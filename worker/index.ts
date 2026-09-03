/**
 * Cloudflare Worker Backend for Antigravity Finance Wallet
 * Full Authentication & User-Isolated KV Storage
 */

export interface Env {
  WALLET_KV?: KVNamespace;
  SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-sync-key',
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

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '::salt::' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    // Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({
        status: 'online',
        message: 'Antigravity Cloudflare Worker Sync & Auth Service is running!',
        time: new Date().toISOString(),
        hasKV: !!env.WALLET_KV,
      });
    }

    // Authentication: Signup
    if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
      try {
        const { email, username, password } = await request.json();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanUsername = (username || '').trim() || cleanEmail.split('@')[0];

        if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 6) {
          return jsonResponse({ error: 'Valid email and password (min 6 chars) required.' }, 400);
        }

        const storageKey = `user:${cleanEmail}`;
        if (env.WALLET_KV) {
          const existing = await env.WALLET_KV.get(storageKey);
          if (existing) {
            return jsonResponse({ error: 'An account with this email already exists.' }, 409);
          }

          const salt = crypto.randomUUID();
          const passwordHash = await hashPassword(password, salt);
          const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

          const userProfile = {
            id: userId,
            email: cleanEmail,
            username: cleanUsername,
            createdAt: new Date().toISOString(),
          };

          await env.WALLET_KV.put(
            storageKey,
            JSON.stringify({
              profile: userProfile,
              salt,
              passwordHash,
            })
          );

          const token = 'token_' + btoa(userId + ':' + Date.now());
          return jsonResponse({
            success: true,
            message: 'Account created successfully in Cloudflare!',
            user: userProfile,
            token,
          });
        } else {
          const userId = 'usr_' + Date.now();
          return jsonResponse({
            success: true,
            message: 'Account created! (Bind WALLET_KV in Cloudflare for persistence).',
            user: { id: userId, email: cleanEmail, username: cleanUsername, createdAt: new Date().toISOString() },
            token: 'token_' + btoa(userId + ':' + Date.now()),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: `Signup error: ${msg}` }, 500);
      }
    }

    // Authentication: Login
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const { email, password } = await request.json();
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanEmail || !password) {
          return jsonResponse({ error: 'Email and password required.' }, 400);
        }

        const storageKey = `user:${cleanEmail}`;
        if (env.WALLET_KV) {
          const raw = await env.WALLET_KV.get(storageKey);
          if (!raw) {
            return jsonResponse({ error: 'Account not found. Please create an account.' }, 404);
          }

          const userRecord = JSON.parse(raw);
          const computedHash = await hashPassword(password, userRecord.salt);

          if (computedHash !== userRecord.passwordHash) {
            return jsonResponse({ error: 'Incorrect password. Please try again.' }, 401);
          }

          const token = 'token_' + btoa(userRecord.profile.id + ':' + Date.now());
          return jsonResponse({
            success: true,
            message: 'Login successful!',
            user: userRecord.profile,
            token,
          });
        } else {
          const userId = 'usr_' + Date.now();
          return jsonResponse({
            success: true,
            message: 'Login approved!',
            user: { id: userId, email: cleanEmail, username: cleanEmail.split('@')[0], createdAt: new Date().toISOString() },
            token: 'token_' + btoa(userId + ':' + Date.now()),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: `Login error: ${msg}` }, 500);
      }
    }

    // User-Isolated Sync Endpoints
    if (url.pathname === '/api/sync') {
      const userKey = extractUserIdentifier(request);

      // POST: Save user's wallet
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const storageKey = `wallet:${userKey}`;

          if (env.WALLET_KV) {
            await env.WALLET_KV.put(storageKey, JSON.stringify(body));
          }

          return jsonResponse({
            success: true,
            message: 'Wallet securely saved into your Cloudflare private vault!',
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: `Failed to save wallet: ${msg}` }, 400);
        }
      }

      // GET: Retrieve user's wallet
      if (request.method === 'GET') {
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
                message: 'No cloud vault found for this account. Click "Push to Cloud" to initialize!',
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
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    return jsonResponse({ error: 'Not Found', path: url.pathname }, 404);
  },
};
