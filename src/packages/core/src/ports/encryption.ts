export type UserDataKeyLoader = {
  ensure(userId: string): Promise<Buffer | null>;
  get(userId: string): Promise<Buffer | null>;
};
