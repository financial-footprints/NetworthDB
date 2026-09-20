import { serializeJobCreated } from "@api/routes/jobs/serializer";
import type { ApiServices } from "@ndb/bootstrap";
import { JobScope } from "@ndb/core";

type RulesApplyBody = {
  from?: string;
  to?: string;
  accountId?: string;
  word?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagId?: string;
  dryRun: boolean;
};

type RulesApplyServices = Pick<
  ApiServices,
  "jobRunnerService" | "ruleEngineService" | "transactionService"
>;

export async function submitRulesApplyJob(
  services: RulesApplyServices,
  userId: string,
  mode: { type: "rule"; ruleId: string } | { type: "group"; groupId: string },
  body: RulesApplyBody
) {
  const scope =
    mode.type === "rule"
      ? JobScope.create({ ruleId: mode.ruleId })
      : JobScope.create({ groupId: mode.groupId });

  const job = await services.jobRunnerService.submit(
    userId,
    "rules_apply",
    scope,
    async (_jobId, shouldCancel) => {
      const result = await services.ruleEngineService.applyManual({
        userId,
        mode,
        filters: {
          from: body.from,
          to: body.to,
          accountId: body.accountId,
          word: body.word,
          categoryId: body.categoryId,
          subcategoryId: body.subcategoryId,
          tagId: body.tagId,
        },
        dryRun: body.dryRun,
        shouldCancel,
      });

      if (!result.dryRun && result.accountIds.length > 0) {
        await services.transactionService.rebuildSummariesForAccounts(
          userId,
          result.accountIds,
          result.earliestDate
        );
      }

      return {
        output: {
          warnings: [],
          rules: {
            matched: result.matched,
            mutated: result.mutated,
            deleted: result.deleted,
            skipped: result.skipped,
            dryRun: result.dryRun,
          },
        },
      };
    }
  );

  return serializeJobCreated(job.id);
}
