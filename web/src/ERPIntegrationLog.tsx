import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Database,
  Activity,
  ChevronRight,
  PauseCircle,
  Send,
  Eye,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from './lib/utils';
import { useAuth } from './AuthProvider';
import {
  createActorContext,
  financeApprovePaymentRequest,
  financeRejectPaymentRequest,
  holdPaymentRequestSync,
  listErpJobs,
  listFinanceReleaseQueue,
  releasePaymentRequestToErp,
  retryErpJob,
} from './api/paymentRequests';
import type { PaymentRequestSummary } from './types/paymentRequest';
import type { ErpIntegrationJob } from './types/erpJob';

function getJobStatusColor(status: string) {
  switch (status) {
    case 'success':
      return 'text-green-700';
    case 'failed':
    case 'manual_review_required':
      return 'text-red-700';
    case 'pending':
    case 'processing':
      return 'text-amber-700';
    default:
      return 'text-on-surface-variant';
  }
}

function getCategoryBadgeStyles(errorCategory: string | null | undefined) {
  switch (errorCategory) {
    case 'business':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'transient':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-surface-container-low text-on-surface-variant border-surface-container-high';
  }
}

function getJobIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle2 size={16} className="text-green-600" />;
    case 'failed':
    case 'manual_review_required':
      return <AlertCircle size={16} className="text-red-600" />;
    default:
      return <Clock size={16} className="text-amber-600" />;
  }
}

