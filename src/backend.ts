// Backend entry (`dist/backend.js`): the host loads this module in the extension's worker.

import { startStudio } from "./backend/main";
import { createSpindleHost } from "./backend/spindle-host";

startStudio(createSpindleHost());
