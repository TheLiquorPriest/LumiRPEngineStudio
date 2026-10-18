// The one door to LumiRPEngine's studio API (`lumi-rp-engine/studio`, pinned in package.json and
// bundled into dist/backend.js). Only the backend comes through it: the frontend never bundles the
// engine.

import { load } from "lumi-rp-engine/studio";
import type { LintIssue, WorldDoc } from "lumi-rp-engine/studio";
import { toJson } from "./shared/json";

export { ENGINE_VERSION, exportFile, newWorld, WORLD_FORMAT } from "lumi-rp-engine/studio";
export type { LintIssue, WorldDoc } from "lumi-rp-engine/studio";

const RANK: Record<LintIssue["severity"], number> = { error: 0, warning: 1, info: 2 };

export type Loaded = { ok: true; world: WorldDoc; issues: LintIssue[] } | { ok: false; issues: LintIssue[] };

/**
 * A world as LumiRPEngine reads one (a file, a world from the engine, a draft about to be
 * offered): a fresh copy, shape-checked, migrated to this engine (maps compiled, missing parts
 * filled) and linted, errors first. The assistant writes drafts piece by piece, so a document the
 * engine can't read comes back as an error rather than a throw.
 */
export function readWorldDoc(input: unknown): Loaded {
  try {
    const loaded = load(typeof input === "string" ? input : toJson(input));
    const issues = [...loaded.issues].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    return loaded.ok ? { ok: true, world: loaded.world, issues } : { ok: false, issues };
  } catch (error) {
    return { ok: false, issues: [{ severity: "error", path: "", code: "unreadable", message: `The engine can't read this world: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}
