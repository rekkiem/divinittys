import type { FullOrder } from '@/lib/orders/load-full-order';
import { getBuyerName } from '@/lib/orders/load-full-order';

function formatCLP(value: number | string | { toString(): string }): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(d);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildOrderConfirmedHtml(order: FullOrder): string {
  const buyerName = getBuyerName(order);
  const itemsRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;">
          ${escapeHtml(item.name)}${item.variant ? ` <span style="color:#666;">(${escapeHtml(item.variant.name)})</span>` : ''}
          <br/><span style="font-size:12px;color:#888;">SKU: ${escapeHtml(item.sku)}</span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCLP(item.price)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCLP(item.total)}</td>
      </tr>`
    )
    .join('');

  const addressBlock = order.address
    ? `
    <p style="margin:0 0 4px;"><strong>${escapeHtml(order.address.firstName)} ${escapeHtml(order.address.lastName)}</strong></p>
    <p style="margin:0 0 4px;">${escapeHtml(order.address.street)} ${escapeHtml(order.address.number)}${order.address.apartment ? `, ${escapeHtml(order.address.apartment)}` : ''}</p>
    <p style="margin:0 0 4px;">${escapeHtml(order.address.commune)}, ${escapeHtml(order.address.city)}</p>
    <p style="margin:0;">${escapeHtml(order.address.region)}${order.address.postalCode ? ` — ${escapeHtml(order.address.postalCode)}` : ''}</p>
    ${order.address.phone ? `<p style="margin:8px 0 0;">Tel: ${escapeHtml(order.address.phone)}</p>` : ''}
  `
    : '<p style="margin:0;color:#888;">Sin dirección registrada</p>';

  const paymentMethod = order.payment?.paymentMethod || order.payment?.provider || '—';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Pedido confirmado ${escapeHtml(order.orderNumber)}</title></head>
<body style="margin:0;padding:0;background:#f6f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f2;padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <tr><td style="background:#1a1a1a;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:0.08em;color:#ffffff;">DIVINITTYS</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c9a96e;">Belleza &amp; cuidado capilar</p>
    </td></tr>
    <tr><td style="padding:32px 32px 16px;">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">¡Gracias por tu compra, ${escapeHtml(buyerName)}!</h2>
      <p style="margin:0;font-size:15px;line-height:1.5;color:#444;">Tu pedido <strong>${escapeHtml(order.orderNumber)}</strong> fue confirmado el ${formatDate(order.createdAt)}.</p>
    </td></tr>
    <tr><td style="padding:8px 32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <thead><tr style="background:#faf8f6;">
          <th style="padding:10px 8px;text-align:left;font-weight:600;border-bottom:2px solid #eee;">Producto</th>
          <th style="padding:10px 8px;text-align:center;font-weight:600;border-bottom:2px solid #eee;">Cant.</th>
          <th style="padding:10px 8px;text-align:right;font-weight:600;border-bottom:2px solid #eee;">Precio</th>
          <th style="padding:10px 8px;text-align:right;font-weight:600;border-bottom:2px solid #eee;">Total</th>
        </tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:8px 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:4px 0;color:#555;">Subtotal</td><td style="padding:4px 0;text-align:right;">${formatCLP(order.subtotal)}</td></tr>
        ${Number(order.discountAmount) > 0 ? `<tr><td style="padding:4px 0;color:#555;">Descuento${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ''}</td><td style="padding:4px 0;text-align:right;color:#0a7;">−${formatCLP(order.discountAmount)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#555;">Envío</td><td style="padding:4px 0;text-align:right;">${Number(order.shippingAmount) === 0 ? 'Gratis' : formatCLP(order.shippingAmount)}</td></tr>
        <tr><td style="padding:12px 0 0;font-size:16px;font-weight:700;border-top:1px solid #eee;">Total</td><td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;border-top:1px solid #eee;">${formatCLP(order.total)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="50%" valign="top" style="padding-right:12px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#888;">Dirección de envío</p>
          <div style="font-size:14px;line-height:1.45;color:#333;">${addressBlock}</div>
        </td>
        <td width="50%" valign="top" style="padding-left:12px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#888;">Pago</p>
          <p style="margin:0;font-size:14px;color:#333;">Método: ${escapeHtml(String(paymentMethod))}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#333;">Estado: <strong style="color:#0a7;">Pagado</strong></p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:20px 32px;background:#faf8f6;border-top:1px solid #eee;">
      <p style="margin:0;font-size:13px;line-height:1.5;color:#666;">Te avisaremos cuando tu pedido sea despachado. Si tienes dudas, responde este correo o contáctanos.</p>
    </td></tr>
    <tr><td style="padding:20px 32px;text-align:center;font-size:12px;color:#999;">© ${new Date().getFullYear()} DIVINITTYS · divinittys.cl</td></tr>
  </table></td></tr></table>
</body></html>`;
}

export function buildOrderConfirmedSubject(orderNumber: string): string {
  return `Pedido confirmado ${orderNumber} — DIVINITTYS`;
}
