import { useCallback, useState } from 'react';
import StatusBar from './components/StatusBar';
import Groups from './pages/Groups';
import Messages from './pages/Messages';
import Tasks from './pages/Tasks';
import System from './pages/System';

type Tab = 'groups' | 'messages' | 'tasks' | 'system';

const tabs: { id: Tab; label: string }[] = [
  { id: 'groups', label: 'Groups' },
  { id: 'messages', label: 'Messages' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'system', label: 'System' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('groups');

  const handleSendMessage = useCallback(async (jid: string, text: string) => {
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(jid)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Send failed:', err.error);
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-white">
      <StatusBar />
      <div className="flex border-b border-zinc-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-emerald-500 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'groups' && <Groups onSendMessage={handleSendMessage} />}
        {activeTab === 'messages' && <Messages />}
        {activeTab === 'tasks' && <Tasks />}
        {activeTab === 'system' && <System />}
      </div>
    </div>
  );
}
