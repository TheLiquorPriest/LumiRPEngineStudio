// Requests to the backend and the pushes it sends: each request gets its `result` or `error` by
// `reqId` (or a timeout), and drafts and assistant activity arrive as pushes.

import { isRecord } from "../shared/json";
import type { BackendToFrontend, FrontendToBackend, RequestType, ResultBodies } from "../shared/protocol";
import { PROTOCOL } from "../shared/protocol";

type Body<K extends RequestType> = Omit<Extract<FrontendToBackend, { type: K }>, "studio" | "reqId">;
export type Push = Extract<BackendToFrontend, { type: "draft" | "activity" | "drafts" }>;

const TIMEOUT_MS = 60_000;

export class Client {
  private seq = 0;
  private readonly pending = new Map<string, { resolve(body: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private readonly listeners = new Set<(push: Push) => void>();
  private readonly off: () => void;

  constructor(
    private readonly send: (message: FrontendToBackend) => void,
    subscribe: (handler: (message: unknown) => void) => () => void,
  ) {
    this.off = subscribe((message) => this.receive(message));
  }

  request<K extends RequestType>(body: Body<K> & { type: K }): Promise<ResultBodies[K]> {
    const reqId = `q${++this.seq}`;
    return new Promise<ResultBodies[K]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error("The Studio's backend didn't answer in time."));
      }, TIMEOUT_MS);
      this.pending.set(reqId, { resolve: (value) => resolve(value as ResultBodies[K]), reject, timer });
      this.send({ ...body, studio: PROTOCOL, reqId } as FrontendToBackend);
    });
  }

  onPush(listener: (push: Push) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private receive(raw: unknown): void {
    if (!isRecord(raw) || raw.studio !== PROTOCOL || typeof raw.type !== "string") return;
    const message = raw as BackendToFrontend;
    if (message.type === "result" || message.type === "error") {
      const waiting = this.pending.get(message.reqId);
      if (!waiting) return;
      this.pending.delete(message.reqId);
      clearTimeout(waiting.timer);
      if (message.type === "result") waiting.resolve(message.body);
      else waiting.reject(new Error(message.message));
      return;
    }
    for (const listener of this.listeners) listener(message);
  }

  dispose(): void {
    this.off();
    for (const waiting of this.pending.values()) clearTimeout(waiting.timer);
    this.pending.clear();
    this.listeners.clear();
  }
}
