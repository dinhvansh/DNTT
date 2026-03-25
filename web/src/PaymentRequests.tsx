import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Download,
  Building2,
  CreditCard,
  ArrowUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from './lib/utils';
import { useAuth } from './AuthProvider';
import { createActorContext, listPaymentRequests } from './api/paymentRequests';
import type { PaymentRequestSummary } from './types/paymentRequest';

const FilterButton = ({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
      active ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-white border border-surface-container-high text-on-surface-variant hover:bg-surface-container-low'
    )}
  >
    {label}
  </button>
);

function normalizeBusinessStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'approved':
      return 'Approved';
    case 'rejected':
    case 'cancelled':
      return 'Rejected';
    case 'submitted':
    case 'pending_approval':
      return 'Pending';
    default:
      return 'Pending';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-700';
    case 'Rejected':
      return 'bg-red-100 text-red-700';
    case 'Pending':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-blue-500';
    default:
      return 'bg-gray-400';
  }
}

export default function PaymentRequests() {
  const navigate = useNavigate();
  const { user, actor } = useAuth();
  const [requests, setRequests] = useState<PaymentRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!user || !actor) {
      setRequests([]);
      setLoading(false);
      return;
    }

    listPaymentRequests(createActorContext({
      userId: actor.userId,
      departmentId: actor.departmentId,
      permissions: actor.permissions,
    }))
      .then((result) => {
        setRequests(result.data);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Unable to load payment requests', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [actor]);

  const filteredRequests = filter === 'All'
    ? requests
    : requests.filter((request) => normalizeBusinessStatusLabel(request.businessStatus) === filter);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Payment Ledger</h1>
          <p className="text-on-surface-variant font-medium">Manage and track all outbound payment lifecycle events.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
            <Download size={18} />
            Export
          </button>
          <button
            onClick={() => navigate('/requests/new')}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10"
          >
            <Plus size={18} />
            New Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Volume', value: `$${requests.reduce((acc, item) => acc + item.totalAmount, 0).toLocaleString()}`, icon: CreditCard, color: 'text-blue-600' },
          { label: 'Pending Review', value: requests.filter((item) => normalizeBusinessStatusLabel(item.businessStatus) === 'Pending').length, icon: Clock, color: 'text-amber-600' },
          { label: 'Approved', value: requests.filter((item) => normalizeBusinessStatusLabel(item.businessStatus) === 'Approved').length, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Rejected', value: requests.filter((item) => normalizeBusinessStatusLabel(item.businessStatus) === 'Rejected').length, icon: XCircle, color: 'text-red-600' },
        ].map((stat, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl border border-surface-container-high flex items-center gap-4 shadow-sm">
            <div className={cn('p-2 rounded-lg bg-surface-container-low', stat.color)}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
              <p className="text-xl font-bold text-on-surface">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              type="text"
              placeholder="Search by payee, request ID, or department..."
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
            />
          </div>
          <FilterButton label="All Requests" active={filter === 'All'} onClick={() => setFilter('All')} />
          <FilterButton label="Pending" active={filter === 'Pending'} onClick={() => setFilter('Pending')} />
          <FilterButton label="Draft" active={filter === 'Draft'} onClick={() => setFilter('Draft')} />
          <FilterButton label="Approved" active={filter === 'Approved'} onClick={() => setFilter('Approved')} />
          <FilterButton label="Rejected" active={filter === 'Rejected'} onClick={() => setFilter('Rejected')} />
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-on-surface">
                    Request ID <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="px-6 py-4">Vendor / Payee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Syncing Ledger...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-sm font-medium text-on-surface-variant">No payment requests found.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/requests/${item.id}`)}
                    className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-bold text-secondary">
                      {item.requestNo}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface">{item.payeeName}</div>
                          <div className="text-[10px] text-on-surface-variant font-medium">{item.paymentType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-surface-container-high rounded text-[10px] font-bold text-on-surface-variant">
                        {item.departmentId}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-sm">
                      {item.totalAmount.toLocaleString('en-US', { style: 'currency', currency: item.currency })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter', getStatusColor(normalizeBusinessStatusLabel(item.businessStatus)))}>
                        {normalizeBusinessStatusLabel(item.businessStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-1.5 h-1.5 rounded-full', getPriorityColor(item.priority))} />
                        <span className="text-xs font-semibold text-on-surface-variant capitalize">{item.priority}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal size={16} className="text-on-surface-variant" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-surface-container-high flex items-center justify-between bg-surface-container-low/30">
          <p className="text-xs text-on-surface-variant font-medium">
            Showing {filteredRequests.length} of {requests.length} requests
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-surface-container-high rounded-lg text-xs font-bold hover:bg-white disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1.5 border border-surface-container-high rounded-lg text-xs font-bold hover:bg-white disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
