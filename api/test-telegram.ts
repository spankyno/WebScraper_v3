export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { telegramId } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured on the server.' });
  }

  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram Chat ID is required.' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: '✅ Test Connection: Your WebScraper bot is correctly configured!'
      })
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: data.description || 'Failed to send message' });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
