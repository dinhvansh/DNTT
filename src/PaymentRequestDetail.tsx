import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  CreditCard, 
  Globe, 
  FileText, 
  ExternalLink,
  History,
  ShieldCheck,
  User,
  Download,
  MoreVertical,
  Share2,
  Printer
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { toast } from 'sonner';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthProvider';

export default function PaymentRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { profile } = useAuth();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(doc(db, 'paymentRequests', id), (snapshot) => {
      if (snapshot.exists()) {
        setRequest({ id: snapshot.id, ...snapshot.data() });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `paymentRequests/${id}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setIsActing(true);
    try {
      await updateDoc(doc(db, 'paymentRequests', id), {
        status: 'Approved'
      });
      toast.success('Request approved', {
        description: `Payment request ${id} has been authorized.`,
      });
      navigate('/approvals');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `paymentRequests/${id}`);
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setIsActing(true);
    try {
      await updateDoc(doc(db, 'paymentRequests', id), {
        status: 'Rejected'
      });
      toast.error('Request rejected', {
        description: `Payment request ${id} has been declined.`,
      });
      navigate('/approvals');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `paymentRequests/${id}`);
    } finally {
      setIsActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black text-on-surface tracking-tighter uppercase">Loading Details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black tracking-tighter">Request Not Found</h2>
        <button onClick={() => navigate('/requests')} className="text-secondary font-bold text-sm">Back to Ledger</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-on-surface tracking-tighter">{request.id.slice(0, 8).toUpperCase()}</h1>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                request.status === 'Approved' ? "bg-green-100 text-green-700" : 
                request.status === 'Pending' ? "bg-amber-100 text-amber-700" : 
                request.status === 'Processing' ? "bg-blue-100 text-blue-700" :
                "bg-red-100 text-red-700"
              )}>
                {request.status}
              </span>
            </div>
            <p className="text-xs font-medium text-on-surface-variant">
              Created by {request.requesterName} on {request.createdAt?.toDate?.().toLocaleDateString() || 'Just now'} • Entity: {request.entityId}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Printer size={20} />
          </button>
          <button className="p-2 hover:bg-surface-container-low rounded-xl transition-colors text-on-surface-variant">
            <Share2 size={20} />
          </button>
          <div className="w-px h-10 bg-surface-container-high mx-2" />
          
          {(profile?.role === 'admin' || profile?.role === 'director') && request.status === 'Pending' && (
            <>
              <button 
                onClick={handleReject}
                disabled={isActing}
                className="px-6 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button 
                onClick={handleApprove}
                disabled={isActing}
                className="px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
              >
                {isActing ? 'Processing...' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Total Amount</p>
              <p className="text-2xl font-black text-on-surface tracking-tighter">$124,500.00</p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">Currency: USD</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Payment Method</p>
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-secondary" />
                <p className="text-sm font-bold text-on-surface">International Wire</p>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">SWIFT / BIC Settlement</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Priority</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600" />
                <p className="text-sm font-bold text-on-surface">Critical</p>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">SLA: 4 Hours</p>
            </div>
          </div>

          {/* Vendor Profile */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg tracking-tight">Vendor Profile</h3>
              <button className="text-secondary text-xs font-bold flex items-center gap-1 hover:underline">
                View Master Data <ExternalLink size={14} />
              </button>
            </div>
            
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-surface-container-low rounded-2xl flex items-center justify-center text-secondary">
                <Building2 size={32} />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Legal Name</p>
                  <p className="text-sm font-bold">Apex Global Systems Inc.</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Tax ID / VAT</p>
                  <p className="text-sm font-bold">US-99-1234567</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Risk Rating</p>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black">LOW RISK</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Last Payment</p>
                  <p className="text-sm font-bold">Feb 12, 2024 ($12,000)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Settlement Destination */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Settlement Destination</h3>
            <div className="p-6 bg-surface-container-low rounded-2xl border border-surface-container-high space-y-4">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Bank Name</p>
                  <p className="text-sm font-bold">J.P. Morgan Chase & Co.</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">SWIFT / BIC</p>
                  <p className="text-sm font-mono font-bold">CHASUS33XXX</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Account Number</p>
                  <p className="text-sm font-mono font-bold">**** **** 8829</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Country</p>
                  <p className="text-sm font-bold">United States</p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Audit Log & Lifecycle</h3>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-surface-container-high">
              {[
                { time: 'Mar 24, 14:22', user: 'Sarah Jenkins', action: 'Request Created', detail: 'Initial submission for Q1 infrastructure services.' },
                { time: 'Mar 24, 14:25', user: 'System Bot', action: 'Governance Check Passed', detail: 'Budget verified, vendor risk assessment: Low.' },
                { time: 'Mar 24, 15:10', user: 'Michael Chen', action: 'Level 1 Approval', detail: 'Technical review completed.' },
                { time: 'Mar 25, 09:00', user: 'Current State', action: 'Pending Level 2 Approval', detail: 'Awaiting CFO authorization.', active: true },
              ].map((log, i) => (
                <div key={i} className="relative pl-8">
                  <div className={cn(
                    "absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                    log.active ? "bg-secondary" : "bg-surface-container-high"
                  )}>
                    {log.active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <p className={cn("text-xs font-bold", log.active ? "text-secondary" : "text-on-surface")}>{log.action}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{log.time}</p>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{log.detail}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant mt-1 flex items-center gap-1">
                    <User size={10} /> {log.user}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* ERP Sync Status */}
          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 mb-6">
              <History className="text-secondary" size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">ERP Sync Lifecycle</span>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Object ID</span>
                <span className="text-xs font-mono font-bold">SAP-PR-99281</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                  <span>Sync Progress</span>
                  <span>40%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full w-[40%]" />
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-xs font-medium">Draft Created in SAP</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                  <span className="text-xs font-medium text-white/40">Awaiting Final Post</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                  <span className="text-xs font-medium text-white/40">Settlement Confirmation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Attachments</h3>
            <div className="space-y-3">
              {[
                { name: 'invoice_apex_q1.pdf', size: '1.2 MB', type: 'PDF' },
                { name: 'contract_signed.pdf', size: '4.5 MB', type: 'PDF' },
                { name: 'tax_form_w9.pdf', size: '800 KB', type: 'PDF' },
              ].map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-red-600">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold truncate max-w-[140px]">{file.name}</p>
                      <p className="text-[10px] text-on-surface-variant">{file.size}</p>
                    </div>
                  </div>
                  <Download size={16} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>

          {/* Approval Chain */}
          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Approval Chain</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">MC</div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-green-900">Michael Chen</p>
                  <p className="text-[10px] text-green-700">Technical Director • Approved</p>
                </div>
                <CheckCircle2 size={16} className="text-green-600" />
              </div>
              
              <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">JD</div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-900">John Doe</p>
                  <p className="text-[10px] text-amber-700">Finance Director • Pending</p>
                </div>
                <Clock size={16} className="text-amber-600" />
              </div>
              
              <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-xl border border-surface-container-high opacity-50">
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs font-bold">AL</div>
                <div className="flex-1">
                  <p className="text-xs font-bold">Alice Low</p>
                  <p className="text-[10px]">CFO • Next in line</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
