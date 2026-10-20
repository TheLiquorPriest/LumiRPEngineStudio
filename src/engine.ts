// The door to LumiRPEngine's authoring API (`lumi-rp-engine/studio`, pinned in package.json and
// bundled into dist/backend.js): loading, linting and exporting worlds. Only the backend comes
// through it. The bridge contract is imported where it's used: from `lumi-rp-engine/studio` in the
// backend, and from `lumi-rp-engine/studio-bridge`, which holds the contract alone, in the frontend,
// so the frontend never bundles the engine.

import { load, migrate } from "lumi-rp-engine/studio";
import type { LintIssue, WorldDoc } from "lumi-rp-engine/studio";
import { jsonEqual } from "./backend/pointer";
import { hasOwn, isRecord, toJson } from "./shared/json";
import type { JsonValue } from "./shared/json";

export { ENGINE_VERSION, exportFile, newWorld, WORLD_FORMAT } from "lumi-rp-engine/studio";
export type { LintIssue, WorldDoc } from "lumi-rp-engine/studio";

const RANK: Record<LintIssue["severity"], number> = { error: 0, warning: 1, info: 2 };
/** How much of a migrated value a `migrated` warning quotes. */
const QUOTED = 400;

export type Loaded = { ok: true; world: WorldDoc; issues: LintIssue[] } | { ok: false; issues: LintIssue[] };

function quote(value: unknown): string {
  const json = JSON.stringify(value);
  return json.length > QUOTED ? `${json.slice(0, QUOTED)}…` : json;
}

/** An entity's parts one level into its fields (`tier`, `fields.owner`, …), so a change names the fields it touched. */
function parts(entity: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (key === "fields" && isRecord(value)) for (const [field, v] of Object.entries(value)) out[`fields.${field}`] = v;
    else out[key] = value;
  }
  return out;
}

/**
 * The world as LumiRPEngine's migration leaves it where the economy runs. The engine converts older
 * money shapes only in a world that configures the economy (`/packs/economy`), and a new draft has
 * none, so a draft without one is converted as if it had one, to find what it holds in an older shape.
 */
function converted(world: WorldDoc): WorldDoc {
  return world.packs.economy ? world : migrate({ ...world, packs: { ...world.packs, economy: { version: 1, config: {} } } });
}

/**
 * What the engine's migration changes in a document's entities. LumiRPEngine converts older shapes
 * (a single money `owner`, a `bills` list, pay fields on a person, a brokerage's units of a symbol)
 * as it loads a world, and says nothing, and only where the world configures the economy; a draft
 * keeps the older shape until it is written again, so each one is reported, with what was written
 * and its current shape.
 */
function migrationIssues(before: JsonValue | string, world: WorldDoc): LintIssue[] {
  if (!isRecord(before) || !isRecord(before.entities)) return [];
  const written = before.entities;
  const after = converted(world);
  const how = world.packs.economy ? "which the engine converts each time it loads the world" : "which the engine converts only in a world that configures the economy (/packs/economy), so in this draft it stays as written and may not work";
  const issues: LintIssue[] = [];
  for (const [id, now] of Object.entries(after.entities)) {
    const was = hasOwn(written, id) ? written[id] : undefined;
    if (jsonEqual(was, now)) continue;
    const path = `entities.${id}`;
    if (!isRecord(was)) {
      issues.push({ severity: "warning", path, code: "migrated", message: `An older shape in this draft stands for the ${now.kind} ${now.name} (${id}), ${how}: write it yourself, with the fields ${quote(now.fields)}, and remove what it came from.` });
      continue;
    }
    const old = parts(was);
    const current = parts(now);
    const keys = [...new Set([...Object.keys(old), ...Object.keys(current)])].filter((k) => !jsonEqual(old[k], current[k]));
    const pick = (from: Record<string, unknown>) => Object.fromEntries(keys.filter((k) => hasOwn(from, k)).map((k) => [k, from[k]]));
    issues.push({ severity: "warning", path, code: "migrated", message: `${now.name} is in an older shape, ${how}: written ${quote(pick(old))}, current ${quote(pick(current))}. Write it the current way.` });
  }
  return issues;
}

/**
 * A world as LumiRPEngine reads one (a file, a world from the engine, a draft about to be
 * offered): a fresh copy, shape-checked, migrated to this engine (maps compiled, missing parts
 * filled, older shapes converted) and linted, errors first, with what it holds in an older shape
 * (`migrated`). The assistant writes drafts piece by piece, so a document the engine can't read
 * comes back as an error rather than a throw.
 */
export function readWorldDoc(input: unknown): Loaded {
  try {
    const json = typeof input === "string" ? input : toJson(input);
    const loaded = load(json);
    const issues = loaded.ok ? [...loaded.issues, ...migrationIssues(json, loaded.world)] : [...loaded.issues];
    issues.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    return loaded.ok ? { ok: true, world: loaded.world, issues } : { ok: false, issues };
  } catch (error) {
    return { ok: false, issues: [{ severity: "error", path: "", code: "unreadable", message: `The engine can't read this world: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}
