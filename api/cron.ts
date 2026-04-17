import { createClient } from '@supabase/supabase-js';
import { hybridScraper } from '../src/lib/scrapers/hybrid.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Simple auth for cron
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: items, error } = await supabaseAdmin
      .from('monitored_items')
      .select('*, profiles(monitoring_paused)')
      .eq('active', true)
      .lte('next_check', new Date().toISOString())
      .order('next_check', { ascending: true })
      .limit(10); // Process in batches to avoid Vercel timeouts

    if (error) throw error;

    let checked = 0;
    let alerts = 0;

    for (const item of items) {
      // Skip if the user has paused monitoring
      if ((item.profiles as any)?.monitoring_paused === true) {
        continue;
      }

      try {
        let result;
        const proxyUrl = process.env.SCRAPER_PROXY_URL;
        
        if (proxyUrl) {
          console.log(`[Cron] Forwarding ${item.id} to Scraper Proxy: ${proxyUrl}`);
          const proxyRes = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, method: 'hybrid' }),
            signal: AbortSignal.timeout(25000)
          });
          
          if (proxyRes.ok) {
            result = await proxyRes.json();
          } else {
            console.error(`[Cron] Proxy failed for ${item.id}, falling back to local`);
            result = await hybridScraper(item.url);
          }
        } else {
          result = await hybridScraper(item.url);
        }

        const nextCheckDate = new Date();
        const hours = parseInt(item.frequency) || 1;
        nextCheckDate.setHours(nextCheckDate.getHours() + hours);

        if (result && result.success) {
          checked++;
          const oldPrice = item.current_price;
          const newPrice = result.price;

          // Update item with success
          await supabaseAdmin
            .from('monitored_items')
            .update({
              current_price: newPrice,
              previous_price: oldPrice,
              last_check: new Date().toISOString(),
              next_check: nextCheckDate.toISOString()
            })
            .eq('id', item.id);

          // Record history
          await supabaseAdmin.from('price_history').insert({
            item_id: item.id,
            price: newPrice,
            method: result.method
          });

          // Check for alerts
          if (newPrice < oldPrice || newPrice <= item.target_price) {
            alerts++;
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

            // Send Telegram if configured
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
            }
          }
        } else {
          // Even if scrape fails, we must move next_check forward 
          // to prevent blocking the queue with failing items
          console.error(`[Cron] Scrape failed for ${item.id}: ${result?.error || 'Unknown error'}`);
          await supabaseAdmin
            .from('monitored_items')
            .update({
              last_check: new Date().toISOString(),
              next_check: nextCheckDate.toISOString()
            })
            .eq('id', item.id);
        }
      } catch (itemError: any) {
        console.error(`[Cron] Error processing item ${item.id}:`, itemError.message);
      }
    }

    res.status(200).json({ checked, alerts });
  } catch (e: any) {
    console.error('Cron error:', e);
    res.status(500).json({ 
      error: 'Cron failed', 
      details: e.message || String(e) 
    });
  }
}
