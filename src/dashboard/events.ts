import { EventEmitter } from 'events';

export interface DashboardEventMap {
  'message:new': {
    chatJid: string;
    sender: string;
    senderName: string;
    content: string;
    timestamp: string;
  };
  'container:start': {
    groupJid: string;
    containerName: string;
    groupFolder: string;
  };
  'container:stop': {
    groupJid: string;
    containerName: string;
    duration: number;
    exitCode: number | null;
  };
  'container:output': {
    groupJid: string;
    text: string;
  };
  'task:run': {
    taskId: string;
    groupFolder: string;
  };
  'task:complete': {
    taskId: string;
    durationMs: number;
    status: string;
    error: string | null;
  };
  'queue:update': {
    activeCount: number;
    waitingCount: number;
    groups: Array<{
      jid: string;
      active: boolean;
      idleWaiting: boolean;
      pendingMessages: boolean;
      pendingTaskCount: number;
    }>;
  };
}

class DashboardEventEmitter extends EventEmitter {
  emit<K extends keyof DashboardEventMap>(
    event: K,
    payload: DashboardEventMap[K],
  ): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof DashboardEventMap>(
    event: K,
    listener: (payload: DashboardEventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }
}

export const dashboardEvents = new DashboardEventEmitter();
