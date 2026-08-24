# DIVINITTYS — Variantes Mercado Libre: Go-Live

## Objetivo

Una publicación de Mercado Libre con variantes se modela como un `Product` padre y un `ProductVariant` por cada `variation.id` de Mercado Libre. La relación externa se conserva en `ProductVariant.options.mercadolibre.variationId` y el SKU local usa `ML-{ITEM_ID}-V-{VARIATION_ID}`.

Mercado Libre expone `attribute_combinations`, `price`, `available_quantity` y `picture_ids` por variante. La API también permite consultar directamente `/items/{ITEM_ID}/variations`.

## Migración

1. Hacer backup de PostgreSQL.
2. Desplegar la rama.
3. Ejecutar primero:

```bash
docker exec divinittys_app npm run migrate:ml-variants:dry
```

4. Revisar que las publicaciones con tinturas muestren todos los tonos y stocks correctos.
5. Ejecutar:

```bash
docker exec divinittys_app npm run migrate:ml-variants
```

6. Verificar agregados:

```bash
docker exec divinittys_db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
'SELECT p.sku,p.name,count(v.id) variants,sum(v.stock) variant_stock,i.stock aggregate_stock FROM products p JOIN product_variants v ON v."productId"=p.id JOIN inventory i ON i."productId"=p.id WHERE p.sku LIKE ''ML-MLC%'' GROUP BY p.id,p.sku,p.name,i.stock ORDER BY count(v.id) DESC;'
```

`inventory.stock` debe ser igual a la suma de las variantes activas.

## Importación Excel

`npm run import:ml` ahora ejecuta la importación de productos y, si termina correctamente, finaliza con `migrate:ml-variants`. No ejecutar una importación masiva antigua sin el paso de variantes.

## Sincronización posterior

Ejecutar periódicamente:

```bash
docker exec divinittys_app npm run sync:ml-stock
```

Para una publicación con variantes, el stock fuente de verdad es `variation.available_quantity`; el stock padre es el agregado de las variantes activas.

## Compra

El storefront exige seleccionar una variante cuando el producto tiene más de una. El carrito conserva `variantId` y `variantName`. El endpoint de órdenes:

- rechaza una compra sin variante cuando el producto tiene variantes;
- valida que la variante pertenezca al producto y esté activa;
- valida stock y precio server-side;
- decrementa la variante de forma atómica para evitar overselling;
- recalcula el stock agregado del producto;
- guarda SKU y nombre de la variante en `OrderItem`.

## Pago

Para Mercado Pago, la orden mantiene `variantId`. El webhook confirma el pago usando `external_reference`/número de orden. Las variantes ya fueron reservadas al crear la orden; un pago fallido o una orden abandonada las devuelve al stock. El stock agregado se recalcula después de la liberación.

## Pruebas obligatorias

### Producto

- publicación sin variantes;
- publicación con 2 variantes;
- tintura con 10+ tonos;
- variante con stock 0;
- precios distintos por variante si Mercado Libre los entrega.

### Carrito

- seleccionar P8 y comprobar `variantId`;
- agregar P8 y P9: deben aparecer como líneas independientes;
- recargar navegador: la variante debe persistir;
- cambiar cantidad: no superar stock de esa variante.

### Orden

- enviar pedido sin `variantId` para producto con variantes: debe rechazar;
- comprar una variante con stock suficiente: debe reservarla;
- intentar dos compras concurrentes sobre el último stock: solo una debe prosperar;
- verificar `OrderItem.variantId`, SKU, nombre y precio.

### Pago

- Mercado Pago sandbox: preference → checkout → webhook → PAID;
- pago rechazado: orden CANCELLED y stock liberado;
- checkout abandonado: cleanup cancela y libera stock;
- webhook repetido: no debe descontar stock dos veces.

## Importante

No borrar variantes antiguas durante la sincronización: pueden estar referenciadas por órdenes históricas. Si una variante desaparece de Mercado Libre, se marca `isActive=false` y `stock=0`.
