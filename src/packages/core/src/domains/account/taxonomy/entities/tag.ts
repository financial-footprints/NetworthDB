import { normalizeTaxonomyName } from "@core/domains/account/taxonomy/helpers";

export class Tag {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  }): Tag {
    const name = normalizeTaxonomyName(props.name);
    const now = new Date().toISOString();
    return new Tag(
      props.id ?? crypto.randomUUID(),
      props.userId,
      name,
      props.createdAt ?? now,
      props.updatedAt ?? now
    );
  }

  withName(name: string, updatedAt: string): Tag {
    return Tag.create({
      id: this.id,
      userId: this.userId,
      name,
      createdAt: this.createdAt,
      updatedAt,
    });
  }
}
