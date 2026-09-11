import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DATA_KEY_LEN,
  decrypt,
  decryptString,
  encrypt,
  encryptString,
  isEncrypted,
  decodeKey,
} = require("./encryption.node");

export { DATA_KEY_LEN, decodeKey, decrypt, decryptString, encrypt, encryptString, isEncrypted };
