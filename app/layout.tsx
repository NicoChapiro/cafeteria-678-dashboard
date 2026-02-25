import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cafetería 678 Dashboard',
  description: 'MVP A - Costeo de recetas y ventas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
