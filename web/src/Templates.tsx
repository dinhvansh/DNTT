import React, { useEffect, useMemo, useState } from 'react';
import { FileStack, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { createActorContext } from './api/paymentRequests';
import {
  createRequestTemplate,
  listRequestTemplates,
  updateRequestTemplate,
  type RequestTemplate,
} from './api/templates';

const FIELD_MASK_OPTIONS = [
  { key: 'bankAccountNumber', label: 'Bank Account Number' },
  { key: 'bankAccountName', label: 'Bank Account Name' },
  { key: 'bankName', label: 'Bank Name' },
];

const ATTACHMENT_TYPES = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'supporting_document', label: 'Supporting Document' },
  { key: 'bank_proof', label: 'Bank Proof' },
  { key: 'id_document', label: 'ID Document' },
];

const DETAIL_COLUMNS = [
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'invoiceRef', label: 'Invoice Ref' },
  { key: 'glCode', label: 'GL Code' },
  { key: 'costCenter', label: 'Cost Center' },
  { key: 'projectCode', label: 'Project' },
  { key: 'expenseTypeCode', label: 'Expense Type' },
  { key: 'currency', label: 'Currency' },
  { key: 'exchangeRate', label: 'Exchange Rate' },
  { key: 'totalAmount', label: 'Total Amount' },
  { key: 'note', label: 'Note' },
];

const VISIBILITY_SCOPE_OPTIONS = [
  { key: 'requester', label: 'Requester' },
  { key: 'workflow_related', label: 'Workflow Related' },
  { key: 'finance', label: 'Finance' },
  { key: 'admin', label: 'Admin' },
  { key: 'department_viewer', label: 'Department Viewer' },
];

type TemplateEditorState = Omit<RequestTemplate, 'id' | 'version'>;

function createBlankTemplate(): TemplateEditorState {
  return {
    code: '',
    name: '',
    requestType: 'payment_request',
    description: '',
    visibilityMode: 'related_only',
    isActive: true,
    formSchema: { fieldMasking: {} },
    detailSchema: { columns: {} },
    attachmentRules: {
      visibilityByType: {},
      requiredTypes: [],
    },
  };
}

function cloneTemplateToState(template: RequestTemplate): TemplateEditorState {
  return {
    code: template.code,
    name: template.name,
    requestType: template.requestType,
    description: template.description,
    visibilityMode: template.visibilityMode,
    isActive: template.isActive,
    formSchema: structuredClone(template.formSchema ?? {}),
    detailSchema: structuredClone(template.detailSchema ?? {}),
    attachmentRules: structuredClone(template.attachmentRules ?? {}),
  };
}

function toggleScope(scopes: string[], scope: string) {
  return scopes.includes(scope)
    ? scopes.filter((entry) => entry !== scope)
    : [...scopes, scope];
}

