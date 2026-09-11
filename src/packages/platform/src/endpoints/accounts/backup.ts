import { accountDataSchema } from "@platform/endpoints/accounts/index";
import { sourceSchema } from "@platform/endpoints/sources";
import { z } from "zod";

export const ACCOUNTS_JSON_NAME = "accounts.json";
export const SOURCES_JSON_NAME = "sources.json";

export const backupAccountsFileSchema = z.array(accountDataSchema);
export const backupSourcesFileSchema = z.array(sourceSchema);
