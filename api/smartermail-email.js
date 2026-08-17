import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export default async function handler(req, res) {
  const user = process.env.SMARTERMAIL_USER;
  const pass = process.env.SMARTERMAIL_PASS;
  const host = 'mail.fortunfoods.com';
  const port = 993;
  const uid = req.query.uid;

  if (!user || !pass) {
    if (uid) {
      return res.status(200).json({ error: 'SmarterMail not configured' });
    }
    return res.status(200).json([
      { subject: 'SmarterMail not configured', from: 'system', date: new Date().toISOString() }
    ]);
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

      if (uid) {
        // DETAIL MODE — fetch and parse a single email's full content
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
      }

      // LIST MODE — fetch recent messages, filtered to priority senders
      const priorityFrom = [
        'kgf@comcast.net',
        'notifications@vercel.com',
        'github.com',
        'onedrive.com',
        'noreply@paymentus.com',
        'anthropic.com',
        'ralphs@e.ralphsemail.com',
        'store-news@amazon.com',
        'openai.com',
        'edd.ca.gov'
      ];

      let results = [];
      const since = new Date();
      since.setDate(since.getDate() - 1);

      for await (const message of client.fetch(
        { since },
        { envelope: true, uid: true }
      )) {
        const fromAddr = message.envelope.from?.[0]?.address?.toLowerCase() || '';
        const isPriority = priorityFrom.some(p => fromAddr.includes(p));

        results.push({
          uid: message.uid,
          subject: message.envelope.subject || '(no subject)',
          from: fromAddr,
          date: message.envelope.date,
          priority: isPriority
        });
      }

      const priorityOnly = results.filter(m => m.priority);
      const pool = priorityOnly.length > 0 ? priorityOnly : results;

      pool.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      return res.status(200).json(pool.slice(0, 4));

    } finally {
      lock.release();
    }
  } catch (err) {
    console.error('SmarterMail fetch failed:', err);
    if (uid) {
      return res.status(500).json({ error: 'Could not load this email' });
    }
    return res.status(200).json([
      { subject: 'Could not connect to SmarterMail', from: 'system', date: new Date().toISOString() }
    ]);
  } finally {
    try {
      await client.logout();
    } catch {
      // connection may already be closed
    }
  }
}
