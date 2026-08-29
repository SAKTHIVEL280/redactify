/**
 * Best-effort in-memory rate limiting for Vercel Serverless Functions.
 *
 * ⚠️  LIMITATION: Vercel spins up multiple containers that do not share memory.
 *     This rate limiter only works within a single warm container instance.
 *     For production-grade distributed rate limiting, use Upstash Redis:
 *       npm install @upstash/ratelimit @upstash/redis
 *     See: https://upstash.com/blog/vercel-ratelimit
 *
 *     Even so, in-memory rate limiting still provides value:
 *     - Protects against rapid-fire abuse from a single client hitting
 *       the same warm container (which is common on low-traffic endpoints).
 *     - Costs nothing and requires no external service.
 *     - Automatically resets on cold starts (no stale state).
 */

const MAX_STORE_ENTRIES = 10000; // Cap to prevent unbounded memory growth

/**
 * Create a rate limiter instance with configurable window and max requests.
 * @param {number} windowMs - Time window in milliseconds (default 60000 = 1 min)
 * @param {number} maxRequests - Max requests per window per IP (default 5)
 */
export function createRateLimiter(windowMs = 60 * 1000, maxRequests = 5) {
  const store = new Map();

  function cleanup() {
    const now = Date.now();
    // Evict expired entries
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
    // If still too large, evict oldest entries
    if (store.size > MAX_STORE_ENTRIES) {
      const entries = [...store.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toRemove = entries.slice(0, entries.length - MAX_STORE_ENTRIES);
      for (const [key] of toRemove) {
        store.delete(key);
      }
    }
  }

  return function checkRateLimit(ip) {
    const now = Date.now();

    // Periodic cleanup every 100 calls
    if (store.size > MAX_STORE_ENTRIES / 2) {
      cleanup();
    }

    if (!store.has(ip)) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const entry = store.get(ip);

    if (now > entry.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count };
  };
}

/**
 * Extract client IP using Vercel-specific headers first, then standard fallbacks.
 * Vercel sets 'x-vercel-forwarded-for' which is more trustworthy than
 * the generic 'x-forwarded-for' (which can be spoofed by upstream proxies).
 */
export function getClientIp(req) {
  // Vercel-specific header (most reliable on Vercel)
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string' && vercelIp.length > 0) {
    return vercelIp.split(',')[0].trim();
  }

  // Standard proxy header
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.headers['x-real-ip'] || 'unknown';
}

/**
 * Apply rate limit headers and return 429 if limit exceeded.
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} checkRateLimit - Rate limiter function from createRateLimiter
 * @param {number} maxRequests - Max requests for header display
 * @returns {boolean} true if request should be blocked (429 already sent)
 */
export function applyRateLimit(req, res, checkRateLimit, maxRequests = 5) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    const resetIn = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime);
    res.setHeader('Retry-After', resetIn);
    res.status(429).json({
      error: 'Too many requests',
      message: `Please try again in ${resetIn} seconds`,
      retryAfter: resetIn
    });
    return true;
  }

  return false;
}
