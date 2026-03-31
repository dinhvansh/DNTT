import React, { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCcw, Save, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  listErpReferenceValues,
  listErpSyncRuns,
  syncErpReferenceValues,
  type ErpReferenceValue,
  type ErpSyncRun,
} from './api/masterData';
import { createActorContext } from './api/paymentRequests';

const referenceTypeOptions = [
  { code: 'expense_type', label: 'Expense Type' },
  { code: 'gl_account', label: 'GL Account' },
  { code: 'cost_center', label: 'Cost Center' },
  { code: 'project', label: 'Project' },
];

export default function ERPReferenceMaster() {
  const { actor: authActor } = useAuth();
  const [references, setReferences] = useState<ErpReferenceValue[]>([]);
  const [selectedType, setSelectedType] = useState('expense_type');
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [syncRuns, setSyncRuns] = useState<ErpSyncRun[]>([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    parentCode: '',
    currency: '',
    isActive: true,
  });

  const actorContext = useMemo(() => {
    if (!authActor) {
      return null;
    }

    return createActorContext({
      userId: authActor.userId,
      departmentId: authActor.departmentId,
      permissions: authActor.permissions,
    });
  }, [authActor]);

  const filteredReferences = useMemo(
    () =>
      references
        .filter((entry) => entry.referenceType === selectedType)
        .sort((left, right) => left.code.localeCompare(right.code)),
    [references, selectedType]
  );

  const selectedReference = useMemo(
    () => filteredReferences.find((entry) => entry.id === selectedReferenceId) ?? null,
    [filteredReferences, selectedReferenceId]
  );

  const resetForm = (reference?: ErpReferenceValue | null) => {
    setForm({
      code: reference?.code ?? '',
      name: reference?.name ?? '',
      parentCode: reference?.parentCode ?? '',
      currency: reference?.currency ?? '',
      isActive: reference?.isActive ?? true,
    });
  };

  const loadReferences = async () => {
    if (!actorContext) {
      setLoading(false);
      return;
    }

    const [referenceResult, syncRunResult] = await Promise.all([
      listErpReferenceValues(actorContext),
      listErpSyncRuns(actorContext),
    ]);
    setReferences(referenceResult.data);
    setSyncRuns(syncRunResult.data);
  };

  useEffect(() => {
    loadReferences()
      .catch((error) => {
        console.error(error);
        toast.error('Unable to load ERP reference master', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      })
      .finally(() => setLoading(false));
  }, [actorContext]);

  useEffect(() => {
    if (!selectedReferenceId && filteredReferences.length > 0) {
      const first = filteredReferences[0];
      setSelectedReferenceId(first.id);
      resetForm(first);
      return;
    }

    if (selectedReference && selectedReference.referenceType === selectedType) {
      resetForm(selectedReference);
      return;
    }

    if (filteredReferences.length === 0) {
      setSelectedReferenceId(null);
      resetForm(null);
    }
  }, [filteredReferences, selectedReference, selectedReferenceId, selectedType]);

  const handleSelectReference = (reference: ErpReferenceValue) => {
    setSelectedReferenceId(reference.id);
    resetForm(reference);
  };

  const handleCreateNew = () => {
    setSelectedReferenceId(null);
    resetForm(null);
  };

  const handleSave = async () => {
    if (!actorContext) {
      return;
    }

    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name are required.');
      return;
    }

    setIsSaving(true);
    try {
      await syncErpReferenceValues(
        {
          referenceType: selectedType,
          values: [
            {
              referenceType: selectedType,
              code: form.code.trim(),
              name: form.name.trim(),
              parentCode: form.parentCode.trim() || null,
              currency: form.currency.trim() || null,
              isActive: form.isActive,
              syncSource: 'manual',
            },
          ],
        },
        actorContext
      );

      await loadReferences();
      toast.success(selectedReferenceId ? 'ERP reference updated' : 'ERP reference created');

      const refreshed = references.find(
        (entry) => entry.referenceType === selectedType && entry.code === form.code.trim()
      );
      if (refreshed) {
        setSelectedReferenceId(refreshed.id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to save ERP reference', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadReferences();
      toast.success('ERP reference master refreshed');
    } catch (error) {
      console.error(error);
      toast.error('Unable to refresh ERP reference master', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!actorContext) {
      return;
    }

    const lines = bulkImportText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('Paste at least one line to import.');
      return;
    }

    const values = [];
    for (const line of lines) {
      const [codeRaw, nameRaw, parentCodeRaw, currencyRaw, activeRaw] = line.split('|').map((entry) => entry.trim());
      if (!codeRaw || !nameRaw) {
        toast.error('Each line must contain at least code and name.', {
          description: `Invalid line: ${line}`,
        });
        return;
      }

      values.push({
        referenceType: selectedType,
        code: codeRaw,
        name: nameRaw,
        parentCode: parentCodeRaw || null,
        currency: currencyRaw || null,
        isActive: activeRaw ? activeRaw.toLowerCase() !== 'false' : true,
        syncSource: 'bulk_import',
      });
    }

    setIsSaving(true);
    try {
      await syncErpReferenceValues(
        {
          referenceType: selectedType,
          values,
        },
        actorContext
      );
      await loadReferences();
      setBulkImportText('');
      toast.success('Bulk ERP reference import completed', {
        description: `${values.length} code(s) synced.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to import ERP references', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[1760px] mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-on-surface">ERP Reference Master</h1>
          <p className="text-sm text-on-surface-variant font-medium mt-2">
            Maintain ERP-facing codes before finance releases requests to downstream integration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-surface-container-high bg-white px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
        <section className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-high">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Reference Groups</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Choose a reference type, then edit codes on the right.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3">
            {referenceTypeOptions.map((option) => {
              const count = references.filter((entry) => entry.referenceType === option.code).length;
              const isActive = selectedType === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    setSelectedType(option.code);
                    setSelectedReferenceId(null);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                    isActive
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-surface-container-high bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest">{count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_420px] gap-8">
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight">
                  {referenceTypeOptions.find((entry) => entry.code === selectedType)?.label}
                </h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Codes shown here are used by request entry and ERP readiness validation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm font-bold text-white hover:bg-secondary-container"
              >
                <PlusCircle size={16} />
                New Code
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-surface-container-low text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-3 text-left">Code</th>
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Source</th>
                    <th className="px-5 py-3 text-left">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {filteredReferences.map((reference) => (
                    <tr
                      key={reference.id}
                      className={`cursor-pointer text-sm transition-colors ${
                        reference.id === selectedReferenceId ? 'bg-secondary/5' : 'hover:bg-surface-container-low'
                      }`}
                      onClick={() => handleSelectReference(reference)}
                    >
                      <td className="px-5 py-4 font-mono font-bold">{reference.code}</td>
                      <td className="px-5 py-4 font-medium">{reference.name}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            reference.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {reference.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-on-surface-variant">{reference.syncSource}</td>
                      <td className="px-5 py-4 text-on-surface-variant">
                        {reference.lastSyncedAt ? new Date(reference.lastSyncedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredReferences.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-on-surface-variant">
                        No ERP references found for this type.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high">
              <h2 className="text-lg font-black tracking-tight">
                {selectedReferenceId ? 'Edit ERP Reference' : 'Create ERP Reference'}
              </h2>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Update one code at a time. Save will upsert through the ERP reference sync API.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <Field label="Reference Type">
                <div className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-bold">
                  {referenceTypeOptions.find((entry) => entry.code === selectedType)?.label}
                </div>
              </Field>

              <Field label="Code">
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  className="w-full rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="service_fee"
                />
              </Field>

              <Field label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="Service Fee"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Parent Code">
                  <input
                    type="text"
                    value={form.parentCode}
                    onChange={(event) => setForm((current) => ({ ...current, parentCode: event.target.value }))}
                    className="w-full rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                    className="w-full rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                    placeholder="Optional"
                  />
                </Field>
              </div>

              <Field label="Status">
                <div className="flex items-center gap-3 rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3">
                  <input
                    id="erp-reference-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-surface-container-high"
                  />
                  <label htmlFor="erp-reference-active" className="text-sm font-medium text-on-surface">
                    Active and selectable in request flow
                  </label>
                </div>
              </Field>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-white hover:bg-secondary-container disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : selectedReferenceId ? 'Save Changes' : 'Create Reference'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high">
              <h2 className="text-lg font-black tracking-tight">Bulk Import</h2>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Format per line: <span className="font-mono">code | name | parentCode | currency | active</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={bulkImportText}
                onChange={(event) => setBulkImportText(event.target.value)}
                rows={8}
                className="w-full rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/20"
                placeholder={`service_fee | Service Fee\ntravel_expense | Travel Expense\nCC-OPS | Operations Cost Center | | VND | true`}
              />

              <button
                type="button"
                onClick={() => void handleBulkImport()}
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-container-high bg-white px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
              >
                <PlusCircle size={16} />
                Import Lines
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-container-high flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight">Recent Sync History</h2>
                <p className="text-xs text-on-surface-variant font-medium mt-1">
                  Who synced ERP references and when.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rows = filteredReferences.map((entry) => ([
                    entry.referenceType,
                    entry.code,
                    entry.name,
                    entry.parentCode ?? '',
                    entry.currency ?? '',
                    entry.isActive ? 'true' : 'false',
                    entry.syncSource,
                    entry.lastSyncedAt ?? '',
                  ]));
                  const csv = [
                    ['referenceType', 'code', 'name', 'parentCode', 'currency', 'isActive', 'syncSource', 'lastSyncedAt'].join(','),
                    ...rows.map((columns) => columns.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
                  ].join('\r\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${selectedType}-references.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-2xl border border-surface-container-high bg-white px-4 py-2 text-xs font-bold hover:bg-surface-container-low"
              >
                Export CSV
              </button>
            </div>

            <div className="divide-y divide-surface-container-high">
              {syncRuns.length === 0 ? (
                <div className="px-6 py-8 text-sm text-on-surface-variant">No sync history recorded yet.</div>
              ) : (
                syncRuns.map((run) => (
                  <div key={run.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">{run.referenceType.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-on-surface-variant">
                          {run.triggeredByName ?? run.triggeredBy ?? 'Unknown actor'} • {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{run.status}</p>
                        <p className="text-sm font-bold">{run.recordsUpserted} record(s)</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}
