import { ReactNode } from 'react';

type FieldHintProps = {
  children: ReactNode;
};

export default function FieldHint({ children }: FieldHintProps) {
  return (
    <small style={{ color: '#4b5563', display: 'block', marginTop: 4 }}>
      {children}
    </small>
  );
}
