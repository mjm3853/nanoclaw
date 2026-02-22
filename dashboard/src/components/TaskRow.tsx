import { useState } from 'react';
import { useApi } from '../hooks/useApi';

interface Task {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  next_run: string | null;
  last_run: string | null;
  last_result: string | null;
  status: string;
  created_at: string;
}

interface RunLog {
  task_id: string;
  run_at: string;
  duration_ms: number;
  status: string;
  result: string | null;
  error: string | null;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <span className="text-emerald-400">●</span>;
  if (status === 'paused') return <span className="text-amber-400">●</span>;
  return <span className="text-zinc-500">●</span>;
}

function formatDate(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TaskRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const { data: logs } = useApi<RunLog[]>(
    expanded ? `/api/tasks/${task.id}/logs?limit=10` : '',
  );

  return (
    <div className="border-b border-zinc-700 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="grid w-full grid-cols-[auto_1fr_100px_100px_140px_140px_20px] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-800/50 transition-colors"
      >
        <StatusIcon status={task.status} />
        <span className="truncate text-zinc-200">{task.prompt.slice(0, 80)}</span>
        <span className="font-mono text-xs text-zinc-400">{task.group_folder}</span>
        <span className="text-xs text-zinc-400">
          {task.schedule_type === 'cron' ? task.schedule_value : task.schedule_type}
        </span>
        <span className="text-xs text-zinc-400">{formatDate(task.last_run)}</span>
        <span className="text-xs text-zinc-400">{formatDate(task.next_run)}</span>
        <span className="text-xs text-zinc-500">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && logs && (
        <div className="bg-zinc-900/50 px-4 py-2 space-y-1">
          <div className="text-xs font-medium text-zinc-400 mb-1">Run History</div>
          {logs.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No runs yet</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-xs py-1">
                <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                  {log.status === 'success' ? '✓' : '✗'}
                </span>
                <span className="text-zinc-400">{formatDate(log.run_at)}</span>
                <span className="text-zinc-500">{(log.duration_ms / 1000).toFixed(1)}s</span>
                <span className="truncate text-zinc-300">
                  {log.error || log.result?.slice(0, 100) || '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
