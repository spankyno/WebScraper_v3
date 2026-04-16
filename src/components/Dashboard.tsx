import Extraction from './Extraction';
import MonitoredItems from './MonitoredItems';
import Alerts from './Alerts';
import Configuration from './Configuration';

export default function Dashboard({ 
  session, 
  activeTab, 
  setActiveTab 
}: { 
  session: any, 
  activeTab: string, 
  setActiveTab: (tab: string) => void 
}) {
  return (
    <div className="space-y-6">
      {activeTab === 'extraction' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Extraction session={session} onMonitor={() => setActiveTab('monitored')} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MonitoredItems session={session} />
              
              {/* Tech Stack & Features Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="bg-[#1A1D23] border border-[#2D333B] rounded-xl p-6">
                  <h3 className="text-sm font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />
                    Tecnologías Utilizadas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {['React 18', 'Next.js', 'Supabase', 'Cloudflare Workers', 'Tailwind CSS', 'Recharts', 'Lucide Icons', 'Shadcn UI'].map(tech => (
                      <span key={tech} className="px-2 py-1 rounded bg-[#0F1115] border border-[#2D333B] text-[10px] font-medium text-[#8B949E]">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1A1D23] border border-[#2D333B] rounded-xl p-6">
                  <h3 className="text-sm font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    Funcionalidades Clave
                  </h3>
                  <ul className="space-y-2">
                    {[
                      'Scraper Híbrido (Fetch + Browser + AI)',
                      'Parser Universal de JSON (Next.js/React)',
                      'Alertas en Tiempo Real vía Telegram',
                      'Monitoreo con Frecuencia Personalizada',
                      'Dashboard de Actividad 24h'
                    ].map(feat => (
                      <li key={feat} className="text-[10px] text-[#8B949E] flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-[#2D333B]" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <Alerts session={session} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monitored' && (
        <div className="animate-in fade-in duration-500">
          <MonitoredItems session={session} />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="animate-in fade-in duration-500">
          <Alerts session={session} />
        </div>
      )}

      {activeTab === 'config' && (
        <div className="animate-in fade-in duration-500">
          <Configuration session={session} />
        </div>
      )}
    </div>
  );
}

