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
            <div className="lg:col-span-2">
              <MonitoredItems session={session} />
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

