import React from 'react';
import { 
  FileStack, 
  Plus, 
  Search, 
  Filter, 
  Copy, 
  Trash2, 
  Settings, 
  Eye,
  CheckCircle2,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const templates = [
  { id: 'TPL-001', name: 'Standard Vendor Invoice', category: 'Accounts Payable', usage: 1240, status: 'Published' },
  { id: 'TPL-002', name: 'Urgent Treasury Transfer', category: 'Treasury', usage: 88, status: 'Published' },
  { id: 'TPL-003', name: 'Intercompany Settlement', category: 'Internal', usage: 420, status: 'Draft' },
];

export default function Templates() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Request Templates</h1>
          <p className="text-on-surface-variant font-medium">Configure dynamic governance rules and field visibility for request types.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10">
            <Plus size={18} />
            Create Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input 
                type="text" 
                placeholder="Search templates..." 
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
              />
            </div>
            <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
              <Filter size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((tpl) => (
              <motion.div 
                key={tpl.id}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-surface-container-low text-secondary rounded-xl group-hover:bg-secondary group-hover:text-white transition-all">
                    <FileText size={24} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant"><Copy size={16} /></button>
                    <button className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant"><Settings size={16} /></button>
                  </div>
                </div>
                
                <h4 className="font-bold text-lg text-on-surface mb-1">{tpl.name}</h4>
                <p className="text-xs text-on-surface-variant font-medium mb-6">{tpl.category}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      Usage: <span className="text-on-surface">{tpl.usage}</span>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                      tpl.status === 'Published' ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"
                    )}>
                      {tpl.status}
                    </span>
                  </div>
                  <button className="p-2 hover:bg-surface-container-low rounded-lg text-secondary">
                    <Eye size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm">
            <h3 className="font-bold text-lg tracking-tight mb-6">Template Governance</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <CheckCircle2 className="text-green-600 shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold">Dynamic Fields</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Templates automatically show/hide fields based on entity and amount.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <ShieldCheck className="text-secondary shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold">Policy Enforcement</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Required documentation is enforced at the template level.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
