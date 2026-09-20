import type { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import type { AccountService } from "@core/domains/account/services/account-service";
import type { StatementsServices } from "@core/domains/account/statements/embedded/statements-services";
import type { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import type { UserDataKeyLoader } from "@core/ports/encryption";

export class LedgerIngestService {
  constructor(
    private readonly statements: StatementsServices,
    private readonly keys: UserDataKeyLoader,
    private readonly accountService: AccountService,
    private readonly accounts: AccountRepository,
    private readonly transactions: TransactionService
  ) {}

  async ingestUnsyncedForAccount(
    userId: string,
    account: Account,
    shouldCancel: () => boolean
  ): Promise<void> {
    if (shouldCancel()) {
      return;
    }

    await this.accountService.ensureSystemAccounts(userId);

    const unknownAccounts = await this.accounts.findByFilters({ userId, accountType: "unknown" });
    const unknown = unknownAccounts[0];
    if (!unknown) {
      throw new Error("core.transaction.ingest.unknown-missing");
    }

    const dataKey = await this.keys.get(userId);
    const list = this.statements.engine.readAccountStatements({
      userId,
      dataKey,
      account,
    });

    for (const statement of list.statements) {
      if (shouldCancel()) {
        return;
      }
      if (statement.transactionsSynced === true) {
        continue;
      }
      if (!statement.formats.includes("transactions")) {
        continue;
      }

      const buffer = this.statements.engine.readStatementFile({
        userId,
        dataKey,
        accountType: account.accountType,
        accountId: account.id,
        format: "transactions",
        statementDate: statement.statementDate,
      });
      if (buffer === null) {
        continue;
      }

      const csvText = buffer.toString("utf8");
      const importId = await this.transactions.ingestVaultCsv(
        userId,
        account.id,
        unknown.id,
        csvText,
        statement.transactionsImportId
      );

      this.statements.engine.setTransactionsSync({
        userId,
        dataKey,
        account,
        period: statement.statementDate,
        transactionsSynced: true,
        transactionsImportId: importId,
      });
    }
  }
}
