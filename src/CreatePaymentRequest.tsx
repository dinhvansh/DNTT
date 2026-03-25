import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Plus, 
  Trash2, 
  Upload, 
  Info,
  Building2,
  CreditCard,
  Globe,
  FileText,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthProvider';

export default function CreatePaymentRequest() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state (simplified for demo)
  const [formData, setFormData] = useState({
    vendorId: 'VND-001',
    vendorName: 'Global Logistics Inc.',
    entityId: 'US-WEST-01',
    amount: 12500.00,
    currency: 'USD',
    priority: 'Medium',
    justification: 'Monthly shipping and handling fees for Q1 distribution.',
    type: 'Wire Transfer'
  });

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const requestData = {
        ...formData,
        status: 'Pending',
        requesterUid: user.uid,
        requesterName: profile?.displayName || user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
        lineItems: [
          { description: 'Shipping Fees', glCode: '6000-10', amount: 8500.00 },
          { description: 'Handling Charges', glCode: '6000-20', amount: 4000.00 }
        ]
      };

      await addDoc(collection(db, 'paymentRequests'), requestData);
      
      toast.success('Payment request submitted for approval', {
        description: 'The request has been routed to the Finance Director.',
      });
      navigate('/requests');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'paymentRequests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    toast.info('Draft saved successfully (Local Storage)');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-on-surface tracking-tighter">Create Payment Request</h1>
            <p className="text-xs font-medium text-on-surface-variant">Initiate a new outbound payment for governance review.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-bold hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
            Submit for Approval
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Section 1: Request Information */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-surface-container-high pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <FileText size={20} />
              </div>
              <h3 className="font-bold text-lg tracking-tight">Request Information</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Entity / Subsidiary</label>
                <select className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all">
                  <option>US-WEST-01 (California Operations)</option>
                  <option>EU-CENTRAL-01 (Germany HQ)</option>
                  <option>APAC-SOUTH-01 (Singapore Hub)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Payment Priority</label>
                <select className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all">
                  <option>Standard (3-5 Days)</option>
                  <option>High (Next Day)</option>
                  <option>Critical (Same Day / Immediate)</option>
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Business Justification</label>
                <textarea 
                  rows={3}
                  placeholder="Provide a detailed explanation for this payment request..."
                  className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Payee Information */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-surface-container-high pb-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Building2 size={20} />
              </div>
              <h3 className="font-bold text-lg tracking-tight">Payee Details</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Vendor / Beneficiary</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search master data for existing vendor..." 
                    className="w-full pl-4 pr-10 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                  <Plus className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary cursor-pointer" size={18} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Settlement Method</label>
                  <select className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all">
                    <option>International Wire (SWIFT)</option>
                    <option>ACH / Domestic Transfer</option>
                    <option>Corporate Credit Card</option>
                    <option>Check</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Currency</label>
                  <select className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all">
                    <option>USD - US Dollar</option>
                    <option>EUR - Euro</option>
                    <option>GBP - British Pound</option>
                    <option>SGD - Singapore Dollar</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Line Items */}
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <CreditCard size={20} />
                </div>
                <h3 className="font-bold text-lg tracking-tight">Payment Details</h3>
              </div>
              <button className="text-secondary text-xs font-bold flex items-center gap-1 hover:underline">
                <Plus size={14} /> Add Line Item
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 bg-surface-container-low p-4 rounded-xl items-center">
                <div className="col-span-6">
                  <input type="text" placeholder="Description" className="w-full bg-transparent border-none text-sm font-medium outline-none" defaultValue="Q1 Cloud Infrastructure Services" />
                </div>
                <div className="col-span-2">
                  <input type="text" placeholder="GL Code" className="w-full bg-transparent border-none text-sm font-medium outline-none" defaultValue="6100-IT" />
                </div>
                <div className="col-span-3">
                  <input type="text" placeholder="Amount" className="w-full bg-transparent border-none text-sm font-bold text-right outline-none" defaultValue="45,200.00" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button className="p-1.5 text-on-surface-variant hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-surface-container-high">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Total Request Amount</p>
                  <p className="text-3xl font-black text-on-surface tracking-tighter">$45,200.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Attachments */}
          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Documentation</h3>
            <div className="border-2 border-dashed border-surface-container-high rounded-2xl p-8 text-center space-y-4 hover:border-secondary/40 transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mx-auto group-hover:bg-secondary/10 transition-colors">
                <Upload className="text-on-surface-variant group-hover:text-secondary transition-colors" size={24} />
              </div>
              <div>
                <p className="text-sm font-bold">Upload Invoices or Contracts</p>
                <p className="text-xs text-on-surface-variant">PDF, PNG, JPG up to 10MB</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-red-600">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold truncate max-w-[120px]">invoice_2024_01.pdf</p>
                    <p className="text-[10px] text-on-surface-variant">1.2 MB</p>
                  </div>
                </div>
                <button className="text-on-surface-variant hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Governance Rules */}
          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="text-secondary" size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Governance Check</span>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div>
                  <p className="text-xs font-bold">Budget Availability</p>
                  <p className="text-[10px] text-white/40">Entity US-WEST-01 has sufficient Q1 budget.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold">Approval Chain</p>
                  <p className="text-[10px] text-white/40">Requires 2-level authorization (Director + CFO).</p>
                </div>
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-secondary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Policy Reminder</p>
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed">Payments over $10,000 require a signed contract attachment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
