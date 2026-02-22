interface Message {
  id: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_bot_message?: number;
  chat_jid?: string;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageRow({
  message,
  showGroup,
}: {
  message: Message;
  showGroup?: boolean;
}) {
  const isBot = message.is_bot_message === 1 || message.sender === 'bot';

  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="shrink-0 text-xs text-zinc-500 pt-0.5">
        {formatTime(message.timestamp)}
      </span>
      {showGroup && message.chat_jid && (
        <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
          {message.chat_jid.split('@')[0].slice(-6)}
        </span>
      )}
      <span className={`shrink-0 font-medium ${isBot ? 'text-emerald-400' : 'text-blue-400'}`}>
        {message.sender_name || message.sender.split('@')[0]}
      </span>
      <span className="text-zinc-200 break-words min-w-0">{message.content}</span>
    </div>
  );
}
