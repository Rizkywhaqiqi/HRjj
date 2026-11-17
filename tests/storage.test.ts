import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { deleteStoredFile, putStoredFile, readStoredFile, validateStorageKey } from "../src/core/storage/files";

test("storage rejects traversal, absolute paths, URLs, and non-file namespaces", () => {
  for (const key of ["../secret", "/private/cv/a.pdf", "private/cv/../a.pdf", "private/cv/a\\b.pdf", "https://example.com/a", "public/a.pdf", "private/cv//a.pdf"]) {
    assert.throws(() => validateStorageKey(key));
  }
});

test("local development can round-trip a file without overwriting existing data", async () => {
  const prior = process.env.FILE_STORAGE;
  process.env.FILE_STORAGE = "local";
  const key = `private/cv/test-${randomUUID()}.pdf`;
  try {
    await putStoredFile(key, Buffer.from("%PDF-test"));
    assert.equal((await readStoredFile(key)).toString(), "%PDF-test");
    await assert.rejects(putStoredFile(key, Buffer.from("different")), { code: "EEXIST" });
    await deleteStoredFile(key);
    await assert.rejects(readStoredFile(key), { code: "ENOENT" });
    await deleteStoredFile(key);
  } finally {
    await deleteStoredFile(key);
    if (prior === undefined) delete process.env.FILE_STORAGE; else process.env.FILE_STORAGE = prior;
  }
});

test("Vercel fails closed instead of silently writing to local disk", async () => {
  const prior = { FILE_STORAGE: process.env.FILE_STORAGE, VERCEL: process.env.VERCEL };
  process.env.FILE_STORAGE = "local";
  process.env.VERCEL = "1";
  try { await assert.rejects(putStoredFile("private/cv/no-write.pdf", Buffer.from("x")), /requires R2/); }
  finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("R2 maps missing objects and preserves storage errors", async () => {
  const prior = { ...process.env };
  Object.assign(process.env, { FILE_STORAGE: "r2", R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET_NAME: "test", R2_ACCESS_KEY_ID: "test", R2_SECRET_ACCESS_KEY: "test" });
  const send = mock.method(S3Client.prototype, "send", async () => { throw Object.assign(new Error("missing"), { name: "NoSuchKey" }); });
  try {
    await assert.rejects(readStoredFile("private/cv/missing.pdf"), { code: "ENOENT" });
    send.mock.mockImplementation(async () => { throw Object.assign(new Error("denied"), { name: "AccessDenied" }); });
    await assert.rejects(readStoredFile("private/cv/missing.pdf"), { name: "AccessDenied" });
  } finally { send.mock.restore(); process.env = prior; }
});
