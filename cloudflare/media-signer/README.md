# media-signer

Cloudflare Worker that issues short-lived presigned R2 URLs to authenticated universe members. The Angular app calls `/sign-upload` and `/sign-delete`; the Worker verifies the user's Firebase ID token, confirms membership against Firestore, and signs a 5-minute S3-compatible URL the client uses directly against R2.

## Posture

Single environment by design: localhost dev and the deployed app both hit this Worker and the same R2 bucket. Test uploads land in the same bucket as real ones — easy to clean up while volume is low. Split into `[env.dev]` / `[env.prod]` (in `wrangler.toml`) when real users would notice if a deploy broke things.

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

The client `PUT`s or `DELETE`s the asset body directly to the returned URL. Public reads are served from `R2_PUBLIC_BASE` (custom domain or `r2.dev`), composed by the client as `${R2_PUBLIC_BASE}/universes/{u}/{kind}/{assetId}/{filename}`.

## One-time Cloudflare setup

```bash
# Authenticate Wrangler with your Cloudflare account.
npx wrangler login

# Create the R2 bucket.
npx wrangler r2 bucket create narrative
```

Configure the bucket for **public reads** (Cloudflare dashboard: R2 → bucket → Settings → Public access). Bind a custom domain if you want a portable URL; otherwise note the bucket's `*.r2.dev` URL. Add a CORS rule to the bucket allowing `PUT, DELETE` from every origin the app runs on:

```json
[
  {
    "AllowedOrigins": ["http://localhost:4200", "https://<you>.github.io"],
    "AllowedMethods": ["PUT", "DELETE"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "MaxAgeSeconds": 86400
  }
]
```

Create an R2 API token scoped to this bucket (Cloudflare dashboard: R2 → Manage R2 API Tokens). The token gives an access key id + secret — save them, secrets are shown once.

## Deploy

Edit `wrangler.toml` and fill in `R2_BUCKET`, `R2_PUBLIC_BASE`, and `ALLOWED_ORIGINS` (comma-separated — at minimum `http://localhost:4200,https://<you>.github.io`). Then push the secrets and deploy:

```bash
# --ignore-workspace because the repo root has its own pnpm-lock.yaml; without
# it pnpm walks up and skips the Worker's deps.
pnpm install --ignore-workspace
pnpm secret:put R2_ACCOUNT_ID
pnpm secret:put R2_ACCESS_KEY_ID
pnpm secret:put R2_SECRET_ACCESS_KEY
pnpm deploy
```

If `pnpm dev` later complains about missing `workerd` or `esbuild` binaries, run `pnpm approve-builds` and pick the build scripts the warning lists — pnpm doesn't run postinstall scripts unless you opt in.

Wrangler prints the Worker's URL after deploy (e.g. `https://media-signer.<account>.workers.dev`). Paste it into `src/app/r2.config.ts` as `signerUrl`, and the bucket public base into `publicBase`.

## Local development

```bash
pnpm dev
```

`wrangler dev` runs the Worker on `http://127.0.0.1:8787`. Point `signerUrl` in `r2.config.ts` at it temporarily to exercise uploads against the real R2 bucket from a local Angular dev server.

## Limits and known constraints

- Presigned URLs expire after `PRESIGN_TTL_SECONDS` (default 300). Always request a fresh URL per upload — don't cache.
- The Worker does not enforce per-kind size limits; the client does. A signed URL technically allows the holder to upload up to R2's per-object limit. Acceptable today because only authenticated members can request URLs.
- CORS on the signed URL itself is enforced by R2 bucket CORS, not the Worker. Update the bucket CORS rule when the app gains a new origin.
