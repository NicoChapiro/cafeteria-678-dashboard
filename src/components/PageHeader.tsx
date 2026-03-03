import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backNav?: ReactNode;
};

export default function PageHeader({ title, description, actions, backNav }: PageHeaderProps) {
  return (
    <header className="card" style={{ marginBottom: 0 }}>
      {backNav ? <div style={{ marginBottom: 8 }}>{backNav}</div> : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {description ? (
            <div style={{ marginTop: 8 }}>
              {typeof description === 'string' ? <p className="muted">{description}</p> : description}
            </div>
          ) : null}
        </div>

        {actions ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
    </header>
  );
}
