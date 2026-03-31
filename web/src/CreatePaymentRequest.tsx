import React, { useEffect, useMemo, useState } from 'react';
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
import {
  createActorContext,
  createPaymentRequest,
  previewPaymentRequestWorkflow,
  submitPaymentRequestWithOverrides,
} from './api/paymentRequests';
import type {
  PaymentRequestAttachment,
  PaymentRequestWorkflowPreviewIssue,
  PaymentRequestWorkflowPreviewStep,
} from './types/paymentRequest';
import { getVietcombankExchangeRates } from './api/exchangeRates';
import { listPublicErpReferenceValues, listVendors, type ErpReferenceValue, type MasterDataVendor } from './api/masterData';
import { listRequestTemplates, type RequestTemplate } from './api/templates';
import { uploadAttachment } from './api/uploads';

interface DraftAttachment extends Pick<PaymentRequestAttachment, 'attachmentType' | 'fileName' | 'filePath' | 'fileSize'> {
  id: string;
}

interface DraftLineItem {
  id: string;
  invoiceDate: string;
  invoiceRef: string;
  glCode: string;
  costCenter: string;
  projectCode: string;
  note: string;
  expenseType: string;
  amount: number;
  currency: string;
  exchangeRate: number;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function calculateLineTotal(lineItem: Pick<DraftLineItem, 'amount' | 'exchangeRate'>) {
  return Number(lineItem.amount || 0) * Number(lineItem.exchangeRate || 0);
}

function getNumericFieldKey(lineId: string, field: 'amount' | 'exchangeRate') {
  return `${lineId}:${field}`;
}

function formatWorkflowStepLabel(stepCode: string) {
  switch (stepCode) {
    case 'line_manager':
      return 'Line Manager';
    case 'reviewer':
      return 'Reviewer';
    case 'hod':
      return 'Head Of Department';
    case 'cfo':
      return 'Chief Financial Officer';
    case 'ceo':
      return 'Chief Executive Officer';
    default:
      return stepCode.replace(/_/g, ' ');
  }
}

export default function CreatePaymentRequest() {
  const navigate = useNavigate();
  const { user, actor: authActor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [vendors, setVendors] = useState<MasterDataVendor[]>([]);
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [erpReferences, setErpReferences] = useState<ErpReferenceValue[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ VND: 1 });
  const [activeNumericField, setActiveNumericField] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isLoadingWorkflowPreview, setIsLoadingWorkflowPreview] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState<{
    departmentId: string | null;
    steps: PaymentRequestWorkflowPreviewStep[];
    issues: PaymentRequestWorkflowPreviewIssue[];
    lineManagerOverride: {
      defaultApproverId?: string | null;
      defaultApproverName?: string | null;
      selectedApproverId?: string | null;
      selectedApproverName?: string | null;
      candidates: Array<{
        approverId: string;
        approverName: string;
        positionCode?: string | null;
        roleCode?: string | null;
      }>;
    };
  } | null>(null);
  const [lineManagerOverrideId, setLineManagerOverrideId] = useState<string>('');
  const [lineManagerOverrideReason, setLineManagerOverrideReason] = useState('');
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    {
      id: 'line-1',
      invoiceDate: '2026-03-26',
      invoiceRef: 'INV-2026-001',
      glCode: '6100-IT',
      costCenter: 'CC-OPS',
      projectCode: 'PRJ-DNTT',
      note: 'Q1 Cloud Infrastructure Services',
      expenseType: 'service_fee',
      amount: 13230,
      currency: 'VND',
      exchangeRate: 1,
    },
  ]);
  const [formData, setFormData] = useState({
    templateCode: 'vendor_standard',
    vendorCode: 'VEND-GLI',
    payeeName: 'Global Logistics Inc.',
    currency: 'VND',
    priority: 'high',
    reason: 'Monthly shipping and handling fees for Q1 distribution.',
    paymentType: 'Wire Transfer',
  });

  const totalAmount = useMemo(
    () => lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0),
    [lineItems]
  );
  const lineManagerStepCode = 'line_manager';
  const actorContext = useMemo(
    () =>
      authActor
        ? createActorContext({
            userId: authActor.userId,
            departmentId: authActor.departmentId,
            permissions: authActor.permissions,
          })
        : null,
    [authActor]
  );
  const expenseTypeOptions = useMemo(
    () =>
      erpReferences
        .filter((entry) => entry.referenceType === 'expense_type' && entry.isActive)
        .map((entry) => ({
          code: entry.code,
          name: entry.name,
        })),
    [erpReferences]
  );
  const glCodeOptions = useMemo(
    () =>
      erpReferences
        .filter((entry) => entry.referenceType === 'gl_account' && entry.isActive)
        .map((entry) => ({
          code: entry.code,
          name: entry.name,
        })),
    [erpReferences]
  );
  const costCenterOptions = useMemo(
    () =>
      erpReferences
        .filter((entry) => entry.referenceType === 'cost_center' && entry.isActive)
        .map((entry) => ({
          code: entry.code,
          name: entry.name,
        })),
    [erpReferences]
  );
  const projectOptions = useMemo(
    () =>
      erpReferences
        .filter((entry) => entry.referenceType === 'project' && entry.isActive)
        .map((entry) => ({
          code: entry.code,
          name: entry.name,
        })),
    [erpReferences]
  );
  const resolveExpenseTypeName = (expenseTypeCode: string) =>
    expenseTypeOptions.find((entry) => entry.code === expenseTypeCode)?.name ?? expenseTypeCode;
  const selectedTemplate = useMemo(
    () => templates.find((entry) => entry.code === formData.templateCode) ?? null,
    [templates, formData.templateCode]
  );

  const updateField = (key: keyof typeof formData, value: string | number) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  useEffect(() => {
    if (!actorContext) {
      return;
    }

    void listVendors(actorContext)
      .then((result) => {
        setVendors(result.data);
        const defaultVendor = result.data.find((entry) => entry.code === 'VEND-GLI') ?? result.data[0];
        if (defaultVendor) {
          setFormData((current) => ({
            ...current,
            vendorCode: defaultVendor.code,
            payeeName: defaultVendor.name,
            currency: defaultVendor.currency || current.currency,
          }));
        }
      })
      .catch(() => {});

    void listRequestTemplates(actorContext)
      .then((result) => {
        setTemplates(result.data);
        const defaultTemplate =
          result.data.find((entry) => entry.code === 'vendor_standard') ??
          result.data.find((entry) => entry.isActive !== false) ??
          null;
        if (defaultTemplate) {
          setFormData((current) => ({
            ...current,
            templateCode: defaultTemplate.code,
          }));
        }
      })
      .catch(() => {});

    void listPublicErpReferenceValues(actorContext)
      .then((result) => {
        setErpReferences(result.data);
        const defaultExpenseType =
          result.data.find((entry) => entry.referenceType === 'expense_type' && entry.code === 'service_fee' && entry.isActive) ??
          result.data.find((entry) => entry.referenceType === 'expense_type' && entry.isActive) ??
          null;
        const defaultGlCode =
          result.data.find((entry) => entry.referenceType === 'gl_account' && entry.code === '6100-IT' && entry.isActive) ??
          result.data.find((entry) => entry.referenceType === 'gl_account' && entry.isActive) ??
          null;
        const defaultCostCenter =
          result.data.find((entry) => entry.referenceType === 'cost_center' && entry.code === 'CC-OPS' && entry.isActive) ??
          result.data.find((entry) => entry.referenceType === 'cost_center' && entry.isActive) ??
          null;
        const defaultProject =
          result.data.find((entry) => entry.referenceType === 'project' && entry.code === 'PRJ-DNTT' && entry.isActive) ??
          result.data.find((entry) => entry.referenceType === 'project' && entry.isActive) ??
          null;

        setLineItems((current) =>
          current.map((item) => ({
            ...item,
            expenseType: item.expenseType || defaultExpenseType?.code || '',
            glCode: item.glCode || defaultGlCode?.code || '',
            costCenter: item.costCenter || defaultCostCenter?.code || '',
            projectCode: item.projectCode || defaultProject?.code || '',
          }))
        );
      })
      .catch(() => {});

    void getVietcombankExchangeRates(actorContext)
      .then((result) => {
        const nextRates = result.data.rates.reduce<Record<string, number>>((accumulator, entry) => {
          if (entry.currencyCode && entry.transfer) {
            accumulator[entry.currencyCode] = entry.transfer;
          }
          return accumulator;
        }, { VND: 1 });

        setExchangeRates(nextRates);
        setLineItems((current) =>
          current.map((item) => ({
            ...item,
            exchangeRate: item.currency === 'VND' ? 1 : (nextRates[item.currency] ?? item.exchangeRate ?? 1),
          }))
        );
      })
      .catch(() => {});
  }, [actorContext]);

  useEffect(() => {
    if (!actorContext) {
      return;
    }

    setIsLoadingWorkflowPreview(true);
    void previewPaymentRequestWorkflow(
      {
        totalAmount,
        lineManagerOverrideId: lineManagerOverrideId || null,
      },
      actorContext
    )
      .then((result) => {
        setWorkflowPreview(result.data);
      })
      .catch((error) => {
        console.error(error);
        setWorkflowPreview(null);
      })
      .finally(() => {
        setIsLoadingWorkflowPreview(false);
      });
  }, [actorContext, totalAmount, lineManagerOverrideId]);

  const updateLineItem = (lineId: string, key: keyof DraftLineItem, value: string | number) => {
    setLineItems((current) => current.map((item) => (item.id === lineId ? { ...item, [key]: value } : item)));
  };

  const addLineItem = () => {
    const defaultExpenseType = expenseTypeOptions[0]?.code ?? '';
    const defaultGlCode = glCodeOptions[0]?.code ?? '';
    const defaultCostCenter = costCenterOptions[0]?.code ?? '';
    const defaultProject = projectOptions[0]?.code ?? '';
    setLineItems((current) => [
      ...current,
      {
        id: `line-${Date.now()}-${current.length + 1}`,
        invoiceDate: '',
        invoiceRef: '',
        glCode: defaultGlCode,
        costCenter: defaultCostCenter,
        projectCode: defaultProject,
        note: '',
        expenseType: defaultExpenseType,
        amount: 0,
        currency: formData.currency || 'VND',
        exchangeRate: formData.currency === 'VND' ? 1 : 1,
      },
    ]);
  };

  const removeLineItem = (lineId: string) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== lineId)));
  };

  const getEditableNumericValue = (lineId: string, field: 'amount' | 'exchangeRate', value: number) => {
    return activeNumericField === getNumericFieldKey(lineId, field)
      ? String(Number.isFinite(value) ? value : 0)
      : formatDecimal(value);
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
      templateCode: formData.templateCode || undefined,
      vendorCode: formData.vendorCode || undefined,
      payeeName: formData.payeeName,
      paymentType: formData.paymentType,
      currency: formData.currency,
      totalAmount,
      priority: formData.priority,
      reason: formData.reason,
      visibilityMode: 'related_only',
      lineItems: lineItems.map((item) => ({
        description: resolveExpenseTypeName(item.expenseType),
        invoiceDate: item.invoiceDate || undefined,
        invoiceRef: item.invoiceRef || undefined,
        glCode: item.glCode || '',
        costCenter: item.costCenter || undefined,
        projectCode: item.projectCode || undefined,
        expenseTypeCode: item.expenseType || undefined,
        currency: item.currency,
        exchangeRate: Number(item.exchangeRate || 0),
        amount: Number(calculateLineTotal(item)),
        totalAmount: Number(calculateLineTotal(item)),
        note: item.note?.trim() || undefined,
        remark: [
          item.invoiceDate ? `Invoice date: ${item.invoiceDate}` : '',
          item.invoiceRef ? `Invoice ref: ${item.invoiceRef}` : '',
          item.expenseType ? `ERP Expense Type: ${item.expenseType}` : '',
          item.costCenter ? `ERP Cost Center: ${item.costCenter}` : '',
          item.projectCode ? `ERP Project: ${item.projectCode}` : '',
          item.note?.trim(),
          `FX ${item.currency} ${formatDecimal(item.amount)} x ${formatDecimal(item.exchangeRate)} = VND ${formatDecimal(
            calculateLineTotal(item)
          )}`,
        ]
          .filter(Boolean)
          .join(' | '),
      })),
      attachments: attachments.map(({ attachmentType, fileName, filePath, fileSize }) => ({
        attachmentType,
        fileName,
        filePath,
        fileSize,
      })),
    }, actor);
  };

  const handleSubmit = async () => {
    if (!actorContext) {
      return;
    }

    if (lineManagerOverrideId && !lineManagerOverrideReason.trim()) {
      toast.error('Line manager override reason is required.', {
        description: 'Add a short justification before submitting this override.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const draft = await createDraft();
      if (!draft) {
        return;
      }
      const submitted = await submitPaymentRequestWithOverrides(
        draft.data.id,
        {
          lineManagerOverrideId: lineManagerOverrideId || null,
          lineManagerOverrideReason: lineManagerOverrideReason.trim() || null,
        },
        actorContext
      );
      toast.success('Payment request submitted for approval', {
        description: `Created ${submitted.data.requestNo} and routed to workflow.`,
      });
      navigate(`/requests/${submitted.data.id}`);
    } catch (error) {
      console.error(error);
      const details = Array.isArray((error as { details?: unknown[] })?.details)
        ? (error as { details?: Array<{ severity?: string; message?: string }> }).details
        : [];
      const firstBlockingIssue = details.find((entry) => entry?.severity === 'error' && entry?.message)?.message;
      toast.error('Unable to submit payment request', {
        description: firstBlockingIssue || (error instanceof Error ? error.message : 'Unknown error'),
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

    if (!actorContext) {
      toast.error('You need to be signed in before uploading attachments.');
      event.target.value = '';
      return;
    }

    setIsUploadingAttachments(true);
    void (async () => {
      const uploadedItems: DraftAttachment[] = [];

      for (const file of files) {
        const result = await uploadAttachment(file, 'supporting_document', actorContext);
        uploadedItems.push({
          id: result.data.id,
          attachmentType: result.data.attachmentType,
          fileName: result.data.fileName,
          filePath: result.data.filePath,
          fileSize: result.data.fileSize,
        });
      }

      setAttachments((current) => [...current, ...uploadedItems]);
      toast.success('Attachment upload completed', {
        description: `${uploadedItems.length} file(s) uploaded to object storage.`,
      });
    })()
      .catch((error) => {
        console.error(error);
        toast.error('Unable to upload attachment', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      })
      .finally(() => {
        setIsUploadingAttachments(false);
        event.target.value = '';
      });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));
  };

  const paymentDetailsSection = (
    <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
            <CreditCard size={20} />
          </div>
          <h3 className="font-bold text-lg tracking-tight">Payment Details</h3>
        </div>
        <button type="button" onClick={addLineItem} className="text-secondary text-xs font-bold flex items-center gap-1 hover:underline">
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      <div className="space-y-4">
        <div className="w-full space-y-4">
          {lineItems.map((item, index) => (
            <div
              key={item.id}
              className="bg-surface-container-low p-4 rounded-xl space-y-3"
            >
              <div className="grid grid-cols-1 xl:grid-cols-[140px_180px_140px_150px_150px_minmax(260px,1fr)_190px_56px] gap-3 items-end">
                <FieldShell label="Invoice Date">
                  <input
                    type="date"
                    value={item.invoiceDate}
                    onChange={(event) => updateLineItem(item.id, 'invoiceDate', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  />
                </FieldShell>

                <FieldShell label="Invoice Ref">
                  <input
                    type="text"
                    value={item.invoiceRef}
                    onChange={(event) => updateLineItem(item.id, 'invoiceRef', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                    placeholder={`INV-${index + 1}`}
                  />
                </FieldShell>

                <FieldShell label="GL Code">
                  <select
                    value={item.glCode}
                    onChange={(event) => updateLineItem(item.id, 'glCode', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  >
                    {glCodeOptions.length === 0 ? <option value="">No GL code</option> : null}
                    {glCodeOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code}
                      </option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Cost Center">
                  <select
                    value={item.costCenter}
                    onChange={(event) => updateLineItem(item.id, 'costCenter', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  >
                    {costCenterOptions.length === 0 ? <option value="">No Cost Center</option> : null}
                    {costCenterOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code}
                      </option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Project">
                  <select
                    value={item.projectCode}
                    onChange={(event) => updateLineItem(item.id, 'projectCode', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  >
                    {projectOptions.length === 0 ? <option value="">No Project</option> : null}
                    {projectOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code}
                      </option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Note / Ghi Chu">
                  <input
                    type="text"
                    value={item.note}
                    onChange={(event) => updateLineItem(item.id, 'note', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] outline-none"
                    placeholder={`Line ${index + 1} note`}
                  />
                </FieldShell>

                <FieldShell label="Type Of Expenses">
                  <select
                    value={item.expenseType}
                    onChange={(event) => updateLineItem(item.id, 'expenseType', event.target.value)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  >
                    {expenseTypeOptions.length === 0 ? <option value="">No expense type</option> : null}
                    {expenseTypeOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Action" hiddenLabel>
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="h-[38px] w-full flex items-center justify-center rounded-xl border border-surface-container-high bg-white text-on-surface-variant hover:text-red-600 transition-colors disabled:opacity-40"
                    title="Delete line"
                  >
                    <Trash2 size={14} />
                  </button>
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_1fr_1fr] gap-3 items-end">
                <FieldShell label="Currency">
                  <select
                    value={item.currency}
                    onChange={(event) =>
                      setLineItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                currency: event.target.value,
                                exchangeRate: event.target.value === 'VND' ? 1 : (exchangeRates[event.target.value] ?? entry.exchangeRate ?? 1),
                              }
                            : entry
                        )
                      )
                    }
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </FieldShell>

                <FieldShell label="Invoice Amount">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getEditableNumericValue(item.id, 'amount', item.amount)}
                    onFocus={() => setActiveNumericField(getNumericFieldKey(item.id, 'amount'))}
                    onBlur={() => setActiveNumericField((current) => (current === getNumericFieldKey(item.id, 'amount') ? null : current))}
                    onChange={(event) => updateLineItem(item.id, 'amount', Number(event.target.value.replace(/,/g, '')) || 0)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-bold text-right outline-none"
                  />
                </FieldShell>

                <FieldShell label="Exchange Rate">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getEditableNumericValue(item.id, 'exchangeRate', item.exchangeRate)}
                    onFocus={() => setActiveNumericField(getNumericFieldKey(item.id, 'exchangeRate'))}
                    onBlur={() => setActiveNumericField((current) => (current === getNumericFieldKey(item.id, 'exchangeRate') ? null : current))}
                    onChange={(event) => updateLineItem(item.id, 'exchangeRate', Number(event.target.value.replace(/,/g, '')) || 0)}
                    className="w-full bg-white border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-bold text-right outline-none"
                    disabled={item.currency === 'VND'}
                  />
                </FieldShell>

                <FieldShell label="Total Payment (VND)">
                  <input
                    type="text"
                    value={formatDecimal(calculateLineTotal(item))}
                    readOnly
                    className="w-full bg-slate-50 border border-surface-container-high rounded-xl px-3 py-2 text-[13px] font-bold text-right outline-none"
                  />
                </FieldShell>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-surface-container-high">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Total Request Amount (VND)</p>
            <p className="text-3xl font-black text-on-surface tracking-tighter">
              {`VND ${formatDecimal(totalAmount)}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1880px] mx-auto space-y-8 px-4 2xl:px-8">
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
            disabled={isSubmitting || isUploadingAttachments}
            className="px-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm font-bold hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            {isUploadingAttachments ? 'Uploading Files...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingAttachments}
            className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-container transition-colors shadow-lg shadow-secondary/10 disabled:opacity-50"
          >
            {isSubmitting || isUploadingAttachments ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {isUploadingAttachments ? 'Uploading Files...' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-5">
          <div className="bg-white p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-surface-container-high pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <FileText size={20} />
              </div>
              <h3 className="font-bold text-lg tracking-tight">Request Information</h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Template</label>
                <select
                  value={formData.templateCode}
                  onChange={(event) => updateField('templateCode', event.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                >
                  {templates.length === 0 ? <option value="">No template</option> : null}
                  {templates.filter((entry) => entry.isActive !== false).map((template) => (
                    <option key={template.code} value={template.code}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {selectedTemplate ? (
                  <p className="text-[11px] text-on-surface-variant">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Department</label>
                <div className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl text-sm font-bold">
                  {authActor?.departmentId ?? 'No department'}
                </div>
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
                <select
                  value={formData.vendorCode}
                  onChange={(event) => {
                    const selectedVendor = vendors.find((entry) => entry.code === event.target.value);
                    setFormData((current) => ({
                      ...current,
                      vendorCode: event.target.value,
                      payeeName: selectedVendor?.name ?? current.payeeName,
                      currency: selectedVendor?.currency ?? current.currency,
                    }));
                  }}
                  disabled={vendors.length === 0}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                >
                  {vendors.length === 0 ? <option value="">No vendors available</option> : null}
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.code}>
                      {vendor.code} - {vendor.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.payeeName}
                  onChange={(event) => updateField('payeeName', event.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                />
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
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg tracking-tight">Approval Preview</h3>
                  <p className="text-xs font-medium text-on-surface-variant">
                    Backend resolves the default flow first. You can override only the Line Manager step before submit.
                  </p>
                </div>
              </div>
              {isLoadingWorkflowPreview ? (
                <div className="text-xs font-bold text-on-surface-variant">Refreshing...</div>
              ) : null}
            </div>

            <div className="space-y-3">
              {(workflowPreview?.steps ?? []).map((step, index) => {
                const isLineManagerStep = step.stepCode === lineManagerStepCode;
                const isSkippedPreview = Boolean(step.willBeSkipped);
                return (
                  <div
                    key={`${step.stepCode}-${step.approverId}-${index}`}
                    className={`rounded-xl border px-4 py-4 transition-colors ${
                      isLineManagerStep
                        ? 'border-amber-200 bg-amber-50/80'
                        : 'border-surface-container-high bg-surface-container-low/55'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${isLineManagerStep ? 'bg-white text-amber-700' : 'bg-white text-on-surface-variant'}`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${isLineManagerStep ? 'text-amber-950' : 'text-on-surface'}`}>
                              {formatWorkflowStepLabel(step.stepCode)}
                            </p>
                            <p className={`${isLineManagerStep ? 'text-amber-800/80' : 'text-on-surface-variant'} text-xs`}>
                              {step.approverName}
                            </p>
                          </div>
                        </div>
                        {step.isOverridden ? (
                          <p className="text-[11px] font-medium text-amber-700">
                            Default: {step.defaultApproverName}
                          </p>
                        ) : null}
                        {isSkippedPreview ? (
                          <p className="text-[11px] font-medium text-rose-600">
                            {step.skippedReason ?? 'This step will be skipped after submit.'}
                          </p>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                        isSkippedPreview
                          ? 'bg-rose-100 text-rose-700'
                          : step.isOverridden
                            ? 'bg-amber-100 text-amber-700'
                            : isLineManagerStep
                              ? 'bg-white text-amber-700'
                              : 'bg-white text-on-surface-variant'
                      }`}>
                        {isSkippedPreview ? 'Skipped' : step.isOverridden ? 'Override' : isLineManagerStep ? 'Editable' : 'Locked'}
                      </span>
                    </div>

                    {isLineManagerStep ? (
                      <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4 border-t border-amber-200/70 pt-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-widest text-amber-900/80">
                            Change Line Manager
                          </label>
                          <select
                            value={lineManagerOverrideId}
                            onChange={(event) => setLineManagerOverrideId(event.target.value)}
                            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                          >
                            <option value="">Use default line manager</option>
                            {(workflowPreview?.lineManagerOverride?.candidates ?? []).map((candidate) => (
                              <option key={candidate.approverId} value={candidate.approverId}>
                                {candidate.approverName}
                                {candidate.positionCode ? ` • ${candidate.positionCode}` : ''}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-amber-900/70">
                            Original line manager will not receive this request after override.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-widest text-amber-900/80">
                            Override Reason
                          </label>
                          <textarea
                            rows={3}
                            value={lineManagerOverrideReason}
                            onChange={(event) => setLineManagerOverrideReason(event.target.value)}
                            placeholder="Why should this request go to a different line manager?"
                            disabled={!lineManagerOverrideId}
                            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20 disabled:bg-amber-50/40 disabled:text-on-surface-variant"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {!isLoadingWorkflowPreview && (workflowPreview?.steps?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-surface-container-high px-4 py-5 text-sm text-on-surface-variant">
                  No approver chain preview is available yet.
                </div>
              ) : null}

              {!isLoadingWorkflowPreview && (workflowPreview?.issues?.length ?? 0) > 0 ? (
                <div className="rounded-xl border border-surface-container-high bg-surface-container-low/55 px-4 py-4 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                    Workflow diagnostics
                  </p>
                  {workflowPreview.issues.map((issue) => (
                    <div
                      key={`${issue.code}-${issue.stepCode ?? 'global'}`}
                      className={`flex gap-2 text-xs ${issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}`}
                    >
                      <span className="mt-0.5">•</span>
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5">
          <div className="bg-white p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
            <h3 className="font-bold text-base tracking-tight">Documentation</h3>
            <label className="block border-2 border-dashed border-surface-container-high rounded-2xl p-6 text-center space-y-3 hover:border-secondary/40 transition-all cursor-pointer group">
              <input type="file" multiple className="hidden" onChange={handleAttachmentSelect} />
              <div className="w-10 h-10 bg-surface-container-low rounded-full flex items-center justify-center mx-auto group-hover:bg-secondary/10 transition-colors">
                <Upload className="text-on-surface-variant group-hover:text-secondary transition-colors" size={20} />
              </div>
              <div>
                <p className="text-[13px] font-bold">{isUploadingAttachments ? 'Uploading...' : 'Upload Invoices or Contracts'}</p>
                <p className="text-[11px] leading-relaxed text-on-surface-variant">Files upload to object storage immediately and link to the request on save or submit.</p>
              </div>
            </label>

            {attachments.length > 0 && (
              <div className="space-y-2.5">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-bold text-on-surface">{attachment.fileName}</p>
                      <p className="text-[10px] text-on-surface-variant">
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

          <div className="bg-primary text-white p-5 rounded-2xl shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="text-secondary" size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Governance Check</span>
            </div>

            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div>
                  <p className="text-[12px] font-bold">Validation Scope</p>
                  <p className="text-[10px] leading-relaxed text-white/45">Current backend enforces required fields, amount and at least one detail line.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div>
                  <p className="text-[12px] font-bold">Workflow Preview</p>
                  <p className="text-[10px] leading-relaxed text-white/45">Draft stays editable. Submit creates the workflow instance and the first pending approver assignment.</p>
                </div>
              </div>

              <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={12} className="text-secondary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Current Limitation</p>
                </div>
                <p className="text-[10px] text-white/80 leading-relaxed">Attachment binaries are uploaded to object storage first, then persisted with the request metadata and approval routing.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {paymentDetailsSection}
    </div>
  );
}

function FieldShell({
  label,
  hiddenLabel = false,
  children,
}: {
  label: string;
  hiddenLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label
        className={`text-[10px] font-black uppercase tracking-widest ${hiddenLabel ? 'text-transparent select-none' : 'text-on-surface-variant'}`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

