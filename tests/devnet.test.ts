import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Connection, Keypair, SystemInstruction, Transaction } from '@solana/web3.js';
import {
  assertDevnet, DEVNET_GENESIS_HASH, parseTestSol, prepareTestTransfer,
  signedSignature, testRecipient, transferStatus, validateSignedTransfer,
} from '../src/services/devnetService';
import express from 'express';
import { registerDevnetRpc, DEVNET_RPC } from '../server/devnetRpc';

const sender = Keypair.generate();
const recipient = Keypair.generate();
function mockConnection(overrides: Record<string, unknown> = {}) {
  return {
    getGenesisHash: async () => DEVNET_GENESIS_HASH,
    getLatestBlockhash: async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 }),
    getBalance: async () => 1_000_000_000,
    getFeeForMessage: async () => ({ value: 5000 }),
    getSignatureStatuses: async () => ({ value: [null] }),
    ...overrides,
  } as unknown as Connection;
}

test('montos exactos en lamports y límites de prueba', () => {
  assert.equal(parseTestSol('0,001'), 1_000_000);
  assert.equal(parseTestSol('0.000000001'), 1);
  assert.equal(parseTestSol('0.1'), 100_000_000);
  for (const invalid of ['0', '-1', '0.100000001', '1e-3', 'NaN', '0.0000000001', '1', 'Infinity', '']) {
    assert.throws(() => parseTestSol(invalid));
  }
});

test('direcciones ficticias y autopagos no se aceptan', () => {
  assert.throws(() => testRecipient('no-es-una-direccion', sender.publicKey));
  assert.throws(() => testRecipient('7xKXtg2CW87d97TXJSD8j9P4mZ7a8B3cDevnetDemo1', sender.publicKey));
  assert.throws(() => testRecipient(sender.publicKey.toBase58(), sender.publicKey));
  assert.equal(testRecipient(recipient.publicKey.toBase58(), sender.publicKey).toBase58(), recipient.publicKey.toBase58());
});

test('un RPC de otra red queda bloqueado antes de construir el envío', async () => {
  await assert.rejects(() => assertDevnet(mockConnection({ getGenesisHash: async () => 'mainnet' })), /no es Solana Devnet/);
});

test('saldo debe cubrir transferencia y comisión', async () => {
  await assert.rejects(() => prepareTestTransfer(mockConnection({ getBalance: async () => 1_000_000 }), sender.publicKey, recipient.publicKey.toBase58(), '0.001'), /insuficiente/);
  await assert.rejects(() => prepareTestTransfer(mockConnection({ getFeeForMessage: async () => ({ value: null }) }), sender.publicKey, recipient.publicKey.toBase58(), '0.001'), /estimar/);
});

test('transacción real con destino y monto esperados, sin claves del usuario', async () => {
  const result = await prepareTestTransfer(mockConnection(), sender.publicKey, recipient.publicKey.toBase58(), '0.001');
  const transfer = SystemInstruction.decodeTransfer(result.transaction.instructions[0]);
  assert.equal(transfer.toPubkey.toBase58(), recipient.publicKey.toBase58());
  assert.equal(transfer.lamports, 1_000_000n);
  assert.ok(result.transaction.feePayer?.equals(sender.publicKey));
  const message = result.transaction.serializeMessage();
  assert.throws(() => validateSignedTransfer(message, result.transaction));
  result.transaction.sign(sender); // Ephemeral test signer, not the user's wallet.
  const raw = validateSignedTransfer(message, result.transaction);
  assert.ok(Transaction.from(raw).verifySignatures());
  assert.ok(signedSignature(result.transaction).length > 80);
  result.transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  assert.throws(() => validateSignedTransfer(message, result.transaction), /cambió/);
});

test('enviado y processed no equivalen a confirmado, errores nunca dan éxito', async () => {
  for (const [status, expected] of [
    [null, 'pending'],
    [{ err: null, confirmationStatus: 'processed' }, 'pending'],
    [{ err: null, confirmationStatus: 'confirmed' }, 'confirmed'],
    [{ err: null, confirmationStatus: 'finalized' }, 'confirmed'],
    [{ err: { InstructionError: [0, 'error'] }, confirmationStatus: 'confirmed' }, 'failed'],
  ] as const) {
    assert.equal(await transferStatus(mockConnection({ getSignatureStatuses: async () => ({ value: [status] }) }), 'signature'), expected);
  }
});

test('proxy ignora cualquier URL cliente y solo permite métodos para Devnet', async () => {
  const app = express();
  app.use(express.json());
  registerDevnetRpc(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const endpoint = `http://127.0.0.1:${address.port}/api/matepay/devnet/rpc`;
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (input, options) => {
    if (String(input) === endpoint) return originalFetch(input, options);
    upstreamCalls++;
    assert.equal(input, DEVNET_RPC);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: DEVNET_GENESIS_HASH }));
  };
  try {
    const post = (body: unknown) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ method: 'requestAirdrop', params: [] })).status, 400);
    assert.equal((await post({ method: 'getBalance', params: {} })).status, 400);
    const result = await post({ id: 1, method: 'getGenesisHash', params: [], url: 'https://api.mainnet-beta.solana.com' });
    assert.equal((await result.json()).result, DEVNET_GENESIS_HASH);
    assert.equal(upstreamCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
