export interface PaymentRequestAttachment {
  id: string;
  attachmentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt?: string;
  isSensitive?: boolean;
}

export interface PaymentRequestLineItem {
  id: string;
  lineNo: number;
  description: string;
  invoiceDate?: string | null;
  invoiceRef?: string | null;
  glCode?: string | null;
  costCenter?: string | null;
  projectCode?: string | null;
  expenseTypeCode?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  amount: number;
  totalAmount?: number | null;
  note?: string | null;
  remark?: string | null;
}

export interface PaymentRequestWorkflowStep {
  stepNo: number;
  stepCode: string;
  approverId: string;
  approverName?: string | null;
  actingApproverId?: string | null;
  actingApproverName?: string | null;
  status: string;
  actionAt?: string | null;
}

export interface PaymentRequestWorkflowPreviewCandidate {
  approverId: string;
  approverName: string;
  positionCode?: string | null;
  roleCode?: string | null;
}

export interface PaymentRequestWorkflowPreviewStep {
  stepCode: string;
  approverId: string;
  approverName: string;
  defaultApproverId?: string | null;
  defaultApproverName?: string | null;
  isOverridden?: boolean;
  willBeSkipped?: boolean;
  skippedReason?: string | null;
}

export interface PaymentRequestWorkflowPreviewIssue {
  code: string;
  stepCode?: string | null;
  severity: 'error' | 'warning';
  message: string;
}

export interface PaymentRequestWorkflowPreview {
  departmentId: string | null;
  steps: PaymentRequestWorkflowPreviewStep[];
  issues: PaymentRequestWorkflowPreviewIssue[];
  lineManagerOverride: {
    defaultApproverId?: string | null;
    defaultApproverName?: string | null;
    selectedApproverId?: string | null;
    selectedApproverName?: string | null;
    candidates: PaymentRequestWorkflowPreviewCandidate[];
  };
}

export interface PaymentRequestErpReadinessIssue {
  level: string;
  lineNo?: number;
  code: string;
  message: string;
}

export interface PaymentRequestErpReadiness {
  isReady: boolean;
  validatedAt: string;
  errors: PaymentRequestErpReadinessIssue[];
}

export interface PaymentRequestErpReadinessSummary {
  isReady: boolean;
  errorCount: number;
  firstErrorMessage?: string | null;
  validatedAt: string;
}

export interface PaymentRequestSummary {
  id: string;
  requestNo: string;
  requesterId: string;
  requesterName: string;
  departmentId: string;
  templateCode?: string | null;
  templateName?: string | null;
  templateVersion?: number | null;
  templateFormSchema?: Record<string, unknown>;
  templateDetailSchema?: Record<string, unknown>;
  templateAttachmentRules?: Record<string, unknown>;
  vendorCode?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  canViewBankDetails?: boolean;
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
  details?: PaymentRequestLineItem[];
  workflowSteps?: PaymentRequestWorkflowStep[];
  attachments?: PaymentRequestAttachment[];
  erpReadinessSummary?: PaymentRequestErpReadinessSummary;
  allowedActions?: {
    approve: boolean;
    reject: boolean;
    returnRequest: boolean;
    cancel: boolean;
    submit: boolean;
    resubmit: boolean;
    releaseToErp: boolean;
    financeApprove: boolean;
    financeReject: boolean;
    holdSync: boolean;
    retryErpPush: boolean;
  };
}
