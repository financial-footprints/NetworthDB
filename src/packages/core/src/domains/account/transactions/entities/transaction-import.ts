export class TransactionImport {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly createdAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    accountId: string;
    createdAt?: string;
  }): TransactionImport {
    const now = props.createdAt ?? new Date().toISOString();
    return new TransactionImport(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.accountId,
      now
    );
  }
}
