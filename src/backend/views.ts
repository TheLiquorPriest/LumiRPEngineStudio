// A draft as the drawer shows it: the accepted world's counts, ids and problems, the proposal under
// review, and the conversation as lines (each tool call one line).

import { readWorldDoc } from "../engine";
import type { WorldDoc } from "../engine";
import { isRecord } from "../shared/json";
import type { ChatLine, DraftView } from "../shared/protocol";
import type { Draft } from "./drafts";
import { changesBetween, COLLECTIONS } from "./review";

const IDS_SHOWN = 400;
const ISSUES_SHOWN = 200;
const LINES_SHOWN = 400;

function countsOf(world: WorldDoc): Record<string, number> {
  const doc: Record<string, unknown> = { ...world };
  const out: Record<string, number> = {};
  for (const c of COLLECTIONS) {
    const items = doc[c];
    if (isRecord(items) && Object.keys(items).length > 0) out[c] = Object.keys(items).length;
  }
  return out;
}

export function draftView(draft: Draft, running: boolean): DraftView {
  const doc: Record<string, unknown> = { ...draft.doc };
  const ids: Record<string, string[]> = {};
  for (const c of COLLECTIONS) {
    const items = doc[c];
    if (isRecord(items) && Object.keys(items).length > 0) ids[c] = Object.keys(items).slice(0, IDS_SHOWN);
  }
  const issues = readWorldDoc(draft.doc).issues;
  const proposed = draft.proposed ? readWorldDoc(draft.proposed).issues : null;
  const lines: ChatLine[] = draft.chat.flatMap((e): ChatLine[] => {
    if (e.kind === "user" || e.kind === "note") return [{ kind: e.kind, text: e.text, at: e.at }];
    if (e.kind === "assistant") return e.text ? [{ kind: "assistant", text: e.text, at: e.at }] : [];
    return e.results.map((r) => ({ kind: "tool", name: r.name, summary: r.summary, error: r.error, at: e.at }));
  });
  return {
    id: draft.id,
    name: draft.name,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    source: draft.source,
    link: draft.link,
    world: { id: draft.doc.id, name: draft.doc.name, pov: draft.doc.pov },
    counts: countsOf(draft.doc),
    ids,
    issues: issues.slice(0, ISSUES_SHOWN),
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    review:
      draft.proposed && proposed
        ? { changes: changesBetween(draft.doc, draft.proposed), counts: countsOf(draft.proposed), errors: proposed.filter((i) => i.severity === "error").length, warnings: proposed.filter((i) => i.severity === "warning").length }
        : null,
    chat: lines.slice(-LINES_SHOWN),
    running,
    offer: draft.offer,
  };
}
