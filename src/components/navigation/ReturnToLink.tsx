import Link from 'next/link';

export function ReturnToLink({ returnTo, label = 'Volver al panel anterior' }: { returnTo: string | null; label?: string }) {
  if (!returnTo) return null;

  return (
    <p>
      <Link href={returnTo}>{label}</Link>
    </p>
  );
}
