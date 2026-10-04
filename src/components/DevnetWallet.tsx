import React, { useEffect, useRef, useState } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Wallet, ExternalLink, RefreshCw } from 'lucide-react';
import {
  assertDevnet, devnetConnection, explorerTransaction, getPhantom,
  prepareTestTransfer, signedSignature, transferStatus, validateSignedTransfer, walletError,
} from '../services/devnetService';
import type { PhantomProvider } from '../services/devnetService';

type Receipt = { signature: string; sender: string; recipient: string; sol: number; fee: number; status: 'pending' | 'confirmed' | 'failed' };
const button = 'rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed';

export function DevnetWallet() {
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const provider = useRef<PhantomProvider | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const locked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let detach = () => {};
    const detect = () => {
      const wallet = getPhantom();
      if (!wallet || provider.current) return;
      provider.current = wallet;
      setAvailable(true);
      const changed = (key: PublicKey | null) => {
        generation.current += 1;
        setAddress(key?.toBase58() ?? '');
        setBalance(null);
        setFee(null);
      };
      const disconnected = () => changed(null);
      wallet.on('accountChanged', changed);
      wallet.on('disconnect', disconnected);
      detach = () => {
        wallet.removeListener('accountChanged', changed);
        wallet.removeListener('disconnect', disconnected);
      };
    };
    detect();
    const interval = window.setInterval(detect, 1000);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.clearInterval(interval);
      detach();
    };
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const connection = devnetConnection();
    (async () => {
      try {
        await assertDevnet(connection);
        const value = await connection.getBalance(new PublicKey(address), 'confirmed');
        if (!cancelled) setBalance(value / LAMPORTS_PER_SOL);
      } catch (err) {
        if (!cancelled) setError(walletError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { if (mounted.current) setError(walletError(err)); }
    finally {
      locked.current = false;
      if (mounted.current) { setBusy(false); setStage(''); }
    }
  }

  const connect = () => run(async () => {
    const wallet = getPhantom();
    if (!wallet) throw new Error('Abrí MatePay en el navegador donde tenés instalada la extensión Phantom.');
    setStage('Esperando conexión en Phantom…');
    const connected = await wallet.connect();
    if (mounted.current) {
      generation.current += 1;
      setAddress(connected.publicKey.toBase58());
    }
  });

  const refresh = () => run(async () => {
    const connection = devnetConnection();
    const version = generation.current;
    await assertDevnet(connection);
    const value = await connection.getBalance(new PublicKey(address), 'confirmed');
    if (mounted.current && version === generation.current) setBalance(value / LAMPORTS_PER_SOL);
  });

  const checkReceipt = () => run(async () => {
    if (!receipt) return;
    const status = await transferStatus(devnetConnection(), receipt.signature);
    if (mounted.current) {
      setReceipt({ ...receipt, status });
      if (status === 'failed') setError('La transacción falló en Devnet. Revisá el detalle en Explorer.');
    }
  });

  const send = () => run(async () => {
    if (receipt?.status === 'pending') throw new Error('Primero verificá la transferencia pendiente en Explorer.');
    const wallet = provider.current;
    if (!wallet?.publicKey || wallet.publicKey.toBase58() !== address) {
      throw new Error('Conectá la cuenta de Phantom que querés usar.');
    }
    const sender = new PublicKey(address);
    const version = generation.current;
    const sameAccount = () => {
      if (!mounted.current || version !== generation.current || wallet.publicKey?.toBase58() !== address) {
        throw new Error('Cambió la cuenta conectada. La transferencia no se envió.');
      }
    };
    const connection = devnetConnection();
    setReceipt(null);
    setFee(null);
    setStage('Verificando red, saldo y comisión…');
    const prepared = await prepareTestTransfer(connection, sender, recipient, amount);
    sameAccount();
    setFee(prepared.fee / LAMPORTS_PER_SOL);
    const originalMessage = prepared.transaction.serializeMessage();
    setStage('Aprobá la transferencia de SOL Devnet en Phantom…');
    const signed = await wallet.signTransaction(prepared.transaction);
    sameAccount();
    const serialized = validateSignedTransfer(originalMessage, signed);
    // Phantom only signs. MatePay broadcasts exclusively through the fixed Devnet RPC.
    await assertDevnet(connection);
    sameAccount();
    setStage('Enviando a Solana Devnet…');
    const signature = signedSignature(signed);
    const payment: Receipt = {
      signature, sender: address, recipient: prepared.recipient.toBase58(),
      sol: prepared.lamports / LAMPORTS_PER_SOL, fee: prepared.fee / LAMPORTS_PER_SOL, status: 'pending',
    };
    if (!mounted.current) return;
    setReceipt(payment);
    // Keep the locally known signature if the RPC times out after accepting the transaction.
    const returnedSignature = await connection.sendRawTransaction(serialized, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 });
    if (returnedSignature !== signature) throw new Error('El RPC devolvió una firma inesperada. Verificá el envío en Explorer.');
    setStage('Esperando confirmación de Devnet…');
    // HTTP polling avoids a WebSocket that could target a different cluster.
    for (let attempt = 0; attempt < 15 && mounted.current; attempt++) {
      const status = await transferStatus(connection, signature);
      if (status !== 'pending') {
        if (!mounted.current) return;
        setReceipt({ ...payment, status });
        if (status === 'failed') throw new Error('La transacción falló en Devnet. Revisá el detalle en Explorer.');
        const updatedBalance = await connection.getBalance(sender, 'confirmed');
        if (mounted.current && version === generation.current) setBalance(updatedBalance / LAMPORTS_PER_SOL);
        return;
      }
      await new Promise(resolve => window.setTimeout(resolve, 1500));
    }
    if (mounted.current) setError('Todavía no pudimos confirmar el envío. Verificá el estado antes de volver a transferir.');
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold"><Wallet className="text-emerald-400" /> Phantom en Solana Devnet</h2>
        <p className="mt-3 text-slate-300">Conectá tu billetera y probá una transferencia real de SOL de prueba. El saldo y la confirmación se consultan en Devnet.</p>
        <p className="mt-2 text-sm text-amber-300">Este flujo usa SOL de prueba para el monto y la comisión. El pago USDC gasless sigue en simulación.</p>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-emerald-300">Red de envío: Solana Devnet</span>
          {address ? <button className="text-sm text-slate-300 underline disabled:opacity-50" disabled={busy} onClick={() => run(async () => {
            await provider.current?.disconnect();
            generation.current += 1;
            setAddress(''); setBalance(null);
          })}>Desconectar Phantom</button> : <button className={button} disabled={busy} onClick={connect}>Conectar Phantom</button>}
        </div>
        {!available && <p className="text-sm text-slate-400">Phantom no está disponible en este navegador. Abrí localhost:3000 en Chrome o Firefox con la extensión instalada y recargá la página.</p>}
        <p className="text-sm text-slate-300">En Phantom: Configuración → Configuración de desarrollador → Modo Testnet. Seleccioná <strong>Solana Devnet</strong>, en lugar de Solana Testnet.</p>
        {address && <>
          <div><span className="text-xs text-slate-400">Cuenta conectada</span><p className="break-all font-mono text-sm" data-testid="wallet-address">{address}</p></div>
          <div className="flex flex-wrap items-center gap-4">
            <strong data-testid="devnet-balance">{balance === null ? 'Saldo Devnet sin consultar' : `${balance.toFixed(9)} SOL Devnet`}</strong>
            <button disabled={busy} onClick={refresh} className="flex items-center gap-2 text-sm text-purple-300 disabled:opacity-50"><RefreshCw size={16} /> Actualizar saldo</button>
          </div>
          <a className="inline-flex items-center gap-2 text-sm text-emerald-300 underline" href={`https://faucet.solana.com/?address=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Pedir SOL de prueba en el faucet <ExternalLink size={14} /></a>
        </>}
      </div>

      <form className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6" onSubmit={event => { event.preventDefault(); void send(); }}>
        <h3 className="text-lg font-bold">Transferencia de prueba</h3>
        <label className="block text-sm text-slate-300">Dirección de otra billetera de prueba
          <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm" value={recipient} disabled={busy} onChange={e => setRecipient(e.target.value)} placeholder="Pegá la dirección pública Solana del destinatario" autoComplete="off" />
        </label>
        <label className="block text-sm text-slate-300">Monto en SOL Devnet (máximo 0,1)
          <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        <p className="text-sm text-slate-400">Probá primero con 0,001 SOL. El destinatario recibe SOL en Devnet. La comisión sale de tu saldo SOL de prueba.</p>
        {fee !== null && <p className="text-sm text-slate-300">Comisión estimada: {fee.toFixed(9)} SOL Devnet</p>}
        <button type="submit" className={button} disabled={busy || !address || !recipient.trim() || receipt?.status === 'pending'}>Firmar y enviar SOL Devnet</button>
        {stage && <p role="status" className="text-sm text-purple-300">{stage}</p>}
        {error && <p role="alert" className="break-words rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">{error}</p>}
      </form>

      {receipt && <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-6" aria-live="polite">
        <h3 className="text-lg font-bold">{receipt.status === 'confirmed' ? 'Transferencia confirmada en Devnet' : receipt.status === 'failed' ? 'Transferencia fallida en Devnet' : 'Transferencia enviada, pendiente de confirmación'}</h3>
        <p>{receipt.sol} SOL Devnet</p>
        <p className="break-all text-sm text-slate-300">Emisor: {receipt.sender}</p>
        <p className="break-all text-sm text-slate-300">Destino: {receipt.recipient}</p>
        <p className="break-all font-mono text-xs text-slate-400">Firma: {receipt.signature}</p>
        <a href={explorerTransaction(receipt.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300 underline">Ver en Explorer Devnet <ExternalLink size={16} /></a>
        {receipt.status === 'pending' && <button disabled={busy} onClick={checkReceipt} className="ml-4 text-purple-300 underline disabled:opacity-50">Verificar confirmación</button>}
      </div>}

      <div className="text-sm leading-relaxed text-slate-400">
        <p>Podés testear conexión, cambio de cuenta, saldo, validación de dirección y monto, rechazo de firma y confirmación de una transferencia.</p>
        <p className="mt-2">En la pestaña Simulación podés probar la UX comercio/cliente, conversión ARS y QR. Ese flujo todavía no mueve USDC, no escanea con cámara y no subsidia una comisión real.</p>
      </div>
    </section>
  );
}
