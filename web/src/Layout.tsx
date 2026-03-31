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
  BookMarked,
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
  History,
  GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', show: () => true },
  {
    icon: FileText,
    label: 'Payment Requests',
    path: '/requests',
    show: (permissions: string[]) =>
      ['create_request', 'edit_own_draft', 'submit_request', 'cancel_request'].some((permission) => permissions.includes(permission)),
  },
  {
    icon: CheckSquare,
    label: 'My Approvals',
    path: '/approvals',
    show: (permissions: string[]) =>
      ['approve_request', 'release_to_erp', 'hold_erp_sync'].some((permission) => permissions.includes(permission)),
  },
  {
    icon: History,
    label: 'ERP Integration Log',
    path: '/erp-log',
    show: (permissions: string[]) =>
      ['view_finance_scoped', 'release_to_erp', 'hold_erp_sync', 'retry_erp_push'].some((permission) => permissions.includes(permission)),
  },
  {
    icon: Database,
    label: 'Master Data',
    path: '/master-data',
    show: (permissions: string[]) => permissions.includes('manage_department_setup'),
  },
  {
    icon: GitBranch,
    label: 'Organization Chart',
    path: '/organization-chart',
    show: (permissions: string[]) => permissions.includes('manage_department_setup'),
  },
  {
    icon: BookMarked,
    label: 'ERP Reference Master',
    path: '/erp-reference-master',
    show: (permissions: string[]) => permissions.includes('manage_department_setup'),
  },
  {
    icon: Settings,
    label: 'Approval Setup',
    path: '/setup',
    show: (permissions: string[]) => permissions.includes('manage_department_setup'),
  },
  { icon: Users, label: 'Delegation', path: '/delegation', show: () => true },
  { icon: FileStack, label: 'Templates', path: '/templates', show: () => true },
];

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
    departmentId: 'dep-a',
    roleCode: 'staff',
  });
  const location = useLocation();
  const { user, actor, loading, login, register, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => item.show(actor?.permissions ?? []));

  const updateAuthField = (key: keyof typeof authForm, value: string) => {
    setAuthForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAuthSubmit = async () => {
    setIsSubmittingAuth(true);
    try {
      if (authMode === 'login') {
        await login({
          email: authForm.email,
          password: authForm.password,
        });
        toast.success('Signed in successfully');
      } else {
        await register({
          fullName: authForm.fullName,
          email: authForm.email,
          password: authForm.password,
          departmentId: authForm.departmentId,
          roleCode: authForm.roleCode,
        });
        toast.success('Account created and signed in');
      }
    } catch (error) {
      console.error(error);
      toast.error(authMode === 'login' ? 'Unable to sign in' : 'Unable to create account', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

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
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 border border-surface-container-high space-y-8">
          <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-3xl flex items-center justify-center mx-auto rotate-3">
            <ShieldCheck size={48} />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-black text-on-surface tracking-tighter leading-none">Sovereign Ledger</h1>
            <p className="text-sm text-on-surface-variant font-medium">Enterprise Payment Governance & Global Finance Control</p>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-surface-container-low rounded-2xl p-1">
            <button
              onClick={() => setAuthMode('login')}
              className={cn(
                'rounded-2xl px-4 py-2 text-sm font-bold transition-colors',
                authMode === 'login' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={cn(
                'rounded-2xl px-4 py-2 text-sm font-bold transition-colors',
                authMode === 'register' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
              )}
            >
              Register
            </button>
          </div>

          <div className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Full Name</label>
                <input
                  type="text"
                  value={authForm.fullName}
                  onChange={(event) => updateAuthField('fullName', event.target.value)}
                  className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="Nguyen Van A"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Email</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => updateAuthField('email', event.target.value)}
                className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => updateAuthField('password', event.target.value)}
                className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder="At least 4 characters"
              />
            </div>

            {authMode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Department</label>
                  <select
                    value={authForm.departmentId}
                    onChange={(event) => updateAuthField('departmentId', event.target.value)}
                    className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                  >
                    <option value="dep-a">dep-a</option>
                    <option value="dep-b">dep-b</option>
                    <option value="dep-finance">dep-finance</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Role</label>
                  <select
                    value={authForm.roleCode}
                    onChange={(event) => updateAuthField('roleCode', event.target.value)}
                    className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                  >
                    <option value="staff">staff</option>
                    <option value="manager">manager</option>
                    <option value="director">director</option>
                    <option value="finance_operations">finance_operations</option>
                    <option value="auditor">auditor</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => void handleAuthSubmit()}
            disabled={isSubmittingAuth}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-secondary text-white rounded-2xl font-bold hover:bg-secondary-container transition-all shadow-xl shadow-secondary/20 group disabled:opacity-50"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            {isSubmittingAuth
              ? 'Processing...'
              : authMode === 'login'
                ? 'Sign in with Local Account'
                : 'Create Account'}
          </button>
          {authMode === 'login' && (
            <div className="rounded-2xl bg-surface-container-low p-4 text-xs text-on-surface-variant space-y-1">
              <p className="font-black uppercase tracking-widest text-[10px] text-secondary">Demo Accounts</p>
              <p>`requester1@example.com` / `1234`</p>
              <p>`approver1@example.com` / `1234`</p>
              <p>`financeops@example.com` / `1234`</p>
              <p>`auditor1@example.com` / `1234`</p>
              <p>`sysadmin@example.com` / `1234`</p>
            </div>
          )}
          <p className="text-[10px] text-center text-on-surface-variant/60 font-mono uppercase tracking-widest">
            Local test access backed by PostgreSQL user records
          </p>
        </div>
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 text-center space-y-8 border border-surface-container-high">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldCheck size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-on-surface tracking-tighter leading-none">Access Not Provisioned</h1>
            <p className="text-sm text-on-surface-variant font-medium">
              Your account ({user.email}) is not registered in the system. Please contact your administrator.
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-surface-container-low text-on-surface rounded-2xl font-bold hover:bg-surface-container-high transition-all"
          >
            <LogOut size={20} />
            Sign out
          </button>
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
          {visibleNavItems.map((item) => {
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
                <p className="text-xs font-black truncate tracking-tight">{actor?.fullName || user.displayName}</p>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">{actor?.departmentId || 'Staff'}</p>
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
