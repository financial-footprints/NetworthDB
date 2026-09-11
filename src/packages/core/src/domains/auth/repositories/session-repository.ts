import type { Session } from "@core/domains/auth/entities/session";
import type { Pagination, Sort } from "@core/shared/query";

export type SessionFilters = {
  id?: string;
  userId?: string;
  sessionHash?: string;
  refreshHash?: string;
};

export type SessionSortColumn = "createdAt";

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByFilters(
    filters: SessionFilters,
    sort?: Sort<SessionSortColumn>,
    pagination?: Pagination
  ): Promise<Session[]>;
  save(session: Session): Promise<Session>;
  delete(filters: SessionFilters): Promise<void>;
}
