/**
 * Cloudflare Worker Backend for Antigravity Finance Wallet
 *
 * Deploy with:
 *   cd worker
 *   npm install
 *   npx wrangler deploy
 */

export interface Env {
  // Cloudflare KV Namespace binding
  WALLET_KV?: KVNamespace;
  // Cloudflare D1 Database binding
  DB?: D1Database;
  // Optional master sync authorization key
  SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-key, Authorization',
};

function handleCorsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    // 2. Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({
        status: 'online',
        message: 'Antigravity Cloudflare Worker Sync Service is running!',
        time: new Date().toISOString(),
        hasKV: !!env.WALLET_KV,
      });
    }

    // 3. Sync Endpoints
    if (url.pathname === '/api/sync') {
      const syncKey = request.headers.get('x-sync-key') || 'default-wallet';

      // Optional secret check if SYNC_SECRET environment variable is set
      if (env.SYNC_SECRET && syncKey !== env.SYNC_SECRET) {
        return jsonResponse({ error: 'Unauthorized: Invalid Sync Key' }, 401);
      }

      // POST: Save backup state
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const storageKey = `backup:${syncKey}`;

          if (env.WALLET_KV) {
            await env.WALLET_KV.put(storageKey, JSON.stringify(body));
          }

          return jsonResponse({
            success: true,
            message: 'Backup stored successfully in Cloudflare!',
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: `Failed to save backup: ${msg}` }, 400);
        }
      }

      // GET: Retrieve latest backup state
      if (request.method === 'GET') {
        try {
          const storageKey = `backup:${syncKey}`;
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
                message: 'No existing cloud backup found for this sync key. Save one first!',
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
          return jsonResponse({ error: `Failed to load backup: ${msg}` }, 500);
        }
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    return jsonResponse({ error: 'Not Found', path: url.pathname }, 404);
  },
};
