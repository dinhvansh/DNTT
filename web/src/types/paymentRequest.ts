export interface PaymentRequestAttachment {
  id: string;
  attachmentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt?: string;
}

export interface PaymentRequestSummary {
  id: string;
  requestNo: string;
  requesterId: string;
  requesterName: string;
  departmentId: string;
  requestType: string;
  payeeName: string;
  paymentType: string;
  totalAmount: number;
  currency: string;
  priority: string;
  visibilityMode: string;
  businessStatus: string;
  erpSyncStatus: string;
  createdAt: string;
  workflowUserIds: string[];
  currentStepApproverIds: string[];
  attachments?: PaymentRequestAttachment[];
  allowedActions?: {
    approve: boolean;
    reject: boolean;
    returnRequest: boolean;
    cancel: boolean;
    submit: boolean;
    resubmit: boolean;
    releaseToErp: boolean;
    holdSync: boolean;
    retryErpPush: boolean;
  };
}
