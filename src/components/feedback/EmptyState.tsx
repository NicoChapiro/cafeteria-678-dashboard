import { ReactNode } from 'react';

type EmptyStateTone = 'neutral' | 'info' | 'warning' | 'error';

type EmptyStateProps = {
  title: string;
  description?: string;
  tone?: EmptyStateTone;
  compact?: boolean;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  tone = 'neutral',
  compact = false,
  action,
}: EmptyStateProps) {
  return (
    <section className={`emptyState emptyState--${tone} ${compact ? 'emptyState--compact' : ''}`.trim()}>
      <p className="emptyState__title">{title}</p>
      {description ? <p className="emptyState__description">{description}</p> : null}
      {action ? <div className="emptyState__action">{action}</div> : null}
    </section>
  );
}
