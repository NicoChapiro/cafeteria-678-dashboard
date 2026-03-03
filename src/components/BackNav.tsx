import Link from 'next/link';

type BackNavProps = {
  backTo?: {
    href: string;
    label: string;
  };
};

export default function BackNav({ backTo }: BackNavProps) {
  return (
    <nav aria-label="Navegación de regreso" style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <Link href="/">← Inicio</Link>
      {backTo ? <Link href={backTo.href}>← {backTo.label}</Link> : null}
    </nav>
  );
}
