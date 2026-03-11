import type { ReactNode } from 'react';

import TopNav from './TopNav';
import WorkspaceHeader from './WorkspaceHeader';

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="dashboardShell">
      <TopNav />
      <WorkspaceHeader>
        <main className="dashboardShell__main">{children}</main>
      </WorkspaceHeader>
    </div>
  );
}
