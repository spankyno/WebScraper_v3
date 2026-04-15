import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Send, Shield, User, Loader2, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function Configuration({ session }: { session: any }) {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        if (data) setTelegramId(data.telegram_chat_id || '');
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session.user.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramId })
        .eq('id', session.user.id);

      if (error) throw error;
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!telegramId) {
      toast.error('Please enter a Telegram Chat ID first');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Test message sent! Check your Telegram.');
      } else {
        throw new Error(data.error || 'Failed to send test message');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Configuración</span>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Send className="h-5 w-5 text-[#4F46E5]" />
            Telegram Notifications
          </CardTitle>
          <CardDescription className="text-[#8B949E]">Configure where you want to receive price alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Telegram Chat ID</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
              />
              <Button 
                variant="outline" 
                onClick={handleTestConnection} 
                disabled={testing || !telegramId}
                className="border-[#2D333B] bg-[#0F1115] text-[#E6EDF3] hover:bg-[#2D333B] whitespace-nowrap"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Test
              </Button>
            </div>
            <p className="text-[10px] text-[#8B949E]">
              You can get your Chat ID by messaging <code className="bg-[#0F1115] px-1 rounded text-[#E6EDF3]">@userinfobot</code> on Telegram.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Cuenta</span>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="h-5 w-5 text-[#4F46E5]" />
            Account & Preferences
          </CardTitle>
          <CardDescription className="text-[#8B949E]">Manage your account settings and app appearance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0F1115] border border-[#2D333B]">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[#E6EDF3]">Appearance</div>
              <div className="text-xs text-[#8B949E]">Elegant Dark theme is active.</div>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-[#4F46E5]" />
              <Switch checked={true} disabled className="data-[state=checked]:bg-[#4F46E5]" />
            </div>
          </div>
          
          <div className="flex items-center justify-between border-t border-[#2D333B] pt-6">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Account Email</div>
              <div className="text-sm font-medium text-[#E6EDF3]">{session.user.email}</div>
            </div>
            <Badge className="pro-badge-gradient border-0 text-[10px] font-bold uppercase tracking-wider">Pro Plan</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
