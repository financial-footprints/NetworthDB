import type {
  accountDataSchema,
  accountDetailsDataSchema,
  accountTypeSchema,
} from "@platform/http/endpoints/accounts/index";
import type { meDetailsSchema } from "@platform/http/endpoints/auth/account";
import type { advCtxSchema } from "@platform/http/endpoints/auth/recovery";
import type { sessionTokenSchema } from "@platform/http/endpoints/auth/session";
import type { jobDataSchema } from "@platform/http/endpoints/jobs";
import type { sourcesSchema } from "@platform/http/endpoints/sources";
import type { z } from "zod";

type DataEnvelopeSchema = z.ZodObject<{ data: z.ZodTypeAny }>;
type EnvelopeData<T extends DataEnvelopeSchema> = z.output<T> extends { data: infer D } ? D : never;

export type AccountType = z.infer<typeof accountTypeSchema>;
export type AccountApi = z.infer<typeof accountDataSchema>;
export type AccountDetailsApi = z.infer<typeof accountDetailsDataSchema>;
export type MeDetailsApi = EnvelopeData<typeof meDetailsSchema>;
export type SessionTokenApi = EnvelopeData<typeof sessionTokenSchema>;
export type JobApi = z.infer<typeof jobDataSchema>;
export type SourcesApi = EnvelopeData<typeof sourcesSchema>;
export type AdvancedRecoveryContextApi = EnvelopeData<typeof advCtxSchema>;
