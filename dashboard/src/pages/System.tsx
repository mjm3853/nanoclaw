import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useSSE, useSSEEvent } from '../hooks/useSSE';

interface StatusData {
  uptime: number;
  whatsappConnected: boolean;
  activeContainers: number;
  maxContainers: number;
  waitingCount: number;
  registeredGroupCount: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

interface ErrorEvent {
  timestamp: number;
  type: string;
  message: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function System() {
  const { data } = useApi<StatusData>('/api/status', 5000);
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const sse = useSSE();

  useSSEEvent<{ groupJid: string; containerName: string; duration: number; exitCode: number | null }>(
    sse,
    'container:stop',
    useCallback((event) => {
      if (event.exitCode !== null && event.exitCode !== 0) {
        setErrors((prev) =>
          [...prev, {
            timestamp: Date.now(),
            type: 'container:stop',
            message: `Container ${event.containerName} exited with code ${event.exitCode}`,
          }].slice(-50),
        );
      }
    }, []),
  );

  if (!data) return <p className="p-4 text-zinc-400">Loading...</p>;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Uptime" value={formatUptime(data.uptime)} />
        <Stat
          label="WhatsApp"
          value={data.whatsappConnected ? 'Connected' : 'Disconnected'}
        />
        <Stat
          label="Containers"
          value={`${data.activeContainers}/${data.maxContainers}`}
          sub={data.waitingCount > 0 ? `${data.waitingCount} queued` : undefined}
        />
        <Stat label="Groups" value={String(data.registeredGroupCount)} />
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <div className="text-xs font-medium text-zinc-400 mb-3">Memory Usage</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-zinc-500">RSS</div>
            <div className="text-sm font-medium">{formatBytes(data.memoryUsage.rss)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Heap Total</div>
            <div className="text-sm font-medium">{formatBytes(data.memoryUsage.heapTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Heap Used</div>
            <div className="text-sm font-medium">{formatBytes(data.memoryUsage.heapUsed)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">External</div>
            <div className="text-sm font-medium">{formatBytes(data.memoryUsage.external)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <div className="text-xs font-medium text-zinc-400 mb-3">Recent Errors</div>
        {errors.length === 0 ? (
          <p className="text-sm text-zinc-500">No errors in this session.</p>
        ) : (
          <div className="space-y-1">
            {errors.slice(-20).reverse().map((err, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-zinc-500">
                  {new Date(err.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-red-400">{err.type}</span>
                <span className="text-zinc-300">{err.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
