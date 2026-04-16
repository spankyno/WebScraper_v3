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

function deepFindPrice(obj: any): any {
  if (!obj || typeof obj !== 'object') return null;
  
  // Priority keys first
  const priorityKeys = ['price', 'unitPrice', 'currentPrice', 'amount', 'value'];
  for (const key of priorityKeys) {
    if (obj[key] !== undefined && (typeof obj[key] === 'number' || typeof obj[key] === 'string')) {
      const p = parsePrice(obj[key].toString());
      if (p !== null) return p;
    }
  }

  for (const key in obj) {
    const value = obj[key];
    if (
      key.toLowerCase().includes('price') &&
      (typeof value === 'number' || typeof value === 'string')
    ) {
      const p = parsePrice(value.toString());
      if (p !== null) return p;
    }
    const found = deepFindPrice(value);
    if (found) return found;
  }
  return null;
}

function extractAllJSON(html: string): any[] {
  const matches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (!matches) return [];
  const results = [];
  for (const m of matches) {
    try {
      const content = m.replace(/<script[^>]*>|<\/script>/g, '').trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        const json = JSON.parse(content);
        results.push(json);
      }
    } catch {}
  }
  return results;
}

export async function fetchParser(url: string, selector?: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let priceRaw: any = null;
    let productName = '';

    // 1. Try Universal JSON Extraction (NEXT_DATA, JSON-LD, etc)
    const allJSON = extractAllJSON(html);
    for (const j of allJSON) {
      const p = deepFindPrice(j);
      if (p !== null) {
        priceRaw = p;
        break;
      }
    }

    // 2. Fallback to selectors if JSON fails
    if (priceRaw === null) {
      if (selector) {
        priceRaw = $(selector).first().text() || $(selector).first().attr('content') || $(selector).first().attr('data-price') || '';
      }

      if (!priceRaw) {
        const priceSelectors = [
          '[data-testid*="price"]',
          '[class*="price"]:not([class*="was"]):not([class*="old"])',
          '[id*="price"]',
          '[itemprop="price"]', 
          'meta[property="product:price:amount"]',
          'meta[name="twitter:data1"]',
          '.price',
          '.current-price',
          '.a-price-whole'
        ];
        for (const sel of priceSelectors) {
          const el = $(sel).first();
          if (el.length) {
            const val = el.attr('content') ?? el.attr('data-price') ?? el.text();
            if (val) {
              priceRaw = val;
              break;
            }
          }
        }
      }
    }

    const finalPrice = typeof priceRaw === 'number' ? priceRaw : parsePrice(priceRaw);

    if (!productName) {
      productName = $('h1[itemprop="name"]').first().text().trim() || 
                    $('#productTitle').text().trim() || 
                    $('h1').first().text().trim() || 
                    $('title').text().trim();
    }

    const bodyText = $('body').text().toLowerCase();
    const inStock = !bodyText.includes('agotado') && !bodyText.includes('out of stock') && !bodyText.includes('no disponible');

    return {
      success: true,
      url,
      method: 'fetch-light',
      price: finalPrice,
      productName,
      inStock,
      durationMs: Date.now() - t0
    };
  } catch (e: any) {
    return { success: false, error: e.message, method: 'fetch-light' };
  }
}
