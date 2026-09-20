import { normalizeTaxonomyName } from "@core/domains/account/taxonomy/helpers";

export class Category {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly parentId: string | null,
    public readonly name: string,
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    parentId?: string | null;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  }): Category {
    const name = normalizeTaxonomyName(props.name);
    const now = new Date().toISOString();
    return new Category(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.parentId ?? null,
      name,
      props.createdAt ?? now,
      props.updatedAt ?? now
    );
  }

  withName(name: string, updatedAt: string): Category {
    return Category.create({
      id: this.id,
      userId: this.userId,
      parentId: this.parentId,
      name,
      createdAt: this.createdAt,
      updatedAt,
    });
  }
}
