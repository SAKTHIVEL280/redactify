import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, email, subject, message, attachmentType } = req.body;

    // Validation
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
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

${email ? `User Email: ${email}` : 'User Email: Not provided'}
${subject ? `Subject: ${subject}` : ''}
${attachmentType ? `PII Type Missed: ${attachmentType}` : ''}

Message:
${message}

---
Sent from Redactify Feedback System
Timestamp: ${new Date().toISOString()}
    `.trim();

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Redactify <onboarding@resend.dev>', // Using Resend's onboarding domain (works immediately)
      to: [process.env.FEEDBACK_EMAIL || 'your-email@example.com'], // Set FEEDBACK_EMAIL in Vercel env vars
      replyTo: email || undefined,
      subject: `[Redactify] ${feedbackTypeLabels[type]}: ${subject || 'No subject'}`,
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
