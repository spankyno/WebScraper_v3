import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { fetchParser } from './src/lib/scrapers/fetchParser';
import { browserlessScraper } from './src/lib/scrapers/browserless';
import { geminiScraper } from './src/lib/scrapers/gemini';
import { hybridScraper, suggestMethod } from './src/lib/scrapers/hybrid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- API Routes ---

app.post('/api/scrape', async (req, res) => {
  console.log(`[API] Scrape request received for URL: ${req.body.url}`);
  const { url, method, selector, instruction } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    let result;
    switch (method) {
      case 'fetch-light': result = await fetchParser(url, selector); break;
      case 'browserless': result = await browserlessScraper(url, selector); break;
      case 'gemini': result = await geminiScraper(url, instruction); break;
      default: result = await hybridScraper(url, selector, instruction);
    }

    if (result.success) {
      res.json({ ...result, suggestedMethod: suggestMethod(url) });
    } else {
      res.status(422).json({ error: result.error || 'Extraction failed' });
    }
  } catch (e: any) {
    console.error('[API] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Note: /api/cron is handled by api/cron.ts on Vercel, 
// but we can keep a simple version here for local testing if needed.
app.post('/api/cron', async (req, res) => {
  // For local testing, you can trigger the cron logic
  res.status(501).json({ error: 'Cron local trigger not implemented in server.ts. Use api/cron.ts for Vercel.' });
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
