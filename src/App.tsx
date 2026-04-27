import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { Loader2, Globe, Search, Activity, Bell, Settings, LogOut, User } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('extraction');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F1115]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  const ThemeProviderAny = ThemeProvider as any;

  return (
    <ThemeProviderAny attribute="class" defaultTheme="dark" forcedTheme="dark">
      <div className="min-h-screen bg-[#0F1115] text-[#E6EDF3] font-sans antialiased flex">
        {!session ? (
          <main className="flex-1 flex items-center justify-center p-4">
            <Auth />
          </main>
        ) : (
          <>
            {/* Sidebar */}
            <aside className="w-[220px] border-r border-[#2D333B] p-6 flex flex-col gap-8 sticky top-0 h-screen">
              <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
                <Globe className="h-5 w-5 text-[#4F46E5]" />
                <span>Web<span className="text-[#4F46E5]">Scraper</span> v3</span>
              </div>

              <nav className="flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab('extraction')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === 'extraction' ? 'bg-[#4F46E5] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1A1D23]'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  Extracción
                </button>
                <button
                  onClick={() => setActiveTab('monitored')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === 'monitored' ? 'bg-[#4F46E5] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1A1D23]'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  Monitorización
                </button>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === 'alerts' ? 'bg-[#4F46E5] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1A1D23]'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Alertas
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === 'config' ? 'bg-[#4F46E5] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1A1D23]'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Configuración
                </button>
              </nav>

              <div className="mt-auto pt-4 border-t border-[#2D333B] space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[#8B949E] flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                    Telegram Bot Online
                  </p>
                  <p className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold">
                    Supabase: prod-01
                  </p>
                </div>
                
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <div className="pro-badge-gradient px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white">
                  Pro Account
                </div>
              </div>

              <Dashboard session={session} activeTab={activeTab} setActiveTab={setActiveTab} />

              {/* Footer */}
              <footer className="mt-auto pt-12 pb-6 border-t border-[#2D333B]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-bold">
                      <Globe className="h-4 w-4 text-[#4F46E5]" />
                      <span>Web<span className="text-[#4F46E5]">Scraper</span></span>
                    </div>
                    <p className="text-xs text-[#8B949E] leading-relaxed max-w-xs">
                      Herramienta profesional de monitorización de precios y extracción de datos en tiempo real.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-[#E6EDF3] uppercase tracking-wider">Contacto</h4>
                      <div className="flex flex-col gap-2">
                        <a href="mailto:blog.cottage627@passinbox.com" className="text-xs text-[#8B949E] hover:text-[#4F46E5] transition-colors flex items-center gap-2">
                          <LogOut className="h-3 w-3 rotate-180" />
                          Email
                        </a>
                        <a href="https://aitor-blog-contacto.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B949E] hover:text-[#4F46E5] transition-colors flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Contacto
                        </a>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-[#E6EDF3] uppercase tracking-wider">Recursos</h4>
                      <div className="flex flex-col gap-2">
                        <a href="https://aitorsanchez.pages.dev/" target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B949E] hover:text-[#4F46E5] transition-colors flex items-center gap-2">
                          <Globe className="h-3 w-3" />
                          Blog
                        </a>
                        <a href="https://aitorhub.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B949E] hover:text-[#4F46E5] transition-colors flex items-center gap-2">
                          <Settings className="h-3 w-3" />
                          Más apps
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-[#2D333B]/50">
                  <p className="text-[10px] text-[#8B949E]">
                    Aitor Sánchez Gutiérrez © 2026 - Reservados todos los derechos
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-[#8B949E] flex items-center gap-1">
                      <div className="h-1 w-1 rounded-full bg-[#10B981]" />
                      System Status: Operational
                    </span>
                  </div>
                </div>
              </footer>
            </main>
          </>
        )}
        <Toaster position="top-right" theme="dark" />
      </div>
    </ThemeProviderAny>
  );
}