export default function ERPIntegrationLog() {
  const navigate = useNavigate();
  const { actor: authActor } = useAuth();
  const [financeQueue, setFinanceQueue] = useState<PaymentRequestSummary[]>([]);
  const [jobs, setJobs] = useState<ErpIntegrationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'not_ready'>('all');
  const [jobErrorFilter, setJobErrorFilter] = useState<'all' | 'transient' | 'business' | 'none'>('all');

  const actor = useMemo(() => {
    if (!authActor) {
      return null;
    }

    return createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });
  }, [authActor]);

  const loadData = async () => {
    if (!actor) {
      setFinanceQueue([]);
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [queueResult, jobsResult] = await Promise.all([
        listFinanceReleaseQueue(actor),
        listErpJobs(actor),
      ]);
      setFinanceQueue(queueResult.data);
      setJobs(jobsResult.data);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load finance and ERP data', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [actor]);

  const handleRelease = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingId(requestId);
    try {
      const result = await releasePaymentRequestToErp(requestId, actor);
      setFinanceQueue((current) => current.filter((entry) => entry.id !== requestId));
      toast.success('Released to ERP queue', {
        description: `${result.data.requestNo} is now pending integration.`,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Unable to release request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleFinanceApprove = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingId(requestId);
    try {
      const result = await financeApprovePaymentRequest(requestId, actor);
      setFinanceQueue((current) =>
        current.map((entry) => (entry.id === requestId ? result.data : entry))
      );
      toast.success('Finance approved request', {
        description: `${result.data.requestNo} is approved by finance and kept for later ERP release.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-approve request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleHold = async (requestId: string) => {
    if (!actor) {
      return;
    }

    setActingId(requestId);
    try {
      const result = await holdPaymentRequestSync(requestId, actor);
      setFinanceQueue((current) =>
        current.map((entry) => (entry.id === requestId ? result.data : entry))
      );
      toast.success('ERP sync placed on hold', {
        description: `${result.data.requestNo} is now held by finance.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to hold ERP sync', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingId(null);
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

    setActingId(requestId);
    try {
      const result = await financeRejectPaymentRequest(requestId, actor, note);
      setFinanceQueue((current) => current.filter((entry) => entry.id !== requestId));
      toast.success('Finance rejected request', {
        description: `${result.data.requestNo} has been rejected by finance.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to finance-reject request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    if (!actor) {
      return;
    }

    setActingId(jobId);
    try {
      const result = await retryErpJob(jobId, actor);
      setJobs((current) => current.map((entry) => (entry.id === jobId ? result.data : entry)));
      toast.success('ERP job retried', {
        description: `${result.data.id} is back in pending state.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to retry ERP job', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActingId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [job.id, job.requestNo, job.status, job.lastError, job.errorCategory, job.idempotencyKey]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
    const matchesErrorFilter =
      jobErrorFilter === 'all' ||
      (jobErrorFilter === 'none' ? !job.errorCategory : job.errorCategory === jobErrorFilter);

    return matchesSearch && matchesErrorFilter;
  });

  const filteredFinanceQueue = financeQueue.filter((entry) => {
    if (readinessFilter === 'ready') {
      return entry.erpReadinessSummary?.isReady === true;
    }

    if (readinessFilter === 'not_ready') {
      return entry.erpReadinessSummary?.isReady === false;
    }

    return true;
  });

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">ERP Release & Integration</h1>
          <p className="text-on-surface-variant font-medium">Finance release queue, sync states, and retry controls.</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors"
        >
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Waiting Finance Release', value: financeQueue.filter((entry) => entry.erpSyncStatus === 'waiting_finance_release').length, icon: Send, color: 'text-amber-600' },
          { label: 'Held By Finance', value: financeQueue.filter((entry) => entry.erpSyncStatus === 'hold_by_finance').length, icon: PauseCircle, color: 'text-red-600' },
          { label: 'ERP Jobs Visible', value: jobs.length, icon: Activity, color: 'text-blue-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm flex items-center gap-4">
            <div className={cn('p-3 rounded-xl bg-surface-container-low', item.color)}>
              <item.icon size={22} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">{item.label}</p>
              <h3 className="text-2xl font-bold">{item.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Finance Release Queue</h2>
            <p className="text-sm text-on-surface-variant">Open the full request detail for document review, then approve only or approve and release to ERP.</p>
          </div>
          <select
            value={readinessFilter}
            onChange={(event) => setReadinessFilter(event.target.value as 'all' | 'ready' | 'not_ready')}
            className="rounded-xl border border-surface-container-high bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none"
          >
            <option value="all">All readiness</option>
            <option value="ready">Ready only</option>
            <option value="not_ready">Need fixes</option>
          </select>
        </div>

        {loading ? (
          <div className="text-sm text-on-surface-variant">Loading finance queue...</div>
        ) : filteredFinanceQueue.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">No requests currently waiting for finance action.</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredFinanceQueue.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="rounded-2xl border border-surface-container-high bg-white p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-secondary">{entry.requestNo}</p>
                    <h3 className="text-lg font-bold">{entry.payeeName}</h3>
                    <p className="text-xs text-on-surface-variant">{entry.departmentId} • {entry.requesterName}</p>
                  </div>
                  <span className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest',
                    entry.erpSyncStatus === 'hold_by_finance'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  )}>
                    {entry.erpSyncStatus === 'waiting_finance_release'
                      ? 'waiting finance review'
                      : entry.erpSyncStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Amount</p>
                      <p className="font-bold">
                        {entry.totalAmount.toLocaleString('en-US', { style: 'currency', currency: entry.currency })}
                      </p>
                    </div>
                    <div className="min-w-[240px] rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        ERP Readiness
                      </p>
                      <p
                        className={cn(
                          'text-sm font-bold',
                          entry.erpReadinessSummary?.isReady ? 'text-green-700' : 'text-red-700'
                        )}
                      >
                        {entry.erpReadinessSummary?.isReady
                          ? 'Ready for release'
                          : `${entry.erpReadinessSummary?.errorCount ?? 0} issue(s)`}
                      </p>
                      {!entry.erpReadinessSummary?.isReady && entry.erpReadinessSummary?.firstErrorMessage ? (
                        <p className="mt-1 text-[11px] text-red-700">
                          {entry.erpReadinessSummary.firstErrorMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => navigate(`/requests/${entry.id}`)}
                        className="px-4 py-2 rounded-xl bg-white border border-surface-container-high text-xs font-bold hover:bg-surface-container-low"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Eye size={14} />
                          Open Detail
                        </span>
                      </button>
                      <button
                        onClick={() => void handleFinanceApprove(entry.id)}
                        disabled={actingId === entry.id || !entry.allowedActions?.financeApprove}
                        className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
                      >
                        Approve Only
                      </button>
                      <button
                        onClick={() => void handleFinanceReject(entry.id)}
                        disabled={actingId === entry.id || !entry.allowedActions?.financeReject}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => void handleHold(entry.id)}
                        disabled={actingId === entry.id || !entry.allowedActions?.holdSync}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                      Hold Sync
                    </button>
                    <button
                        onClick={() => void handleRelease(entry.id)}
                        disabled={actingId === entry.id || !entry.allowedActions?.releaseToErp}
                        className="px-4 py-2 rounded-xl bg-secondary text-white text-xs font-bold hover:bg-secondary-container disabled:opacity-50"
                      >
                        Approve & Release ERP
                      </button>
                    </div>
                  </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight">ERP Jobs</h2>
            <p className="text-sm text-on-surface-variant">Integration jobs created by finance release and retry actions.</p>
          </div>
          <div className="flex w-full max-w-3xl items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by job id, request no, or status..."
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
              />
            </div>
            <select
              value={jobErrorFilter}
              onChange={(event) => setJobErrorFilter(event.target.value as 'all' | 'transient' | 'business' | 'none')}
              className="rounded-xl border border-surface-container-high bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none"
            >
              <option value="all">All error types</option>
              <option value="transient">Transient only</option>
              <option value="business">Business only</option>
              <option value="none">No error type</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Job</th>
                <th className="px-6 py-4">Request</th>
                <th className="px-6 py-4">Target</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Error Type</th>
                <th className="px-6 py-4">Retries</th>
                <th className="px-6 py-4">Last Error</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-on-surface-variant">Loading ERP jobs...</td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-on-surface-variant">No ERP jobs visible for current actor.</td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-bold text-secondary">{job.id}</div>
                      <div className="mt-1 text-[10px] text-on-surface-variant break-all">
                        {job.idempotencyKey ?? 'No idempotency key'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm">{job.requestNo ?? 'Detached Job'}</div>
                      <div className="text-[10px] text-on-surface-variant">{job.requestId ?? 'No request reference'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-secondary" />
                        <span className="text-sm font-medium uppercase">{job.targetSystem}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getJobIcon(job.status)}
                        <span className={cn('text-xs font-bold uppercase', getJobStatusColor(job.status))}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
                          getCategoryBadgeStyles(job.errorCategory)
                        )}
                      >
                        {job.errorCategory ?? 'none'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">{job.retryCount}</td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant max-w-xs">
                      {job.lastError ?? 'No error recorded'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => void handleRetry(job.id)}
                        disabled={actingId === job.id || !job.allowedActions?.retry}
                        className="px-3 py-1.5 bg-white border border-surface-container-high rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-surface-container-low transition-colors disabled:opacity-50"
                        title={
                          job.errorCategory === 'business'
                            ? 'Business/master-data errors must be fixed before retry.'
                            : undefined
                        }
                      >
                        Retry
                      </button>
                      {job.errorCategory === 'business' ? (
                        <p className="mt-2 max-w-[180px] text-[10px] font-medium text-red-700">
                          Fix ERP reference data first. Auto/manual retry is blocked for business errors.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="text-secondary" size={24} />
            <h3 className="font-bold text-lg tracking-tight">Queue Health</h3>
          </div>
          <div className="space-y-6">
            {[
              { label: 'Pending ERP Jobs', rate: jobs.filter((job) => job.status === 'pending').length, total: jobs.length || 1 },
              { label: 'Failed ERP Jobs', rate: jobs.filter((job) => ['failed', 'manual_review_required'].includes(job.status)).length, total: jobs.length || 1 },
              { label: 'Finance Held Requests', rate: financeQueue.filter((entry) => entry.erpSyncStatus === 'hold_by_finance').length, total: financeQueue.length || 1 },
            ].map((item) => {
              const percent = Math.min(100, Math.round((item.rate / item.total) * 100));
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-on-surface-variant">{item.label}</span>
                    <span className="text-on-surface">{item.rate}</span>
                  </div>
                  <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-secondary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-primary text-white p-8 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-lg tracking-tight mb-6">Finance Controls</h3>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">
              Finance can release approved requests into the ERP queue, place risky records on hold, and retry failed jobs after validation issues are resolved.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => void loadData()}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-between px-6"
              >
                Refresh Queue Snapshot
                <ChevronRight size={16} />
              </button>
              <div className="w-full py-3 bg-white/10 rounded-xl text-xs font-bold px-6 flex items-center justify-between">
                Queue Ready For Review
                <span>{financeQueue.length}</span>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}

