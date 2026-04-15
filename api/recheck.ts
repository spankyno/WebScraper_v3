import { createClient } from '@supabase/supabase-js';
import { hybridScraper } from '../src/lib/scrapers/hybrid.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'Item ID required' });

  try {
    // 1. Get item
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('monitored_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) throw new Error('Item not found');

    // 2. Scrape price
    let result;
    const proxyUrl = process.env.SCRAPER_PROXY_URL;
    
    if (proxyUrl) {
      console.log(`[Recheck] Forwarding to Scraper Proxy: ${proxyUrl}`);
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url, method: 'hybrid' }),
        signal: AbortSignal.timeout(25000)
      });
      
      if (proxyRes.ok) {
        result = await proxyRes.json();
      } else {
        console.error(`[Recheck] Proxy failed, falling back to local`);
        result = await hybridScraper(item.url);
      }
    } else {
      result = await hybridScraper(item.url);
    }

    if (!result || !result.success) throw new Error(result?.error || 'Scrape failed');

    const newPrice = result.price;
    const oldPrice = item.current_price;

    // 3. Update item
    const { error: updateError } = await supabaseAdmin
      .from('monitored_items')
      .update({
        current_price: newPrice,
        previous_price: oldPrice,
        last_check: new Date().toISOString()
      })
      .eq('id', itemId);

    if (updateError) throw updateError;

    // 4. Record history
    await supabaseAdmin.from('price_history').insert({
      item_id: itemId,
      price: newPrice,
      method: result.method
    });

    // 5. Check for alerts
    let alertSent = false;
    // Condition: Price drop OR target reached
    if (newPrice < oldPrice || newPrice <= item.target_price) {
      const isTargetReached = newPrice <= item.target_price;
      const message = isTargetReached 
        ? `🎯 Target Reached! ${item.name} is now ${newPrice}€ (Target: ${item.target_price}€)`
        : `📉 Price Drop! ${item.name} is now ${newPrice}€ (Previous: ${oldPrice}€)`;
      
      await supabaseAdmin.from('alerts').insert({
        user_id: item.user_id,
        item_id: item.id,
        message,
        type: isTargetReached ? 'target_reached' : 'price_drop'
      });

      // Send Telegram
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', item.user_id)
        .single();

      if (profile?.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: message + `\nURL: ${item.url}`
          })
        });
        alertSent = true;
      }
    }

    res.status(200).json({ 
      success: true, 
      price: newPrice, 
      alertSent,
      method: result.method 
    });

  } catch (e: any) {
    console.error('[Recheck API] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
