export { DEFAULT_EMAIL_PORT } from "@core/domains/sources/constants";
export {
  cloneSources,
  type EmailSource,
  type EmailSourceWriteInput,
  emailHasPassword,
  emptySources,
  type Source,
  type Sources,
  type SourcesUpdateInput,
  type SourceWriteInput,
  type ThunderbirdSource,
  type ThunderbirdSourceWriteInput,
  UserSources,
} from "@core/domains/sources/entities/sources";
export type {
  SourcesFilters,
  SourcesRepository,
  SourcesSortColumn,
} from "@core/domains/sources/repositories/sources-repository";
export { SourcesService } from "@core/domains/sources/services/sources-service";
