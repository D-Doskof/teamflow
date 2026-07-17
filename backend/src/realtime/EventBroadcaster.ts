import { Response } from 'express';

// Abstraction: callers (TaskService, the SSE route) depend on this contract, not on how
// fan-out is actually implemented — a future WebSocket or Redis pub/sub broadcaster could
// implement the same interface without touching a single caller.
export interface IEventBroadcaster {
  subscribe(clientId: string, res: Response): void;
  unsubscribe(clientId: string): void;
  broadcast(event: string, data: Record<string, unknown>): void;
}

export class SseBroadcaster implements IEventBroadcaster {
  // Encapsulation: the connected-clients map is nobody's business but this class's —
  // callers only ever see subscribe/unsubscribe/broadcast.
  private readonly clients = new Map<string, Response>();

  subscribe(clientId: string, res: Response): void {
    this.clients.set(clientId, res);
  }

  unsubscribe(clientId: string): void {
    this.clients.delete(clientId);
  }

  broadcast(event: string, data: Record<string, unknown>): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, res] of this.clients) {
      try {
        res.write(message);
      } catch {
        // client disconnected — next heartbeat/close handler will clean it up
      }
    }
  }
}

// Stand-in composition root until container.ts wires this through proper constructor
// injection (see the container.ts task) — both the SSE route and TaskService import this
// single shared instance directly for now instead of TaskService reaching into ../routes.
export const sseBroadcaster: IEventBroadcaster = new SseBroadcaster();
