export interface ErpIntegrationJob {
  id: string;
  requestId: string | null;
  requestNo: string | null;
  targetSystem: string;
  idempotencyKey?: string | null;
  status: string;
  errorCategory?: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  allowedActions?: {
    retry: boolean;
  };
}
