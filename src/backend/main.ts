// The composition root: drafts, settings, the LumiRPEngine bridge, the assistant and the
// dispatcher over a host (the real one in dist/backend.js, a fake one in tests).

import { Assistant } from "./assistant";
import { EngineBridge } from "./bridge";
import { Dispatcher } from "./dispatch";
import { DraftStore } from "./drafts";
import type { StudioHost } from "./host";
import { SettingsStore } from "./settings";
import { PROTOCOL } from "../shared/protocol";

export interface Studio {
  drafts: DraftStore;
  settings: SettingsStore;
  bridge: EngineBridge;
  assistant: Assistant;
  dispatch: Dispatcher;
}

export function startStudio(host: StudioHost): Studio {
  const drafts = new DraftStore(host);
  const settings = new SettingsStore(host);
  const bridge = new EngineBridge(host);
  let dispatch: Dispatcher | null = null;
  const assistant = new Assistant(
    host,
    drafts,
    settings,
    bridge,
    async (userId, draftId) => dispatch?.push(userId, draftId),
    (userId, draftId, line) => host.frontend.send({ studio: PROTOCOL, type: "activity", draftId, line }, userId),
  );
  dispatch = new Dispatcher(host, drafts, settings, bridge, assistant);
  dispatch.start();
  host.log("info", "[LumiRPEngine Studio] backend started");
  return { drafts, settings, bridge, assistant, dispatch };
}
