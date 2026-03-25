import React from 'react';
import { 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ArrowRight,
  Database,
  Globe,
  Activity,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const logs = [
  { id: 'LOG-99281', entity: 'US-WEST-01', object: 'Payment Request', erpId: 'SAP-PR-99281', status: 'Success', time: '2 mins ago', message: 'Object posted successfully to SAP S/4HANA.' },
  { id: 'LOG-99282', entity: 'EU-CENTRAL-01', object: 'Vendor Master', erpId: 'SAP-VM-4421', status: 'Error', time: '15 mins ago', message: 'Validation failed: Tax ID format mismatch for region DE.' },
  { id: 'LOG-99283', entity: 'APAC-SOUTH-01', object: 'Payment Request', erpId: 'ORCL-PR-112', status: 'Pending', time: '1 hour ago', message: 'Awaiting response from Oracle Cloud API gateway.' },
  { id: 'LOG-99284', entity: 'US-EAST-02', object: 'GL Account', erpId: 'SAP-GL-6100', status: 'Success', time: '3 hours ago', message: 'Account mapping synchronized.' },
  { id: 'LOG-99285', entity: 'GLOBAL-HQ', object: 'Payment Request', erpId: 'SAP-PR-99275', status: 'Success', time: '5 hours ago', message: 'Object posted successfully to SAP S/4HANA.' },
];

export default function ERPIntegrationLog() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">ERP Integration Log</h1>
          <p className="text-on-surface-variant font-medium">Monitor and troubleshoot global ledger synchronization events.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
            <RefreshCcw size={18} />
            Sync All
          </button>
        </div>
      </div>

      {/* Connectivity Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'SAP S/4HANA (Global)', status: 'Operational', latency: '124ms', color: 'bg-green-500' },
          { name: 'Oracle Cloud (APAC)', status: 'Operational', latency: '245ms', color: 'bg-green-500' },
          { name: 'Microsoft Dynamics (EU)', status: 'Degraded', latency: '1.2s', color: 'bg-amber-500' },
        ].map((erp, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-surface-container-low rounded-xl text-secondary">
                <Database size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{erp.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn("w-2 h-2 rounded-full", erp.color)} />
                  <span className="text-xs font-medium text-on-surface-variant">{erp.status}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Latency</p>
              <p className="text-sm font-bold">{erp.latency}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input 
            type="text" 
            placeholder="Search logs by ERP ID, Entity, or Message..." 
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-surface-container-low rounded-xl text-xs font-bold hover:bg-surface-container-high transition-colors">All Status</button>
          <button className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">Errors Only</button>
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Sync ID</th>
                <th className="px-6 py-4">Entity / Object</th>
                <th className="px-6 py-4">ERP Reference</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-on-surface-variant">{log.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-on-surface">{log.entity}</div>
                    <div className="text-[10px] text-on-surface-variant font-medium">{log.object}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-secondary">{log.erpId}</span>
                      <ExternalLink size={12} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {log.status === 'Success' ? <CheckCircle2 size={16} className="text-green-600" /> :
                       log.status === 'Error' ? <AlertCircle size={16} className="text-red-600" /> :
                       <Clock size={16} className="text-amber-600" />}
                      <span className={cn(
                        "text-xs font-bold",
                        log.status === 'Success' ? "text-green-700" : 
                        log.status === 'Error' ? "text-red-700" : "text-amber-700"
                      )}>
                        {log.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-on-surface-variant max-w-xs truncate">{log.message}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant">{log.time}</td>
                  <td className="px-6 py-4">
                    <button className="px-3 py-1.5 bg-white border border-surface-container-high rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-surface-container-low transition-colors">
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="text-secondary" size={24} />
            <h3 className="font-bold text-lg tracking-tight">Sync Success Rate</h3>
          </div>
          <div className="space-y-6">
            {[
              { label: 'Payment Requests', rate: 99.8, count: '1,240/1,242' },
              { label: 'Vendor Master', rate: 94.2, count: '420/446' },
              { label: 'GL Mappings', rate: 100, count: '88/88' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-on-surface-variant">{item.label}</span>
                  <span className="text-on-surface">{item.rate}% ({item.count})</span>
                </div>
                <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.rate}%` }}
                    transition={{ duration: 1, delay: i * 0.2 }}
                    className={cn("h-full rounded-full", item.rate > 95 ? "bg-green-500" : "bg-amber-500")} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary text-white p-8 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-lg tracking-tight mb-6">Integration Troubleshooting</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              Encountering persistent sync errors? Our global integration middleware handles automatic retries, but manual intervention may be required for validation failures.
            </p>
            <div className="space-y-4">
              <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-between px-6">
                Download Error Logs (Last 24h)
                <ChevronRight size={16} />
              </button>
              <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-between px-6">
                View API Documentation
                <ChevronRight size={16} />
              </button>
              <button className="w-full py-3 bg-secondary text-white rounded-xl text-xs font-bold transition-all flex items-center justify-between px-6">
                Contact Integration Support
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}
