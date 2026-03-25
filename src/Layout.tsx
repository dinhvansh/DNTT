import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Database, 
  Settings, 
  Users, 
  FileStack, 
  LogOut, 
  Search, 
  Bell, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  ShieldCheck,
  Activity,
  LogIn,
  X,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './AuthProvider';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Payment Requests', path: '/requests' },
  { icon: CheckSquare, label: 'My Approvals', path: '/approvals' },
  { icon: History, label: 'ERP Integration Log', path: '/erp-log' },
  { icon: Database, label: 'Master Data', path: '/master-data' },
  { icon: Settings, label: 'Approval Setup', path: '/setup' },
  { icon: Users, label: 'Delegation', path: '/delegation' },
  { icon: FileStack, label: 'Templates', path: '/templates' },
];

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { user, profile, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black text-on-surface tracking-tighter uppercase">Initializing Ledger...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 text-center space-y-8 border border-surface-container-high">
          <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-3xl flex items-center justify-center mx-auto rotate-3">
            <ShieldCheck size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-on-surface tracking-tighter leading-none">Sovereign Ledger</h1>
            <p className="text-sm text-on-surface-variant font-medium">Enterprise Payment Governance & Global Finance Control</p>
          </div>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-secondary text-white rounded-2xl font-bold hover:bg-secondary-container transition-all shadow-xl shadow-secondary/20 group"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            Sign in with Corporate Account
          </button>
          <p className="text-[10px] text-on-surface-variant/50 font-mono uppercase tracking-widest">
            Secure SSO Authentication Required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface font-sans text-on-surface">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        className="fixed left-0 top-0 h-screen bg-white border-r border-surface-container-high z-50 flex flex-col"
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center px-6 gap-3 border-bottom border-surface-container-low">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-secondary/20">
            <ShieldCheck className="text-white" size={24} />
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="text-xl font-black tracking-tighter block leading-none">Sovereign</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary leading-none">Ledger</span>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-2xl transition-all group relative",
                  isActive 
                    ? "bg-secondary/10 text-secondary font-bold" 
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                )}
              >
                <item.icon size={22} className={cn(
                  "shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-secondary" : "text-on-surface-variant"
                )} />
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm tracking-tight"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-6 bg-secondary rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Collapse Toggle */}
        <div className="p-4 border-t border-surface-container-low space-y-4">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-2xl bg-surface-container-low",
            isCollapsed && "justify-center"
          )}>
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users size={20} className="text-on-surface-variant" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate tracking-tight">{profile?.displayName || user.displayName}</p>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">{profile?.role || 'Staff'}</p>
              </div>
            )}
            {!isCollapsed && (
              <button 
                onClick={logout}
                className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          isCollapsed ? "pl-20" : "pl-[280px]"
        )}
      >
        {/* Top Bar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-surface-container-high sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex-1 max-w-xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search payments, vendors, or entities..."
              className="w-full bg-surface-container-low border-none rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-on-surface-variant/50"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-700 uppercase tracking-tighter">ERP Connected</span>
              </div>
              <button className="relative p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full border-2 border-white" />
              </button>
            </div>
            
            <div className="h-8 w-px bg-surface-container-high" />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">System Status</p>
                <p className="text-xs font-bold">Operational</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-center">
                <Menu size={20} className="text-on-surface-variant" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
