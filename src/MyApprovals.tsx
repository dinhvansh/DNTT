import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  FileText, 
  User, 
  Calendar,
  Building2,
  ExternalLink,
  History,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { useNavigate } from 'react-router-dom';

const pendingApprovals = [
  { id: 'REQ-2024-088', vendor: 'Apex Global Systems', amount: '$124,500.00', entity: 'US-WEST-01', date: '2h ago', priority: 'Critical', requester: 'Sarah Jenkins' },
  { id: 'REQ-2024-092', vendor: 'Cloudflare Inc.', amount: '$8,200.00', entity: 'EU-CENTRAL-01', date: '5h ago', priority: 'High', requester: 'Michael Chen' },
  { id: 'REQ-2024-095', vendor: 'Stripe Payments', amount: '$450,000.00', entity: 'GLOBAL-HQ', date: '1d ago', priority: 'Critical', requester: 'Finance Bot' },
  { id: 'REQ-2024-101', vendor: 'Office Depot', amount: '$1,240.00', entity: 'US-EAST-02', date: '1d ago', priority: 'Low', requester: 'David Miller' },
];

export default function MyApprovals() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Pending Action</p>
              <h3 className="text-2xl font-bold">12 Requests</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
            <AlertCircle size={14} />
            3 requests are past SLA threshold
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-primary text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Total Value</p>
              <h3 className="text-2xl font-bold">$1.28M</h3>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">Across 4 global entities</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium">Approved (MTD)</p>
              <h3 className="text-2xl font-bold">84 Requests</h3>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">Average turnaround: 4.2 hours</p>
        </div>
      </div>

      {/* Inbox */}
      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div className="flex gap-6">
            <button className="text-sm font-bold text-secondary border-b-2 border-secondary pb-6 -mb-6">Pending (12)</button>
            <button className="text-sm font-bold text-on-surface-variant hover:text-on-surface pb-6 -mb-6">Escalated (3)</button>
            <button className="text-sm font-bold text-on-surface-variant hover:text-on-surface pb-6 -mb-6">Delegated (0)</button>
          </div>
        </div>
        
        <div className="divide-y divide-surface-container-high">
          {pendingApprovals.map((item) => (
            <motion.div 
              key={item.id}
              whileHover={{ backgroundColor: '#f3f4f6' }}
              className="p-6 flex items-center justify-between group cursor-pointer"
              onClick={() => navigate(`/requests/${item.id}`)}
            >
              <div className="flex items-center gap-6 flex-1">
                <div className={cn("w-1 h-12 rounded-full", 
                  item.priority === 'Critical' ? "bg-red-600" : "bg-amber-500"
                )} />
                
                <div className="w-48">
                  <div className="font-mono text-xs font-bold text-secondary mb-1">{item.id}</div>
                  <div className="font-bold text-on-surface">{item.vendor}</div>
                </div>

                <div className="w-32">
                  <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Amount</div>
                  <div className="font-mono font-bold text-sm">{item.amount}</div>
                </div>

                <div className="w-32">
                  <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Requester</div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[10px]">
                      {item.requester.split(' ').map(n => n[0]).join('')}
                    </div>
                    {item.requester}
                  </div>
                </div>

                <div className="w-32">
                  <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Received</div>
                  <div className="text-sm font-medium text-on-surface-variant">{item.date}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/requests/${item.id}`);
                  }}
                  className="px-4 py-2 bg-white border border-surface-container-high rounded-xl text-xs font-bold hover:bg-surface-container-low transition-all"
                >
                  View Details
                </button>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                >
                  <XCircle size={20} />
                </button>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all"
                >
                  <CheckCircle2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="p-6 bg-surface-container-low/30 border-t border-surface-container-high text-center">
          <button className="text-secondary text-sm font-bold hover:underline">Load More Requests</button>
        </div>
      </div>
    </div>
  );
}
