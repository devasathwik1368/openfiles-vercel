import { list } from "@vercel/blob";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { blobs } = await list({ prefix: "openfiles-uploads/" });
    const files = blobs.map(blob => {
      const name = blob.pathname.split("/").pop().replace(/^[0-9a-f-]{36}-/, "");
      return {
        id: blob.pathname,
        name,
        url: blob.url,
        size: blob.size,
        contentType: blob.contentType || "application/octet-stream",
        createdAt: blob.uploadedAt
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return response.status(200).json({ files });
  } catch (error) {
    console.error("OpenFiles list error:", error);
    return response.status(500).json({ error: "Could not list files. Check that Vercel Blob is connected and BLOB_READ_WRITE_TOKEN is configured." });
  }
}
