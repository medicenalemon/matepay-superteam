# MatePay: presentación y continuidad

Preparado el 3 de octubre de 2026 para Mauricio. El contenido para jurados está en inglés. Es un borrador de pitch de **10 diapositivas en total**, incluida la portada, pensado para acompañar una explicación de unos 3 minutos.

## Generar en Gamma

1. Abrí `MatePay_Gamma.txt` y copiá todo el contenido.
2. En Gamma, pegalo como texto fuente. Si usás el generador clásico, elegí **Paste in text** y **Preserve**. En Gamma 5, pegá el texto junto con la instrucción de abajo.
3. Revisá el esquema antes de generar: deben quedar 10 diapositivas. Cada línea `---` indica una separación deseada. Ajustá las divisiones manualmente si Gamma no las respeta.
4. Usá el siguiente prompt como instrucción de generación, separado del contenido de las diapositivas:

```text
Create a 10-slide presentation in English for hackathon judges using the supplied MatePay text. Keep the slide order and all factual qualifications. Each --- separator marks a slide boundary. Keep my text exactly as written. Do not add slides, market statistics, customer traction, partnerships, transaction signatures or performance claims.

Use a 16:9 format. Match the MatePay application's dark background (#0b0f17), white text, purple accents and occasional emerald accents. Use large, readable typography, generous spacing and one main composition per slide. Keep the cover minimal. Avoid dense card grids and decorative crypto imagery.

Use image placeholders on the merchant and customer slides for screenshots that the team will supply. Do not fabricate product screenshots, functional QR codes, wallet balances or Explorer evidence. Represent slide 6 as an editable numbered process and label it Proposed Devnet flow. Treat all user validation and business model statements as hypotheses or planned work.

Keep the distinction between the interactive simulation and the pending Devnet transaction implementation visible. Do not imply confirmed payments, a live fee payer, verified merchant identity or measured one-second settlement. Do not use third-party merchant logos or suggest partnerships with the demo aliases.
```

La ayuda oficial explica cómo [pegar contenido y conservar el texto](https://help.gamma.app/en/articles/11047840-how-can-i-import-slides-or-content-into-gamma) y cómo [usar espacios reservados para imágenes](https://help.gamma.app/en/articles/7838093-how-do-i-create-a-new-presentation-document-or-webpage-in-gamma). Este TXT está preparado para copiar y pegar. No se presupone que Gamma acepte subir archivos TXT directamente.

## Evidencia y límites del borrador

Revisé el código local y lo comparé con el ZIP suministrado. Coinciden los archivos principales del backend, frontend, documentación de equipo y conversión. No ejecuté la app: esta copia no tiene `node_modules`. No comprobé pantallas, la disponibilidad de DolarAPI ni una transacción en Devnet. La presentación describe el código y sus pendientes, sin afirmar esas verificaciones.

| Tema | Evidencia en el repositorio | Cómo se presenta |
| --- | --- | --- |
| Cobro y pago | `src/components/PosTerminal.tsx`, `ClientPay.tsx`, `LiveDemo.tsx` | Interfaces implementadas, pagos simulados |
| Conversión | `src/services/currencyService.ts` | Consulta a DolarAPI con fallback blue y offline. Es una estimación, no una cotización garantizada de USDC |
| QR | `src/components/SolanaPayQr.tsx` | Generación de imagen. Falta validar destinatario y referencia con una wallet |
| Alias | `server.ts` y tabla local de `ClientPay.tsx` | Registro de demostración en memoria. El frontend todavía usa su propia tabla |
| Fee payer | `server.ts`, endpoint `/api/matepay/fee-payer/sign` | Respuesta fija de éxito, sin firma ni envío de transacción |
| Wallet y RPC | No hay integración de wallet adapter ni envío/confirmación en los flujos revisados | Pendientes |
| Velocidad | `setTimeout` y firmas generadas con `Math.random` en los componentes de pago | Sin medición de confirmación on-chain |
| Usuarios y negocio | No se aportaron entrevistas, métricas o pilotos | Hipótesis y validación propuesta |

El README del equipo afirma que hay una base probada en Devnet y menciona gasless y 0,4 segundos. El código revisado no respalda una transferencia real ni esa medición. Conviene corregir esas afirmaciones antes de entregar material a los jurados.

El ejemplo ARS 4.500 / 1.240 usa un valor ilustrativo del fallback local y el redondeo actual a dos decimales. No representa el tipo de cambio del día. El alcance no incluye convertir fondos ARS a USDC: convierte el monto mostrado para solicitar un pago en tokens.

## Próximo trabajo de Mauricio

Prioridad: completar un solo cobro verificable en Devnet. La funcionalidad decisiva todavía falta, aunque la demo ya comunica el recorrido.

1. **Definir cuentas de prueba válidas.** Reemplazar los destinatarios ficticios y `MatePayRef...` por claves públicas válidas. Guardar una referencia estable por orden. Elegir y comprobar el mint de prueba en Devnet, sus decimales y las cuentas de tokens. Criterio: el QR se puede parsear y conserva destinatario, mint, importe y referencia.
2. **Crear la orden en el backend.** Fijar importe en unidades enteras del token, destinatario, mint, cotización, origen de la cotización y vencimiento. Diferenciar una cotización vigente de un fallback. Criterio: el cliente no puede alterar el importe o el destinatario de la orden al pedir patrocinio.
3. **Implementar el patrocinio.** Configurar un RPC exclusivamente de Devnet y un firmante de prueba del servidor. Construir o validar una transferencia restringida a la orden antes de firmar como fee payer. Aplicar límites de patrocinio y evitar cobros duplicados. Las claves se gestionan localmente fuera del repositorio y del chat. Criterio: el endpoint deja de devolver éxito fijo y solo patrocina el mensaje esperado.
4. **Integrar firma con Juan Pablo.** Conectar Phantom configurada para Devnet, mostrar los detalles y pedir aprobación del usuario. Conservar explícitamente el modo simulación para la demo. Criterio: rechazar una firma no produce un recibo exitoso.
5. **Enviar y verificar.** Confirmar mediante RPC que la transferencia corresponde a la orden y no tiene error. Actualizar comercio y cliente desde ese estado. Criterio: recibo con firma real y enlace a Explorer con `cluster=devnet`, junto con balances de tokens antes y después.
6. **Probar en pantalla.** Mostrar un cliente con tokens de prueba y 0 SOL, pago aprobado y comisión a cargo del patrocinador. Incluir rechazo de firma, saldo insuficiente y orden vencida. Registrar tiempos por separado para aprobación y confirmación, antes de prometer una duración.

La documentación oficial de Solana explica que [emisor y patrocinador firman la transacción](https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction). El QR por sí solo no implementa el patrocinio: MatePay necesita construir el flujo de firma con el fee payer.

## Preparación de la entrega

La fecha objetivo del equipo es el **12 de octubre de 2026**, según `AGENTS.md`. No se verificó el calendario externo de la hackathon.

- Máximo puede reemplazar los espacios reservados de Gamma por capturas del POS y cliente, rotuladas como simulación mientras corresponda.
- Después de verificar el pago, actualizar las diapositivas 5 a 7 y 10 con la evidencia real. Mantener la etiqueta Devnet y no presentar tokens de prueba como dinero real.
- La validación propuesta empieza con pruebas de comprensión y disposición a cobrar en USDC. Todavía no hay evidencia de que el segmento sugerido quiera este producto.
- Antes de enviar, revisar el deck generado en pantalla y ensayar el tiempo del pitch. Gamma puede cambiar divisiones y composición aunque el texto fuente esté correcto.
