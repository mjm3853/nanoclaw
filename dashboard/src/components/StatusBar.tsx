import { useApi } from '../hooks/useApi';

interface StatusData {
  uptime: number;
  whatsappConnected: boolean;
  activeContainers: number;
  maxContainers: number;
  waitingCount: number;
  registeredGroupCount: number;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StatusBar() {
  const { data } = useApi<StatusData>('/api/status', 5000);

  if (!data) return null;

  return (
    <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2 text-sm">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold tracking-tight">NanoClaw</span>
        <span className="text-zinc-400">
          {formatUptime(data.uptime)} uptime
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${data.whatsappConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
          WA
        </span>
        <span>
          Containers{' '}
          <span className={data.activeContainers > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
            {data.activeContainers}
          </span>
          <span className="text-zinc-500">/{data.maxContainers}</span>
          {data.waitingCount > 0 && (
            <span className="ml-1 text-amber-400">+{data.waitingCount} queued</span>
          )}
        </span>
        <span className="text-zinc-400">
          {data.registeredGroupCount} groups
        </span>
      </div>
    </div>
  );
}
