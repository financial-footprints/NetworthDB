import type { WebAuthnSession } from "@core/domains/auth/modules/webauthn/entities/webauthn-session";
import type {
  WebAuthnSessionFilters,
  WebAuthnSessionRepository,
  WebAuthnSessionSortColumn,
} from "@core/domains/auth/modules/webauthn/repositories/webauthn-session-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryWebAuthnSessionRepository implements WebAuthnSessionRepository {
  private readonly byId = new Map<string, WebAuthnSession>();

  async create(session: WebAuthnSession): Promise<WebAuthnSession> {
    this.byId.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<WebAuthnSession | null> {
    return this.byId.get(id) ?? null;
  }

  async findByFilters(
    filters: WebAuthnSessionFilters,
    sort?: Sort<WebAuthnSessionSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnSession[]> {
    let items = [...this.byId.values()].filter((session) => this.matches(session, filters));
    items = sortByColumn(
      items,
      {
        createdAt: (session) => session.createdAt,
        expiresAt: (session) => session.expiresAt,
      },
      sort
    );
    return paginate(items, pagination);
  }

  async delete(filters: WebAuthnSessionFilters): Promise<void> {
    for (const [id, session] of this.byId.entries()) {
      if (this.matches(session, filters)) {
        this.byId.delete(id);
      }
    }
  }

  private matches(session: WebAuthnSession, filters: WebAuthnSessionFilters): boolean {
    if (filters.id !== undefined && session.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && session.userId !== filters.userId) {
      return false;
    }

    return true;
  }
}
