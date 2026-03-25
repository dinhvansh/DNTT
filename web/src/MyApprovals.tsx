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
  listMyApprovals,
  rejectPaymentRequest,
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

    setActingRequestId(requestId);
    try {
      const result = await rejectPaymentRequest(requestId, actor);
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

  const totalValue = approvals.reduce((sum, item) => sum + item.totalAmount, 0);
  const criticalCount = approvals.filter((item) => item.priority === 'critical').length;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">My Approvals</h1>
          <p className="text-on-surface-variant font-medium">Review and authorize pending payment requests assigned to you.</p>
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
              <h3 className="text-2xl font-bold">{approvals.length} Requests</h3>
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
              Pending ({approvals.length})
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
                </div>
              </div>
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
