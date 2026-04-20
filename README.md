# Web Scraper Monitoring & Alerts

A professional, full-stack price monitoring application built with **React**, **Next.js**, and **Supabase**. It features a hybrid scraping engine capable of extracting data from complex SPAs and anti-bot protected websites.

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Shadcn UI, Recharts, Lucide Icons.
- **Backend**: Next.js Serverless Functions (Vercel), Cloudflare Workers.
- **Database & Auth**: Supabase (PostgreSQL + Real-time).
- **Scraping Engine**: 
  - **Smart Fetch**: Universal JSON extraction (JSON-LD, NEXT_DATA, window state).
  - **Browserless**: Headless Chrome with API interception and network monitoring.
  - **Gemini AI**: Vision-based extraction fallback using screenshots.
- **Notifications**: Telegram Bot API integration.
- **Automation**: Scheduled Cron jobs via Cloudflare Workers.

## ✨ Key Features

- **Hybrid Scraper**: Automatically switches between light fetch, headless browser, and AI vision to ensure successful price extraction.
- **Universal JSON Parser**: Deep-searches internal site data (Next.js, React states) to find prices hidden from the DOM.
- **Real-time Monitoring**: Track products with custom frequencies (1h, 6h, 24h, 72h).
- **Smart Alerts**: Receive instant Telegram notifications when a price drops or reaches your target.
- **Activity Dashboard**: Visual 24h activity chart and user statistics.
- **Anti-Bot Bypass**: Uses rotating fingerprints and proxy workers to overcome scraper blocks.
- **Mobile Responsive**: Polished dark-mode UI optimized for all devices.

## ✨ Cron de Cludflare

- **Cron**: Proyecto vinculado con el worker de Cludflare web-scraper-proxy [https://dash.cloudflare.com/6f5636e3dec79c2be9b823f2b5aaf4b5/workers/services/view/web-scraper-proxy/production](https://dash.cloudflare.com/6f5636e3dec79c2be9b823f2b5aaf4b5/workers/services/view/web-scraper-proxy/production)
- Necesario que tenga activo el evento de activación (trigger): Cron: */30 * * * *
- 
