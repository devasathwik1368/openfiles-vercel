import { handleUpload } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { createHash } from "node:crypto";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = request.body;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("openfiles-uploads/")) {
          throw new Error("Invalid upload path");
        }
        let payload;
        try { payload = JSON.parse(clientPayload || "{}"); } catch { payload = {}; }
        if (typeof payload.ownerToken !== "string" || payload.ownerToken.length < 40) {
          throw new Error("Missing upload ownership token");
        }
        return {
          allowedContentTypes: [
            "image/*", "application/pdf", "text/*",
            "audio/*", "video/*",
            "application/zip", "application/x-zip-compressed",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/octet-stream"
          ],
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ pathname, ownerToken: payload.ownerToken })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "{}");
        const hash = createHash("sha256").update(payload.pathname).digest("hex");
        const metadata = {
          pathname: payload.pathname,
          ownerTokenHash: createHash("sha256").update(payload.ownerToken).digest("hex"),
          url: blob.url,
          createdAt: new Date().toISOString()
        };
        await put(`openfiles-meta/${hash}.json`, JSON.stringify(metadata), {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 0
        });
      }
    });
    return response.status(200).json(result);
  } catch (error) {
    console.error("OpenFiles upload token error:", error);
    return response.status(400).json({ error: error.message || "Upload authorization failed" });
  }
}
