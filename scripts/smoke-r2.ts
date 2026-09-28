import { createHash, randomUUID } from "node:crypto";

import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  verifyUploadedObject
} from "../server/storage/r2";

const key = `_smoke/${randomUUID()}.mp3`;
const body = new TextEncoder().encode("Ensayando R2 smoke probe");

try {
  const upload = await createUploadUrl({ key, contentType: "audio/mpeg", filename: "probe.mp3" });
  const put = await fetch(upload.url, { method: "PUT", headers: upload.headers, body });
  if (!put.ok) throw new Error(`PUT failed with ${put.status}`);

  const head = await verifyUploadedObject({ key, fileType: "audio" });
  const get = await fetch(await createDownloadUrl(key));
  if (!get.ok) throw new Error(`GET failed with ${get.status}`);
  const downloaded = new Uint8Array(await get.arrayBuffer());
  const expectedHash = createHash("sha256").update(body).digest("hex");
  const actualHash = createHash("sha256").update(downloaded).digest("hex");
  if (expectedHash !== actualHash) throw new Error("Probe hash mismatch");

  console.log(JSON.stringify({ status: "ok", key, bytes: head.size }));
} finally {
  await deleteObject(key).catch(() => undefined);
}
