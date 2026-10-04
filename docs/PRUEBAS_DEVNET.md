# Qué podés probar en MatePay

Actualizado el 3 de octubre de 2026. Todas las transacciones de prueba se envían exclusivamente a **Solana Devnet**.

## Los dos modos de Demo en Vivo

| Modo | Qué podés probar | Qué todavía no hace |
| --- | --- | --- |
| Simulación USDC | UX comercio/cliente, conversión de montos ARS, imagen QR, estados de pago y recibo simulado | Transferencia de tokens, aprobación en Phantom, confirmación RPC o subsidio real de comisión |
| Phantom · SOL Devnet | Conexión y desconexión de Phantom, cambio de cuenta, saldo real de Devnet, firma de transferencia SOL, envío y consulta de confirmación, Explorer | Cobro USDC, alias verificados, cámara QR y fee payer gasless |

El saldo mostrado por el simulador no es el saldo de Phantom. SOL Devnet y USDC son activos distintos. En el nuevo modo la comisión también sale del SOL Devnet de tu cuenta.

## Probar con tu Phantom

1. Ejecutá `npm install --legacy-peer-deps` si faltan las dependencias y después `npm run dev` desde la raíz del proyecto. Las pruebas de wallet no requieren una clave Gemini.
2. Abrí **http://localhost:3000/?mode=devnet** en el navegador donde instalaste Phantom. El navegador integrado de Codex puede no tener la extensión.
3. En Phantom abrí **Configuración → Configuración de desarrollador → Modo Testnet** y elegí **Solana Devnet**. El modo de prueba de Phantom también ofrece Solana Testnet, que es otra red. Una captura que muestra Ethereum no informa el saldo SOL de Devnet.
4. Tocá **Conectar Phantom** en MatePay y aprobá la conexión en la extensión. Compará la dirección pública completa con tu cuenta Solana. La app solo solicita dirección pública y firma de transacciones.
5. Si tu saldo Devnet es cero, abrí **Pedir SOL de prueba en el faucet**, completá la solicitud y después tocá **Actualizar saldo**. Los límites y la disponibilidad dependen del faucet.
6. Usá una segunda billetera de prueba como destino. Pegá su dirección pública Solana, no un alias del simulador ni una dirección Ethereum.
7. Probá con **0,001 SOL**. Tocá **Firmar y enviar SOL Devnet**, revisá el destino y el monto en Phantom y aprobá o rechazá la firma.
8. Esperá el estado **Transferencia confirmada en Devnet**. Abrí **Ver en Explorer Devnet** y comprobá emisor, destinatario, monto y resultado. Consultá también el saldo del destinatario en Devnet.

La app limita cada transferencia a 0,1 SOL Devnet, estima la comisión antes de firmar y bloquea los destinatarios ficticios conocidos de la simulación. Un destinatario con formato válido no equivale a un comercio verificado: vos comprobás a quién pertenece.

## Pruebas manuales y resultados esperados

| Prueba | Resultado esperado |
| --- | --- |
| Sin extensión Phantom | Mensaje de extensión no disponible y envío deshabilitado |
| Rechazar la conexión | Mensaje de rechazo, sin saldo simulado como sustituto |
| Conectar la cuenta | Dirección de Phantom y saldo consultado en Devnet |
| Cambiar cuenta en Phantom | Cambia la dirección y se consulta su saldo. Cambiar durante la firma bloquea el envío de esa operación |
| Desconectar | Dirección y saldo desaparecen, envío deshabilitado |
| Monto cero, negativo o mayor que 0,1 SOL | Error antes de abrir una solicitud de firma |
| Dirección inválida, cuenta de programa, propia o destinatario ficticio del simulador | Error antes de firmar |
| Saldo insuficiente para monto y comisión | Mensaje para obtener SOL de prueba, sin envío |
| Rechazar la firma | Sin envío ni comprobante exitoso |
| Aprobar la firma | Envío a Devnet, estado pendiente hasta confirmación RPC |
| RPC lento o sin respuesta después de firmar | Se conserva la firma conocida cuando comienza el intento de envío. Revisar Explorer y Verificar confirmación antes de repetir |
| Transacción con error on-chain | Se muestra fallida, nunca confirmada como pago exitoso |

Si la red nunca devuelve un resultado para una firma pendiente, no repitas a ciegas. Comprobá el resultado en Explorer. Una firma conocida identifica la transacción firmada, pero por sí sola no demuestra que el RPC la recibió.

## Cómo se asegura Devnet

- `server/devnetRpc.ts` envía únicamente a `https://api.devnet.solana.com`. No acepta una URL de red del navegador ni variables de entorno para cambiarla.
- `src/services/devnetService.ts` compara el identificador de la red antes de consultar saldo, preparar, enviar y consultar confirmación.
- Phantom firma mediante su provider Solana inyectado. MatePay verifica que el mensaje firmado coincida y que sus firmas sean válidas. La app envía mediante su RPC fijo, sin delegar el envío a la red seleccionada por la wallet.
- El endpoint de fee payer anterior sigue siendo un placeholder y este modo no lo usa.

## Verificación realizada

Pasaron `npm run lint`, `npm run build` y las 7 pruebas automatizadas de `npm test`. Las pruebas cubren montos, destinatarios, bloqueo de otra red, saldo/comisión, integridad del mensaje firmado, estados de confirmación y RPC fijo. Usan cuentas efímeras generadas para el test y respuestas RPC simuladas.

También se consultó el RPC público desde el backend local y respondió con el identificador de Devnet. Se abrió y revisó la pantalla del modo Phantom, que muestra correctamente la ausencia de extensión en el navegador integrado.

**Pendiente de tu prueba manual:** conexión con tu extensión, aprobación de firma, transferencia on-chain y comprobación de ambos saldos. No se ejecutó una transferencia con tu billetera ni se observó una confirmación real.

Fuentes oficiales: [Modo Testnet de Phantom](https://docs.phantom.com/developer-powertools/testnet-mode), [firma y envío de transacciones](https://docs.phantom.com/solana/sending-a-transaction), [Solana Faucet](https://faucet.solana.com/).
