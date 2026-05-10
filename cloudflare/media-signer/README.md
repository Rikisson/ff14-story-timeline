# media-signer

Cloudflare Worker that issues short-lived presigned R2 URLs to authenticated universe members. The Angular app calls `/sign-upload` and `/sign-delete`; the Worker verifies the user's Firebase ID token, confirms membership against Firestore, and signs a 5-minute S3-compatible URL the client uses directly against R2.

## Contract

Both routes accept `POST` with `Authorization: Bearer <firebase-id-token>` and a JSON body:

```json
{
  "universeId": "...",
  "kind": "cover | sprite | background | ambient | sfx",
  "assetId": "...",
  "filename": "..."
}
```

Responses:

- `POST /sign-upload` → `{ "uploadUrl": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }`
- `POST /sign-delete` → `{ "deleteUrl": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }`
- `4xx` errors → `{ "error": "..." }` with `401` (auth), `403` (membership), `400` (validation), `404` (route).

The client `PUT`s or `DELETE`s the body of the asset directly to the returned URL. Public reads are served from `R2_PUBLIC_BASE` (custom domain or `r2.dev`), composed by the client as `${R2_PUBLIC_BASE}/universes/{u}/{kind}/{assetId}/{filename}`.

## One-time Cloudflare setup

```bash
# Authenticate Wrangler with your Cloudflare account.
npx wrangler login

# Create R2 buckets per environment.
npx wrangler r2 bucket create narrative-dev
npx wrangler r2 bucket create narrative-prod

# Create R2 API tokens scoped to each bucket (Cloudflare dashboard: R2 → Manage R2 API Tokens).
# Each token gives an access key id + secret. Save them — secrets are shown once.
```

Configure each bucket for **public reads** (Cloudflare dashboard: R2 → bucket → Settings → Public access). Bind a custom domain if you want a portable URL; otherwise note the bucket's `*.r2.dev` URL. Add a CORS rule to each bucket allowing `PUT, DELETE` from the app origins:

```json
[
  {
    "AllowedOrigins": ["http://localhost:4200", "https://<your-app-origin>"],
    "AllowedMethods": ["PUT", "DELETE"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "MaxAgeSeconds": 86400
  }
]
```

## Per-environment setup

Edit `wrangler.toml` and fill in `R2_PUBLIC_BASE` and `ALLOWED_ORIGIN` for each environment, then push the secrets:

```bash
pnpm install

# Dev
pnpm secret:dev R2_ACCOUNT_ID
pnpm secret:dev R2_ACCESS_KEY_ID
pnpm secret:dev R2_SECRET_ACCESS_KEY
pnpm deploy:dev

# Prod
pnpm secret:prod R2_ACCOUNT_ID
pnpm secret:prod R2_ACCESS_KEY_ID
pnpm secret:prod R2_SECRET_ACCESS_KEY
pnpm deploy:prod
```

Wrangler prints each Worker's URL after deploy (e.g. `https://media-signer-dev.<account>.workers.dev`). Paste it into `src/app/r2.config.ts` as `signerUrl`, and the public base into `publicBase`.

## Local development

```bash
pnpm dev
```

`wrangler dev` runs the Worker on `http://127.0.0.1:8787`. Set `signerUrl` in `r2.config.ts` to that URL temporarily to exercise the upload flow against a real R2 bucket from a local Angular dev server.

## Limits and known constraints

- Presigned URLs expire after `PRESIGN_TTL_SECONDS` (default 300). The client should always request a fresh URL per upload — don't cache.
- The Worker does not enforce per-kind size limits; the client does. A signed URL technically allows the holder to upload a body of any size up to R2's per-object limit. Acceptable today because only authenticated members can request URLs.
- CORS on the signed URL itself is enforced by R2 bucket CORS, not the Worker. Update the bucket CORS rule when the app gains a new origin.
