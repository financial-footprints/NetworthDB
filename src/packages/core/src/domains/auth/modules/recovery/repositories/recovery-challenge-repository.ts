import type { RecoveryChallenge } from "@core/domains/auth/modules/recovery/entities/recovery-challenge";
import type { Pagination, Sort } from "@core/shared/query";

export type RecoveryChallengeFilters = {
  id?: string;
  userId?: string;
  kind?: string;
  secretHash?: string;
  active?: boolean;
};

export type RecoveryChallengeSortColumn = "createdAt" | "expiresAt";

export type RecoveryChallengeUpdate = {
  usedAt?: Date | null;
};

export interface RecoveryChallengeRepository {
  create(challenge: RecoveryChallenge): Promise<RecoveryChallenge>;
  findByFilters(
    filters: RecoveryChallengeFilters,
    sort?: Sort<RecoveryChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryChallenge[]>;
  update(
    filters: RecoveryChallengeFilters,
    patch: RecoveryChallengeUpdate
  ): Promise<RecoveryChallenge[]>;
}
