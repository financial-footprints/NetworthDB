import { WebAuthnCredential } from "@core/domains/auth/modules/webauthn/entities/webauthn-credential";
import type {
  WebAuthnCredentialFilters,
  WebAuthnCredentialRepository,
  WebAuthnCredentialSortColumn,
  WebAuthnCredentialUpdate,
} from "@core/domains/auth/modules/webauthn/repositories/webauthn-credential-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryWebAuthnCredentialRepository implements WebAuthnCredentialRepository {
  private readonly byId = new Map<string, WebAuthnCredential>();

  async create(credential: WebAuthnCredential): Promise<WebAuthnCredential> {
    this.byId.set(credential.id, credential);
    return credential;
  }

  async findById(id: string): Promise<WebAuthnCredential | null> {
    return this.byId.get(id) ?? null;
  }

  async findByFilters(
    filters: WebAuthnCredentialFilters,
    sort?: Sort<WebAuthnCredentialSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnCredential[]> {
    let items = [...this.byId.values()].filter((credential) => this.matches(credential, filters));
    items = sortByColumn(items, { createdAt: (credential) => credential.createdAt }, sort);
    return paginate(items, pagination);
  }

  async save(credential: WebAuthnCredential): Promise<WebAuthnCredential> {
    this.byId.set(credential.id, credential);
    return credential;
  }

  async update(
    filters: WebAuthnCredentialFilters,
    patch: WebAuthnCredentialUpdate
  ): Promise<WebAuthnCredential[]> {
    const updated: WebAuthnCredential[] = [];
    for (const [id, credential] of this.byId.entries()) {
      if (!this.matches(credential, filters)) {
        continue;
      }

      const next = new WebAuthnCredential(
        credential.id,
        credential.userId,
        credential.credentialId,
        credential.publicKey,
        credential.attestationType,
        credential.transport,
        patch.signCount ?? credential.signCount,
        credential.backupEligible,
        patch.backupState ?? credential.backupState,
        credential.name,
        credential.aaguid,
        credential.createdAt
      );
      this.byId.set(id, next);
      updated.push(next);
    }

    return updated;
  }

  async aggregate(filters: WebAuthnCredentialFilters): Promise<number> {
    return [...this.byId.values()].filter((credential) => this.matches(credential, filters)).length;
  }

  async delete(filters: WebAuthnCredentialFilters): Promise<void> {
    for (const [id, credential] of this.byId.entries()) {
      if (this.matches(credential, filters)) {
        this.byId.delete(id);
      }
    }
  }

  private matches(credential: WebAuthnCredential, filters: WebAuthnCredentialFilters): boolean {
    if (filters.id !== undefined && credential.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && credential.userId !== filters.userId) {
      return false;
    }
    if (
      filters.credentialId !== undefined &&
      !credential.credentialId.equals(filters.credentialId)
    ) {
      return false;
    }

    return true;
  }
}
