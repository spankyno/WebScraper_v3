import { createClient } from '@supabase/supabase-js';
import { hybridScraper } from '../src/lib/scrapers/hybrid';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Simple auth for cron
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer \${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: items, error } = await supabaseAdmin
      .from('monitored_items')
      .select('*')
      .eq('active', true)
      .lte('next_check', new Date().toISOString());

    if (error) throw error;

    let checked = 0;
    let alerts = 0;

    for (const item of items) {
      const result = await hybridScraper(item.url);
      if (result && result.success) {
        checked++;
        const oldPrice = item.current_price;
        const newPrice = result.price;

        // Update item
        const nextCheckDate = new Date();
        const hours = parseInt(item.frequency);
        nextCheckDate.setHours(nextCheckDate.getHours() + hours);

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
          const message = `🚨 Price Drop! \${item.name} is now \${newPrice} (Target: \${item.target_price})`;
          
          await supabaseAdmin.from('alerts').insert({
            user_id: item.user_id,
            item_id: item.id,
            message,
            type: newPrice <= item.target_price ? 'target_reached' : 'price_drop'
          });

          // Send Telegram if configured
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('telegram_chat_id')
            .eq('id', item.user_id)
            .single();

          if (profile?.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            await fetch(`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: profile.telegram_chat_id,
                text: message + `\nURL: \${item.url}`
              })
            });
          }
        }
      }
    }

    res.status(200).json({ checked, alerts });
  } catch (e: any) {
    console.error('Cron error:', e);
    res.status(500).json({ error: 'Cron failed' });
  }
}
