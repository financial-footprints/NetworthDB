import {
  BlobReader,
  BlobWriter,
  configure,
  type FileEntry,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";

configure({ useWebWorkers: false });

export type ZipCreateOptions = {
  password?: string;
};

export type ZipOpenOptions = {
  password?: string;
};

async function toBlob(data: Blob | Uint8Array): Promise<Blob> {
  if (data instanceof Blob) {
    return data;
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy]);
}

export const Zip = {
  async create(files: Record<string, string>, options?: ZipCreateOptions): Promise<Uint8Array> {
    const blobWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(blobWriter);
    const trimmedPassword = options?.password?.trim();

    for (const [filename, contents] of Object.entries(files)) {
      await zipWriter.add(filename, new TextReader(contents), {
        password: trimmedPassword || undefined,
        encryptionStrength: trimmedPassword ? 3 : undefined,
      });
    }

    await zipWriter.close();
    const blob = await blobWriter.getData();
    return new Uint8Array(await blob.arrayBuffer());
  },

  async open(data: Blob | Uint8Array, options?: ZipOpenOptions): Promise<Record<string, string>> {
    const blobReader = new BlobReader(await toBlob(data));
    const zipReader = new ZipReader(blobReader, {
      password: options?.password?.trim() || undefined,
    });

    try {
      const entries = await zipReader.getEntries();
      const files: Record<string, string> = {};

      for (const entry of entries) {
        if (entry.directory) {
          continue;
        }
        const fileEntry = entry as FileEntry;
        const writer = new TextWriter();
        await fileEntry.getData(writer);
        files[fileEntry.filename] = await writer.getData();
      }

      return files;
    } finally {
      await zipReader.close();
    }
  },
};
