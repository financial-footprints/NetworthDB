import { RecoveryCode } from "@core/domains/auth/entities/recovery-code";
import type {
  RecoveryCodeFilters,
  RecoveryCodeRepository,
  RecoveryCodeSortColumn,
  RecoveryCodeUpdate,
} from "@core/domains/auth/repositories/recovery-code-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/auth/fakes/repository-helpers";

export class InMemoryRecoveryCodeRepository implements RecoveryCodeRepository {
  private readonly byId = new Map<string, RecoveryCode>();

  async create(codes: RecoveryCode | RecoveryCode[]): Promise<RecoveryCode | RecoveryCode[]> {
    const items = Array.isArray(codes) ? codes : [codes];
    for (const code of items) {
      this.byId.set(code.id, code);
    }

    return codes;
  }

  async findByFilters(
    filters: RecoveryCodeFilters,
    sort?: Sort<RecoveryCodeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryCode[]> {
    let items = [...this.byId.values()].filter((code) => this.matches(code, filters));
    items = sortByColumn(items, { createdAt: (code) => code.createdAt }, sort);
    return paginate(items, pagination);
  }

  async save(code: RecoveryCode): Promise<RecoveryCode> {
    this.byId.set(code.id, code);
    return code;
  }

  async update(filters: RecoveryCodeFilters, patch: RecoveryCodeUpdate): Promise<RecoveryCode[]> {
    const updated: RecoveryCode[] = [];
    for (const [id, code] of this.byId.entries()) {
      if (!this.matches(code, filters)) {
        continue;
      }

      const next = new RecoveryCode(
        code.id,
        code.userId,
        code.codeHash,
        code.createdAt,
        patch.usedAt !== undefined ? patch.usedAt : code.usedAt
      );
      this.byId.set(id, next);
      updated.push(next);
    }

    return updated;
  }

  async aggregate(filters: RecoveryCodeFilters): Promise<number> {
    return [...this.byId.values()].filter((code) => this.matches(code, filters)).length;
  }

  async delete(filters: RecoveryCodeFilters): Promise<void> {
    for (const [id, code] of this.byId.entries()) {
      if (this.matches(code, filters)) {
        this.byId.delete(id);
      }
    }
  }

  private matches(code: RecoveryCode, filters: RecoveryCodeFilters): boolean {
    if (filters.id !== undefined && code.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && code.userId !== filters.userId) {
      return false;
    }
    if (filters.codeHash !== undefined && code.codeHash !== filters.codeHash) {
      return false;
    }
    if (filters.unused === true && code.usedAt !== null) {
      return false;
    }

    return true;
  }
}
