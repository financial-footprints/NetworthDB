import type { Session } from "@core/domains/auth/entities/session";
import type {
  SessionFilters,
  SessionRepository,
  SessionSortColumn,
} from "@core/domains/auth/repositories/session-repository";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/auth/fakes/repository-helpers";

export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    for (const existing of this.byId.values()) {
      if (
        existing.sessionHash === session.sessionHash ||
        existing.refreshHash === session.refreshHash
      ) {
        throw new ConflictError("core.auth.session.create.conflict.hash-collision");
      }
    }

    this.byId.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.byId.get(id) ?? null;
  }

  async findByFilters(
    filters: SessionFilters,
    sort?: Sort<SessionSortColumn>,
    pagination?: Pagination
  ): Promise<Session[]> {
    let items = [...this.byId.values()].filter((session) => this.matches(session, filters));
    items = sortByColumn(items, { createdAt: (session) => session.createdAt }, sort);
    return paginate(items, pagination);
  }

  async save(session: Session): Promise<Session> {
    this.byId.set(session.id, session);
    return session;
  }

  async delete(filters: SessionFilters): Promise<void> {
    for (const [id, session] of this.byId.entries()) {
      if (this.matches(session, filters)) {
        this.byId.delete(id);
      }
    }
  }

  private matches(session: Session, filters: SessionFilters): boolean {
    if (filters.id !== undefined && session.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && session.userId !== filters.userId) {
      return false;
    }
    if (filters.sessionHash !== undefined && session.sessionHash !== filters.sessionHash) {
      return false;
    }
    if (filters.refreshHash !== undefined && session.refreshHash !== filters.refreshHash) {
      return false;
    }

    return true;
  }
}
