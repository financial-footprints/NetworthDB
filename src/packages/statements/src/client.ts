import { createRequire } from "node:module";
import type * as Native from "../native.d.ts";

const require = createRequire(import.meta.url);

export const native = require("../statements.node") as typeof Native;
