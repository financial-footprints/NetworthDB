/** Bank handlers for cleanup and metadata. All manifest bank/variant paths registered in `registry.ts`. */
export type { BankHandler } from "@statements/banks/handlers/base";
export type { BankHandlerKey } from "@statements/banks/handlers/registry";
export {
  getHandler,
  getMailSubjects,
  listHandlers,
} from "@statements/banks/handlers/registry";
