import type { MultifactorChallenge } from "@core/domains/auth/entities/multifactor-challenge";
import type { Pagination, Sort } from "@core/shared/query";

export type MultifactorChallengeFilters = {
  id?: string;
  userId?: string;
  tokenHash?: string;
  unused?: boolean;
};

export type MultifactorChallengeSortColumn = "createdAt" | "expiresAt";

export type MultifactorChallengeUpdate = {
  usedAt?: Date | null;
};

export interface MultifactorChallengeRepository {
  create(challenge: MultifactorChallenge): Promise<MultifactorChallenge>;
  findById(id: string): Promise<MultifactorChallenge | null>;
  findByFilters(
    filters: MultifactorChallengeFilters,
    sort?: Sort<MultifactorChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<MultifactorChallenge[]>;
  save(challenge: MultifactorChallenge): Promise<MultifactorChallenge>;
  update(
    filters: MultifactorChallengeFilters,
    patch: MultifactorChallengeUpdate
  ): Promise<MultifactorChallenge[]>;
}
