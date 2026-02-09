import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  
  // Remove expired entries
  const validRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  return true;
}

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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.app').split(',');
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    const { type, email, subject, message, attachmentType } = req.body;

    // Validation
    if (!message || !message.trim()) {
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

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Redactify <onboarding@resend.dev>', // Using Resend's onboarding domain (works immediately)
      to: ['sakthivel.hsr06@gmail.com'], // Your email for receiving feedback
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
      message: error.message 
    });
  }
}
