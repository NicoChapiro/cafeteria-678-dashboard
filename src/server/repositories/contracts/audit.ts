import type { AuditLog } from '@/src/domain/types';

export interface AuditRepository {
  list(): Promise<AuditLog[]>;
  append(event: AuditLog): Promise<AuditLog>;
  clear(actor: string): Promise<void>;
}
