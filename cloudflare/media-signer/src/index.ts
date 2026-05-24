import { AwsClient } from 'aws4fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  AssetKind,
  parseBulkDeleteBody,
  parseDeleteBody,
  parseSignBody,
} from './parse-body';
import { assertByteCap, assertUniverseCap } from './quotas';
import { checkRateLimit } from './rate-limit';

interface Env {
  FIREBASE_PROJECT_ID: string;
  PRESIGN_TTL_SECONDS: string;
  R2_BUCKET: string;
  R2_PUBLIC_BASE: string;
  ALLOWED_ORIGINS: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  MEDIA_RATE_LIMIT: KVNamespace;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request.headers.get('Origin'));
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    try {
      const uid = await verifyAuth(request, env);
      if (!(await checkRateLimit(env.MEDIA_RATE_LIMIT, uid))) {
        return errorResp(cors, 429, 'Too many requests. Wait a minute before retrying.');
      }
      const rawBody = await request.json();

      if (route === 'POST /sign-upload') {
        const body = parseSignBody(rawBody);
        const counters = await loadUniverseForUpload(env, uid, body.universeId);
        assertByteCap(body.kind, body.byteLength);
        assertUniverseCap({ ...counters, byteLength: body.byteLength });
        const signed = await signR2Url(env, body, 'PUT');
        return jsonResp(cors, { uploadUrl: signed });
      }
      if (route === 'POST /sign-delete') {
        const body = parseDeleteBody(rawBody);
        await assertMembership(env, uid, body.universeId);
        const signed = await signR2Url(env, { ...body, byteLength: 0 }, 'DELETE');
        return jsonResp(cors, { deleteUrl: signed });
      }
      if (route === 'POST /bulk-delete') {
        const body = parseBulkDeleteBody(rawBody);
        await assertMembership(env, uid, body.universeId);
        const results = await bulkDeleteR2Objects(env, body.keys);
        return jsonResp(cors, { results });
      }
      return errorResp(cors, 404, 'Not found');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      let status = 400;
      if (message.startsWith('AUTH:')) status = 401;
      else if (message.startsWith('FORBIDDEN:')) status = 403;
      else if (/too large/i.test(message)) status = 413;
      else if (/storage cap exceeded|asset count cap reached/i.test(message)) status = 507;
      return errorResp(cors, status, message);
    }
  },
};

async function verifyAuth(request: Request, env: Env): Promise<string> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('AUTH: missing bearer token');
  const token = auth.slice('Bearer '.length).trim();
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    audience: env.FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('AUTH: token missing uid');
  }
  return payload.sub;
}

interface UniverseCountersSnapshot {
  storageBytes: number;
  assetCount: number;
}

async function loadUniverseForUpload(
  env: Env,
  uid: string,
  universeId: string,
): Promise<UniverseCountersSnapshot> {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/universes/${universeId}`;
  const res = await fetch(docUrl);
  if (res.status === 404) throw new Error('FORBIDDEN: universe not found');
  if (!res.ok) throw new Error(`FORBIDDEN: universe lookup failed (${res.status})`);
  const data = (await res.json()) as { fields?: Record<string, FirestoreField> };
  const authorUid = stringField(data.fields?.['authorUid']);
  const editorUids = arrayStringField(data.fields?.['editorUids']);
  if (authorUid !== uid && !editorUids.includes(uid)) {
    throw new Error('FORBIDDEN: not a member of this universe');
  }
  return {
    storageBytes: integerField(data.fields?.['storageBytes']),
    assetCount: integerField(data.fields?.['assetCount']),
  };
}

async function assertMembership(env: Env, uid: string, universeId: string): Promise<void> {
  await loadUniverseForUpload(env, uid, universeId);
}

async function signR2Url(
  env: Env,
  body: {
    universeId: string;
    kind: AssetKind;
    assetId: string;
    filename: string;
    byteLength: number;
  },
  method: 'PUT' | 'DELETE',
): Promise<string> {
  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const key = `universes/${body.universeId}/${body.kind}/${body.assetId}/${body.filename}`;
  const ttl = Number(env.PRESIGN_TTL_SECONDS) || 300;
  const target = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`,
  );
  target.searchParams.set('X-Amz-Expires', String(ttl));
  const headers: Record<string, string> =
    method === 'PUT' ? { 'Content-Length': String(body.byteLength) } : {};
  const signed = await r2.sign(new Request(target.toString(), { method, headers }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

interface BulkDeleteResult {
  key: string;
  ok: boolean;
  status: number;
}

async function bulkDeleteR2Objects(env: Env, keys: string[]): Promise<BulkDeleteResult[]> {
  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  return Promise.all(
    keys.map(async (key) => {
      const target = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
      const signed = await r2.sign(new Request(target, { method: 'DELETE' }));
      const res = await fetch(signed);
      return { key, ok: res.ok || res.status === 404, status: res.status };
    }),
  );
}

type FirestoreField = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  arrayValue?: { values?: FirestoreField[] };
};

function stringField(field: FirestoreField | undefined): string | undefined {
  return field?.stringValue;
}

function arrayStringField(field: FirestoreField | undefined): string[] {
  const values = field?.arrayValue?.values ?? [];
  return values.map((v) => v.stringValue ?? '').filter((s) => s.length > 0);
}

function integerField(field: FirestoreField | undefined): number {
  if (!field) return 0;
  if (typeof field.integerValue === 'string') return Number(field.integerValue);
  if (typeof field.doubleValue === 'number') return field.doubleValue;
  return 0;
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  // Multiple allowed origins (e.g. localhost + GitHub Pages) — CORS only
  // permits one value per response, so echo back the request's Origin if it
  // appears in the allowlist; otherwise fall back to the first allowed entry.
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const echo = origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*');
  return {
    'Access-Control-Allow-Origin': echo,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResp(cors: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function errorResp(cors: Record<string, string>, status: number, message: string): Response {
  return jsonResp(cors, { error: message }, status);
}
