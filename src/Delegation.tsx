import React from 'react';
import { 
  Users, 
  Plus, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const delegations = [
  { id: 'DEL-001', from: 'John Doe', to: 'Sarah Jenkins', start: 'Mar 25, 2024', end: 'Apr 02, 2024', status: 'Active', scope: 'All Requests' },
  { id: 'DEL-002', from: 'Michael Chen', to: 'David Miller', start: 'Apr 10, 2024', end: 'Apr 15, 2024', status: 'Scheduled', scope: 'IT Dept Only' },
];

export default function Delegation() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Delegation Setup</h1>
          <p className="text-on-surface-variant font-medium">Configure temporary approval authorities for planned absences.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10">
            <Plus size={18} />
            New Delegation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container-high">
              <h3 className="font-bold text-lg tracking-tight">Active & Scheduled Delegations</h3>
            </div>
            <div className="divide-y divide-surface-container-high">
              {delegations.map((del) => (
                <div key={del.id} className="p-6 flex items-center justify-between group">
                  <div className="flex items-center gap-8 flex-1">
                    <div className="w-40">
                      <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">From</div>
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[10px]">JD</div>
                        {del.from}
                      </div>
                    </div>
                    
                    <ArrowRight className="text-on-surface-variant" size={16} />

                    <div className="w-40">
                      <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">To</div>
                      <div className="flex items-center gap-2 font-bold text-sm text-secondary">
                        <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-[10px]">SJ</div>
                        {del.to}
                      </div>
                    </div>

                    <div className="w-48">
                      <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Period</div>
                      <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                        <Calendar size={14} />
                        {del.start} - {del.end}
                      </div>
                    </div>

                    <div className="w-32">
                      <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Status</div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        del.status === 'Active' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {del.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-surface-container-low rounded-xl text-on-surface-variant"><Clock size={18} /></button>
                    <button className="p-2 hover:bg-red-50 rounded-xl text-red-600"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-primary text-white p-8 rounded-2xl shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 mb-6">
              <UserCheck className="text-secondary" size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Delegation Policy</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed mb-6">
              Delegated authority is strictly time-bound and audit-logged. The delegate inherits the original approver's thresholds and scope for the specified period.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-green-400 shrink-0" size={16} />
                <p className="text-[11px] text-white/80">Full audit trail of all delegated actions.</p>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="text-amber-400 shrink-0" size={16} />
                <p className="text-[11px] text-white/80">Critical payments {'>'} $1M cannot be delegated.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
