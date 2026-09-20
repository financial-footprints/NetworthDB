import type { SourcesApi } from "@ndb/platform";

export type SourceType = "thunderbird" | "email";

export type SourcesResponse = SourcesApi;

export type SourceConfig = SourcesApi["sources"][number];

export type ThunderbirdSourceConfig = Extract<SourceConfig, { type: "thunderbird" }>;

export type EmailSource = Extract<SourceConfig, { type: "email" }>;

export type EmailWrite = {
  id: string;
  label: string;
  type: "email";
  host: string;
  port: number;
  username: string;
  password?: string;
  folder: string;
  use_ssl: boolean;
};

export type SourceWrite = ThunderbirdSourceConfig | EmailWrite;

export type SourcesUpdate = {
  sources: SourceWrite[];
};
