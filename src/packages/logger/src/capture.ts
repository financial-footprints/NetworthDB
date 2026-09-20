export type LogFd = "stdout" | "stderr";

export function logWriteStream(fd: LogFd): NodeJS.WriteStream {
  return fd === "stderr" ? process.stderr : process.stdout;
}

export function writeLogLine(line: string, fd: LogFd = "stdout"): void {
  logWriteStream(fd).write(`${line}\n`);
}
