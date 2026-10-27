# OpenFiles — Vercel Blob starter

This project keeps the OpenFiles public file-sharing UI and connects uploads to Vercel Blob.

## Features

- Public upload and sharing
- Upload progress and multi-file uploads
- Direct browser-to-Blob uploads (avoids the Vercel Function 4.5 MB request-body limit)
- Image, PDF, text, audio and video previews where the browser supports them
- Search, file-type filtering, grid/list views and dark mode
- Uploader-only deletion from the same browser, using a random ownership token saved in local storage

## Before deployment

1. In Vercel, open the `openfiles` project.
2. Open **Storage** and confirm `openfiles-storage` is connected to Production and Preview.
3. In the Blob connection options, enable adding the read-write token environment variable if it is not already present. The project needs `BLOB_READ_WRITE_TOKEN`.
4. Redeploy the project after connecting storage or changing environment variables.

## Deploy

The easiest path is to replace the files in your existing GitHub repository with the contents of this ZIP, preserving the repository name `openfiles`.

Vercel project settings:
- Framework preset: **Vite** (or Other if Vite is not detected)
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Push the files to the `main` branch. Vercel should build and deploy automatically.

## Local development

```bash
npm install
npm run dev
```

The frontend can be previewed locally, but the `/api` serverless routes and Blob upload completion callback need to run on Vercel with a connected Blob store for full end-to-end behavior. You can use Vercel CLI (`vercel dev`) for local API development after linking the project and pulling environment variables.

## Storage and privacy

This is a public file-sharing app: anyone who can access the site can see the file list and download public files. Do not upload sensitive or private information. Public upload endpoints can be abused and can consume your account's usage. Add rate limiting, bot protection, file moderation, quotas, and abuse reporting before broad public use.

File deletion is authenticated using an ownership token generated in the browser and a hashed ownership record stored as a small metadata Blob. If a user clears browser local storage, they lose the token and cannot delete their files through the UI. A project administrator can still manage objects in the Vercel dashboard.

The starter allows common image, document, audio, video, text and archive MIME types. MIME type validation is not malware scanning. Avoid treating uploaded content as trusted.
