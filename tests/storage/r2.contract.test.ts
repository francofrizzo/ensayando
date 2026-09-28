import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  verifyUploadedObject
} from "../../server/storage/r2";

const enabled = process.env.R2_CONTRACT_TEST === "1";
const key = `_contract/${randomUUID()}.mp3`;

describe.skipIf(!enabled)("R2 storage contract", () => {
  afterAll(async () => {
    await deleteObject(key).catch(() => undefined);
  });

  it("uploads, validates, downloads with metadata, and deletes", async () => {
    const body = new TextEncoder().encode("contract audio probe");
    const upload = await createUploadUrl({
      key,
      contentType: "audio/mpeg",
      filename: "ensayo probe.mp3"
    });
    const put = await fetch(upload.url, { method: "PUT", headers: upload.headers, body });
    expect(put.status).toBe(200);

    await expect(verifyUploadedObject({ key, fileType: "audio" })).resolves.toEqual({
      size: body.byteLength,
      contentType: "audio/mpeg"
    });

    const get = await fetch(await createDownloadUrl(key));
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toBe("audio/mpeg");
    expect(get.headers.get("content-disposition")).toContain("ensayo probe.mp3");
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(body);

    await deleteObject(key);
  });
});
