import GroupCard from '../components/GroupCard';
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

export default function Groups({
  onSendMessage,
}: {
  onSendMessage: (jid: string, text: string) => void;
}) {
  const { data: groups, loading } = useApi<GroupData[]>('/api/groups', 5000);

  if (loading) return <p className="p-4 text-zinc-400">Loading groups...</p>;
  if (!groups || groups.length === 0) {
    return <p className="p-4 text-zinc-500">No registered groups yet.</p>;
  }

  return (
    <div className="space-y-2 p-4">
      {groups.map((group) => (
        <GroupCard key={group.jid} group={group} onSendMessage={onSendMessage} />
      ))}
    </div>
  );
}
