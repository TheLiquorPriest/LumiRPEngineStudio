// The user's Studio settings (`userStorage/settings.json`): the connection the assistant runs on,
// and how many model calls one message may take. A stored value that isn't one is the default.

import { isRecord } from "../shared/json";
import type { StudioSettings } from "../shared/protocol";
import type { StudioHost } from "./host";

export const DEFAULT_SETTINGS: StudioSettings = { connectionId: null, maxRounds: 40 };
/** The most model calls a message may take: a whole conversion fits well under it. */
export const MAX_ROUNDS = 120;

function clampRounds(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.min(MAX_ROUNDS, Math.round(n))) : DEFAULT_SETTINGS.maxRounds;
}

export class SettingsStore {
  constructor(private readonly host: StudioHost) {}

  async get(userId: string): Promise<StudioSettings> {
    const text = await this.host.storage.read("settings.json", userId);
    let raw: unknown = null;
    try {
      raw = text === null ? null : JSON.parse(text);
    } catch {
      raw = null;
    }
    if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
    return { connectionId: typeof raw.connectionId === "string" && raw.connectionId !== "" ? raw.connectionId : null, maxRounds: clampRounds(raw.maxRounds) };
  }

  async set(userId: string, patch: { connectionId?: string | null; maxRounds?: number }): Promise<StudioSettings> {
    const current = await this.get(userId);
    const next: StudioSettings = {
      connectionId: patch.connectionId === undefined ? current.connectionId : patch.connectionId || null,
      maxRounds: patch.maxRounds === undefined ? current.maxRounds : clampRounds(patch.maxRounds),
    };
    await this.host.storage.write("settings.json.tmp", JSON.stringify(next), userId);
    await this.host.storage.move("settings.json.tmp", "settings.json", userId);
    return next;
  }
}
