// The drawer's styles, scoped under `.lres`. Colors come from the text color and translucent
// layers, so the tab sits in any theme.

export const CSS = `
.lres { display: flex; flex-direction: column; gap: 10px; padding: 10px 10px 24px; font-size: 14px; line-height: 1.4; box-sizing: border-box; }
.lres * { box-sizing: border-box; }
.lres-card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.lres-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; }
.lres-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.lres-grow { flex: 1 1 160px; min-width: 0; }
.lres-muted { opacity: 0.7; font-size: 12px; }
.lres-btn { min-height: 34px; padding: 6px 12px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); color: inherit; font: inherit; cursor: pointer; }
.lres-btn:disabled { opacity: 0.45; cursor: default; }
.lres-btn.primary { background: color-mix(in srgb, currentColor 16%, transparent); font-weight: 600; }
.lres-btn.danger { border-color: color-mix(in srgb, #d44 60%, transparent); }
.lres-input { width: 100%; min-height: 34px; padding: 6px 8px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: transparent; color: inherit; font: inherit; }
textarea.lres-input { min-height: 72px; resize: vertical; }
.lres-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.lres-chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: color-mix(in srgb, currentColor 10%, transparent); }
.lres-chat { display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto; }
.lres-line { padding: 6px 8px; border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
.lres-line.user { align-self: flex-end; background: color-mix(in srgb, currentColor 12%, transparent); max-width: 90%; }
.lres-line.assistant { background: color-mix(in srgb, currentColor 5%, transparent); }
.lres-line.tool { font-size: 12px; opacity: 0.8; padding: 2px 8px; }
.lres-line.tool.error { color: #d44; opacity: 1; }
.lres-line.note { font-size: 12px; font-style: italic; opacity: 0.75; }
.lres-issue { font-size: 12px; overflow-wrap: anywhere; }
.lres-issue.error { color: #d44; }
.lres-issue.warning { color: #c80; }
.lres-json { max-height: 320px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; padding: 8px; border-radius: 8px; background: color-mix(in srgb, currentColor 6%, transparent); }
.lres-banner { padding: 8px; border-radius: 8px; background: color-mix(in srgb, #c80 16%, transparent); font-size: 13px; }
.lres-banner.error { background: color-mix(in srgb, #d44 18%, transparent); }
`;
