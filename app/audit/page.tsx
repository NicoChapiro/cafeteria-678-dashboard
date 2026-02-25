'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AuditLog } from '@/src/domain/types';
import { clearAuditLogs, listAuditLogs } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString();
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  useEffect(() => {
    setLogs(listAuditLogs());
  }, []);

  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entityType))).sort(),
    [logs],
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const passEntity =
          entityTypeFilter === 'all' || log.entityType === entityTypeFilter;
        const passAction = actionFilter === 'all' || log.action === actionFilter;
        return passEntity && passAction;
      }),
    [actionFilter, entityTypeFilter, logs],
  );

  const selectedLog = filteredLogs.find((entry) => entry.id === selectedLogId) ?? null;

  function refresh(): void {
    setLogs(listAuditLogs());
  }

  function handleClear(): void {
    clearAuditLogs();
    setSelectedLogId(null);
    refresh();
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Audit logs</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <label>
          Entity type
          <br />
          <select
            value={entityTypeFilter}
            onChange={(event) => setEntityTypeFilter(event.target.value)}
          >
            <option value="all">all</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>

        <label>
          Action
          <br />
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">all</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={refresh}>
          Refresh
        </button>

        <button type="button" onClick={handleClear}>
          Clear audit logs
        </button>
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              createdAt
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              action
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              entityType
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              entityId
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log) => (
            <tr
              key={log.id}
              onClick={() => setSelectedLogId(log.id)}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedLogId === log.id ? '#f2f2f2' : 'transparent',
              }}
            >
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{formatDate(log.createdAt)}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{log.action}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{log.entityType}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{log.entityId}</td>
            </tr>
          ))}
          {filteredLogs.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8 }}>
                Sin logs
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>diffJson</h2>
      <pre style={{ background: '#111', color: '#e9e9e9', padding: 12, overflowX: 'auto' }}>
        {selectedLog ? JSON.stringify(selectedLog.diffJson, null, 2) : 'Selecciona un log'}
      </pre>
    </main>
  );
}
