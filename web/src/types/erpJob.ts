export interface ErpIntegrationJob {
  id: string;
  requestId: string | null;
  requestNo: string | null;
  targetSystem: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  allowedActions?: {
    retry: boolean;
  };
}