export default function Templates() {
  const { actor: authActor } = useAuth();
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
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('');
  const [editorState, setEditorState] = useState<TemplateEditorState>(createBlankTemplate());
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!actorContext) {
      return;
    }

    void listRequestTemplates(actorContext)
      .then((result) => {
        setTemplates(result.data);
        const first = result.data[0] ?? null;
        if (first) {
          setSelectedTemplateCode(first.code);
          setEditorState(cloneTemplateToState(first));
        }
      })
      .catch((error) => {
        toast.error('Unable to load templates', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      });
  }, [actorContext]);

  const selectedTemplate = useMemo(
    () => templates.find((entry) => entry.code === selectedTemplateCode) ?? null,
    [templates, selectedTemplateCode]
  );

  useEffect(() => {
    if (!selectedTemplate || isCreating) {
      return;
    }

    setEditorState(cloneTemplateToState(selectedTemplate));
  }, [selectedTemplate, isCreating]);

  const saveTemplate = async () => {
    if (!actorContext) {
      return;
    }

    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await createRequestTemplate(editorState, actorContext);
        setTemplates((current) => [...current, created.data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedTemplateCode(created.data.code);
        setEditorState(cloneTemplateToState(created.data));
        setIsCreating(false);
        toast.success('Template created');
      } else {
        const updated = await updateRequestTemplate(editorState.code, editorState, actorContext);
        setTemplates((current) =>
          current.map((entry) => (entry.code === updated.data.code ? updated.data : entry)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditorState(cloneTemplateToState(updated.data));
        toast.success('Template updated');
      }
    } catch (error) {
      toast.error('Unable to save template', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-on-surface">Request Templates</h1>
          <p className="text-sm font-medium text-on-surface-variant">
            Configure attachment visibility, field masking, and detail-column behavior by template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setSelectedTemplateCode('');
            setEditorState(createBlankTemplate());
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-secondary/10"
        >
          <Plus size={16} />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-surface-container-high bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-surface-container-low p-2 text-secondary">
              <FileStack size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Templates</h2>
              <p className="text-xs text-on-surface-variant">Active and draft configurations.</p>
            </div>
          </div>

          <div className="space-y-3">
            {templates.map((template) => (
              <button
                key={template.code}
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setSelectedTemplateCode(template.code);
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                  selectedTemplateCode === template.code && !isCreating
                    ? 'border-secondary bg-secondary/5'
                    : 'border-surface-container-high bg-surface-container-low/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">{template.name}</p>
                    <p className="text-xs font-medium text-on-surface-variant">{template.code}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                      template.isActive ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{template.description || 'No description.'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-surface-container-high bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-on-surface">
                {isCreating ? 'Create Template' : editorState.name || 'Template Editor'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Keep the config tight: visibility, masking, detail columns, and required attachments.
              </p>
            </div>
            <button
              type="button"
              onClick={saveTemplate}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-secondary/10 disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : isCreating ? 'Create Template' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Basics</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Field label="Template Code">
                  <input
                    value={editorState.code}
                    onChange={(event) =>
                      setEditorState((current) => ({
                        ...current,
                        code: event.target.value.toLowerCase(),
                      }))
                    }
                    disabled={!isCreating}
                    className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none disabled:opacity-60"
                  />
                </Field>
                <Field label="Template Name">
                  <input
                    value={editorState.name}
                    onChange={(event) => setEditorState((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none"
                  />
                </Field>
                <Field label="Visibility Mode">
                  <select
                    value={editorState.visibilityMode}
                    onChange={(event) => setEditorState((current) => ({ ...current, visibilityMode: event.target.value }))}
                    className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none"
                  >
                    <option value="related_only">Related Only</option>
                    <option value="related_and_same_department">Related + Same Department</option>
                    <option value="finance_shared">Finance Shared</option>
                  </select>
                </Field>
                <Field label="Status">
                  <label className="flex items-center gap-3 rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={editorState.isActive}
                      onChange={(event) => setEditorState((current) => ({ ...current, isActive: event.target.checked }))}
                    />
                    Active template
                  </label>
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={editorState.description}
                  onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none"
                />
              </Field>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Field Masking</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {FIELD_MASK_OPTIONS.map((field) => {
                  const config = editorState.formSchema.fieldMasking?.[field.key] ?? { enabled: false, visibleTo: [] };
                  return (
                    <div key={field.key} className="rounded-2xl border border-surface-container-high bg-surface-container-low/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{field.label}</p>
                        <label className="flex items-center gap-2 text-xs font-bold">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(event) =>
                              setEditorState((current) => ({
                                ...current,
                                formSchema: {
                                  ...current.formSchema,
                                  fieldMasking: {
                                    ...(current.formSchema.fieldMasking ?? {}),
                                    [field.key]: {
                                      enabled: event.target.checked,
                                      visibleTo: config.visibleTo,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          Mask
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {VISIBILITY_SCOPE_OPTIONS.map((scope) => (
                          <button
                            key={scope.key}
                            type="button"
                            onClick={() =>
                              setEditorState((current) => ({
                                ...current,
                                formSchema: {
                                  ...current.formSchema,
                                  fieldMasking: {
                                    ...(current.formSchema.fieldMasking ?? {}),
                                    [field.key]: {
                                      enabled: current.formSchema.fieldMasking?.[field.key]?.enabled ?? false,
                                      visibleTo: toggleScope(
                                        current.formSchema.fieldMasking?.[field.key]?.visibleTo ?? [],
                                        scope.key
                                      ),
                                    },
                                  },
                                },
                              }))
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                              config.visibleTo.includes(scope.key)
                                ? 'bg-secondary text-white'
                                : 'bg-white text-on-surface-variant'
                            }`}
                          >
                            {scope.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Attachment Visibility</h3>
              <div className="space-y-4">
                {ATTACHMENT_TYPES.map((attachment) => {
                  const config = editorState.attachmentRules.visibilityByType?.[attachment.key] ?? {
                    sensitive: attachment.key !== 'invoice' && attachment.key !== 'supporting_document',
                    visibleTo: [],
                  };
                  return (
                    <div key={attachment.key} className="rounded-2xl border border-surface-container-high bg-surface-container-low/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">{attachment.label}</p>
                          <p className="text-xs text-on-surface-variant">{attachment.key}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs font-bold">
                            <input
                              type="checkbox"
                              checked={editorState.attachmentRules.requiredTypes?.includes(attachment.key) ?? false}
                              onChange={() =>
                                setEditorState((current) => ({
                                  ...current,
                                  attachmentRules: {
                                    ...current.attachmentRules,
                                    requiredTypes: (current.attachmentRules.requiredTypes ?? []).includes(attachment.key)
                                      ? (current.attachmentRules.requiredTypes ?? []).filter((entry) => entry !== attachment.key)
                                      : [...(current.attachmentRules.requiredTypes ?? []), attachment.key],
                                  },
                                }))
                              }
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold">
                            <input
                              type="checkbox"
                              checked={config.sensitive}
                              onChange={(event) =>
                                setEditorState((current) => ({
                                  ...current,
                                  attachmentRules: {
                                    ...current.attachmentRules,
                                    visibilityByType: {
                                      ...(current.attachmentRules.visibilityByType ?? {}),
                                      [attachment.key]: {
                                        sensitive: event.target.checked,
                                        visibleTo: current.attachmentRules.visibilityByType?.[attachment.key]?.visibleTo ?? [],
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                            Sensitive
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {VISIBILITY_SCOPE_OPTIONS.map((scope) => (
                          <button
                            key={scope.key}
                            type="button"
                            onClick={() =>
                              setEditorState((current) => ({
                                ...current,
                                attachmentRules: {
                                  ...current.attachmentRules,
                                  visibilityByType: {
                                    ...(current.attachmentRules.visibilityByType ?? {}),
                                    [attachment.key]: {
                                      sensitive: current.attachmentRules.visibilityByType?.[attachment.key]?.sensitive ?? false,
                                      visibleTo: toggleScope(
                                        current.attachmentRules.visibilityByType?.[attachment.key]?.visibleTo ?? [],
                                        scope.key
                                      ),
                                    },
                                  },
                                },
                              }))
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                              config.visibleTo.includes(scope.key)
                                ? 'bg-secondary text-white'
                                : 'bg-white text-on-surface-variant'
                            }`}
                          >
                            {scope.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Detail Columns</h3>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {DETAIL_COLUMNS.map((column) => {
                  const config = editorState.detailSchema.columns?.[column.key] ?? { visible: true, required: false };
                  return (
                    <div key={column.key} className="flex items-center justify-between rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3">
                      <div>
                        <p className="text-sm font-bold">{column.label}</p>
                        <p className="text-xs text-on-surface-variant">{column.key}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={config.visible}
                            onChange={(event) =>
                              setEditorState((current) => ({
                                ...current,
                                detailSchema: {
                                  ...current.detailSchema,
                                  columns: {
                                    ...(current.detailSchema.columns ?? {}),
                                    [column.key]: {
                                      visible: event.target.checked,
                                      required: current.detailSchema.columns?.[column.key]?.required ?? false,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          Visible
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={config.required}
                            onChange={(event) =>
                              setEditorState((current) => ({
                                ...current,
                                detailSchema: {
                                  ...current.detailSchema,
                                  columns: {
                                    ...(current.detailSchema.columns ?? {}),
                                    [column.key]: {
                                      visible: current.detailSchema.columns?.[column.key]?.visible ?? true,
                                      required: event.target.checked,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          Required
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}
