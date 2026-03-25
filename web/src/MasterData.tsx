import React from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Building2, 
  Globe, 
  ShieldCheck, 
  ExternalLink,
  MoreVertical,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const entities = [
  { id: 'ENT-001', name: 'Sovereign Corp US', type: 'Legal Entity', region: 'North America', status: 'Active' },
  { id: 'ENT-002', name: 'Sovereign EU Gmbh', type: 'Legal Entity', region: 'Europe', status: 'Active' },
  { id: 'ENT-003', name: 'Sovereign APAC Pte Ltd', type: 'Legal Entity', region: 'Asia Pacific', status: 'Active' },
];

const vendors = [
  { id: 'VEN-4421', name: 'Apex Global Systems', category: 'IT Services', risk: 'Low', status: 'Verified' },
  { id: 'VEN-4422', name: 'Stellar Logistics', category: 'Operations', risk: 'Medium', status: 'Verified' },
  { id: 'VEN-4423', name: 'Vertex Tax Solutions', category: 'Professional Services', risk: 'Low', status: 'Pending' },
];

export default function MasterData() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Master Data Management</h1>
          <p className="text-on-surface-variant font-medium">Centralized repository for system-wide entity and vendor definitions.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
            <Download size={18} />
            Export Master
          </button>
          <button className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10">
            <Plus size={18} />
            Add Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
            <div className="space-y-1">
              {[
                { icon: Building2, label: 'Legal Entities', count: 12, active: true },
                { icon: Globe, label: 'Vendors & Payees', count: 1420 },
                { icon: Database, label: 'GL Accounts', count: 88 },
                { icon: ShieldCheck, label: 'Risk Profiles', count: 4 },
              ].map((tab, i) => (
                <button 
                  key={i}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                    tab.active ? "bg-secondary/10 text-secondary" : "text-on-surface-variant hover:bg-surface-container-low"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon size={18} />
                    <span className="text-sm font-bold">{tab.label}</span>
                  </div>
                  <span className="text-[10px] font-black bg-surface-container-high px-2 py-0.5 rounded-full">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20">
            <h4 className="text-sm font-bold mb-4">Data Governance</h4>
            <p className="text-xs text-white/60 leading-relaxed mb-6">
              All master data changes require dual-authorization and are automatically synchronized with connected ERP environments.
            </p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">
              View Governance Policy
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input 
                type="text" 
                placeholder="Search master data records..." 
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
              />
            </div>
            <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
              <Filter size={20} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <h3 className="font-bold text-lg tracking-tight">Legal Entities</h3>
              <button className="text-secondary text-xs font-bold hover:underline flex items-center gap-1">
                Manage Regions <ArrowRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Entity ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Region</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {entities.map((ent) => (
                    <tr key={ent.id} className="hover:bg-surface-container-low transition-colors group cursor-pointer">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-on-surface-variant">{ent.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-on-surface">{ent.name}</div>
                        <div className="text-[10px] text-on-surface-variant font-medium">{ent.type}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">{ent.region}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-600" />
                          <span className="text-xs font-bold text-green-700">{ent.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <MoreVertical size={16} className="text-on-surface-variant" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
