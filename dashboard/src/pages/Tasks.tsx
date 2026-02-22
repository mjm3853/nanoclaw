import TaskRow from '../components/TaskRow';
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

export default function Tasks() {
  const { data: tasks, loading } = useApi<Task[]>('/api/tasks', 10000);

  if (loading) return <p className="p-4 text-zinc-400">Loading tasks...</p>;
  if (!tasks || tasks.length === 0) {
    return <p className="p-4 text-zinc-500">No scheduled tasks.</p>;
  }

  return (
    <div className="p-4">
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_100px_100px_140px_140px_20px] gap-3 px-4 py-2 text-xs font-medium text-zinc-400 border-b border-zinc-700">
          <span></span>
          <span>Prompt</span>
          <span>Group</span>
          <span>Schedule</span>
          <span>Last Run</span>
          <span>Next Run</span>
          <span></span>
        </div>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
