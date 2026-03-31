export interface AuditLogEntry {
  id: string;
  entityType?: string;
  entityId: string;
  actionCode: string;
  actorId?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}
