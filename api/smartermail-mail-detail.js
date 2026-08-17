import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export default async function handler(req, res) {
  const user = process.env.SMARTERMAIL_USER;
  const pass = process.env.SMARTERMAIL_PASS;
  const host = 'mail.fortunfoods.com';
  const port = 993;

  const uid = req.query.uid;
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }

  if (!user || !pass) {
    return res.status(200).json({ error: 'SmarterMail not configured' });
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const { content } = await client.download(uid, undefined, { uid: true });
      const parsed = await simpleParser(content);

      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      return res.status(200).json({
        subject: parsed.subject || '(no subject)',
        from: parsed.from?.text || '',
        date: parsed.date,
        text: parsed.text || '',
        html: parsed.html || null
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error('SmarterMail detail fetch failed:', err);
    return res.status(500).json({ error: 'Could not load this email' });
  } finally {
    try {
      await client.logout();
    } catch {
      // connection may already be closed
    }
  }
}
