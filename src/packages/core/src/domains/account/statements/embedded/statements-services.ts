import type { StatementEngine } from "@core/ports/statement-engine";

export type StatementsServices = {
  engine: StatementEngine;
  trace: boolean;
};
