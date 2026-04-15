import * as cheerio from 'cheerio';

export function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[€$£¥\s]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export async function fetchParser(url: string, selector?: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let priceRaw = '';
    if (selector) {
      priceRaw = $(selector).first().text() || $(selector).first().attr('content') || $(selector).first().attr('data-price') || '';
    }

    if (!priceRaw) {
      const priceSelectors = ['[itemprop="price"]', '[class*="price"]:not([class*="was"])', '.a-price-whole', 'meta[property="product:price:amount"]'];
      for (const sel of priceSelectors) {
        const el = $(sel).first();
        if (el.length) {
          priceRaw = el.attr('content') ?? el.attr('data-price') ?? el.text();
          if (priceRaw) break;
        }
      }
    }

    const price = parsePrice(priceRaw);
    const productName = $('h1[itemprop="name"]').first().text().trim() || $('#productTitle').text().trim() || $('h1').first().text().trim() || $('title').text().trim();
    
    const bodyText = $('body').text().toLowerCase();
    const inStock = !bodyText.includes('agotado') && !bodyText.includes('out of stock') && !bodyText.includes('no disponible');

    return {
      success: true,
      url,
      method: 'fetch-light',
      price,
      productName,
      inStock,
      durationMs: Date.now() - t0
    };
  } catch (e: any) {
    return { success: false, error: e.message, method: 'fetch-light' };
  }
}
