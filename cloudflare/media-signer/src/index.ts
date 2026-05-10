import { AwsClient } from 'aws4fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  FIREBASE_PROJECT_ID: string;
  PRESIGN_TTL_SECONDS: string;
  R2_BUCKET: string;
  R2_PUBLIC_BASE: string;
  ALLOWED_ORIGIN: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

const ASSET_KINDS = ['cover', 'sprite', 'background', 'ambient', 'sfx'] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

interface SignBody {
  universeId: string;
  kind: AssetKind;
  assetId: string;
  filename: string;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILENAME = /^[\w.\-]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    try {
      if (route !== 'POST /sign-upload' && route !== 'POST /sign-delete') {
        return error(env, 404, 'Not found');
      }
      const uid = await verifyAuth(request, env);
      const body = parseBody(await request.json());
      await assertMembership(env, uid, body.universeId);
      const method = url.pathname === '/sign-upload' ? 'PUT' : 'DELETE';
      const signed = await signR2Url(env, body, method);
      const responseKey = method === 'PUT' ? 'uploadUrl' : 'deleteUrl';
      return json(env, { [responseKey]: signed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.startsWith('AUTH:')
        ? 401
        : message.startsWith('FORBIDDEN:')
          ? 403
          : 400;
      return error(env, status, message);
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

async function assertMembership(env: Env, uid: string, universeId: string): Promise<void> {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/universes/${universeId}`;
  const res = await fetch(docUrl);
  if (res.status === 404) throw new Error('FORBIDDEN: universe not found');
  if (!res.ok) throw new Error(`FORBIDDEN: universe lookup failed (${res.status})`);
  const data = (await res.json()) as { fields?: Record<string, FirestoreField> };
  const ownerUid = stringField(data.fields?.['ownerUid']);
  const editorUids = arrayStringField(data.fields?.['editorUids']);
  if (ownerUid !== uid && !editorUids.includes(uid)) {
    throw new Error('FORBIDDEN: not a member of this universe');
  }
}

function parseBody(raw: unknown): SignBody {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid body');
  const r = raw as Record<string, unknown>;
  const universeId = String(r['universeId'] ?? '');
  const kind = String(r['kind'] ?? '') as AssetKind;
  const assetId = String(r['assetId'] ?? '');
  const filename = String(r['filename'] ?? '');
  if (!PATH_SEGMENT.test(universeId)) throw new Error('Invalid universeId');
  if (!ASSET_KINDS.includes(kind)) throw new Error('Invalid kind');
  if (!PATH_SEGMENT.test(assetId)) throw new Error('Invalid assetId');
  if (!FILENAME.test(filename) || filename === '.' || filename === '..') {
    throw new Error('Invalid filename');
  }
  return { universeId, kind, assetId, filename };
}

async function signR2Url(env: Env, body: SignBody, method: 'PUT' | 'DELETE'): Promise<string> {
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
  const signed = await r2.sign(new Request(target.toString(), { method }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

type FirestoreField = {
  stringValue?: string;
  arrayValue?: { values?: FirestoreField[] };
};

function stringField(field: FirestoreField | undefined): string | undefined {
  return field?.stringValue;
}

function arrayStringField(field: FirestoreField | undefined): string[] {
  const values = field?.arrayValue?.values ?? [];
  return values.map((v) => v.stringValue ?? '').filter((s) => s.length > 0);
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function error(env: Env, status: number, message: string): Response {
  return json(env, { error: message }, status);
}
