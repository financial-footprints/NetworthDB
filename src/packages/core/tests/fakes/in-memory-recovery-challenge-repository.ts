import { RecoveryChallenge } from "@core/domains/auth/modules/recovery/entities/recovery-challenge";
import type {
  RecoveryChallengeFilters,
  RecoveryChallengeRepository,
  RecoveryChallengeSortColumn,
  RecoveryChallengeUpdate,
} from "@core/domains/auth/modules/recovery/repositories/recovery-challenge-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryRecoveryChallengeRepository implements RecoveryChallengeRepository {
  private readonly byId = new Map<string, RecoveryChallenge>();

  async create(challenge: RecoveryChallenge): Promise<RecoveryChallenge> {
    this.byId.set(challenge.id, challenge);
    return challenge;
  }

  async findByFilters(
    filters: RecoveryChallengeFilters,
    sort?: Sort<RecoveryChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryChallenge[]> {
    let items = [...this.byId.values()].filter((challenge) => this.matches(challenge, filters));
    items = sortByColumn(
      items,
      {
        createdAt: (challenge) => challenge.createdAt,
        expiresAt: (challenge) => challenge.expiresAt,
      },
      sort
    );
    return paginate(items, pagination);
  }

  async update(
    filters: RecoveryChallengeFilters,
    patch: RecoveryChallengeUpdate
  ): Promise<RecoveryChallenge[]> {
    const updated: RecoveryChallenge[] = [];
    for (const [id, challenge] of this.byId.entries()) {
      if (!this.matches(challenge, filters)) {
        continue;
      }

      const next = new RecoveryChallenge(
        challenge.id,
        challenge.userId,
        challenge.kind,
        challenge.secretHash,
        challenge.expiresAt,
        challenge.createdAt,
        patch.usedAt !== undefined ? patch.usedAt : challenge.usedAt
      );
      this.byId.set(id, next);
      updated.push(next);
    }

    return updated;
  }

  private matches(challenge: RecoveryChallenge, filters: RecoveryChallengeFilters): boolean {
    if (filters.id !== undefined && challenge.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && challenge.userId !== filters.userId) {
      return false;
    }
    if (filters.kind !== undefined && challenge.kind !== filters.kind) {
      return false;
    }
    if (filters.secretHash !== undefined && challenge.secretHash !== filters.secretHash) {
      return false;
    }
    if (filters.active === true) {
      if (challenge.usedAt !== null || challenge.expiresAt <= new Date()) {
        return false;
      }
    }

    return true;
  }
}
