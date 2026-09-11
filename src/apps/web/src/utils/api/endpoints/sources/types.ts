export type SourceType = "thunderbird" | "email";

export type ThunderbirdSourceConfig = {
  id: string;
  label: string;
  type: "thunderbird";
  profile: string;
};

export type EmailSource = {
  id: string;
  label: string;
  type: "email";
  host: string;
  port: number;
  username: string;
  folder: string;
  use_ssl: boolean;
  has_password: boolean;
  password?: string;
};

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

export type SourceConfig = ThunderbirdSourceConfig | EmailSource;

export type SourceWrite = ThunderbirdSourceConfig | EmailWrite;

export type SourcesResponse = {
  sources: SourceConfig[];
};

export type SourcesUpdate = {
  sources: SourceWrite[];
};
