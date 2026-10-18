// Markdown imported as text (`import guide from "…/ASSISTANT-GUIDE.md" with { type: "text" }`):
// Bun bundles the file's contents as a string.
declare module "*.md" {
  const text: string;
  export default text;
}
