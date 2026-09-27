/**
 * Inyecta un bloque <script type="application/ld+json">.
 * Server Component seguro: serializa con JSON.stringify (escapa <).
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
