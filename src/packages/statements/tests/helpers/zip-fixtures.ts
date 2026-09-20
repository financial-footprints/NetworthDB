import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";

export async function buildZip(
  entries: Array<{ name: string; content: string | Buffer }>
): Promise<Buffer> {
  const blobWriter = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(blobWriter);
  for (const entry of entries) {
    const data = typeof entry.content === "string" ? entry.content : entry.content.toString("utf8");
    await zipWriter.add(entry.name, new TextReader(data));
  }
  await zipWriter.close();
  const blob = await blobWriter.getData();
  return Buffer.from(await blob.arrayBuffer());
}

export async function buildAesZip(
  entries: Array<{ name: string; content: string | Buffer }>,
  password: string
): Promise<Buffer> {
  const blobWriter = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(blobWriter);
  for (const entry of entries) {
    const data = typeof entry.content === "string" ? entry.content : entry.content.toString("utf8");
    await zipWriter.add(entry.name, new TextReader(data), {
      password,
      encryptionStrength: 3,
    });
  }
  await zipWriter.close();
  const blob = await blobWriter.getData();
  return Buffer.from(await blob.arrayBuffer());
}

export function minimalPdfBytes(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}
