import type { RecoveryCode } from "@core/domains/auth/entities/recovery-code";
import type { Pagination, Sort } from "@core/shared/query";

export type RecoveryCodeFilters = {
  id?: string;
  userId?: string;
  codeHash?: string;
  unused?: boolean;
};

export type RecoveryCodeSortColumn = "createdAt";

export type RecoveryCodeUpdate = {
  usedAt?: Date | null;
};

export interface RecoveryCodeRepository {
  create(codes: RecoveryCode | RecoveryCode[]): Promise<RecoveryCode | RecoveryCode[]>;
  findByFilters(
    filters: RecoveryCodeFilters,
    sort?: Sort<RecoveryCodeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryCode[]>;
  save(code: RecoveryCode): Promise<RecoveryCode>;
  update(filters: RecoveryCodeFilters, patch: RecoveryCodeUpdate): Promise<RecoveryCode[]>;
  aggregate(filters: RecoveryCodeFilters): Promise<number>;
  delete(filters: RecoveryCodeFilters): Promise<void>;
}
