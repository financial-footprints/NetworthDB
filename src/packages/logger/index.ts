import { createRequire } from "node:module";
import type { RayHandle } from "./native.d.ts";

const require = createRequire(import.meta.url);
const { createLogger, Logger, RayManager } = require("./logger.node");

export { createLogger, Logger };
export const ray: RayHandle = new RayManager();
