// Frontend entry: the "RPEngine Studio" drawer tab, the client to the backend, and the open chat.

import { render } from "preact";
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { FrontendToBackend } from "../shared/protocol";
import { App } from "./app";
import type { FrontendHost } from "./app";
import { Client } from "./client";
import { CSS } from "./styles";

const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9"/><path d="M16 16l5 5"/></svg>`;

export function setup(ctx: SpindleFrontendContext): () => void {
  const cleanups: (() => void)[] = [];
  cleanups.push(ctx.dom.addStyle(CSS));
  const client = new Client((message: FrontendToBackend) => ctx.sendToBackend(message), (handler) => ctx.onBackendMessage(handler));
  cleanups.push(() => client.dispose());
  const host: FrontendHost = {
    activeChat: () => ctx.getActiveChat().chatId,
    onChatChange(listener) {
      const offs = ["CHAT_CHANGED", "CHAT_SWITCHED"].map((event) => ctx.events.on(event, listener));
      return () => offs.forEach((off) => off());
    },
    download(fileName, text) {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
  const tab = ctx.ui.registerDrawerTab({
    id: "rpengine-studio",
    title: "RPEngine Studio",
    shortName: "Studio",
    headerTitle: "RPEngine Studio",
    description: "Build LumiRPEngine worlds with an assistant, or convert this chat and its lore into one",
    keywords: ["world", "lumirpengine", "convert", "assistant", "lore"],
    iconSvg: ICON,
  });
  render(<App client={client} host={host} />, tab.root);
  cleanups.push(() => {
    render(null, tab.root);
    tab.destroy();
  });
  return () => {
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.warn("[LumiRPEngine Studio] cleanup failed", error);
      }
    }
  };
}
