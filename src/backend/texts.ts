// The two texts the assistant looks things up in, bundled into dist/backend.js: the conversion
// guide (docs/ASSISTANT-GUIDE.md, also the core of its system prompt) and LumiRPEngine's
// reference (assets/REFERENCE.md, copied from the pinned engine by `bun run reference`). A lookup
// returns the sections that best match a query, headings counting most.

import guideText from "../../docs/ASSISTANT-GUIDE.md" with { type: "text" };
import referenceText from "../../assets/REFERENCE.md" with { type: "text" };

export const GUIDE = guideText;

export interface Section {
  /** The heading trail: "Economy pack (`economy`) › Kinds › `account`: Account". */
  title: string;
  body: string;
}

/** Splits markdown at its headings (outside code fences) into sections with their heading trail. */
export function sectionsOf(markdown: string): Section[] {
  const out: Section[] = [];
  const trail: string[] = [];
  let body: string[] = [];
  let fenced = false;
  const flush = () => {
    const text = body.join("\n").trim();
    if (trail.length > 0 && text !== "") out.push({ title: trail.filter((t) => t !== "").join(" › "), body: text });
    body = [];
  };
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const depth = (heading[1] ?? "#").length;
      trail.length = depth - 1;
      for (let i = 0; i < depth - 1; i++) trail[i] ??= "";
      trail[depth - 1] = (heading[2] ?? "").trim();
    } else body.push(line);
  }
  flush();
  return out;
}

const guideSections = sectionsOf(guideText);
const referenceSections = sectionsOf(referenceText);

function terms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9_.]+/).filter((t) => t.length >= 2))];
}

function count(haystack: string, needle: string): number {
  let n = 0;
  for (let at = haystack.indexOf(needle); at >= 0 && n < 20; at = haystack.indexOf(needle, at + needle.length)) n++;
  return n;
}

/** The sections that best match the query, each clipped, within `budget` characters in all. */
export function lookup(sections: readonly Section[], query: string, limit = 4, budget = 9000): string {
  const words = terms(query);
  if (words.length === 0) return "Give a few words to look up.";
  const phrase = query.toLowerCase().trim();
  const scored = sections
    .map((s, i) => {
      const title = s.title.toLowerCase();
      const body = s.body.toLowerCase();
      let score = 0;
      for (const w of words) score += 6 * count(title, w) + Math.min(8, count(body, w));
      if (phrase.length > 3 && (title.includes(phrase) || body.includes(phrase))) score += 10;
      // Every word present beats a few words many times.
      if (words.every((w) => title.includes(w) || body.includes(w))) score += 4 * words.length;
      return { s, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit);
  if (scored.length === 0) return `Nothing matches "${query}". Try other words, or a kind, field, effect or function name.`;
  const each = Math.floor(budget / scored.length);
  return scored.map(({ s }) => `## ${s.title}\n${s.body.length > each ? `${s.body.slice(0, each)}\n…` : s.body}`).join("\n\n");
}

export function lookupGuide(query: string): string {
  return lookup(guideSections, query);
}

export function lookupReference(query: string): string {
  return lookup(referenceSections, query);
}
