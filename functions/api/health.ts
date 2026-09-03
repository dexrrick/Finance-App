interface Env {
  WALLET_KV?: KVNamespace;
  SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-key, Authorization',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet = async (context: { env: Env }) => {
  const { env } = context;
  return new Response(
    JSON.stringify({
      status: 'online',
      message: 'Cloudflare Pages Functions Backend is active and connected!',
      time: new Date().toISOString(),
      hasKV: !!env.WALLET_KV,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    }
  );
};
