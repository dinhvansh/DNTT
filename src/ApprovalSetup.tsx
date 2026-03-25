import React from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Settings, 
  Users, 
  Building2, 
  AlertCircle,
  Save,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const workflows = [
  { id: 'WF-001', name: 'Standard Vendor Payment', entity: 'Global', levels: 2, status: 'Active' },
  { id: 'WF-002', name: 'High Value Capital Expenditure', entity: 'US-WEST-01', levels: 4, status: 'Active' },
  { id: 'WF-003', name: 'Payroll Settlement', entity: 'EU-CENTRAL-01', levels: 3, status: 'Draft' },
];

export default function ApprovalSetup() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Approval Setup</h1>
          <p className="text-on-surface-variant font-medium">Configure hierarchical workflows and escalation thresholds.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10">
            <Plus size={18} />
            Create Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflow List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-4 px-2">Active Workflows</h3>
            <div className="space-y-2">
              {workflows.map((wf) => (
                <div key={wf.id} className="p-4 rounded-xl border border-surface-container-high hover:border-secondary/40 hover:bg-surface-container-low transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono font-bold text-secondary">{wf.id}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                      wf.status === 'Active' ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"
                    )}>
                      {wf.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-on-surface mb-1">{wf.name}</h4>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-on-surface-variant">
                    <span className="flex items-center gap-1"><Building2 size={10} /> {wf.entity}</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {wf.levels} Levels</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workflow Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">Standard Vendor Payment</h3>
                  <p className="text-xs text-on-surface-variant">Global policy for all standard outbound payments.</p>
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-container transition-colors">
                <Save size={16} />
                Save Changes
              </button>
            </div>

            <div className="space-y-8">
              {/* Level 1 */}
              <div className="relative pl-12 before:absolute before:left-[19px] before:top-10 before:bottom-[-40px] before:w-px before:bg-surface-container-high">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-black text-sm shadow-lg shadow-secondary/20">
                  1
                </div>
                <div className="p-6 bg-surface-container-low rounded-2xl border border-surface-container-high space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm">Technical / Department Review</h4>
                    <button className="text-on-surface-variant hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Approver Role</label>
                      <select className="w-full bg-white border-none rounded-lg text-xs font-bold px-3 py-2 outline-none">
                        <option>Department Head</option>
                        <option>Technical Lead</option>
                        <option>Project Manager</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">SLA Threshold</label>
                      <select className="w-full bg-white border-none rounded-lg text-xs font-bold px-3 py-2 outline-none">
                        <option>24 Hours</option>
                        <option>48 Hours</option>
                        <option>72 Hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Level 2 */}
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-black text-sm shadow-lg shadow-secondary/20">
                  2
                </div>
                <div className="p-6 bg-surface-container-low rounded-2xl border border-surface-container-high space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm">Finance Authorization</h4>
                    <button className="text-on-surface-variant hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Approver Role</label>
                      <select className="w-full bg-white border-none rounded-lg text-xs font-bold px-3 py-2 outline-none">
                        <option>Finance Director</option>
                        <option>Treasury Manager</option>
                        <option>Controller</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Condition</label>
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-xs font-bold">
                        Amount {'>'} $10,000
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button className="ml-12 w-[calc(100%-3rem)] py-4 border-2 border-dashed border-surface-container-high rounded-2xl text-xs font-bold text-on-surface-variant hover:border-secondary/40 hover:text-secondary transition-all flex items-center justify-center gap-2">
                <Plus size={16} /> Add Approval Level
              </button>
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4">
            <AlertCircle className="text-amber-600 shrink-0" size={24} />
            <div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">Escalation Policy</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                If a request remains unacted upon past the SLA threshold, it will automatically escalate to the next level in the hierarchy. Global Finance Director is the final escalation point for all workflows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
