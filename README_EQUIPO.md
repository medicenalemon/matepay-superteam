# 🧉 MatePay — Kit de Trabajo para el Equipo
### Hackathon: Colosseum Crypto World's Fair x Superteam Argentina
**Fecha Límite de Entrega:** 12 de Octubre de 2026

> **Estado actualizado (03/10/2026):** el cobro USDC y el fee payer de la demo original son simulados. Se agregó un modo separado **Phantom · SOL Devnet** para conectar una wallet, consultar saldo y probar transferencias de SOL de prueba. La transferencia con la extensión del usuario todavía requiere verificación manual. Consultá [las instrucciones y casos de prueba](docs/PRUEBAS_DEVNET.md).

Este repositorio contiene el prototipo interactivo de **MatePay**, el modo de prueba con Phantom y SOL Devnet, y el kit de Superteam Argentina (`workspace-colosseum`). El flujo USDC sigue siendo simulado.

---

## 👥 Roles del Equipo

* **Montero Mauricio:** Ing. en Sistemas — *Full Stack & Web3 Lead*
* **Gerez Juan Pablo:** *Frontend Lead*
* **Robles Máximo:** *Diseñador Multimedial & Aprendiz de Full Stack*

---

## 🚀 La Propuesta de Valor (Para los Jueces de Colosseum)

> **"Ayudamos a personas y comercios en Argentina a pagar y cobrar en dólares digitales (USDC) en 1 segundo vía QR de Solana Pay y Alias legibles, sin necesidad de tener SOL para comisiones ni miedo a equivocarse de dirección."**

---

## 🛠️ Cómo Levantar el Proyecto en tu Máquina

### Requisitos:
* **Node.js 18+** instalado.
* Git.

### Pasos:
1. Descomprimir este archivo o clonar el repositorio.
2. Abrir una terminal en la carpeta del proyecto y ejecutar:
   ```bash
   npm install --legacy-peer-deps
   npm run dev
   ```
3. Abrir en el navegador: **`http://localhost:3000`**

---

## 📱 Lo que ya está Construido y Funcionando (Revisar en la App):

1. **`⚡ Demo en Vivo` (`src/components/LiveDemo.tsx`):**
   * Vista dual en paralelo: pantalla del comercio a la izquierda y celular del cliente a la derecha.
   * Al tocar "Confirmar Pago", se modifica un saldo simulado y se actualizan ambas pantallas. Ese tiempo no mide confirmación de una transacción en la red.
   * Modo separado **Phantom · SOL Devnet**: conexión, saldo y transferencias de SOL de prueba con firma del usuario y confirmación consultada por RPC.
2. **`Cobro POS` (`src/components/PosTerminal.tsx`):**
   * Teclado numérico táctil para el comerciante.
   * Conversión en tiempo real de pesos argentinos (ARS) a USDC usando **DolarAPI en vivo** (`https://dolarapi.com/v1/dolares/cripto`).
   * Generador de imagen QR con una URL que incluye el mint configurado de **USDC en Devnet** (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). El destinatario y la referencia de la simulación necesitan reemplazo y validación antes de usar el QR para cobrar.
3. **`Pagar (Cliente)` (`src/components/ClientPay.tsx`):**
   * Búsqueda por alias (`@cafemartinez`, `@montero`, `@juanpi`, `@roblesmaximo`).
   * Simulación de pago gasless con saldo ficticio de 0 SOL. Todavía no firma ni envía USDC desde una wallet.
4. **Backend Express (`server.ts`):**
   * Endpoint de resolución de alias: `GET /api/matepay/aliases` y `GET /api/matepay/alias/:alias`.
   * Endpoint placeholder de Fee-Payer: `POST /api/matepay/fee-payer/sign`, sin firma real.
   * Proxy RPC exclusivo de Devnet: `POST /api/matepay/devnet/rpc`.

---

## 🎯 Próximas Tareas Asignadas por Integrante:

### 1. Montero Mauricio (Backend & Web3)
* **Objetivo:** Conectar el Fee-Payer con una Keypair real de Solana Devnet y enviar la transacción directamente al RPC de Solana (Helius/Triton o RPC público).
* **Archivo principal:** `server.ts`
* **Librerías listas:** `@solana/web3.js` y `@solana/spl-token` ya están instaladas.

### 2. Gerez Juan Pablo (Frontend)
* **Objetivo:** Conectar Phantom Wallet real vía `@solana/wallet-adapter-react` para que si el usuario tiene la extensión de Phantom en Devnet, pueda firmar con su wallet física además del modo simulación.
* **Archivo principal:** `src/components/ClientPay.tsx` y `src/App.tsx`.

### 3. Robles Máximo (UX, Conversor y Demo)
* **Objetivo:** Pulir las microinteracciones visuales, la exportación de comprobantes en PDF/imagen y dirigir la grabación del video de 3 minutos en inglés mostrando la pantalla de `⚡ Demo en Vivo`.

---

## ⚠️ Reglas Maestras de la Sede (No Romper):
1. **Solo Devnet:** La plata es de mentira, sale de faucets (`faucet.solana.com`). NUNCA usar mainnet ni dinero real durante la hackathon.
2. **Claves privadas y frases semilla:** NUNCA en el chat de la IA, ni en archivos del repo, ni en GitHub.
3. **La entrega final (README, video de 3 min y formulario) va en inglés.** Fecha límite: 12/10/2026.
