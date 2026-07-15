# Modelo de negocio: créditos, recargas y control de gasto

## Resumen ejecutivo

La plataforma opera con un sistema de créditos prepago. Cada usuaria inicia con 300 créditos incluidos, equivalentes a $3.00 de uso dentro de la plataforma. Cuando esos créditos se agotan, la cuenta deja de poder ejecutar acciones con costo de IA y se le muestra la opción de contactar a atención a clientes por WhatsApp para solicitar una recarga.

El objetivo es que la usuaria pueda probar la plataforma sin fricción, pero que el gasto variable de IA quede topado desde el servidor. La administradora puede revisar consumo, costo real, margen, recargas y saldo por usuaria desde el panel de administración.

## Valor del crédito

- 1 crédito = $0.01 de saldo.
- 100 créditos = $1.00 de saldo.
- 300 créditos iniciales = $3.00 incluidos.
- 1,000 créditos = $10.00 de recarga.

## Créditos iniciales por usuaria

Cada usuaria inicia con:

- 300 créditos incluidos.
- Valor equivalente: $3.00.
- Saldo comprado inicial: 0 créditos.

Los créditos incluidos se consumen primero. Después se consume el saldo comprado. Si no hay créditos incluidos ni saldo comprado suficiente, la acción no se ejecuta.

## Costos por acción

| Acción | Créditos | Precio equivalente | Costo real estimado |
| --- | ---: | ---: | ---: |
| Chat estratega | 3 | $0.03 | $0.0213 |
| Nota de voz | 2 | $0.02 | $0.0060 |
| Análisis de imagen | 60 | $0.60 | $0.0066 |
| Análisis de video | 120 | $1.20 | $0.0088 |
| Guion | 40 | $0.40 | $0.0038 |
| Análisis Meta | 120 | $1.20 | $0.0068 |
| Ficha creativa | 15 | $0.15 | $0.0046 |
| Imagen estándar | 120 | $1.20 | $0.0700 |
| Imagen alta | 250 | $2.50 | $0.1900 |
| Corrección de imagen | 80 | $0.80 | $0.0700 |
| Referencia visual | 20 | $0.20 | $0.0022 |

Los costos reales son estimaciones conservadoras basadas en el proveedor/modelo configurado. El panel de administración muestra también el costo real promedio observado con los datos guardados en el historial de créditos.

## Paquetes de recarga

| Paquete | Precio | Créditos | Valor nominal | Bono |
| --- | ---: | ---: | ---: | ---: |
| Impulso | $10 | 1,000 | $10.00 | 0% |
| Crecimiento | $25 | 2,800 | $28.00 | 12% |
| Estudio | $50 | 6,000 | $60.00 | 20% |

La recarga se solicita por WhatsApp y la administradora la aprueba manualmente desde el panel. Al aprobarse, los créditos se abonan al saldo comprado de la usuaria.

## Proyección por cada $10 abonados

Si una usuaria compra $10, recibe 1,000 créditos. La utilidad depende de qué use más:

| Escenario de uso | Costo real estimado | Ingreso | Utilidad estimada | Margen |
| --- | ---: | ---: | ---: | ---: |
| Uso mixto saludable | $0.90 a $1.60 | $10.00 | $8.40 a $9.10 | 84% a 91% |
| Uso intensivo en imagen estándar | $0.58 aprox. por 8 imágenes | $10.00 | $9.42 aprox. | 94% |
| Uso intensivo en imagen alta | $0.76 aprox. por 4 imágenes | $10.00 | $9.24 aprox. | 92% |
| Uso intensivo en chat | hasta $7.10 aprox. | $10.00 | $2.90 aprox. | 29% |

El chat tiene menor margen si se usa con modelos premium de texto, por eso tiene rate limit y debe monitorearse. Las imágenes son caras en términos absolutos, pero el precio en créditos deja margen suficiente si se mantiene el costo actual de proveedor.

## Candados de gasto

La estructura queda protegida por estos candados:

- Tope inicial: 300 créditos incluidos por usuaria.
- Cobro server-side: las acciones de IA se cobran desde rutas privadas, no desde el navegador.
- Si no hay saldo suficiente, la acción no se ejecuta.
- Límite diario por usuaria: 800 créditos.
- Límite temporal por tipo de acción: chat, imagen y análisis tienen reglas de frecuencia.
- Tope mensual global de API configurable con `MONTHLY_SPEND_LIMIT_USD`.
- Panel admin con costo real, precio cobrado, margen, usuario, módulo y alertas.

## Qué ve la usuaria

En Cuenta, la usuaria ve:

- Créditos disponibles.
- Créditos incluidos restantes.
- Saldo comprado sin vencimiento.
- Tabla de costos por acción.
- Historial de movimientos.
- Paquetes de recarga por WhatsApp.

## Qué ve administración

En Admin, la administradora ve:

- Gasto real de API del mes.
- Créditos consumidos.
- Ingresos por recargas aprobadas.
- Profit estimado.
- Costo por OpenAI y Anthropic.
- Tabla maestra por acción con créditos, precio, costo estimado, costo real promedio y margen.
- Rentabilidad individual por usuaria.
- Historial detallado, recargas, archivos, galería y desglose por módulo.
- Acción para abonar créditos manualmente.

## Recomendación operativa

Mantener el crédito inicial en 300. Es suficiente para probar la plataforma de forma real sin permitir que una cuenta gratuita genere un gasto abierto. Para crecer, conviene monitorear semanalmente:

- Usuarios con uso alto de chat.
- Usuarios con muchas imágenes fallidas o regeneraciones.
- Costo real promedio por imagen.
- Margen por paquete de recarga.
- Porcentaje de conversión de usuarias gratuitas a recarga.

Si el costo de modelos sube o el uso de chat premium crece demasiado, el ajuste más sano es subir el costo del chat a 4 o 5 créditos por mensaje, antes de tocar el precio de las imágenes.
