export function ReturnToLink({ returnTo, label = 'Volver al panel anterior' }: { returnTo: string | null; label?: string }) {
  if (!returnTo) return null;

  return (
    <p>
      <a href={returnTo} data-testid="return-to-link">{label}</a>
    </p>
  );
}
