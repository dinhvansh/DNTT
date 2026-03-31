import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  History,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from './lib/utils';
import { useAuth } from './AuthProvider';
import {
  approvePaymentRequest,
  createActorContext,
  financeApprovePaymentRequest,
  financeRejectPaymentRequest,
  holdPaymentRequestSync,
  listMyApprovals,
  rejectPaymentRequest,
  releasePaymentRequestToErp,
} from './api/paymentRequests';
import type { PaymentRequestSummary } from './types/paymentRequest';

function getPriorityAccent(priority: string) {
  return priority === 'critical' ? 'bg-red-600' : priority === 'high' ? 'bg-orange-500' : 'bg-amber-500';
}

export default function MyApprovals() {
  const navigate = useNavigate();
  const { user, actor: authActor } = useAuth();
  const [approvals, setApprovals] = useState<PaymentRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const actor = useMemo(() => {
    if (!authActor) return null;
    return createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });
  }, [authActor]);

  useEffect(() => {
    if (!actor) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    listMyApprovals(actor)
      .then((result) => {
        setApprovals(result.data);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Unable to load approval inbox', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [actor]);

  const handleApprove = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await approvePaymentRequest(requestId, actor);
      setApprovals((current) => current.filter((item) => item.id !== requestId));
      toast.success('Approval completed', {
        description: `${result.data.requestNo} moved out of your inbox.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to approve request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!actor) {
      return;
    }

    const note = window.prompt('Reject reason is required. Enter the reason for rejection:')?.trim() ?? '';
    if (!note) {
      toast.error('Reject reason is required.');
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await rejectPaymentRequest(requestId, actor, note);
      setApprovals((current) => current.filter((item) => item.id !== requestId));
      toast.success('Request rejected', {
        description: `${result.data.requestNo} was removed from your inbox.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to reject request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const handleFinanceApprove = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await financeApprovePaymentRequest(requestId, actor);
      setApprovals((current) => current.map((item) => (item.id === requestId ? result.data : item)));
      toast.success('Finance approved request', {
        description: `${result.data.requestNo} remains in finance worklist for ERP follow-up.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-approve request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const handleFinanceReject = async (requestId: string) => {
    if (!actor) {
      return;
    }

    const note = window.prompt('Finance reject reason is required. Enter the reason for rejection:')?.trim() ?? '';
    if (!note) {
      toast.error('Finance reject reason is required.');
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await financeRejectPaymentRequest(requestId, actor, note);
      setApprovals((current) => current.map((item) => (item.id === requestId ? result.data : item)));
      toast.success('Finance rejected request', {
        description: `${result.data.requestNo} remains visible for finance follow-up and audit trace.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-reject request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const handleHold = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await holdPaymentRequestSync(requestId, actor);
      setApprovals((current) => current.map((item) => (item.id === requestId ? result.data : item)));
      toast.success('ERP sync placed on hold', {
        description: `${result.data.requestNo} stays in finance worklist.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to hold ERP sync', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const handleRelease = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingRequestId(requestId);
    try {
      const result = await releasePaymentRequestToErp(requestId, actor);
      setApprovals((current) => current.map((item) => (item.id === requestId ? result.data : item)));
      toast.success('Released to ERP queue', {
        description: `${result.data.requestNo} remains visible while ERP processing continues.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to release request to ERP', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingRequestId(null);
    }
  };

  const totalValue = approvals.reduce((sum, item) => sum + item.totalAmount, 0);
  const criticalCount = approvals.filter((item) => item.priority === 'critical').length;
  const pendingCount = approvals.filter(
    (item) =>
      item.allowedActions?.approve ||
      item.allowedActions?.reject ||
      item.allowedActions?.financeApprove ||
      item.allowedActions?.financeReject ||
      item.allowedActions?.releaseToErp ||
      item.allowedActions?.holdSync
  ).length;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">My Approvals</h1>
          <p className="text-on-surface-variant font-medium">Review business approvals and finance actions assigned to your current role.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
            <History size={18} />
            Approval History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Pending Action</p>
              <h3 className="text-2xl font-bold">{pendingCount} Requests</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
            <AlertCircle size={14} />
            {criticalCount} critical requests in current inbox
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-primary text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Total Value</p>
              <h3 className="text-2xl font-bold">
                {totalValue.toLocaleString('en-US', { style: 'currency', currency: 'VND' })}
              </h3>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">Pending approval amount assigned to current actor.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Delegation Coverage</p>
              <h3 className="text-2xl font-bold">
                {approvals.filter((item) => item.currentStepApproverIds.includes(authActor?.userId || '')).length}
              </h3>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">Requests currently matched directly to your actor id.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div className="flex gap-6">
              <button className="text-sm font-bold text-secondary border-b-2 border-secondary pb-6 -mb-6">
              Worklist ({approvals.length})
              </button>
          </div>
        </div>

        <div className="divide-y divide-surface-container-high">
          {loading ? (
            <div className="p-10 text-center text-sm text-on-surface-variant">Loading approval inbox...</div>
          ) : approvals.length === 0 ? (
            <div className="p-10 text-center text-sm text-on-surface-variant">No approvals assigned to you.</div>
          ) : (
            approvals.map((item) => (
              (() => {
                const hasPendingActions = Boolean(
                  item.allowedActions?.approve ||
                    item.allowedActions?.reject ||
                    item.allowedActions?.financeApprove ||
                    item.allowedActions?.financeReject ||
                    item.allowedActions?.releaseToErp ||
                    item.allowedActions?.holdSync
                );
                const outcomeLabel =
                  item.businessStatus === 'rejected'
                    ? 'Rejected'
                    : item.erpSyncStatus === 'success'
                      ? 'ERP Synced'
                      : item.erpSyncStatus === 'processing'
                        ? 'ERP Processing'
                        : item.erpSyncStatus === 'pending'
                          ? 'ERP Pending'
                          : item.erpSyncStatus === 'hold_by_finance'
                            ? 'On Hold'
                            : item.businessStatus === 'approved'
                              ? 'Approved'
                              : 'Pending';

                return (
              <div
                key={item.id}
                className="p-6 flex items-center justify-between group cursor-pointer hover:bg-surface-container-low"
                onClick={() => navigate(`/requests/${item.id}`)}
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className={cn('w-1 h-12 rounded-full', getPriorityAccent(item.priority))} />

                  <div className="w-48">
                    <div className="font-mono text-xs font-bold text-secondary mb-1">{item.requestNo}</div>
                    <div className="font-bold text-on-surface">{item.payeeName}</div>
                  </div>

                  <div className="w-40">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Amount</div>
                    <div className="font-mono font-bold text-sm">
                      {item.totalAmount.toLocaleString('en-US', { style: 'currency', currency: item.currency })}
                    </div>
                  </div>

                  <div className="w-36">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Requester</div>
                    <div className="text-sm font-medium">{item.requesterName}</div>
                  </div>

                  <div className="w-32">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Received</div>
                    <div className="text-sm font-medium text-on-surface-variant">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="w-32">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">State</div>
                    <div
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide',
                        hasPendingActions
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-surface-container-low text-on-surface-variant'
                      )}
                    >
                      {hasPendingActions ? 'Action Required' : outcomeLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/requests/${item.id}`);
                    }}
                    className="px-4 py-2 bg-white border border-surface-container-high rounded-xl text-xs font-bold hover:bg-surface-container-low transition-all"
                  >
                    View Details
                  </button>
                  {hasPendingActions && item.allowedActions?.financeReject ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleFinanceReject(item.id);
                      }}
                      disabled={actingRequestId === item.id}
                      className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                    >
                      Finance Reject
                    </button>
                  ) : hasPendingActions ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleReject(item.id);
                      }}
                      disabled={actingRequestId === item.id || !item.allowedActions?.reject}
                      className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                    >
                      <XCircle size={20} />
                    </button>
                  ) : null}
                  {hasPendingActions && item.allowedActions?.holdSync && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleHold(item.id);
                      }}
                      disabled={actingRequestId === item.id}
                      className="px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                    >
                      Hold
                    </button>
                  )}
                  {hasPendingActions && item.allowedActions?.releaseToErp ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRelease(item.id);
                      }}
                      disabled={actingRequestId === item.id}
                      className="px-3 py-2 bg-secondary text-white hover:bg-secondary-container rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                    >
                      Release ERP
                    </button>
                  ) : hasPendingActions && item.allowedActions?.financeApprove ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleFinanceApprove(item.id);
                      }}
                      disabled={actingRequestId === item.id}
                      className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                    >
                      Finance Approve
                    </button>
                  ) : hasPendingActions ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleApprove(item.id);
                      }}
                      disabled={actingRequestId === item.id || !item.allowedActions?.approve}
                      className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all"
                    >
                      <CheckCircle2 size={20} />
                    </button>
                  ) : null}
                </div>
              </div>
                );
              })()
            ))
          )}
        </div>

        <div className="p-6 bg-surface-container-low/30 border-t border-surface-container-high text-center">
          <button className="text-secondary text-sm font-bold hover:underline">Inbox is filtered by current actor permissions</button>
        </div>
      </div>
    </div>
  );
}
