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
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from './lib/utils';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  approvePaymentRequest,
  cancelPaymentRequest,
  createActorContext,
  getPaymentRequestById,
  holdPaymentRequestSync,
  rejectPaymentRequest,
  releasePaymentRequestToErp,
  resubmitPaymentRequest,
  submitPaymentRequest,
  returnPaymentRequest,
} from './api/paymentRequests';
import type { PaymentRequestSummary } from './types/paymentRequest';

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
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PaymentRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { actor: authActor } = useAuth();
  const [request, setRequest] = useState<PaymentRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const actor = useMemo(() => {
    if (!authActor) return null;
    return createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });
  }, [authActor]);

  useEffect(() => {
    if (!id || !actor) {
      setLoading(false);
      return;
    }

    getPaymentRequestById(id, actor)
      .then((result) => {
        setRequest(result.data);
      })
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
      setRequest(result.data);
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

    setIsActing(true);
    try {
      const result = await rejectPaymentRequest(id, actor);
      setRequest(result.data);
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
      setRequest(result.data);
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
      setRequest(result.data);
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
      setRequest(result.data);
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
      setRequest(result.data);
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
      setRequest(result.data);
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

  const handleHoldSync = async () => {
    if (!id || !actor) {
      return;
    }

    setIsActing(true);
    try {
      const result = await holdPaymentRequestSync(id, actor);
      setRequest(result.data);
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
  const canHoldSync = Boolean(request.allowedActions?.holdSync);

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
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Printer size={20} />
          </button>
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Share2 size={20} />
          </button>
          <div className="w-px h-10 bg-surface-container-high mx-2" />

          {(canApprove || canReject || canReturn || canCancel || canSubmit || canResubmit || canReleaseToErp || canHoldSync) && (
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
                  disabled={isActing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {isActing ? 'Processing...' : 'Release to ERP'}
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
          <div className="grid grid-cols-3 gap-4">
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
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Audit Log & Lifecycle</h3>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-surface-container-high">
              {[
                { time: new Date(request.createdAt).toLocaleString(), user: request.requesterName, action: 'Request Created', detail: `${request.requestNo} was created for ${request.payeeName}.` },
                { time: new Date(request.createdAt).toLocaleString(), user: 'Workflow Engine', action: 'Visibility Applied', detail: `Mode: ${request.visibilityMode}.` },
                { time: new Date(request.createdAt).toLocaleString(), user: 'Workflow Engine', action: 'Current Business Status', detail: formatBusinessStatus(request.businessStatus), active: true },
              ].map((log, index) => (
                <div key={index} className="relative pl-8">
                  <div className={cn(
                    'absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center',
                    log.active ? 'bg-secondary' : 'bg-surface-container-high'
                  )}>
                    {log.active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <p className={cn('text-xs font-bold', log.active ? 'text-secondary' : 'text-on-surface')}>{log.action}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{log.time}</p>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{log.detail}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant mt-1 flex items-center gap-1">
                    <User size={10} /> {log.user}
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

          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Attachments</h3>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="space-y-3">
                {request.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-xl border border-surface-container-high p-4">
                    <p className="text-sm font-bold text-on-surface">{attachment.fileName}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {attachment.attachmentType.replace(/_/g, ' ')} • {(attachment.fileSize / 1024).toFixed(1)} KB
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-1 font-mono">{attachment.filePath}</p>
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
              {(request.currentStepApproverIds.length > 0 ? request.currentStepApproverIds : request.workflowUserIds).map((actorId, index) => (
                <div
                  key={actorId}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-xl border',
                    index === 0 ? 'bg-amber-50 border-amber-100' : 'bg-surface-container-low border-surface-container-high'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    index === 0 ? 'bg-amber-600 text-white' : 'bg-surface-container-high text-on-surface-variant'
                  )}>
                    {actorId.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold">{actorId}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {index === 0 ? 'Current approver in backend fixture' : 'Workflow related user'}
                    </p>
                  </div>
                  {index === 0 ? <Clock size={16} className="text-amber-600" /> : <CheckCircle2 size={16} className="text-green-600" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
