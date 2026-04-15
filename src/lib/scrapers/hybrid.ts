import { fetchParser } from './fetchParser.js';
import { browserlessScraper } from './browserless.js';
import { geminiScraper } from './gemini.js';

export async function hybridScraper(url: string, selector?: string, instruction?: string) {
  const errors: string[] = [];
  const startTime = Date.now();
  const MAX_TIME = 9500; // 9.5s total for Vercel Hobby

  try {
    // 1. Fetch Light
    const f = await fetchParser(url, selector);
    if (f.success && f.price !== null) return f;
    errors.push(`fetch: ${f.error || 'no price'}`);

    // Check remaining time
    if (Date.now() - startTime > MAX_TIME - 3000) {
       return { success: false, error: errors.join(' | ') + ' | timeout before browserless', method: 'hybrid' };
    }

    // 2. Browserless
    const b = await browserlessScraper(url, selector);
    if (b.success && b.price !== null) return b;
    errors.push(`browserless: ${b.error || 'no price'}`);

    // Check remaining time
    if (Date.now() - startTime > MAX_TIME - 3000) {
       return { success: false, error: errors.join(' | ') + ' | timeout before gemini', method: 'hybrid' };
    }

    // 3. Gemini
    const g = await geminiScraper(url, instruction);
    if (g.success && g.price !== null) return g;
    errors.push(`gemini: ${g.error || 'no price'}`);

    return { success: false, error: errors.join(' | '), method: 'hybrid' };
  } catch (e: any) {
    return { success: false, error: `Hybrid fatal: ${e.message}`, method: 'hybrid' };
  }
}

export function suggestMethod(url: string): string {
  const u = url.toLowerCase();
  const jsRequired = [
    'amazon.', 'zara.com', 'mango.com', 'zalando.', 
    'mediamarkt.', 'pccomponentes.', 'elcorteingles.',
    'carrefour.es', 'alcampo.es', 'primor.eu'
  ];
  return jsRequired.some(d => u.includes(d)) ? 'browserless' : 'fetch-light';
}
