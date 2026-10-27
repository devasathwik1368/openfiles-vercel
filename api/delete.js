import { list, del } from "@vercel/blob";
import { createHash } from "node:crypto";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const auth = request.headers.authorization || "";
  const ownerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const pathname = request.body?.pathname;
  if (!ownerToken || typeof pathname !== "string" || !pathname.startsWith("openfiles-uploads/")) {
    return response.status(400).json({ error: "Missing or invalid file ownership information" });
  }
  try {
    const key = createHash("sha256").update(pathname).digest("hex");
    const metadataUrl = (await list({ prefix: `openfiles-meta/${key}.json` })).blobs[0]?.url;
    if (!metadataUrl) return response.status(404).json({ error: "Ownership record not found; this file may have been uploaded before ownership support was enabled." });
    const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
    if (!metadataResponse.ok) throw new Error("Could not read file ownership record");
    const metadata = await metadataResponse.json();
    const tokenHash = createHash("sha256").update(ownerToken).digest("hex");
    if (metadata.pathname !== pathname || metadata.ownerTokenHash !== tokenHash) {
      return response.status(403).json({ error: "Only the uploader can delete this file from the original browser." });
    }
    await del([metadata.url, metadataUrl]);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("OpenFiles delete error:", error);
    return response.status(500).json({ error: "Could not delete file. Check the deployment logs." });
  }
}
