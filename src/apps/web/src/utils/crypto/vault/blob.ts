const BLOB_SEPARATOR = ".";

export function packE2EEBlob(nonce: string, ciphertext: string): string {
  return `${nonce}${BLOB_SEPARATOR}${ciphertext}`;
}

export function unpackE2EEBlob(blob: string): {
  nonce: string;
  ciphertext: string;
} {
  const trimmed = blob.trim();
  if (!trimmed) {
    throw new Error("e2ee blob empty");
  }
  const dot = trimmed.indexOf(BLOB_SEPARATOR);
  if (dot <= 0 || dot === trimmed.length - 1) {
    throw new Error("e2ee blob invalid");
  }
  const nonce = trimmed.slice(0, dot);
  const ciphertext = trimmed.slice(dot + 1);
  if (!nonce || !ciphertext || ciphertext.includes(BLOB_SEPARATOR)) {
    throw new Error("e2ee blob invalid");
  }
  return { nonce, ciphertext };
}
