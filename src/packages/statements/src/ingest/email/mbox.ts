import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ParsedEmail } from "@statements/ingest/email/attachments";

const SKIP_DIR_NAMES = new Set(["Feeds", "smart mailboxes"]);
const SKIP_EXTENSIONS = new Set(["dat", "json", "html", "txt", "backup"]);

export function discoverMboxFiles(profile: string): string[] {
  const found = new Set<string>();
  const imapRoot = join(profile, "ImapMail");
  if (existsSync(imapRoot) && statSync(imapRoot).isDirectory()) {
    collectMboxFiles(imapRoot, found);
  }
  const localRoot = join(profile, "Mail", "Local Folders");
  if (existsSync(localRoot) && statSync(localRoot).isDirectory()) {
    collectMboxFiles(localRoot, found);
  }
  return [...found].sort();
}

function collectMboxFiles(dir: string, found: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMboxFiles(path, found);
    } else if (isMboxStore(path)) {
      found.add(path);
    }
  }
}

function isMboxStore(path: string): boolean {
  if (!existsSync(path) || !statSync(path).isFile()) {
    return false;
  }
  if (path.endsWith(".msf")) {
    return false;
  }
  if (path.endsWith("msgFilterRules.dat")) {
    return false;
  }
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && SKIP_EXTENSIONS.has(ext)) {
    return false;
  }
  for (const part of path.split(/[/\\]/)) {
    if (SKIP_DIR_NAMES.has(part)) {
      return false;
    }
  }
  const msfPath = `${path}.msf`;
  return existsSync(msfPath) && statSync(msfPath).isFile();
}

export async function iterMboxMessages(path: string): Promise<ParsedEmail[]> {
  const raw = readFileSync(path, "utf8");
  if (!raw) {
    return [];
  }

  const messages: ParsedEmail[] = [];
  let chunk = "";
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("From ") && chunk.length > 0) {
      const parsed = await ParsedEmail.parse(Buffer.from(chunk, "utf8"));
      if (parsed) {
        messages.push(parsed);
      }
      chunk = "";
      continue;
    }
    if (chunk.length > 0) {
      chunk += "\n";
    }
    chunk += line;
  }
  if (chunk.length > 0) {
    const parsed = await ParsedEmail.parse(Buffer.from(chunk, "utf8"));
    if (parsed) {
      messages.push(parsed);
    }
  }
  return messages;
}
