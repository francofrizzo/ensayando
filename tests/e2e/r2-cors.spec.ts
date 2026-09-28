import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const enabled = process.env.R2_BROWSER_TEST === "1";

test.skip(!enabled, "Set R2_BROWSER_TEST=1 and dev-bucket credentials to run");

test("browser can PUT directly to R2 through CORS", async ({ page }) => {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      sessionToken: process.env.R2_SESSION_TOKEN
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
  const key = `_browser/${randomUUID()}.mp3`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "audio/mpeg" });
  const url = await getSignedUrl(client, command, { expiresIn: 60 });

  try {
    await page.goto("/");
    const response = await page.evaluate(async (signedUrl) => {
      const result = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body: new Uint8Array([1, 2, 3, 4])
      });
      return {
        status: result.status,
        allowOrigin: result.headers.get("access-control-allow-origin")
      };
    }, url);
    expect(response.status).toBe(200);
    expect(response.allowOrigin).toBe(new URL(page.url()).origin);
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
});
