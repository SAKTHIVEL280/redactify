import { Resend } from 'resend';
import { createRateLimiter, getClientIp, applyRateLimit } from '../lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 5); // 5 req/min/IP

// Input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 5000); // Limit to 5000 chars
}

function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.daeq.in,http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  const isVercelPreview = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = !origin || allowedOrigins.includes(origin) || isVercelPreview || process.env.NODE_ENV !== 'production';

  if (origin) {
    if (!isAllowed) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting by IP
  if (applyRateLimit(req, res, checkRateLimit, 5)) return;

  try {
    const feedbackTo = process.env.FEEDBACK_TO_EMAIL || 'sakthivel.hsr06@gmail.com';
    const senderEmail = 'onboarding@resend.dev';

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ 
        error: 'Email service not configured',
        message: 'RESEND_API_KEY environment variable is missing on server.' 
      });
    }

    const { type, email, subject, message, attachmentType } = req.body || {};

    // Validation
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Sanitize inputs
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedSubject = sanitizeInput(subject || 'No subject');
    const sanitizedEmail = email ? sanitizeInput(email) : null;
    
    // Validate email if provided
    if (sanitizedEmail && !isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate type
    const validTypes = ['feedback', 'bug', 'missing_pii', 'improvement'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }

    // Build email content
    const feedbackTypeLabels = {
      feedback: 'General Feedback',
      bug: 'Bug Report',
      missing_pii: 'Missed PII Detection',
      improvement: 'Feature Request'
    };

    const emailContent = `
New ${feedbackTypeLabels[type] || 'Feedback'} from Redactify

${sanitizedEmail ? `User Email: ${sanitizedEmail}` : 'User Email: Not provided'}
${sanitizedSubject ? `Subject: ${sanitizedSubject}` : ''}
${attachmentType ? `PII Type Missed: ${attachmentType}` : ''}

Message:
${sanitizedMessage}

---
Sent from Redactify Feedback System
Timestamp: ${new Date().toISOString()}
    `.trim();

    // Lazy Resend initialization
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email using Resend
    const data = await resend.emails.send({
      from: `Redactify <${senderEmail}>`,
      to: [feedbackTo],
      replyTo: sanitizedEmail || undefined,
      subject: `[Redactify] ${feedbackTypeLabels[type]}: ${sanitizedSubject || 'No subject'}`,
      text: emailContent,
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Feedback sent successfully',
      id: data.id 
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return res.status(500).json({ 
      error: 'Failed to send feedback',
      message: error.message || 'Internal server error'
    });
  }
}

