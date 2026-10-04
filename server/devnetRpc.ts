import type { Express } from 'express';

// No URL supplied by a browser or an environment variable can change this cluster.
export const DEVNET_RPC = 'https://api.devnet.solana.com';
const METHODS = new Set([
  'getGenesisHash', 'getBalance', 'getLatestBlockhash', 'getFeeForMessage',
  'sendTransaction', 'getSignatureStatuses', 'getBlockHeight',
]);

export function registerDevnetRpc(app: Express) {
  app.post('/api/matepay/devnet/rpc', async (req, res) => {
    const { id, method, params = [] } = req.body ?? {};
    if (!METHODS.has(method) || !Array.isArray(params)) {
      return res.status(400).json({ error: 'Método RPC no permitido para esta demo Devnet.' });
    }
    try {
      const upstream = await fetch(DEVNET_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!upstream.ok) {
        return res.status(upstream.status === 429 ? 429 : 502).json({
          error: 'El RPC público de Devnet no respondió. Esperá un momento y reintentá.',
        });
      }
      return res.json(await upstream.json());
    } catch {
      return res.status(502).json({ error: 'No pudimos comunicarnos con Solana Devnet.' });
    }
  });
}
