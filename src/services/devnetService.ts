import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

export const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const MAX_TEST_SOL = 0.1;
const DEMO_ADDRESSES = new Set([
  '7xKXtg2CW87d97TXJSD8j9P4mZ7a8B3cDevnetDemo1',
  '4uQeVj5tqViQh7yVWzmKb7P3n9A8B6cDevnetMauricio',
  '3mK9tg5VW87d97TXJSD8j9P4mZ7a8B3cDevnetJuanPablo',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'SuperteamArgDevnetPublicAddress11111111111111',
]);

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  on(event: 'accountChanged', handler: (key: PublicKey | null) => void): void;
  on(event: 'disconnect', handler: () => void): void;
  removeListener(event: 'accountChanged', handler: (key: PublicKey | null) => void): void;
  removeListener(event: 'disconnect', handler: () => void): void;
}

export function getPhantom(): PhantomProvider | undefined {
  const injected = window as typeof window & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const provider = injected.phantom?.solana ?? injected.solana;
  return provider?.isPhantom ? provider : undefined;
}

export function devnetConnection() {
  return new Connection(new URL('/api/matepay/devnet/rpc', window.location.origin).href, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(25_000) }),
  });
}

export async function assertDevnet(connection: Connection) {
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
    throw new Error('La red no es Solana Devnet. Se bloqueó la operación.');
  }
}

// Decimal string parsing avoids floating point truncation of lamports.
export function parseTestSol(value: string): number {
  const text = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,9})?$/.test(text)) {
    throw new Error('Ingresá un monto válido, con hasta 9 decimales.');
  }
  const [whole, fraction = ''] = text.split('.');
  const lamports = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
  if (lamports <= 0n || lamports > 100_000_000n) {
    throw new Error('El monto de prueba debe ser mayor a 0 y de hasta 0,1 SOL.');
  }
  return Number(lamports);
}

export function testRecipient(value: string, sender: PublicKey): PublicKey {
  if (DEMO_ADDRESSES.has(value.trim())) {
    throw new Error('Esta dirección pertenece a la simulación. Usá otra billetera de prueba de Phantom.');
  }
  let recipient: PublicKey;
  try {
    recipient = new PublicKey(value.trim());
  } catch {
    throw new Error('La dirección de destino no es una clave pública válida de Solana.');
  }
  if (!PublicKey.isOnCurve(recipient.toBytes())) {
    throw new Error('Usá la dirección de una billetera de prueba, no una cuenta de programa.');
  }
  if (recipient.equals(sender)) throw new Error('Usá otra billetera de prueba como destinatario.');
  return recipient;
}

export async function prepareTestTransfer(connection: Connection, sender: PublicKey, destination: string, amount: string) {
  const lamports = parseTestSol(amount);
  const recipient = testRecipient(destination, sender);
  await assertDevnet(connection);
  const latest = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({ feePayer: sender, ...latest }).add(
    SystemProgram.transfer({ fromPubkey: sender, toPubkey: recipient, lamports }),
  );
  const [balance, feeResult] = await Promise.all([
    connection.getBalance(sender, 'confirmed'),
    connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
  ]);
  if (feeResult.value === null) throw new Error('No pudimos estimar la comisión. Volvé a intentar.');
  if (balance < lamports + feeResult.value) {
    throw new Error('Saldo Devnet insuficiente para el monto y la comisión. Pedí SOL de prueba en el faucet.');
  }
  return { transaction, recipient, lamports, fee: feeResult.value };
}

export function validateSignedTransfer(unsignedMessage: Uint8Array, signed: Transaction) {
  const message = signed.serializeMessage();
  if (message.length !== unsignedMessage.length || message.some((byte, index) => byte !== unsignedMessage[index])) {
    throw new Error('La transacción firmada cambió respecto de la solicitada.');
  }
  // Serialization checks all required signatures before any broadcast.
  return signed.serialize({ requireAllSignatures: true, verifySignatures: true });
}

export function signedSignature(signed: Transaction): string {
  if (!signed.signature) throw new Error('Phantom no devolvió una firma. No se envió la transferencia.');
  return bs58.encode(signed.signature);
}

export async function transferStatus(connection: Connection, signature: string): Promise<'pending' | 'confirmed' | 'failed'> {
  await assertDevnet(connection);
  const result = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const status = result.value[0];
  if (!status) return 'pending';
  if (status.err) return 'failed';
  return status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized'
    ? 'confirmed' : 'pending';
}

export const explorerTransaction = (signature: string) =>
  `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;

export function walletError(error: unknown): string {
  if ((error as { code?: number })?.code === 4001) return 'Rechazaste la solicitud en Phantom. No se envió la transferencia.';
  return error instanceof Error ? error.message : 'No pudimos completar la operación.';
}
