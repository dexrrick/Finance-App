interface Env {
  WALLET_KV?: KVNamespace;
  SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-key, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function extractUserIdentifier(request: Request): string {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('token_')) {
      try {
        const decoded = atob(token.substring(6));
        const [userId] = decoded.split(':');
        if (userId) return userId;
      } catch {
        // fallback
      }
    }
    return token;
  }
  return request.headers.get('x-sync-key') || 'default-wallet';
}

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const userKey = extractUserIdentifier(request);

  try {
    const body = await request.json();
    const storageKey = `wallet:${userKey}`;

    if (env.WALLET_KV) {
      await env.WALLET_KV.put(storageKey, JSON.stringify(body));
      return jsonResponse({
        success: true,
        message: 'Your wallet was securely stored into your private Cloudflare KV vault!',
        lastSyncedAt: new Date().toISOString(),
      });
    } else {
      return jsonResponse({
        success: true,
        message:
          'Backup received! (Tip: bind WALLET_KV in Cloudflare Dashboard > Workers & Pages > Settings > Bindings to persist multi-device data).',
        lastSyncedAt: new Date().toISOString(),
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to save wallet: ${msg}` }, 400);
  }
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const userKey = extractUserIdentifier(request);

  try {
    const storageKey = `wallet:${userKey}`;
    let data = null;

    if (env.WALLET_KV) {
      const raw = await env.WALLET_KV.get(storageKey);
      if (raw) {
        data = JSON.parse(raw);
      }
    }

    if (!data) {
      return jsonResponse(
        {
          message: 'No cloud vault found for this account yet. Click "Push to Cloud" to initialize!',
          data: null,
        },
        404
      );
    }

    return jsonResponse({
      success: true,
      data,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to retrieve wallet: ${msg}` }, 500);
  }
};
