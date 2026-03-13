import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
};

export default function PageShell({ children }: PageShellProps) {
  return (
    <main
      style={{
        width: '100%',
        maxWidth: 1280,
        margin: '0 auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {children}
    </main>
  );
}
