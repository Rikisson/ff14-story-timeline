# media-signer

Cloudflare Worker that issues short-lived presigned R2 URLs to authenticated universe members. The Angular app calls `/sign-upload` and `/sign-delete`; the Worker verifies the user's Firebase ID token, confirms membership against Firestore, and signs a 5-minute S3-compatible URL the client uses directly against R2.

## Posture

Single environment by design: localhost dev and the deployed app both hit this Worker and the same R2 bucket. Test uploads land in the same bucket as real ones — easy to clean up while volume is low. Split into `[env.dev]` / `[env.prod]` (in `wrangler.toml`) when real users would notice if a deploy broke things.

## Contract

All routes accept `POST` with `Authorization: Bearer <firebase-id-token>`.

`/sign-upload` body:

```json
{
  "universeId": "...",
  "kind": "cover | sprite | background | ambient | sfx",
  "assetId": "...",
  "filename": "...",
  "byteLength": 12345
}
```

`/sign-delete` body (no `byteLength`):

```json
{
  "universeId": "...",
  "kind": "...",
  "assetId": "...",
  "filename": "..."
}
```

Responses:

- `POST /sign-upload` → `{ "uploadUrl": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }`. The signed URL binds `Content-Length` — the client must PUT exactly `byteLength` bytes (browsers set Content-Length from the blob size automatically).
- `POST /sign-delete` → `{ "deleteUrl": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }`
- `POST /bulk-delete` → see below.
- `4xx`/`5xx` → `{ "error": "..." }`. `401` (auth), `403` (membership), `400` (validation), `413` (kind byte cap), `507` (universe storage / count cap), `429` (rate limit), `404` (route).

The client `PUT`s or `DELETE`s the asset body directly to the returned URL. Public reads are served from `R2_PUBLIC_BASE` (custom domain or `r2.dev`), composed by the client as `${R2_PUBLIC_BASE}/universes/{u}/{kind}/{assetId}/{filename}`.

### `/bulk-delete`

Server-side bulk deletion. Used by the universe-deletion cascade walker so a single soft-deleted universe's cleanup doesn't bottleneck on browser concurrent-connection limits.

```json
{
  "universeId": "...",
  "keys": [
    "universes/{u}/cover/{assetId}/{filename}",
    "universes/{u}/cover/{assetId}/{filename}.thumb.webp"
  ]
}
```

- Max 50 keys per call (returns `400` above).
- Each key must start with `universes/{universeId}/` matching the body's `universeId`.
- Counted as **one** rate-limited request regardless of key count.
- Response: `{ "results": [{ "key": "...", "ok": true, "status": 204 }, ...] }`. 404 from R2 is treated as success (idempotent — already-deleted is fine).

## One-time Cloudflare setup

```bash
# Authenticate Wrangler with your Cloudflare account.
npx wrangler login

# Create the R2 bucket.
npx wrangler r2 bucket create narrative
```

Configure the bucket for **public reads** (Cloudflare dashboard: R2 → bucket → Settings → Public access). Bind a custom domain if you want a portable URL; otherwise note the bucket's `*.r2.dev` URL. Add a CORS rule to the bucket allowing `GET, PUT, DELETE` from every origin the app runs on — `GET` is required so the universe-export feature can `fetch()` asset binaries into a `.universe` archive (without it, `<img>` tags still render but export silently produces metadata-only archives):

```json
[
  {
    "AllowedOrigins": ["http://localhost:4200", "https://<you>.github.io"],
    "AllowedMethods": ["GET", "PUT", "DELETE"],
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
- The Worker enforces per-kind stored byte caps and a per-universe 500 MB / 500-doc ceiling (read from `universes/{u}` counters via Firestore REST) before signing. The signed PUT URL also binds `Content-Length`, so a holder cannot upload a body larger than what they declared.
- **Rate limit**: 30 requests/minute per UID across all routes, backed by the `MEDIA_RATE_LIMIT` KV namespace. Fixed minute buckets. Over-cap requests return `429`. The limit is sloppy under high concurrency (KV has no atomic increment); a hard ceiling lives on the Cloud Billing budget alert.
- **KV bootstrap (one-time)**: `pnpm exec wrangler kv namespace create MEDIA_RATE_LIMIT` then paste the printed id into `wrangler.toml`'s `[[kv_namespaces]]` block. Without this, the Worker returns 500 on every request.
- CORS on the signed URL itself is enforced by R2 bucket CORS, not the Worker. Update the bucket CORS rule when the app gains a new origin.
