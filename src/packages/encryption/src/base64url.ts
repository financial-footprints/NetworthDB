export function b64urlEncode(data: Buffer): string {
  return data.toString("base64url");
}

export function b64urlDecode(data: string): Buffer {
  const padding = "=".repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(`${data}${padding}`, "base64url");
}
