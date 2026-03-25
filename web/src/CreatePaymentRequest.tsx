import React, { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Upload,
  Info,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { createActorContext, createPaymentRequest, submitPaymentRequest } from './api/paymentRequests';
import type { PaymentRequestAttachment } from './types/paymentRequest';

interface DraftAttachment extends Pick<PaymentRequestAttachment, 'attachmentType' | 'fileName' | 'filePath' | 'fileSize'> {
  id: string;
}

export default function CreatePaymentRequest() {
  const navigate = useNavigate();
  const { user, actor: authActor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [formData, setFormData] = useState({
    departmentId: 'dep-a',
    payeeName: 'Global Logistics Inc.',
    totalAmount: 45200,
    currency: 'VND',
    priority: 'high',
    reason: 'Monthly shipping and handling fees for Q1 distribution.',
    paymentType: 'Wire Transfer',
    lineDescription: 'Q1 Cloud Infrastructure Services',
    glCode: '6100-IT',
  });

  const updateField = (key: keyof typeof formData, value: string | number) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const createDraft = async () => {
    if (!user || !authActor) {
      return null;
    }
    const actor = createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });

    return createPaymentRequest({
      departmentId: formData.departmentId,
      payeeName: formData.payeeName,
      paymentType: formData.paymentType,
      currency: formData.currency,
      totalAmount: formData.totalAmount,
      priority: formData.priority,
      reason: formData.reason,
      visibilityMode: 'related_only',
      lineItems: [
        {
          description: formData.lineDescription,
          glCode: formData.glCode,
          amount: formData.totalAmount,
        },
      ],
      attachments: attachments.map(({ attachmentType, fileName, filePath, fileSize }) => ({
        attachmentType,
        fileName,
        filePath,
        fileSize,
      })),
    }, actor);
  };

  const handleSubmit = async () => {
    if (!authActor) {
      return;
    }

    setIsSubmitting(true);
    try {
      const actor = createActorContext({
        userId: authActor.userId,
        departmentId: authActor.departmentId,
        permissions: authActor.permissions,
      });
      const draft = await createDraft();
      if (!draft) {
        return;
      }
      const submitted = await submitPaymentRequest(draft.data.id, actor);
      toast.success('Payment request submitted for approval', {
        description: `Created ${submitted.data.requestNo} and routed to workflow.`,
      });
      navigate(`/requests/${submitted.data.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Unable to submit payment request', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const draft = await createDraft();
      if (!draft) {
        return;
      }
      toast.success('Draft saved', {
        description: `${draft.data.requestNo} is ready for later submission.`,
      });
      navigate(`/requests/${draft.data.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Unable to save draft', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setAttachments((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        attachmentType: 'supporting_document',
        fileName: file.name,
        filePath: `local-upload/${file.name}`,
        fileSize: file.size,
      })),
    ]);
    event.target.value = '';
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-surface-container-high pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <FileText size={20} />
              </div>
              <h3 className="font-bold text-lg tracking-tight">Request Information</h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(event) => updateField('departmentId', event.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                >
                  <option value="dep-a">dep-a</option>
                  <option value="dep-b">dep-b</option>
                  <option value="dep-finance">dep-finance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Payment Priority</label>
                <select
                  value={formData.priority}
                  onChange={(event) => updateField('priority', event.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                >
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Business Justification</label>
                <textarea
                  rows={3}
                  value={formData.reason}
                  onChange={(event) => updateField('reason', event.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                />
              </div>
            </div>
          </div>

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
                    value={formData.payeeName}
                    onChange={(event) => updateField('payeeName', event.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                  <Plus className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Settlement Method</label>
                  <select
                    value={formData.paymentType}
                    onChange={(event) => updateField('paymentType', event.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  >
                    <option value="Wire Transfer">International Wire (SWIFT)</option>
                    <option value="ACH">ACH / Domestic Transfer</option>
                    <option value="Card">Corporate Credit Card</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(event) => updateField('currency', event.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

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
                  <input
                    type="text"
                    value={formData.lineDescription}
                    onChange={(event) => updateField('lineDescription', event.target.value)}
                    className="w-full bg-transparent border-none text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={formData.glCode}
                    onChange={(event) => updateField('glCode', event.target.value)}
                    className="w-full bg-transparent border-none text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={formData.totalAmount}
                    onChange={(event) => updateField('totalAmount', Number(event.target.value))}
                    className="w-full bg-transparent border-none text-sm font-bold text-right outline-none"
                  />
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
                  <p className="text-3xl font-black text-on-surface tracking-tighter">
                    {formData.totalAmount.toLocaleString('en-US', { style: 'currency', currency: formData.currency })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <h3 className="font-bold text-lg tracking-tight">Documentation</h3>
            <label className="block border-2 border-dashed border-surface-container-high rounded-2xl p-8 text-center space-y-4 hover:border-secondary/40 transition-all cursor-pointer group">
              <input type="file" multiple className="hidden" onChange={handleAttachmentSelect} />
              <div className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mx-auto group-hover:bg-secondary/10 transition-colors">
                <Upload className="text-on-surface-variant group-hover:text-secondary transition-colors" size={24} />
              </div>
              <div>
                <p className="text-sm font-bold">Upload Invoices or Contracts</p>
                <p className="text-xs text-on-surface-variant">Current flow stores attachment metadata with the request for audit and review.</p>
              </div>
            </label>

            {attachments.length > 0 && (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{attachment.fileName}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {(attachment.fileSize / 1024).toFixed(1)} KB • {attachment.attachmentType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="p-1.5 text-on-surface-variant hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  <p className="text-xs font-bold">Validation Scope</p>
                  <p className="text-[10px] text-white/40">Current backend enforces required fields, amount and at least one detail line.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold">Workflow Preview</p>
                  <p className="text-[10px] text-white/40">Draft stays editable. Submit creates the workflow instance and the first pending approver assignment.</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-secondary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Current Limitation</p>
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed">Binary upload to MinIO is still pending. This phase persists attachment metadata, line items, and approval routing through the backend.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
