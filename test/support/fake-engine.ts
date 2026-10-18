// LumiRPEngine's side of the bridge as its docs/STUDIO.md ("The Studio bridge") defines it, played
// with the pinned engine's studio API and bridge contract: per-user endpoints only the Studio may read (worlds, each
// world's head, world chats), and an install that reads the Studio's offer as the engine, checks
// it as Build's review does, installs it, and attaches it to the chat it names.

import { chatsChannel, ENGINE_EXTENSION, lint, load, offerEndpoint, revisionOf, STUDIO_EXTENSION, worldChannel, worldsChannel } from "lumi-rp-engine/studio";
import type { StudioChats, StudioInstalled, StudioWorldList, StudioWorldRead, WorldDoc } from "lumi-rp-engine/studio";
import { isRecord } from "../../src/shared/json";
import type { JsonValue } from "../../src/shared/json";
import type { FakeRpcPool } from "./fake-host";

function guard(requester: string): void {
  if (requester !== STUDIO_EXTENSION) throw new Error(`only ${STUDIO_EXTENSION} may read this endpoint`);
}

export class FakeEngine {
  /** Worlds by id: their revisions, oldest first. */
  readonly worlds = new Map<string, { name: string; revisions: { id: string; doc: WorldDoc }[] }>();
  /** Chat → the world it plays. */
  readonly attached = new Map<string, { worldId: string; revision: string }>();
  private next = 0;

  constructor(
    private readonly pool: FakeRpcPool,
    private readonly userId: string,
  ) {
    pool.handle(ENGINE_EXTENSION, worldsChannel(userId), [], async (requester): Promise<StudioWorldList> => {
      guard(requester);
      return { v: 1, worlds: [...this.worlds].map(([id, w]) => ({ id, name: w.name, head: w.revisions.at(-1)?.id ?? "", revisions: w.revisions.map((r) => r.id), revisionCount: w.revisions.length })) };
    });
    pool.handle(ENGINE_EXTENSION, chatsChannel(userId), ["chats"], async (requester): Promise<StudioChats> => {
      guard(requester);
      return { v: 1, chats: [...this.attached].map(([chatId, a]) => ({ chatId, worldId: a.worldId, revision: a.revision, status: "idle", place: { id: "home", name: "Home" }, clock: { minutes: 480, label: "Mon 08:00", dayPart: "morning" }, cash: null, present: [], quests: [], at: 1 })) };
    });
  }

  /** A world the user already has, with its head endpoint. */
  addWorld(world: WorldDoc): string {
    const id = world.id;
    this.worlds.set(id, { name: world.name, revisions: [{ id: revisionOf(world), doc: world }] });
    this.pool.handle(ENGINE_EXTENSION, worldChannel(this.userId, id), [], async (requester): Promise<StudioWorldRead> => {
      guard(requester);
      const w = this.worlds.get(id);
      const head = w?.revisions.at(-1);
      if (!w || !head) throw new Error("gone");
      return { v: 1, worldId: id, name: w.name, head: head.id, revision: head.id, world: head.doc };
    });
    return id;
  }

  /** Build's review and Install: reads the offer as the engine, refuses errors, installs, attaches. */
  async install(): Promise<StudioInstalled> {
    const offer = await this.pool.read(offerEndpoint(this.userId), ENGINE_EXTENSION);
    if (!isRecord(offer) || typeof offer.offerId !== "string" || (offer.mode !== "new" && offer.mode !== "revision")) throw new Error("no offer");
    const loaded = load(offer.doc as JsonValue);
    if (!loaded.ok) throw new Error(`not a world: ${loaded.issues.map((i) => i.message).join("; ")}`);
    if (lint(loaded.world).some((i) => i.severity === "error")) throw new Error("the offer has errors");
    let worldId: string;
    if (offer.mode === "new") {
      worldId = `w_installed_${++this.next}`;
      this.addWorld({ ...loaded.world, id: worldId });
    } else {
      worldId = String(offer.worldId);
      const w = this.worlds.get(worldId);
      if (!w) throw new Error("no such world");
      w.revisions.push({ id: revisionOf({ ...loaded.world, id: worldId }), doc: { ...loaded.world, id: worldId } });
    }
    const revision = this.worlds.get(worldId)?.revisions.at(-1)?.id ?? "";
    if (typeof offer.attachChatId === "string" && !this.attached.has(offer.attachChatId)) this.attached.set(offer.attachChatId, { worldId, revision });
    return { offerId: offer.offerId, mode: offer.mode, worldId, revision };
  }
}

