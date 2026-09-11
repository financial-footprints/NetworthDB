import type { ListData } from "@web/utils/api/types";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type JobWarningResponse = {
  kind: string;
  message: string;
  account: string;
  source_file: string;
  text_contains: string[];
};

export type JobOutputResponse = {
  warnings: JobWarningResponse[];
};

export type JobResponse = {
  id: string;
  status: JobStatus;
  stage: string;
  account_id: string | null;
  financial_year: string | null;
  created_at: string;
  completed_at: string | null;
  output: JobOutputResponse;
  error: string | null;
  logs?: string | null;
};

export type JobListResponse = ListData<JobResponse>;

export type JobCreatedResponse = {
  id: string;
};
