import { useState } from 'react';
import MessageRow from './MessageRow';
import { useApi } from '../hooks/useApi';

interface GroupData {
  jid: string;
  name: string;
  folder: string;
  trigger: string;
  active: boolean;
  idleWaiting: boolean;
  pendingMessages: boolean;
  pendingTaskCount: number;
  containerName: string | null;
  retryCount: number;
}

interface Message {
  id: string;
  chat_jid: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_bot_message?: number;
}

function StatusBadge({ group }: { group: GroupData }) {
  if (group.active && !group.idleWaiting) {
    return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">active</span>;
  }
  if (group.idleWaiting) {
    return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">idle</span>;
  }
  if (group.pendingMessages) {
    return <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">pending</span>;
  }
  return <span className="rounded bg-zinc-600/50 px-1.5 py-0.5 text-xs text-zinc-400">offline</span>;
}

export default function GroupCard({
  group,
  onSendMessage,
}: {
  group: GroupData;
  onSendMessage?: (jid: string, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const { data: messages } = useApi<Message[]>(
    expanded ? `/api/groups/${encodeURIComponent(group.jid)}/messages?limit=20` : '',
    expanded ? 3000 : undefined,
  );

  const handleSend = () => {
    if (!input.trim() || !onSendMessage) return;
    onSendMessage(group.jid, input.trim());
    setInput('');
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium">{group.name}</span>
          <StatusBadge group={group} />
          {group.retryCount > 0 && (
            <span className="text-xs text-red-400">retry #{group.retryCount}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="font-mono">{group.folder}</span>
          {group.pendingTaskCount > 0 && (
            <span className="text-amber-400">{group.pendingTaskCount} tasks queued</span>
          )}
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-700">
          <div className="max-h-80 overflow-y-auto px-4 py-2 space-y-1">
            {messages && messages.length > 0 ? (
              messages.map((msg) => <MessageRow key={msg.id} message={msg} />)
            ) : (
              <p className="py-4 text-center text-sm text-zinc-500">No recent messages</p>
            )}
          </div>

          {onSendMessage && (
            <div className="flex gap-2 border-t border-zinc-700 px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Send a message through the agent..."
                className="flex-1 rounded bg-zinc-900 px-3 py-1.5 text-sm outline-none ring-1 ring-zinc-600 focus:ring-emerald-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
