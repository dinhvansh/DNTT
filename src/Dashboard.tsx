import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Download,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

const paymentData = [
  { name: 'Mon', value: 450000 },
  { name: 'Tue', value: 520000 },
  { name: 'Wed', value: 480000 },
  { name: 'Thu', value: 610000 },
  { name: 'Fri', value: 550000 },
  { name: 'Sat', value: 210000 },
  { name: 'Sun', value: 180000 },
];

const categoryData = [
  { name: 'Vendor', value: 1200000, color: '#041632' },
  { name: 'Payroll', value: 850000, color: '#0058be' },
  { name: 'Tax', value: 450000, color: '#2170e4' },
  { name: 'Ops', value: 320000, color: '#44474d' },
];

const recentActivity = [
  { id: '1', vendor: 'Global Logistics Inc.', amount: '$45,200.00', status: 'Approved', date: '2 mins ago', type: 'Wire Transfer' },
  { id: '2', vendor: 'Amazon Web Services', amount: '$12,840.50', status: 'Pending', date: '15 mins ago', type: 'Credit Card' },
  { id: '3', vendor: 'Stellar Office Supplies', amount: '$2,400.00', status: 'Error', date: '1 hour ago', type: 'ACH' },
  { id: '4', vendor: 'Vertex Tax Solutions', amount: '$125,000.00', status: 'Approved', date: '3 hours ago', type: 'Wire Transfer' },
];

const StatCard = ({ title, value, change, trend, icon: Icon, color }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full", 
        trend === 'up' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      )}>
        {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {change}
      </div>
    </div>
    <p className="text-on-surface-variant text-sm font-medium mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-on-surface tracking-tight">{value}</h3>
  </motion.div>
);

export default function Dashboard() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Global Payment Oversight</h1>
          <p className="text-on-surface-variant font-medium">Real-time governance and treasury control across all entities.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
            <Filter size={18} />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-container transition-colors shadow-lg shadow-primary/10">
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Outbound (MTD)" 
          value="$4,285,400.00" 
          change="+12.5%" 
          trend="up" 
          icon={TrendingUp} 
          color="bg-primary"
        />
        <StatCard 
          title="Pending Approvals" 
          value="24 Requests" 
          change="-4.2%" 
          trend="down" 
          icon={Clock} 
          color="bg-secondary"
        />
        <StatCard 
          title="Integration Errors" 
          value="3 Critical" 
          change="+1" 
          trend="up" 
          icon={AlertCircle} 
          color="bg-red-600"
        />
        <StatCard 
          title="Settled Successfully" 
          value="1,420 Payments" 
          change="+8.1%" 
          trend="up" 
          icon={CheckCircle2} 
          color="bg-green-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg tracking-tight">Liquidity Flow Trends</h3>
            <select className="bg-surface-container-low border-none rounded-lg text-xs font-bold px-3 py-1.5 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paymentData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0058be" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0058be" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#44474d', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#44474d', fontWeight: 500 }}
                  tickFormatter={(value) => `$${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0058be" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <h3 className="font-bold text-lg tracking-tight mb-8">Allocation by Category</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#44474d', fontWeight: 600 }}
                  width={70}
                />
                <Tooltip 
                  cursor={{ fill: '#f8f9fb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {categoryData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-on-surface-variant font-medium">{item.name}</span>
                </div>
                <span className="font-bold">${(item.value/1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity and ERP Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
          <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
            <h3 className="font-bold text-lg tracking-tight">Recent Payment Activity</h3>
            <button className="text-secondary text-sm font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Vendor / Payee</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {recentActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-on-surface">{item.vendor}</div>
                      <div className="text-xs text-on-surface-variant">ID: REQ-2024-{item.id}</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-sm">{item.amount}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                        item.status === 'Approved' ? "bg-green-100 text-green-700" : 
                        item.status === 'Pending' ? "bg-amber-100 text-amber-700" : 
                        "bg-red-100 text-red-700"
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">{item.type}</td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">{item.date}</td>
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

        <div className="space-y-6">
          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">ERP Connectivity</span>
              </div>
              <h4 className="text-xl font-bold mb-2">SAP S/4HANA Global</h4>
              <p className="text-sm text-white/60 mb-6">Last synchronized: 14:22:05 UTC</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Sync Status</span>
                  <span className="font-bold text-green-400">Operational</span>
                </div>
                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                  <div className="bg-green-400 h-full w-[98%]" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Queue Depth</span>
                  <span className="font-bold">12 Objects</span>
                </div>
              </div>

              <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                <ExternalLink size={14} />
                Open ERP Console
              </button>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
            <h3 className="font-bold text-lg tracking-tight mb-6">Governance Alerts</h3>
            <div className="space-y-4">
              <div className="flex gap-4 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle className="text-red-600 shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold text-red-900 mb-1">Threshold Violation</p>
                  <p className="text-[11px] text-red-700 leading-relaxed">Payment to 'Apex Corp' exceeds daily limit for Entity: US-WEST-01.</p>
                </div>
              </div>
              <div className="flex gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <Clock className="text-amber-600 shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold text-amber-900 mb-1">Approval Escalation</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">Request #8829 has been pending for 48h. Escalating to Finance Director.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
