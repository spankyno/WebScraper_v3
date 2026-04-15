-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  telegram_chat_id TEXT,
  plan TEXT DEFAULT 'anonymous',
  extractions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitored items table
CREATE TABLE monitored_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  target_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2),
  previous_price DECIMAL(10, 2),
  frequency TEXT DEFAULT '24h',
  last_check TIMESTAMP WITH TIME ZONE,
  next_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Price history table
CREATE TABLE price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES monitored_items ON DELETE CASCADE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  method TEXT
);

-- Alerts table
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES monitored_items ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Monitored Items
ALTER TABLE monitored_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own items" ON monitored_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON monitored_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON monitored_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON monitored_items FOR DELETE USING (auth.uid() = user_id);

-- Price History
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view history of own items" ON price_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM monitored_items 
    WHERE monitored_items.id = price_history.item_id 
    AND monitored_items.user_id = auth.uid()
  )
);

-- Alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
