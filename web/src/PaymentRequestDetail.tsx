import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Globe,
  ExternalLink,
  History,
  User,
  Share2,
  Printer,
  Eye,
  Download,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from './lib/utils';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  approvePaymentRequest,
  cancelPaymentRequest,
  createActorContext,
  financeApprovePaymentRequest,
  financeRejectPaymentRequest,
  getAttachmentContent,
  getPaymentRequestErpReadiness,
  getPaymentRequestById,
  listPaymentRequestAuditLogs,
  holdPaymentRequestSync,
  rejectPaymentRequest,
  releasePaymentRequestToErp,
  resubmitPaymentRequest,
  submitPaymentRequest,
  returnPaymentRequest,
} from './api/paymentRequests';
import type { PaymentRequestErpReadiness, PaymentRequestSummary } from './types/paymentRequest';
import type { AuditLogEntry } from './types/auditLog';

function getStatusColor(status: string) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700';
    case 'submitted':
    case 'pending_approval':
      return 'bg-amber-100 text-amber-700';
    case 'draft':
      return 'bg-slate-100 text-slate-700';
    case 'processing':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-red-100 text-red-700';
  }
}

function formatBusinessStatus(status: string) {
  switch (status) {
    case 'pending_approval':
      return 'Pending Approval';
    case 'submitted':
      return 'Submitted';
    case 'draft':
      return 'Draft';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'returned':
      return 'Returned';
    default:
      return status;
  }
}

