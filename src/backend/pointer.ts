// JSON Pointers (RFC 6901) and JSON Patch operations (RFC 6902) on a draft, for the assistant's
// draft_read and draft_patch tools. A patch applies to a copy, all of its operations or none, and
// every refusal says where and why, so the model can correct it.

import { hasOwn, isRecord } from "../shared/json";
import type { JsonValue } from "../shared/json";

export type PatchOp =
  | { op: "add"; path: string; value: JsonValue }
  | { op: "replace"; path: string; value: JsonValue }
  | { op: "test"; path: string; value: JsonValue }
  | { op: "remove"; path: string }
  | { op: "move"; from: string; path: string }
  | { op: "copy"; from: string; path: string };

export class PatchError extends Error {
  constructor(
    readonly index: number,
    message: string,
  ) {
    super(`operation ${index + 1}: ${message}`);
    this.name = "PatchError";
  }
}

/** A key a document may hold: never one that reaches an object's prototype. */
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

/** The tokens of a pointer: `""` is the whole document; `/entities/a~1b` is `["entities", "a/b"]`. */
export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`"${pointer}" isn't a JSON Pointer (it starts with "/", or is "" for the whole draft)`);
  return pointer
    .slice(1)
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** A pointer from tokens (the inverse of `parsePointer`). */
export function pointerOf(tokens: readonly string[]): string {
  return tokens.map((t) => `/${t.replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

function arrayIndex(token: string, length: number, forAdd: boolean): number {
  if (forAdd && token === "-") return length;
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new Error(`"${token}" isn't an array index`);
  const index = Number(token);
  if (index > length || (!forAdd && index === length)) throw new Error(`index ${index} is past the end (length ${length})`);
  return index;
}

/** The value at a pointer, or undefined when nothing is there. */
export function getAt(doc: JsonValue, tokens: readonly string[]): JsonValue | undefined {
  let at: JsonValue | undefined = doc;
  for (const token of tokens) {
    if (Array.isArray(at)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) return undefined;
      at = at[Number(token)];
    } else if (isRecord(at)) {
      at = hasOwn(at, token) ? at[token] : undefined;
    } else return undefined;
    if (at === undefined) return undefined;
  }
  return at;
}

/** The container a pointer's last token lives in, and that token; the whole document has none. */
function parentOf(doc: JsonValue, tokens: readonly string[], what: string): { parent: JsonValue; key: string } {
  if (tokens.length === 0) throw new Error(`${what} needs a path inside the draft, not the whole draft`);
  const parent = getAt(doc, tokens.slice(0, -1));
  if (parent === undefined || (!Array.isArray(parent) && !isRecord(parent))) throw new Error(`there is no object or list at ${pointerOf(tokens.slice(0, -1)) || "the top"} to hold it`);
  return { parent, key: tokens[tokens.length - 1] ?? "" };
}

/** Deep equality of JSON values, whatever the order of their keys. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (isRecord(a) && isRecord(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => hasOwn(b, k) && jsonEqual(a[k], b[k]));
  }
  return false;
}

function insert(doc: JsonValue, tokens: readonly string[], value: JsonValue, replace: boolean): JsonValue {
  if (tokens.length === 0) return value;
  const { parent, key } = parentOf(doc, tokens, replace ? "replace" : "add");
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, !replace);
    if (replace) parent[index] = value;
    else parent.splice(index, 0, value);
    return doc;
  }
  if (!isRecord(parent)) throw new Error("not an object");
  if (UNSAFE.has(key)) throw new Error(`"${key}" can't be a key`);
  if (replace && !hasOwn(parent, key)) throw new Error(`nothing at ${pointerOf(tokens)} to replace (use add)`);
  parent[key] = value;
  return doc;
}

function removeAt(doc: JsonValue, tokens: readonly string[]): JsonValue {
  const { parent, key } = parentOf(doc, tokens, "remove");
  if (Array.isArray(parent)) {
    parent.splice(arrayIndex(key, parent.length, false), 1);
    return doc;
  }
  if (!isRecord(parent) || !hasOwn(parent, key)) throw new Error(`nothing at ${pointerOf(tokens)} to remove`);
  delete parent[key];
  return doc;
}

/** Reads one operation from what the model sent, or says what's wrong with it. */
export function readOp(raw: unknown, index: number): PatchOp {
  if (!isRecord(raw)) throw new PatchError(index, "not an object");
  const { op, path, from, value } = raw;
  if (typeof path !== "string") throw new PatchError(index, "needs a path (a JSON Pointer string)");
  if (op === "remove") return { op, path };
  if (op === "add" || op === "replace" || op === "test") {
    if (value === undefined) throw new PatchError(index, `${op} needs a value`);
    return { op, path, value: value as JsonValue };
  }
  if (op === "move" || op === "copy") {
    if (typeof from !== "string") throw new PatchError(index, `${op} needs a from (a JSON Pointer string)`);
    return { op, from, path };
  }
  throw new PatchError(index, `unknown op ${JSON.stringify(op)} (add, remove, replace, move, copy or test)`);
}

/** Applies the operations to a copy of the document, all or none. */
export function applyPatch(doc: JsonValue, ops: readonly PatchOp[]): JsonValue {
  let out = structuredClone(doc);
  ops.forEach((op, index) => {
    try {
      const tokens = parsePointer(op.path);
      if (op.op === "add") out = insert(out, tokens, structuredClone(op.value), false);
      else if (op.op === "replace") out = insert(out, tokens, structuredClone(op.value), true);
      else if (op.op === "remove") out = removeAt(out, tokens);
      else if (op.op === "test") {
        if (!jsonEqual(getAt(out, tokens), op.value)) throw new Error(`the value at ${op.path || "the top"} isn't the one given`);
      } else {
        const fromTokens = parsePointer(op.from);
        const value = getAt(out, fromTokens);
        if (value === undefined) throw new Error(`nothing at ${op.from} to ${op.op}`);
        if (op.op === "move") {
          if (op.path.startsWith(`${op.from}/`)) throw new Error("can't move a value into itself");
          out = removeAt(out, fromTokens);
        }
        out = insert(out, tokens, structuredClone(value), false);
      }
    } catch (error) {
      throw error instanceof PatchError ? error : new PatchError(index, error instanceof Error ? error.message : String(error));
    }
  });
  return out;
}
