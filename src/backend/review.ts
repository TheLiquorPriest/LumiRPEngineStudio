// Review, then accept: the assistant works on a proposal, and nothing reaches the draft until the
// user accepts it. A change is an item of a collection (`/entities/mara`), a part (`/calendar`) or a
// top-level field (`/pov`), named by its JSON Pointer; the user accepts all of them, some or none.

import type { WorldDoc } from "../engine";
import { hasOwn, isRecord } from "../shared/json";
import type { ChangeView } from "../shared/protocol";
import { jsonEqual, parsePointer, pointerOf } from "./pointer";

/** The collections of a world (`lre-world-v1`): objects keyed by id, reviewed item by item. */
export const COLLECTIONS: readonly string[] = ["packs", "kinds", "relations", "entities", "places", "routes", "grids", "maps", "rules", "actions", "checks", "schedules", "tracks", "tables", "sections", "steps", "lore", "classifications", "tiers"];
const IS_COLLECTION: Record<string, true> = Object.fromEntries(COLLECTIONS.map((c) => [c, true]));

/** An item's own name, for the review line. */
function nameOf(item: unknown): string | null {
  if (!isRecord(item)) return null;
  for (const key of ["name", "title", "label"]) if (typeof item[key] === "string" && item[key] !== "") return item[key];
  return null;
}

/** Every change from the accepted draft to the proposal, collections item by item, in document order. */
export function changesBetween(doc: WorldDoc, proposed: WorldDoc): ChangeView[] {
  const a: Record<string, unknown> = { ...doc };
  const b: Record<string, unknown> = { ...proposed };
  const out: ChangeView[] = [];
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
    const before = hasOwn(a, key) ? a[key] : undefined;
    const after = hasOwn(b, key) ? b[key] : undefined;
    if (IS_COLLECTION[key] && isRecord(before) && isRecord(after)) {
      for (const id of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
        const was = hasOwn(before, id) ? before[id] : undefined;
        const now = hasOwn(after, id) ? after[id] : undefined;
        if (jsonEqual(was, now)) continue;
        const name = nameOf(now) ?? nameOf(was);
        out.push({ key: pointerOf([key, id]), label: `${key} › ${name && name !== id ? `${name} (${id})` : id}`, kind: was === undefined ? "added" : now === undefined ? "removed" : "changed" });
      }
      continue;
    }
    if (jsonEqual(before, after)) continue;
    out.push({ key: pointerOf([key]), label: key, kind: before === undefined ? "added" : after === undefined ? "removed" : "changed" });
  }
  return out;
}

/** The accepted draft with the picked changes taken from the proposal (all of them when `keys` is null). */
export function acceptChanges(doc: WorldDoc, proposed: WorldDoc, keys: readonly string[] | null): WorldDoc {
  if (keys === null) return structuredClone(proposed);
  const out: Record<string, unknown> = structuredClone({ ...doc });
  const from: Record<string, unknown> = { ...proposed };
  for (const key of keys) {
    const [top, id, ...rest] = parsePointer(key);
    if (top === undefined || rest.length > 0) continue;
    const source = hasOwn(from, top) ? from[top] : undefined;
    if (id === undefined) {
      if (source === undefined) delete out[top];
      else out[top] = structuredClone(source);
      continue;
    }
    if (!IS_COLLECTION[top]) continue;
    const target = isRecord(out[top]) ? out[top] : (out[top] = {});
    const item = isRecord(source) && hasOwn(source, id) ? source[id] : undefined;
    if (item === undefined) delete target[id];
    else target[id] = structuredClone(item);
  }
  return out as unknown as WorldDoc;
}
