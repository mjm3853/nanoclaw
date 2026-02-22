import fs from 'fs';
import http from 'http';
import path from 'path';

import { DASHBOARD_PORT } from '../config.js';
import {
  getAllChats,
  getAllRegisteredGroups,
  getAllTasks,
  getMessagesForDashboard,
  getTaskById,
  getTaskRunLogs,
  storeMessageDirect,
} from '../db.js';
import { GroupQueue } from '../group-queue.js';
import { logger } from '../logger.js';
import { Channel } from '../types.js';
import { dashboardEvents, DashboardEventMap } from './events.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const startedAt = Date.now();

// Rate limiting for POST /api/groups/:jid/send
const rateLimitWindow = 60_000;
const rateLimitMax = 10;
const rateLimitHits: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  while (rateLimitHits.length > 0 && rateLimitHits[0] < now - rateLimitWindow) {
    rateLimitHits.shift();
  }
  if (rateLimitHits.length >= rateLimitMax) return false;
  rateLimitHits.push(now);
  return true;
}

export interface DashboardDependencies {
  queue: GroupQueue;
  channels: Channel[];
  registeredGroups: () => Record<string, import('../types.js').RegisteredGroup>;
  isWhatsAppConnected: () => boolean;
  enqueueMessageCheck: (jid: string) => void;
}

let deps: DashboardDependencies;

// SSE clients
const sseClients = new Set<http.ServerResponse>();

function sendSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

// Wire dashboard events → SSE
function wireEvents(): void {
  const eventNames: (keyof DashboardEventMap)[] = [
    'message:new',
    'container:start',
    'container:stop',
    'container:output',
    'task:run',
    'task:complete',
    'queue:update',
  ];
  for (const name of eventNames) {
    dashboardEvents.on(name, (payload) => sendSSE(name, payload));
  }
}

// Route table: [method, pattern, handler]
type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

function route(method: string, path: string, handler: RouteHandler): Route {
  const keys: string[] = [];
  const patternStr = path.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${patternStr}$`), keys, handler };
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const routes: Route[] = [
  route('GET', '/api/status', (_req, res) => {
    const snapshot = deps.queue.getSnapshot();
    const groups = deps.registeredGroups();
    json(res, {
      uptime: Date.now() - startedAt,
      whatsappConnected: deps.isWhatsAppConnected(),
      activeContainers: snapshot.activeCount,
      maxContainers: snapshot.maxConcurrent,
      waitingCount: snapshot.waitingCount,
      registeredGroupCount: Object.keys(groups).length,
      memoryUsage: process.memoryUsage(),
    });
  }),

  route('GET', '/api/groups', (_req, res) => {
    const groups = deps.registeredGroups();
    const snapshot = deps.queue.getSnapshot();
    const snapshotByJid = new Map(snapshot.groups.map((g) => [g.jid, g]));

    const result = Object.entries(groups).map(([jid, group]) => {
      const queueState = snapshotByJid.get(jid);
      return {
        jid,
        ...group,
        active: queueState?.active ?? false,
        idleWaiting: queueState?.idleWaiting ?? false,
        pendingMessages: queueState?.pendingMessages ?? false,
        pendingTaskCount: queueState?.pendingTaskCount ?? 0,
        containerName: queueState?.containerName ?? null,
        retryCount: queueState?.retryCount ?? 0,
      };
    });
    json(res, result);
  }),

  route('GET', '/api/groups/:jid/messages', (req, res, params) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const since = url.searchParams.get('since') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const groups = deps.registeredGroups();
    const jid = decodeURIComponent(params.jid);
    if (!groups[jid]) {
      json(res, { error: 'Group not registered' }, 404);
      return;
    }

    const messages = getMessagesForDashboard(jid, since, limit);
    json(res, messages.reverse()); // Reverse so oldest-first
  }),

  route('GET', '/api/chats', (_req, res) => {
    json(res, getAllChats());
  }),

  route('GET', '/api/tasks', (_req, res) => {
    json(res, getAllTasks());
  }),

  route('GET', '/api/tasks/:id', (_req, res, params) => {
    const task = getTaskById(params.id);
    if (!task) {
      json(res, { error: 'Task not found' }, 404);
      return;
    }
    json(res, task);
  }),

  route('GET', '/api/tasks/:id/logs', (req, res, params) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const logs = getTaskRunLogs(params.id, limit);
    json(res, logs);
  }),

  route('GET', '/api/events', (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n'); // SSE comment as keepalive

    sseClients.add(res);
    res.on('close', () => sseClients.delete(res));
  }),

  route('POST', '/api/groups/:jid/send', async (req, res, params) => {
    if (!checkRateLimit()) {
      json(res, { error: 'Rate limit exceeded (10 req/min)' }, 429);
      return;
    }

    const jid = decodeURIComponent(params.jid);
    const groups = deps.registeredGroups();
    if (!groups[jid]) {
      json(res, { error: 'Group not registered' }, 404);
      return;
    }

    let body: { text?: string };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, { error: 'Invalid JSON body' }, 400);
      return;
    }

    if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      json(res, { error: 'Missing or empty "text" field' }, 400);
      return;
    }

    const msgId = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();

    storeMessageDirect({
      id: msgId,
      chat_jid: jid,
      sender: 'dashboard',
      sender_name: 'Dashboard',
      content: body.text.trim(),
      timestamp,
      is_from_me: false,
      is_bot_message: false,
    });

    deps.enqueueMessageCheck(jid);

    json(res, { ok: true, messageId: msgId });
  }),
];

function matchRoute(
  method: string,
  pathname: string,
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = pathname.match(r.pattern);
    if (match) {
      const params: Record<string, string> = {};
      r.keys.forEach((key, i) => {
        params[key] = match[i + 1];
      });
      return { handler: r.handler, params };
    }
  }
  return null;
}

function serveStaticFile(
  res: http.ServerResponse,
  filePath: string,
): void {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error('Not a file');
    const content = fs.readFileSync(filePath);
    const headers: Record<string, string> = { 'Content-Type': mime };
    if (ext === '.html') {
      headers['Content-Security-Policy'] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:";
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for non-API, non-file routes
    const indexPath = path.join(path.dirname(filePath), '..', 'index.html');
    try {
      const content = fs.readFileSync(
        filePath.endsWith('index.html') ? filePath : indexPath,
      );
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

export function startDashboard(dependencies: DashboardDependencies): void {
  deps = dependencies;
  wireEvents();

  const distDir = path.resolve(
    import.meta.dirname,
    '../../dashboard/dist',
  );

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // API routes
    if (pathname.startsWith('/api/')) {
      const matched = matchRoute(method, pathname);
      if (matched) {
        try {
          await matched.handler(req, res, matched.params);
        } catch (err) {
          logger.error({ err, path: pathname }, 'Dashboard API error');
          if (!res.headersSent) json(res, { error: 'Internal server error' }, 500);
        }
      } else {
        json(res, { error: 'Not found' }, 404);
      }
      return;
    }

    // Static files (production build)
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath =
      safePath === '/' || safePath === ''
        ? path.join(distDir, 'index.html')
        : path.join(distDir, safePath);

    // Ensure we don't serve files outside distDir
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    serveStaticFile(res, filePath);
  });

  server.listen(DASHBOARD_PORT, '127.0.0.1', () => {
    logger.info({ port: DASHBOARD_PORT }, 'Dashboard server started');
  });
}
