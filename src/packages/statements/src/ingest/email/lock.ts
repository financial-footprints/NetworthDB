/** Serialize IMAP sessions per mailbox login (Gmail limits concurrent connections). */

const tailByKey = new Map<string, Promise<void>>();

function lockKey(host: string, username: string): string {
  return `${host.trim().toLowerCase()}|${username.trim().toLowerCase()}`;
}

export async function withImapSessionLock<T>(
  host: string,
  username: string,
  run: () => Promise<T>
): Promise<T> {
  const key = lockKey(host, username);
  const prior = tailByKey.get(key) ?? Promise.resolve();

  let release!: () => void;
  const slot = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = prior.then(() => slot);
  tailByKey.set(key, next);

  await prior;
  try {
    return await run();
  } finally {
    release();
    if (tailByKey.get(key) === next) {
      tailByKey.delete(key);
    }
  }
}
