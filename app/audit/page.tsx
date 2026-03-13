'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AuditLog } from '@/src/domain/types';
import {
  clearAuditLogs,
  exportData,
  importData,
  listAuditLogs,
} from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString();
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dataMessage, setDataMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);

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

  function handleExport(): void {
    exportData();
    setDataMessage({ type: 'success', text: 'Exportación completada.' });
    refresh();
  }

  function handleImport(): void {
    if (!importFile) {
      setDataMessage({ type: 'error', text: 'Selecciona un archivo JSON antes de importar.' });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        importData(text);
        setDataMessage({ type: 'success', text: 'Importación completada.' });
        setImportFile(null);
        setSelectedLogId(null);
        refresh();
      } catch (error) {
        setDataMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Error al importar el archivo.',
        });
      }
    };

    reader.onerror = () => {
      setDataMessage({ type: 'error', text: 'No se pudo leer el archivo seleccionado.' });
    };

    reader.readAsText(importFile, 'utf-8');
  }

  return (
    <main className="pageStack" style={{ gap: 12 }}>
      <h1 style={{ margin: 0 }}>Auditoría</h1>

      <section className="card" style={{ display: 'grid', gap: 10, marginBottom: 0, maxWidth: 1120 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Acciones de datos</h2>

        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <button className="btnSecondary" type="button" onClick={handleExport}>
            Exportar JSON
          </button>

          <label>
            Archivo JSON
            <br />
            <input
              className="input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setDataMessage(null);
              }}
            />
          </label>

          <button className="btn" type="button" onClick={handleImport}>
            Importar JSON
          </button>

          <button className="btnSecondary" type="button" onClick={refresh}>
            Refrescar
          </button>

          <button className="btnSecondary" type="button" onClick={handleClear}>
            Limpiar auditoría
          </button>
        </div>

        {dataMessage ? (
          <p
            style={{
              margin: 0,
              color: dataMessage.type === 'error' ? '#b00020' : '#0f5132',
            }}
          >
            {dataMessage.text}
          </p>
        ) : null}
      </section>

      <section className="card" style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginBottom: 0, maxWidth: 1120 }}>
        <h2 style={{ margin: 0, fontSize: 18, width: '100%' }}>Filtros</h2>

        <label>
          Tipo de entidad
          <br />
          <select
            className="select"
            value={entityTypeFilter}
            onChange={(event) => setEntityTypeFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>

        <label>
          Acción
          <br />
          <select className="select" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">Todas</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Tabla de logs</h2>

        <div className="tableWrap listPageTable"><table className="table">
          <thead>
            <tr>
              <th>
                Fecha
              </th>
              <th>
                Acción
              </th>
              <th>
                Tipo de entidad
              </th>
              <th>
                ID de entidad
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => {
              const isSelected = selectedLogId === log.id;

              return (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#e9f2ff' : 'transparent',
                    boxShadow: isSelected ? 'inset 3px 0 0 #0d6efd' : 'none',
                  }}
                >
                  <td>
                    {formatDate(log.createdAt)}
                  </td>
                  <td>{log.action}</td>
                  <td>{log.entityType}</td>
                  <td>{log.entityId}</td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: '#666' }}>
                  No hay logs para los filtros seleccionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table></div>
      </section>

      <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          Detalle del cambio
        </h2>
        <pre
          style={{
            margin: 0,
            background: '#111',
            color: '#e9e9e9',
            padding: 12,
            overflowX: 'auto',
            minHeight: 150,
            borderRadius: 8,
          }}
        >
          {selectedLog ? JSON.stringify(selectedLog.diffJson, null, 2) : 'Selecciona un log'}
        </pre>
      </section>
    </main>
  );
}
