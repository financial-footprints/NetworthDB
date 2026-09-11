/** Web Crypto expects ArrayBuffer-backed views, not generic ArrayBufferLike. */
export function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
