import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Keep requests below Vercel's function payload limit, including multipart fields.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
let client: S3Client | undefined;

export function validateStorageKey(key: string): string {
  if (!/^(private\/(cv|ktp|letters)|templates\/letters)\/[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(key) ||
      key.split("/").some((part) => part === ".." || part === "." || part === "")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

function isR2Storage(): boolean {
  const provider = process.env.FILE_STORAGE ?? (process.env.VERCEL ? "r2" : "local");
  if (provider !== "local" && provider !== "r2") throw new Error("FILE_STORAGE must be local or r2");
  if (process.env.VERCEL && provider !== "r2") throw new Error("Vercel requires R2 file storage");
  return provider === "r2";
}

function r2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !/^[a-f0-9]{32}$/.test(accountId) || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket };
}

export function storageContentType(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".docx")) return DOCX;
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function putStoredFile(key: string, bytes: Buffer): Promise<void> {
  validateStorageKey(key);
  if (isR2Storage()) {
    const { client, bucket } = r2();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes,
      ContentType: storageContentType(key), CacheControl: "private, no-store", IfNoneMatch: "*" }));
    return;
  }
  const target = path.join(process.cwd(), "storage", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  validateStorageKey(key);
  if (!isR2Storage()) return readFile(path.join(process.cwd(), "storage", key));
  const { client, bucket } = r2();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw Object.assign(new Error("File not found"), { code: "ENOENT" });
    return Buffer.from(await result.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
      throw Object.assign(new Error("File not found"), { code: "ENOENT" });
    }
    throw error;
  }
}

export async function deleteStoredFile(key: string): Promise<void> {
  validateStorageKey(key);
  if (isR2Storage()) {
    const { client, bucket } = r2();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } else {
    await unlink(path.join(process.cwd(), "storage", key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
