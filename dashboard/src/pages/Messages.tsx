import { useCallback, useEffect, useRef, useState } from 'react';
import MessageRow from '../components/MessageRow';
import { useApi } from '../hooks/useApi';
import { useSSE, useSSEEvent } from '../hooks/useSSE';

interface Message {
  id: string;
  chat_jid: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_bot_message?: number;
}

interface GroupOption {
  jid: string;
  name: string;
}

interface SSEMessage {
  chatJid: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filterJid, setFilterJid] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sse = useSSE();

  const { data: groups } = useApi<GroupOption[]>('/api/groups', 30000);

  // Load initial messages for all groups
  useEffect(() => {
    if (!groups) return;
    const fetchAll = async () => {
      const allMessages: Message[] = [];
      for (const group of groups) {
        const res = await fetch(`/api/groups/${encodeURIComponent(group.jid)}/messages?limit=30`);
        if (res.ok) {
          const msgs: Message[] = await res.json();
          allMessages.push(...msgs);
        }
      }
      allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setMessages(allMessages);
    };
    fetchAll();
  }, [groups]);

  // Live updates via SSE
  useSSEEvent<SSEMessage>(sse, 'message:new', useCallback((data: SSEMessage) => {
    const msg: Message = {
      id: `sse-${Date.now()}-${Math.random()}`,
      chat_jid: data.chatJid,
      sender: data.sender,
      sender_name: data.senderName,
      content: data.content,
      timestamp: data.timestamp,
    };
    setMessages((prev) => [...prev.slice(-200), msg]);
  }, []));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filtered = filterJid
    ? messages.filter((m) => m.chat_jid === filterJid)
    : messages;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-700 px-4 py-2">
        <select
          value={filterJid}
          onChange={(e) => setFilterJid(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-sm outline-none ring-1 ring-zinc-600 focus:ring-emerald-500"
        >
          <option value="">All groups</option>
          {groups?.map((g) => (
            <option key={g.jid} value={g.jid}>{g.name}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">{filtered.length} messages</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
        {filtered.map((msg) => (
          <MessageRow key={msg.id} message={msg} showGroup={!filterJid} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
