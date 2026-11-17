import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { putStoredFile, readStoredFile, validateStorageKey } from "../src/core/storage/files";

async function walk(directory: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error("Symlinks are not supported for migration");
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  if (process.env.FILE_STORAGE !== "r2") throw new Error("Set FILE_STORAGE=r2");
  const root = path.resolve(process.env.LEGACY_STORAGE_ROOT ?? "storage");
  const files = (await Promise.all(["private/cv", "private/ktp", "private/letters", "templates/letters"].map((prefix) => walk(path.join(root, prefix))))).flat();
  const apply = process.argv.includes("--apply");
  let copied = 0;
  let skipped = 0;
  for (const file of files) {
    const key = validateStorageKey(path.relative(root, file).split(path.sep).join("/"));
    if (!apply) continue;
    const bytes = await readFile(file);
    let existing: Buffer | undefined;
    try { existing = await readStoredFile(key); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (existing) {
      if (digest(existing) !== digest(bytes)) throw new Error("An existing R2 object differs; migration stopped without overwriting");
      skipped++;
      continue;
    }
    await putStoredFile(key, bytes);
    if (digest(await readStoredFile(key)) !== digest(bytes)) throw new Error("R2 verification failed");
    copied++;
  }
  console.info({ mode: apply ? "apply" : "dry-run", found: files.length, copied, skipped });
  // Intentionally retain local files. No database changes are needed.
}
void main().catch((error: unknown) => {
  console.error("File migration failed:", error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
