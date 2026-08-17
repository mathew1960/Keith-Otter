import { ImapFlow } from 'imapflow';

export default async function handler(req, res) {
  const user = process.env.SMARTERMAIL_USER;
  const pass = process.env.SMARTERMAIL_PASS;
  const host = 'mail.fortunfoods.com';
  const port = 993;

  if (!user || !pass) {
    return res.status(200).json([
      { subject: 'SmarterMail not configured', from: 'system', date: new Date().toISOString() }
    ]);
  }

  const priorityFrom = [
    'kgf@comcast.net',
    'notifications@vercel.com',
    'github.com',
    'onedrive.com',
    'noreply@paymentus.com'
  ];

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
    let results = [];

    try {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      for await (const message of client.fetch(
        { since },
        { envelope: true }
      )) {
        const fromAddr = message.envelope.from?.[0]?.address?.toLowerCase() || '';
        const isPriority = priorityFrom.some(p => fromAddr.includes(p));

        results.push({
          subject: message.envelope.subject || '(no subject)',
          from: fromAddr,
          date: message.envelope.date,
          priority: isPriority
        });
      }
    } finally {
      lock.release();
    }

    // Only show priority senders (keeps promo/newsletter clutter out),
    // and rank by recency within that group — NOT by priority-first —
    // so old priority emails can't permanently crowd out newer ones.
    const priorityOnly = results.filter(m => m.priority);
    const pool = priorityOnly.length > 0 ? priorityOnly : results;

    pool.sort((a, b) => new Date(b.date) - new Date(a.date));

    await client.logout();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json(pool.slice(0, 4));
  } catch (err) {
    console.error('SmarterMail fetch failed:', err);
    return res.status(200).json([
      { subject: 'Could not connect to SmarterMail', from: 'system', date: new Date().toISOString() }
    ]);
  }
}
