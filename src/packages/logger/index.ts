import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLogger, Logger } = require("./logger.node");

export { createLogger, Logger };
