export type Plan = 'anonymous' | 'pro';

export interface Profile {
  id: string;
  telegram_chat_id?: string;
  plan: Plan;
  extractions_count: number;
}

export interface MonitoredItem {
  id: string;
  user_id: string;
  url: string;
  name: string;
  target_price: number;
  current_price: number;
  previous_price: number;
  frequency: '1h' | '6h' | '24h' | '72h';
  last_check: string;
  next_check: string;
  active: boolean;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  item_id: string;
  price: number;
  timestamp: string;
  method: string;
}

export interface Alert {
  id: string;
  user_id: string;
  item_id: string;
  message: string;
  timestamp: string;
  type: 'price_drop' | 'target_reached' | 'error';
}

export interface ScrapeResult {
  price: number;
  name: string;
  method: string;
  success: boolean;
  error?: string;
}
