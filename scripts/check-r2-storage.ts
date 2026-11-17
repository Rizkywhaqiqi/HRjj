import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deleteStoredFile, putStoredFile, readStoredFile } from "../src/core/storage/files";

async function main() {
  if (process.env.FILE_STORAGE !== "r2") throw new Error("Set FILE_STORAGE=r2 before this check");
  const key = `private/cv/storage-check-${randomUUID()}.pdf`;
  const bytes = Buffer.from("%PDF-1.4\nHRjj storage connectivity check\n%%EOF");
  let uploaded = false;
  try {
    await putStoredFile(key, bytes);
    uploaded = true;
    assert.deepEqual(await readStoredFile(key), bytes);
    await assert.rejects(putStoredFile(key, Buffer.from("must not replace")));
    assert.deepEqual(await readStoredFile(key), bytes);
    await deleteStoredFile(key);
    uploaded = false;
    await assert.rejects(readStoredFile(key), { code: "ENOENT" });
    console.info("R2 upload, read, overwrite protection, delete and missing-file checks passed.");
  } finally { if (uploaded) await deleteStoredFile(key); }
}
void main().catch((error: unknown) => {
  console.error("R2 check failed:", error instanceof Error ? error.name : "unknown");
  process.exitCode = 1;
});
