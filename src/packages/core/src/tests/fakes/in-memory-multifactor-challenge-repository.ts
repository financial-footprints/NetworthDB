import { MultifactorChallenge } from "@core/domains/auth/entities/multifactor-challenge";
import type {
  MultifactorChallengeFilters,
  MultifactorChallengeRepository,
  MultifactorChallengeSortColumn,
  MultifactorChallengeUpdate,
} from "@core/domains/auth/repositories/multifactor-challenge-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryMultifactorChallengeRepository implements MultifactorChallengeRepository {
  private readonly byId = new Map<string, MultifactorChallenge>();

  async create(challenge: MultifactorChallenge): Promise<MultifactorChallenge> {
    this.byId.set(challenge.id, challenge);
    return challenge;
  }

  async findById(id: string): Promise<MultifactorChallenge | null> {
    return this.byId.get(id) ?? null;
  }

  async findByFilters(
    filters: MultifactorChallengeFilters,
    sort?: Sort<MultifactorChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<MultifactorChallenge[]> {
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

  async save(challenge: MultifactorChallenge): Promise<MultifactorChallenge> {
    this.byId.set(challenge.id, challenge);
    return challenge;
  }

  async update(
    filters: MultifactorChallengeFilters,
    patch: MultifactorChallengeUpdate
  ): Promise<MultifactorChallenge[]> {
    const updated: MultifactorChallenge[] = [];
    for (const [id, challenge] of this.byId.entries()) {
      if (!this.matches(challenge, filters)) {
        continue;
      }

      const next = new MultifactorChallenge(
        challenge.id,
        challenge.userId,
        challenge.tokenHash,
        challenge.expiresAt,
        challenge.createdAt,
        patch.usedAt !== undefined ? patch.usedAt : challenge.usedAt
      );
      this.byId.set(id, next);
      updated.push(next);
    }

    return updated;
  }

  private matches(challenge: MultifactorChallenge, filters: MultifactorChallengeFilters): boolean {
    if (filters.id !== undefined && challenge.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && challenge.userId !== filters.userId) {
      return false;
    }
    if (filters.tokenHash !== undefined && challenge.tokenHash !== filters.tokenHash) {
      return false;
    }
    if (filters.unused === true && challenge.usedAt !== null) {
      return false;
    }

    return true;
  }
}
