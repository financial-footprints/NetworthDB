import type {
  CleanupAccountResult,
  MetadataAccountResult,
  ParseAccountResult,
} from "@statements/pipeline/stages/cleanup/models";

/** Per-stage results from `runPipeline`. */
export type PipelineResult = {
  extract?: unknown;
  /** Set when IMAP extract failed but cleanup continued (staged PDFs). */
  extractFailedReason?: string;
  cleanup?: CleanupAccountResult;
  metadata?: MetadataAccountResult;
  parse?: ParseAccountResult;
};
