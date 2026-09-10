import type { User } from "@core/domains/user/entities/user/index";
import { Username } from "@core/domains/user/entities/user/index";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import { findFirst } from "@core/shared/query";

export async function getByUsername(users: UserRepository, username: string): Promise<User> {
  const user = await findFirst(users.findByFilters.bind(users), {
    username: Username.parse(username),
  });
  if (!user) {
    throw new Error(`user ${username} not found`);
  }

  return user;
}

export async function getById(users: UserRepository, userId: string): Promise<User> {
  const user = await users.findById(userId);
  if (!user) {
    throw new Error(`user ${userId} not found`);
  }

  return user;
}
