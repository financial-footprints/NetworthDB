import { assertAal2 } from "@core/domains/auth/helpers";
import {
  emptySources,
  type Sources,
  type SourcesUpdateInput,
  UserSources,
} from "@core/domains/sources/entities/sources";
import type { SourcesRepository } from "@core/domains/sources/repositories/sources-repository";
import type { User } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";

export type {
  EmailSourceWriteInput,
  SourcesUpdateInput,
  SourceWriteInput,
  ThunderbirdSourceWriteInput,
} from "@core/domains/sources/entities/sources";

export class SourcesService {
  constructor(private readonly sources: SourcesRepository) {}

  async getSources(user: User, authAcr: string): Promise<Sources> {
    assertAal2(user.multifactorEnabled, authAcr);
    const record = await this.sources.findById(user.id);
    return record?.toPayload() ?? emptySources();
  }

  async requireSources(user: User, authAcr: string): Promise<Sources> {
    assertAal2(user.multifactorEnabled, authAcr);
    const record = await this.sources.findById(user.id);
    const settings = record?.toPayload() ?? emptySources();
    if (settings.sources.length === 0) {
      throw new ValidationError("core.sources.invalid.none");
    }

    return settings;
  }

  async updateSources(user: User, authAcr: string, input: SourcesUpdateInput): Promise<Sources> {
    assertAal2(user.multifactorEnabled, authAcr);
    const current = await this.sources.findById(user.id);
    const base = current ?? UserSources.empty(user.id);
    const saved = await this.sources.save(base.withSourcesUpdate(input));
    return saved.toPayload();
  }
}
