import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const parser = new PostalMime();
    const parsedEmail = await parser.parse(await message.raw);

    const id = crypto.randomUUID();
    const toAddress = message.to.toLowerCase();
    const fromAddress = message.from;
    const subject = parsedEmail.subject || '(No Subject)';
    const bodyText = parsedEmail.text || '';
    const bodyHtml = parsedEmail.html || '';

    // Check if mailbox exists, if not create a default one to avoid foreign key errors
    const exists = await env.DB.prepare(`SELECT address FROM mailboxes WHERE address = ?`).bind(toAddress).first();
    if (!exists) {
      await env.DB.prepare(`INSERT INTO mailboxes (address, token) VALUES (?, ?)`).bind(toAddress, 'auto-created').run();
    }

    await env.DB.prepare(
      `INSERT INTO emails (id, to_address, from_address, subject, body_text, body_html, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'))`
    ).bind(id, toAddress, fromAddress, subject, bodyText, bodyHtml).run();
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Register or verify mailbox
    if (url.pathname === '/api/mailbox' && request.method === 'POST') {
      const data = await request.json();
      const address = data.address.toLowerCase();
      const token = data.token || crypto.randomUUID();

      const existing = await env.DB.prepare(`SELECT * FROM mailboxes WHERE address = ?`).bind(address).first();
      if (!existing) {
        await env.DB.prepare(`INSERT INTO mailboxes (address, token) VALUES (?, ?)`).bind(address, token).run();
      }

      return new Response(JSON.stringify({ success: true, address, token }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/messages') {
      const address = url.searchParams.get('email');
      if (!address) {
        return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });
      }

      const { results } = await env.DB.prepare(
        `SELECT id, from_address, subject, body_text, body_html, created_at 
         FROM emails WHERE to_address = ? ORDER BY created_at DESC LIMIT 20`
      ).bind(address.toLowerCase()).all();

      return new Response(JSON.stringify(results || []), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/test-incoming' && request.method === 'POST') {
      const data = await request.json();
      const id = crypto.randomUUID();
      const toAddress = data.to.toLowerCase();

      // Ensure mailbox exists
      const exists = await env.DB.prepare(`SELECT address FROM mailboxes WHERE address = ?`).bind(toAddress).first();
      if (!exists) {
        await env.DB.prepare(`INSERT INTO mailboxes (address, token) VALUES (?, ?)`).bind(toAddress, 'test-token').run();
      }

      await env.DB.prepare(
        `INSERT INTO emails (id, to_address, from_address, subject, body_text, body_html, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'))`
      ).bind(
        id, 
        toAddress, 
        data.from || 'sender@example.com', 
        data.subject || 'Test Email', 
        data.text || 'Local test message payload.', 
        data.html || '<p>Local test message payload.</p>'
      ).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};