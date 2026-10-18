// JSON values and the record guard. Drafts, offers and every message between the frontend, the
// backend and LumiRPEngine are plain JSON.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

/** True for a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Own-property lookup, so a key from outside never reaches the prototype chain. */
export function hasOwn(o: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

/** A deep copy of a value as JSON: functions, `undefined` and non-finite numbers drop out. */
export function toJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined && typeof v !== "function") out[k] = toJson(v);
    return out;
  }
  return null;
}
