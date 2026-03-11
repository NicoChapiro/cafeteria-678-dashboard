import type { ReactNode } from 'react';

type WorkspaceHeaderProps = {
  children: ReactNode;
};

export default function WorkspaceHeader({ children }: WorkspaceHeaderProps) {
  return (
    <div className="workspaceShell">
      <div className="workspaceShell__header">
        <p className="workspaceShell__eyebrow">Workspace</p>
        <h2 className="workspaceShell__title">Cafetería 678 Dashboard</h2>
      </div>
      <div className="workspaceShell__content">{children}</div>
    </div>
  );
}