function formatErpSyncStatus(status: string) {
  if (status === 'waiting_finance_release') {
    return 'Waiting Finance Review';
  }

  if (status === 'hold_by_finance') {
    return 'Held By Finance';
  }

  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAuditAction(actionCode: string) {
  return actionCode.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWorkflowActorLabel(actorId: string) {
  return actorId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWorkflowStepLabel(stepCode: string) {
  switch (stepCode) {
    case 'line_manager':
      return 'Line Manager';
    case 'reviewer':
      return 'Reviewer';
    case 'hod':
      return 'Head Of Department';
    case 'cfo':
      return 'Chief Financial Officer';
    case 'ceo':
      return 'Chief Executive Officer';
    case 'finance':
      return 'Finance Review';
    default:
      return stepCode.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function formatWorkflowOutcome(status: string) {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'returned':
      return 'Returned';
    case 'pending':
      return 'Pending';
    case 'queued':
      return 'Queued';
    case 'released':
      return 'Released To ERP';
    case 'hold':
      return 'Approved Only / Hold';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function parseDetailRemark(remark?: string | null) {
  const result = {
    invoiceDate: '-',
    invoiceRef: '-',
    costCenter: '-',
    projectCode: '-',
    currency: '-',
    fxRate: '-',
    totalVnd: '-',
    note: '-',
  };

  if (!remark) {
    return result;
  }

  const parts = remark
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const freeNotes: string[] = [];

  for (const part of parts) {
    if (part.toLowerCase().startsWith('invoice date:')) {
      result.invoiceDate = part.replace(/invoice date:/i, '').trim() || '-';
      continue;
    }

    if (part.toLowerCase().startsWith('invoice ref:')) {
      result.invoiceRef = part.replace(/invoice ref:/i, '').trim() || '-';
      continue;
    }

    if (part.toLowerCase().startsWith('erp expense type:')) {
      continue;
    }

    if (part.toLowerCase().startsWith('erp cost center:')) {
      result.costCenter = part.replace(/erp cost center:/i, '').trim() || '-';
      continue;
    }

    if (part.toLowerCase().startsWith('erp project:')) {
      result.projectCode = part.replace(/erp project:/i, '').trim() || '-';
      continue;
    }

    if (part.toLowerCase().startsWith('fx ')) {
      const fxMatch = part.match(/^FX\s+([A-Z]{3})\s+([\d,]+\.\d{2})\s+x\s+([\d,]+\.\d{2})\s+=\s+VND\s+([\d,]+\.\d{2})$/i);
      if (fxMatch) {
        result.currency = fxMatch[1].toUpperCase();
        result.fxRate = fxMatch[3];
        result.totalVnd = fxMatch[4];
      } else {
        result.note = result.note === '-' ? part : `${result.note} | ${part}`;
      }
      continue;
    }

    freeNotes.push(part);
  }

  if (freeNotes.length > 0) {
    result.note = freeNotes.join(' | ');
  }

  return result;
}

function getDetailDisplay(detail: PaymentRequestSummary['details'][number]) {
  const parsedRemark = parseDetailRemark(detail?.remark);

  return {
    invoiceDate: detail?.invoiceDate ?? parsedRemark.invoiceDate,
    invoiceRef: detail?.invoiceRef ?? parsedRemark.invoiceRef,
    costCenter: detail?.costCenter ?? parsedRemark.costCenter,
    projectCode: detail?.projectCode ?? parsedRemark.projectCode,
    currency: detail?.currency ?? parsedRemark.currency,
    fxRate:
      typeof detail?.exchangeRate === 'number' && Number.isFinite(detail.exchangeRate)
        ? detail.exchangeRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : parsedRemark.fxRate,
    totalVnd:
      typeof detail?.totalAmount === 'number' && Number.isFinite(detail.totalAmount)
        ? detail.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : parsedRemark.totalVnd,
    note: detail?.note ?? parsedRemark.note,
  };
}

function escapePrintHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimelineTitle(entry: { type: string; stepCode?: string; stepNo?: number; status?: string; actionCode?: string }) {
  if (entry.type === 'workflow') {
    return `Step ${entry.stepNo} - ${formatWorkflowStepLabel(entry.stepCode ?? 'workflow')} - ${formatWorkflowOutcome(entry.status ?? 'pending')}`;
  }

  switch (entry.actionCode) {
    case 'create_request':
      return 'Request Created';
    case 'submit_request':
      return 'Submitted For Approval';
    case 'resubmit_request':
      return 'Resubmitted';
    case 'cancel_request':
      return 'Cancelled';
    case 'finance_approve':
      return 'Finance Review - Approved Only';
    case 'finance_reject':
      return 'Finance Review - Rejected';
    case 'release_to_erp':
      return 'Finance Review - Released To ERP';
    case 'hold_erp_sync':
      return 'Finance Review - Hold Sync';
    case 'retry_erp_job':
      return 'ERP Job Retried';
    default:
      return formatAuditAction(entry.actionCode ?? 'audit_event');
  }
}

export default function PaymentRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { actor: authActor } = useAuth();
  const [request, setRequest] = useState<PaymentRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [erpReadiness, setErpReadiness] = useState<PaymentRequestErpReadiness | null>(null);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const actor = useMemo(() => {
    if (!authActor) return null;
    return createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });
  }, [authActor]);

  const refreshRequestContext = async () => {
    if (!id || !actor) {
      return;
    }

    const [requestResult, auditResult] = await Promise.all([
      getPaymentRequestById(id, actor),
      listPaymentRequestAuditLogs(id, actor).catch(() => ({ data: [], total: 0 })),
    ]);

    setRequest(requestResult.data);
    setAuditLogs(auditResult.data);
    const shouldCheckReadiness =
      requestResult.data.businessStatus === 'approved' ||
      requestResult.data.allowedActions?.releaseToErp ||
      requestResult.data.allowedActions?.financeApprove ||
      requestResult.data.allowedActions?.financeReject ||
      requestResult.data.allowedActions?.holdSync ||
      ['waiting_finance_release', 'hold_by_finance', 'pending', 'processing', 'success', 'failed', 'manual_review_required'].includes(requestResult.data.erpSyncStatus);

    if (shouldCheckReadiness) {
      const readinessResult = await getPaymentRequestErpReadiness(id, actor).catch(() => null);
      setErpReadiness(readinessResult?.data ?? null);
    } else {
      setErpReadiness(null);
    }
  };

  useEffect(() => {
    if (!id || !actor) {
      setLoading(false);
      return;
    }

    refreshRequestContext()
      .catch((error) => {
        console.error(error);
        toast.error('Unable to load payment request', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
          navigate('/requests');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [actor, id, navigate]);

  const handleApprove = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await approvePaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Payment request approved', {
        description: `${result.data.requestNo} moved to the next workflow state.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to approve payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!id || !actor) {
      return;
    }

    const note = window.prompt('Reject reason is required. Enter the reason for rejection:')?.trim() ?? '';
    if (!note) {
      toast.error('Reject reason is required.');
      return;
    }

    setIsActing(true);
    try {
      const result = await rejectPaymentRequest(id, actor, note);
      await refreshRequestContext();
      toast.success('Payment request rejected', {
        description: `${result.data.requestNo} has been closed by the workflow action.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to reject payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleReturn = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await returnPaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Payment request returned', {
        description: `${result.data.requestNo} was returned to requester for update.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to return payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleResubmit = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await resubmitPaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Payment request resubmitted', {
        description: `${result.data.requestNo} is back in approval flow.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to resubmit payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleSubmit = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await submitPaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Payment request submitted', {
        description: `${result.data.requestNo} is now pending approval.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to submit payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await cancelPaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Payment request cancelled', {
        description: `${result.data.requestNo} has been cancelled.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to cancel payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleReleaseToErp = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await releasePaymentRequestToErp(id, actor);
      await refreshRequestContext();
      toast.success('Request released to ERP queue', {
        description: `${result.data.requestNo} is now pending ERP processing.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to release request to ERP', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleFinanceApprove = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await financeApprovePaymentRequest(id, actor);
      await refreshRequestContext();
      toast.success('Finance approved request', {
        description: `${result.data.requestNo} is approved by finance and can be released later.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-approve request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleFinanceReject = async () => {
    if (!id || !actor) {
      return;
    }

    const note = window.prompt('Finance reject reason is required. Enter the reason for rejection:')?.trim() ?? '';
    if (!note) {
      toast.error('Finance reject reason is required.');
      return;
    }

    setIsActing(true);
    try {
      const result = await financeRejectPaymentRequest(id, actor, note);
      await refreshRequestContext();
      toast.success('Finance rejected request', {
        description: `${result.data.requestNo} has been rejected by finance.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-reject request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleHoldSync = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await holdPaymentRequestSync(id, actor);
      await refreshRequestContext();
      toast.success('ERP sync placed on hold', {
        description: `${result.data.requestNo} is now held by finance.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to hold ERP sync', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckErpReadiness = async () => {
    if (!id || !actor) {
      return;
    }

    setIsCheckingReadiness(true);
    try {
      const result = await getPaymentRequestErpReadiness(id, actor);
      setErpReadiness(result.data);
      toast.success(
        result.data.isReady ? 'ERP readiness check passed' : 'ERP readiness check found issues',
        {
          description: result.data.isReady
            ? 'This request is ready for finance release to ERP.'
            : `${result.data.errors.length} validation issue(s) must be fixed before release.`,
        }
      );
    } catch (error) {
      console.error(error);
      toast.error('Unable to validate ERP readiness', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCheckingReadiness(false);
    }
  };

  const handlePreviewAttachment = async (attachmentId: string, fileName: string) => {
    if (!actor) {
      return;
    }

    setActiveAttachmentId(attachmentId);
    try {
      const asset = await getAttachmentContent(attachmentId, actor);
      const objectUrl = window.URL.createObjectURL(asset.blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error(error);
      toast.error('Unable to preview attachment', {
        description: error instanceof Error ? error.message : `Could not preview ${fileName}.`,
      });
    } finally {
      setActiveAttachmentId(null);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!actor) {
      return;
    }

    setActiveAttachmentId(attachmentId);
    try {
      const asset = await getAttachmentContent(attachmentId, actor, { download: true });
      const objectUrl = window.URL.createObjectURL(asset.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error(error);
      toast.error('Unable to download attachment', {
        description: error instanceof Error ? error.message : `Could not download ${fileName}.`,
      });
    } finally {
      setActiveAttachmentId(null);
    }
  };

  const handlePrint = () => {
    if (!request) {
      return;
    }

    const detailRows = (request.details ?? [])
      .map((detail) => {
        const display = getDetailDisplay(detail);
        return `
          <tr>
            <td>${escapePrintHtml(detail.lineNo)}</td>
            <td>${escapePrintHtml(detail.description)}</td>
            <td>${escapePrintHtml(display.invoiceDate)}</td>
            <td>${escapePrintHtml(display.invoiceRef)}</td>
            <td>${escapePrintHtml(detail.glCode ?? '-')}</td>
            <td>${escapePrintHtml(display.costCenter)}</td>
            <td>${escapePrintHtml(display.projectCode)}</td>
            <td>${escapePrintHtml(display.currency)}</td>
            <td class="num">${escapePrintHtml(
              Number(detail.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            )}</td>
            <td class="num">${escapePrintHtml(display.fxRate)}</td>
            <td class="num">${escapePrintHtml(display.totalVnd)}</td>
            <td>${escapePrintHtml(display.note)}</td>
          </tr>
        `;
      })
      .join('');

    const attachmentRows = (request.attachments ?? [])
      .map((attachment) => `<li>${escapePrintHtml(attachment.fileName)}</li>`)
      .join('');
    const auditRows = lifecycleEntries
      .map((entry) => `
        <tr>
          <td>${escapePrintHtml(new Date(entry.createdAt).toLocaleString())}</td>
          <td>${escapePrintHtml(entry.title)}</td>
          <td>${escapePrintHtml(entry.actorName)}</td>
          <td>${escapePrintHtml(entry.note)}</td>
        </tr>
      `)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${escapePrintHtml(request.requestNo)} - Print</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            h2 { margin: 28px 0 12px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.04em; }
            .meta { color: #475569; font-size: 13px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; }
            .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
            .field-value { font-size: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; vertical-align: top; text-align: left; }
            th { background: #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .num { text-align: right; white-space: nowrap; }
            ul { margin: 0; padding-left: 18px; }
          </style>
        </head>
        <body>
          <h1>${escapePrintHtml(request.requestNo)}</h1>
          <div class="meta">
            Created by ${escapePrintHtml(request.requesterName)} on ${escapePrintHtml(new Date(request.createdAt).toLocaleDateString())}
          </div>

          <h2>Summary</h2>
          <div class="grid">
            <div><div class="field-label">Payee</div><div class="field-value">${escapePrintHtml(request.payeeName)}</div></div>
            <div><div class="field-label">Department</div><div class="field-value">${escapePrintHtml(request.departmentId)}</div></div>
            <div><div class="field-label">Vendor Code</div><div class="field-value">${escapePrintHtml(request.vendorCode ?? '-')}</div></div>
            <div><div class="field-label">Payment Method</div><div class="field-value">${escapePrintHtml(request.paymentType)}</div></div>
            <div><div class="field-label">Currency</div><div class="field-value">${escapePrintHtml(request.currency)}</div></div>
            <div><div class="field-label">Total Amount</div><div class="field-value">${escapePrintHtml(
              request.totalAmount.toLocaleString('en-US', { style: 'currency', currency: request.currency })
            )}</div></div>
            <div><div class="field-label">Bank Name</div><div class="field-value">${escapePrintHtml(request.bankName ?? '-')}</div></div>
            <div><div class="field-label">Bank Account</div><div class="field-value">${escapePrintHtml(request.bankAccountNumber ?? '-')}</div></div>
          </div>

          <h2>Payment Details</h2>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Description</th>
                <th>Inv. Date</th>
                <th>Inv. Ref</th>
                <th>GL Code</th>
                <th>Cost Center</th>
                <th>Project</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>FX Rate</th>
                <th>Total VND</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>

          <h2>Attachments</h2>
          ${attachmentRows ? `<ul>${attachmentRows}</ul>` : '<div class="field-value">No visible attachments</div>'}

          <h2>Audit Log &amp; Lifecycle</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>${auditRows}</tbody>
          </table>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const iframeDocument = iframe.contentWindow?.document;
    if (!iframeDocument || !iframe.contentWindow) {
      iframe.remove();
      toast.error('Unable to initialize print document.');
      return;
    }

    iframeDocument.open();
    iframeDocument.write(html);
    iframeDocument.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black text-on-surface tracking-tighter uppercase">Loading Details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black tracking-tighter">Request Not Found</h2>
        <button onClick={() => navigate('/requests')} className="text-secondary font-bold text-sm">Back to Ledger</button>
      </div>
    );
  }

  const canApprove = Boolean(request.allowedActions?.approve);
  const canReject = Boolean(request.allowedActions?.reject);
  const canReturn = Boolean(request.allowedActions?.returnRequest);
  const canCancel = Boolean(request.allowedActions?.cancel);
  const canSubmit = Boolean(request.allowedActions?.submit);
  const canResubmit = Boolean(request.allowedActions?.resubmit);
  const canReleaseToErp = Boolean(request.allowedActions?.releaseToErp);
  const canFinanceApprove = Boolean(request.allowedActions?.financeApprove);
  const canFinanceReject = Boolean(request.allowedActions?.financeReject);
  const canHoldSync = Boolean(request.allowedActions?.holdSync);
  const timelineEntries = auditLogs.length > 0
    ? auditLogs
    : [
      {
        id: `fallback-created-${request.id}`,
        entityId: request.id,
        actionCode: 'create_request',
        actorName: request.requesterName,
        note: `Request ${request.requestNo} was created.`,
        createdAt: request.createdAt,
      },
    ];
  const workflowSteps = request.workflowSteps ?? [];
  const financeAudit = auditLogs.find((entry) =>
    ['finance_approve', 'finance_reject', 'release_to_erp', 'hold_erp_sync'].includes(entry.actionCode)
  );
  const shouldShowFinanceStage =
    request.businessStatus === 'approved' ||
    request.allowedActions?.financeApprove ||
    request.allowedActions?.financeReject ||
    request.allowedActions?.releaseToErp ||
    request.allowedActions?.holdSync ||
    ['waiting_finance_release', 'hold_by_finance', 'pending', 'processing', 'success', 'failed', 'manual_review_required'].includes(request.erpSyncStatus);
  const shouldShowErpReadinessPanel =
    request.businessStatus === 'approved' ||
    canReleaseToErp ||
    canFinanceApprove ||
    canFinanceReject ||
    canHoldSync ||
    ['waiting_finance_release', 'hold_by_finance', 'pending', 'processing', 'success', 'failed', 'manual_review_required'].includes(request.erpSyncStatus);

  const approvalStages = [
    ...workflowSteps.map((step) => ({
      type: 'workflow' as const,
      id: `workflow-step-${step.stepNo}`,
      stepNo: step.stepNo,
      stepCode: step.stepCode,
      approverId: step.approverId,
      approverName: step.actingApproverName || step.approverName || formatWorkflowActorLabel(step.approverId),
      status: step.status,
      actionAt: step.actionAt ?? null,
      isCurrent: step.status === 'pending',
    })),
    ...(shouldShowFinanceStage
      ? [{
          type: 'finance' as const,
          id: 'finance-stage',
          stepNo: workflowSteps.length + 1,
          stepCode: 'finance',
          approverId: financeAudit?.actorId ?? 'finance-ops',
          approverName: financeAudit?.actorName ?? 'Finance Operations',
          status:
            request.allowedActions?.financeApprove || request.allowedActions?.financeReject || request.allowedActions?.releaseToErp || request.allowedActions?.holdSync
              ? 'pending'
              : request.erpSyncStatus === 'hold_by_finance'
                ? 'hold'
                : ['pending', 'processing', 'success', 'failed', 'manual_review_required'].includes(request.erpSyncStatus)
                  ? 'released'
                  : 'queued',
          actionAt: financeAudit?.createdAt ?? null,
          isCurrent:
            Boolean(request.allowedActions?.financeApprove) ||
            Boolean(request.allowedActions?.financeReject) ||
    Boolean(request.allowedActions?.releaseToErp) ||
    Boolean(request.allowedActions?.holdSync) ||
    request.erpSyncStatus === 'waiting_finance_release',
        }]
      : []),
  ];

  const lifecycleEntries = [
    ...timelineEntries
      .filter((log) => !['approve_request', 'reject_request', 'return_request'].includes(log.actionCode))
      .map((log) => ({
        id: log.id,
        type: 'audit' as const,
        createdAt: log.createdAt,
        title: formatTimelineTitle({ type: 'audit', actionCode: log.actionCode }),
        note: log.note || `${formatAuditAction(log.actionCode)} on ${request.requestNo}.`,
        actorName: log.actorName || log.actorId || 'System',
      })),
    ...workflowSteps
      .filter((step) => ['approved', 'rejected', 'returned'].includes(step.status) && step.actionAt)
      .map((step) => ({
        id: `timeline-step-${step.stepNo}-${step.status}`,
        type: 'workflow' as const,
        createdAt: step.actionAt ?? request.createdAt,
        title: formatTimelineTitle({ type: 'workflow', stepCode: step.stepCode, stepNo: step.stepNo, status: step.status }),
        note: `${formatWorkflowStepLabel(step.stepCode)} was ${formatWorkflowOutcome(step.status).toLowerCase()} by ${step.actingApproverName || step.approverName || formatWorkflowActorLabel(step.approverId)}.`,
        actorName: step.actingApproverName || step.approverName || formatWorkflowActorLabel(step.approverId),
      })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const currentStage = approvalStages.find((stage) => stage.isCurrent) ?? approvalStages[approvalStages.length - 1] ?? null;
  const currentLaneLabel = currentStage?.stepCode === 'finance' ? 'Finance Review' : 'Business Approval';
  const currentLaneTone = currentStage?.stepCode === 'finance' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700';

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-on-surface tracking-tighter">{request.requestNo}</h1>
              <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter', getStatusColor(request.businessStatus))}>
                {formatBusinessStatus(request.businessStatus)}
              </span>
            </div>
            <p className="text-xs font-medium text-on-surface-variant">
              Created by {request.requesterName} on {new Date(request.createdAt).toLocaleDateString()} • Department: {request.departmentId}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant"
          >
            <Printer size={20} />
          </button>
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Share2 size={20} />
          </button>
          <div className="w-px h-10 bg-surface-container-high mx-2" />

          {(canApprove || canReject || canReturn || canCancel || canSubmit || canResubmit || canReleaseToErp || canFinanceApprove || canFinanceReject || canHoldSync) && (
            <>
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={isActing}
                  className="px-6 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Cancel'}
                </button>
              )}
              {canSubmit && (
                <button
                  onClick={handleSubmit}
                  disabled={isActing}
                  className="px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Submit'}
                </button>
              )}
              {canReturn && (
                <button
                  onClick={handleReturn}
                  disabled={isActing}
                  className="px-6 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  Return
                </button>
              )}
              {canReject && (
                <button
                  onClick={handleReject}
                  disabled={isActing}
                  className="px-6 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              {canApprove && (
                <button
                  onClick={handleApprove}
                  disabled={isActing}
                  className="px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Approve'}
                </button>
              )}
              {canResubmit && (
                <button
                  onClick={handleResubmit}
                  disabled={isActing}
                  className="px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Resubmit'}
                </button>
              )}
              {canReleaseToErp && (
                <button
                  onClick={handleReleaseToErp}
                  disabled={isActing || (erpReadiness !== null && !erpReadiness.isReady)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Approve & Release ERP'}
                </button>
              )}
              {canFinanceApprove && (
                <button
                  onClick={handleFinanceApprove}
                  disabled={isActing}
                  className="px-6 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Finance Approve'}
                </button>
              )}
              {canFinanceReject && (
                <button
                  onClick={handleFinanceReject}
                  disabled={isActing}
                  className="px-6 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Finance Reject'}
                </button>
              )}
              {canHoldSync && (
                <button
                  onClick={handleHoldSync}
                  disabled={isActing}
                  className="px-6 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Hold Sync'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Total Amount</p>
              <p className="text-2xl font-black text-on-surface tracking-tighter">
                {request.totalAmount.toLocaleString('en-US', { style: 'currency', currency: request.currency })}
              </p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">Currency: {request.currency}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Payment Method</p>
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-secondary" />
                <p className="text-sm font-bold text-on-surface">{request.paymentType}</p>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">Request Type: {request.requestType}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Priority</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600" />
                <p className="text-sm font-bold text-on-surface capitalize">{request.priority}</p>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">Visibility: {request.visibilityMode}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Current Lane</p>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', currentLaneTone)}>
                  {currentLaneLabel}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-2">
                {currentStage ? `${formatWorkflowStepLabel(currentStage.stepCode)} • ${formatWorkflowOutcome(currentStage.status)}` : 'No active workflow stage'}
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg tracking-tight">Payee Summary</h3>
              <button className="text-secondary text-xs font-bold flex items-center gap-1 hover:underline">
                View Master Data <ExternalLink size={14} />
              </button>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-surface-container-low rounded-2xl flex items-center justify-center text-secondary">
                <Building2 size={32} />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Payee Name</p>
                  <p className="text-sm font-bold">{request.payeeName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Department</p>
                  <p className="text-sm font-bold">{request.departmentId}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Requester</p>
                  <p className="text-sm font-bold">{request.requesterName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Current ERP Status</p>
                  <p className="text-sm font-bold">{formatErpSyncStatus(request.erpSyncStatus)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Bank Name</p>
                  <p className="text-sm font-bold">{request.bankName || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Bank Account</p>
                  <p className="text-sm font-bold">{request.bankAccountNumber || '-'}</p>
                  {request.canViewBankDetails === false ? (
                    <p className="text-[10px] text-on-surface-variant mt-1">Masked for your access scope.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg tracking-tight">Payment Details</h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {(request.details ?? []).length} line item{(request.details ?? []).length === 1 ? '' : 's'}
              </span>
            </div>

            {request.details && request.details.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-surface-container-high">
                <table className="min-w-[1780px] w-full table-auto">
                  <colgroup>
                    <col className="w-16" />
                    <col className="w-44" />
                    <col className="w-32" />
                    <col className="w-44" />
                    <col className="w-28" />
                    <col className="w-32" />
                    <col className="w-36" />
                    <col className="w-28" />
                    <col className="w-32" />
                    <col className="w-32" />
                    <col className="w-40" />
                    <col className="w-[360px]" />
                  </colgroup>
                  <thead className="bg-surface-container-low">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      <th className="px-5 py-3">Line</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Inv. Date</th>
                      <th className="px-5 py-3">Inv. Ref</th>
                      <th className="px-5 py-3">GL Code</th>
                      <th className="px-5 py-3">Cost Center</th>
                      <th className="px-5 py-3">Project</th>
                      <th className="px-5 py-3">Currency</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">FX Rate</th>
                      <th className="px-5 py-3">Total VND</th>
                      <th className="px-5 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {request.details.map((detail) => {
                      const displayDetail = getDetailDisplay(detail);

                      return (
                      <tr key={detail.id} className="align-top text-sm">
                        <td className="px-5 py-4 font-mono font-bold text-secondary">{detail.lineNo}</td>
                        <td className="px-5 py-4 font-semibold text-on-surface break-words">{detail.description}</td>
                        <td className="px-5 py-4 text-on-surface-variant">{displayDetail.invoiceDate}</td>
                        <td className="px-5 py-4 text-on-surface-variant break-words">{displayDetail.invoiceRef}</td>
                        <td className="px-5 py-4 font-medium text-on-surface-variant">{detail.glCode || '-'}</td>
                        <td className="px-5 py-4 font-medium text-on-surface-variant">{displayDetail.costCenter}</td>
                        <td className="px-5 py-4 font-medium text-on-surface-variant">{displayDetail.projectCode}</td>
                        <td className="px-5 py-4 font-medium text-on-surface-variant">{displayDetail.currency}</td>
                        <td className="px-5 py-4 font-mono font-bold text-on-surface">
                          {displayDetail.currency !== '-' && displayDetail.currency !== 'VND'
                            ? `${displayDetail.currency} ${Number(detail.amount ?? 0).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : Number(detail.amount ?? 0).toLocaleString('en-US', {
                                style: 'currency',
                                currency: request.currency,
                              })}
                        </td>
                        <td className="px-5 py-4 font-mono text-on-surface-variant">{displayDetail.fxRate}</td>
                        <td className="px-5 py-4 font-mono font-bold text-on-surface">
                          {displayDetail.totalVnd !== '-'
                            ? `VND ${displayDetail.totalVnd}`
                            : Number(detail.amount ?? 0).toLocaleString('en-US', {
                                style: 'currency',
                                currency: request.currency,
                              })}
                        </td>
                        <td className="min-w-[360px] px-5 py-4 text-on-surface-variant">
                          <p className="max-w-[360px] leading-6 break-words whitespace-normal">{displayDetail.note}</p>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-surface-container-high p-4 text-xs text-on-surface-variant">
                No persisted payment detail lines were recorded for this request yet.
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Audit Log & Lifecycle</h3>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-surface-container-high">
              {lifecycleEntries.map((entry, index) => (
                <div key={entry.id} className="relative pl-8">
                  <div className={cn(
                    'absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center',
                    index === 0 ? 'bg-secondary' : 'bg-surface-container-high'
                  )}>
                    {index === 0 && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <p className={cn('text-xs font-bold', index === 0 ? 'text-secondary' : 'text-on-surface')}>
                      {entry.title}
                    </p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {entry.note}
                  </p>
                  <p className="text-[10px] font-bold text-on-surface-variant mt-1 flex items-center gap-1">
                    <User size={10} /> {entry.actorName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 mb-6">
              <History className="text-secondary" size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">ERP Sync Lifecycle</span>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Request No</span>
                <span className="text-xs font-mono font-bold">{request.requestNo}</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                  <span>ERP Status</span>
                  <span>{formatErpSyncStatus(request.erpSyncStatus)}</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full',
                      request.erpSyncStatus === 'success' ? 'bg-green-400 w-full' :
                      request.erpSyncStatus === 'waiting_finance_release' ? 'bg-amber-400 w-1/3' :
                      request.erpSyncStatus === 'processing' ? 'bg-secondary w-2/3' :
                      'bg-white/40 w-1/4'
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-xs font-medium">Business status: {formatBusinessStatus(request.businessStatus)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-amber-300" />
                  <span className="text-xs font-medium">ERP sync: {formatErpSyncStatus(request.erpSyncStatus)}</span>
                </div>
              </div>
            </div>
          </div>

          {shouldShowErpReadinessPanel && (
            <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg tracking-tight">ERP Readiness Check</h3>
                  <p className="text-xs text-on-surface-variant">
                    Validate vendor, expense type, and GL mapping before finance release.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckErpReadiness}
                  disabled={isCheckingReadiness}
                  className="rounded-xl border border-surface-container-high px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
                >
                  {isCheckingReadiness ? 'Checking...' : 'Run Check'}
                </button>
              </div>

              {erpReadiness ? (
                <div className="space-y-3">
                  <div className={cn(
                    'rounded-xl border px-4 py-3 text-sm font-bold',
                    erpReadiness.isReady
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  )}>
                    {erpReadiness.isReady
                      ? 'Ready for ERP release.'
                      : `Blocked by ${erpReadiness.errors.length} readiness issue(s).`}
                  </div>

                  <p className="text-[11px] text-on-surface-variant">
                    Last checked: {new Date(erpReadiness.validatedAt).toLocaleString()}
                  </p>

                  {!erpReadiness.isReady && (
                    <div className="rounded-xl border border-surface-container-high bg-surface-container-low p-4">
                      <ul className="space-y-2">
                        {erpReadiness.errors.map((error, index) => (
                          <li key={`${error.code}-${error.lineNo ?? 'header'}-${index}`} className="flex items-start gap-2 text-xs text-on-surface-variant">
                            <span className="mt-0.5 text-red-500">•</span>
                            <span>{error.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-container-high p-4 text-xs text-on-surface-variant">
                  No readiness validation has been executed yet for this request.
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Attachments</h3>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="space-y-3">
                {request.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-xl border border-surface-container-high p-4">
                    <p className="text-sm font-bold text-on-surface break-all">{attachment.fileName}</p>
                      {attachment.isSensitive ? (
                        <p className="text-[10px] text-on-surface-variant mt-1">Sensitive attachment</p>
                      ) : null}
                    <p className="hidden text-[11px] text-on-surface-variant mt-1 font-mono break-all">{attachment.filePath}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewAttachment(attachment.id, attachment.fileName)}
                        disabled={activeAttachmentId === attachment.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-surface-container-high px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
                      >
                        <Eye size={14} />
                        {activeAttachmentId === attachment.id ? 'Opening...' : 'Preview'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(attachment.id, attachment.fileName)}
                        disabled={activeAttachmentId === attachment.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-surface-container-high px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
                      >
                        <Download size={14} />
                        {activeAttachmentId === attachment.id ? 'Preparing...' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-surface-container-high p-4 text-xs text-on-surface-variant">
                No attachment metadata has been recorded for this request yet.
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Approval Chain</h3>
            <div className="space-y-4">
              {approvalStages.map((stage) => (
                <div
                  key={stage.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-xl border',
                    stage.isCurrent ? 'bg-amber-50 border-amber-100' : 'bg-surface-container-low border-surface-container-high'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    stage.isCurrent ? 'bg-amber-600 text-white' : 'bg-surface-container-high text-on-surface-variant'
                  )}>
                    {`S${stage.stepNo}`}
                  </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold">{formatWorkflowStepLabel(stage.stepCode)}</p>
                      <p className="text-[10px] text-on-surface-variant">{stage.approverName}</p>
                      <p className="text-[10px] text-on-surface-variant font-mono">{stage.approverId}</p>
                      <div className="mt-1">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider',
                            stage.isCurrent
                              ? 'bg-amber-100 text-amber-700'
                              : stage.status === 'approved' || stage.status === 'released' || stage.status === 'hold'
                                ? 'bg-green-100 text-green-700'
                                : stage.status === 'rejected' || stage.status === 'returned'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {formatWorkflowOutcome(stage.status)}
                        </span>
                      </div>
                    </div>
                  {stage.isCurrent
                    ? <Clock size={16} className="text-amber-600" />
                    : stage.status === 'approved' || stage.status === 'released' || stage.status === 'hold'
                      ? <CheckCircle2 size={16} className="text-green-600" />
                      : stage.status === 'rejected' || stage.status === 'returned'
                        ? <AlertCircle size={16} className="text-red-600" />
                        : <Clock size={16} className="text-slate-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


