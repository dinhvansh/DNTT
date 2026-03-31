import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  Building2,
  CheckCircle2,
  GitBranch,
  Save,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  createDepartment,
  getApprovalSetup,
  updateDepartmentApprovalSetup,
  updateGlobalApproverConfig,
  type ApprovalDepartment,
  type GlobalApproverConfig,
  type SetupPosition,
  type SetupUser,
} from './api/approvalSetup';
import { createActorContext } from './api/paymentRequests';

function emptyDepartmentForm() {
  return {
    reviewerUserId: '',
    reviewerPositionCode: '',
    hodUserId: '',
    hodPositionCode: '',
    fallbackUserId: '',
    fallbackPositionCode: '',
    stepOrder: ['line_manager', 'reviewer', 'hod'],
  };
}

function emptyGlobalForm() {
  return {
    cfoPositionCode: '',
    ceoPositionCode: '',
    cfoAmountThreshold: '',
    ceoAmountThreshold: '',
  };
}

const localStepOptions = [
  { code: 'line_manager', label: 'Line Manager', hint: 'Pulled from each requester profile.' },
  { code: 'reviewer', label: 'Reviewer', hint: 'Optional business review layer inside the department.' },
  { code: 'hod', label: 'HOD', hint: 'Department head control point before escalation.' },
];

function formatPositionLabel(positionCode: string | null | undefined, positions: SetupPosition[]) {
  if (!positionCode) {
    return 'Not assigned';
  }

  return positions.find((entry) => entry.code === positionCode)?.name ?? positionCode;
}

function resolveDepartmentAssignee({
  users,
  selectedUserId,
  departmentCode,
  positionCode,
}: {
  users: SetupUser[];
  selectedUserId: string | null | undefined;
  departmentCode: string | null;
  positionCode: string | null | undefined;
}) {
  if (selectedUserId) {
    return users.find((entry) => entry.id === selectedUserId) ?? null;
  }

  if (!departmentCode || !positionCode) {
    return null;
  }

  return (
    users.find(
      (entry) =>
        entry.departmentId === departmentCode &&
        entry.positionCode === positionCode
    ) ?? null
  );
}

export default function ApprovalSetup() {
  const { actor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [departments, setDepartments] = useState<ApprovalDepartment[]>([]);
  const [positions, setPositions] = useState<SetupPosition[]>([]);
  const [users, setUsers] = useState<SetupUser[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalApproverConfig | null>(null);
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('');
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm());
  const [globalForm, setGlobalForm] = useState(emptyGlobalForm());
  const [newDepartment, setNewDepartment] = useState({ code: '', name: '' });

  const canManage = actor?.permissions.includes('manage_department_setup') ?? false;
  const actorContext = useMemo(
    () =>
      actor
        ? createActorContext({
            userId: actor.userId,
            departmentId: actor.departmentId,
            permissions: actor.permissions,
          })
        : null,
    [actor]
  );

  useEffect(() => {
    if (!actorContext || !canManage) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const result = await getApprovalSetup(actorContext);
        setDepartments(result.data.departments);
        setPositions(result.data.positions);
        setUsers(result.data.users);
        setGlobalConfig(result.data.globalConfig);
        setSelectedDepartmentCode((current) =>
          result.data.departments.some((entry) => entry.code === current)
            ? current
            : (result.data.departments[0]?.code ?? '')
        );
      } catch (error) {
        toast.error('Unable to load approval setup', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [actorContext, canManage]);

  const selectedDepartment = useMemo(
    () => departments.find((entry) => entry.code === selectedDepartmentCode) ?? null,
    [departments, selectedDepartmentCode]
  );

  useEffect(() => {
    if (!selectedDepartment) {
      setDepartmentForm(emptyDepartmentForm());
      return;
    }

    setDepartmentForm({
      reviewerUserId: selectedDepartment.setup.reviewerUserId ?? '',
      reviewerPositionCode: selectedDepartment.setup.reviewerPositionCode ?? '',
      hodUserId: selectedDepartment.setup.hodUserId ?? '',
      hodPositionCode: selectedDepartment.setup.hodPositionCode ?? '',
      fallbackUserId: selectedDepartment.setup.fallbackUserId ?? '',
      fallbackPositionCode: selectedDepartment.setup.fallbackPositionCode ?? '',
      stepOrder: selectedDepartment.setup.stepOrder?.length
        ? selectedDepartment.setup.stepOrder
        : ['line_manager', 'reviewer', 'hod'],
    });
  }, [selectedDepartment]);

  useEffect(() => {
    if (!globalConfig) {
      setGlobalForm(emptyGlobalForm());
      return;
    }

    setGlobalForm({
      cfoPositionCode: globalConfig.cfoPositionCode ?? '',
      ceoPositionCode: globalConfig.ceoPositionCode ?? '',
      cfoAmountThreshold: globalConfig.cfoAmountThreshold?.toString() ?? '',
      ceoAmountThreshold: globalConfig.ceoAmountThreshold?.toString() ?? '',
    });
  }, [globalConfig]);

  const globalPositionOptions = useMemo(
    () => positions.filter((entry) => entry.isGlobal && entry.isActive),
    [positions]
  );

  const departmentUsers = useMemo(
    () =>
      users
        .filter((entry) => entry.departmentId === selectedDepartmentCode)
        .sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [selectedDepartmentCode, users]
  );

  const departmentUserOptions = useMemo(
    () =>
      departmentUsers.map((entry) => ({
        value: entry.id,
        label: `${entry.fullName} • ${formatPositionLabel(entry.positionCode, positions)}`,
      })),
    [departmentUsers, positions]
  );

  const resolvedReviewer = useMemo(
    () =>
      resolveDepartmentAssignee({
        users,
        selectedUserId: departmentForm.reviewerUserId,
        departmentCode: selectedDepartmentCode,
        positionCode: departmentForm.reviewerPositionCode,
      }),
    [departmentForm.reviewerPositionCode, departmentForm.reviewerUserId, selectedDepartmentCode, users]
  );

  const resolvedHod = useMemo(
    () =>
      resolveDepartmentAssignee({
        users,
        selectedUserId: departmentForm.hodUserId,
        departmentCode: selectedDepartmentCode,
        positionCode: departmentForm.hodPositionCode,
      }),
    [departmentForm.hodPositionCode, departmentForm.hodUserId, selectedDepartmentCode, users]
  );

  const resolvedFallback = useMemo(
    () =>
      resolveDepartmentAssignee({
        users,
        selectedUserId: departmentForm.fallbackUserId,
        departmentCode: selectedDepartmentCode,
        positionCode: departmentForm.fallbackPositionCode,
      }),
    [departmentForm.fallbackPositionCode, departmentForm.fallbackUserId, selectedDepartmentCode, users]
  );

  const resolvedCfo = useMemo(
    () => users.find((entry) => entry.positionCode === globalForm.cfoPositionCode) ?? null,
    [globalForm.cfoPositionCode, users]
  );

  const resolvedCeo = useMemo(
    () => users.find((entry) => entry.positionCode === globalForm.ceoPositionCode) ?? null,
    [globalForm.ceoPositionCode, users]
  );

  const departmentHealth = useMemo(() => {
    const issues = [];
    if (!selectedDepartment) {
      return issues;
    }
    if (!departmentForm.hodUserId && !departmentForm.hodPositionCode) {
      issues.push('HOD is not mapped yet.');
    }
    if ((departmentForm.hodUserId || departmentForm.hodPositionCode) && !resolvedHod) {
      issues.push('HOD is mapped, but no active user could be resolved.');
    }
    if ((departmentForm.reviewerUserId || departmentForm.reviewerPositionCode) && !resolvedReviewer) {
      issues.push('Reviewer is mapped, but no active user could be resolved.');
    }
    if (!departmentUsers.length) {
      issues.push('This department currently has no active users in master data.');
    }
    return issues;
  }, [departmentForm.hodPositionCode, departmentForm.hodUserId, departmentForm.reviewerPositionCode, departmentForm.reviewerUserId, departmentUsers.length, resolvedHod, resolvedReviewer, selectedDepartment]);

  const saveDepartmentSetup = async () => {
    if (!actorContext || !selectedDepartment) {
      return;
    }

    setSavingDepartment(true);
    try {
      const result = await updateDepartmentApprovalSetup(
        selectedDepartment.code,
        {
          reviewerUserId: departmentForm.reviewerUserId || null,
          reviewerPositionCode: departmentForm.reviewerPositionCode || null,
          hodUserId: departmentForm.hodUserId || null,
          hodPositionCode: departmentForm.hodPositionCode || null,
          fallbackUserId: departmentForm.fallbackUserId || null,
          fallbackPositionCode: departmentForm.fallbackPositionCode || null,
          stepOrder: departmentForm.stepOrder,
        },
        actorContext
      );

      setDepartments((current) =>
        current.map((entry) => (entry.code === result.data.code ? result.data : entry))
      );
      toast.success('Department approval setup saved');
    } catch (error) {
      toast.error('Unable to save department setup', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSavingDepartment(false);
    }
  };

  const saveGlobalSetup = async () => {
    if (!actorContext) {
      return;
    }

    setSavingGlobal(true);
    try {
      const result = await updateGlobalApproverConfig(
        {
          cfoPositionCode: globalForm.cfoPositionCode || null,
          ceoPositionCode: globalForm.ceoPositionCode || null,
          cfoAmountThreshold: globalForm.cfoAmountThreshold ? Number(globalForm.cfoAmountThreshold) : null,
          ceoAmountThreshold: globalForm.ceoAmountThreshold ? Number(globalForm.ceoAmountThreshold) : null,
        },
        actorContext
      );

      setGlobalConfig(result.data);
      toast.success('Global approver config saved');
    } catch (error) {
      toast.error('Unable to save global config', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleCreateDepartment = async () => {
    if (!actorContext) {
      return;
    }

    setCreatingDepartment(true);
    try {
      const result = await createDepartment(
        {
          code: newDepartment.code.trim().toLowerCase(),
          name: newDepartment.name.trim(),
        },
        actorContext
      );

      setDepartments((current) => [...current, result.data].sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedDepartmentCode(result.data.code);
      setNewDepartment({ code: '', name: '' });
      toast.success('Department created');
    } catch (error) {
      toast.error('Unable to create department', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCreatingDepartment(false);
    }
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setDepartmentForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.stepOrder.length) {
        return current;
      }

      const next = [...current.stepOrder];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return {
        ...current,
        stepOrder: next,
      };
    });
  };

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-3xl p-8 space-y-4">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertCircle size={24} />
          <h1 className="text-2xl font-black tracking-tight">Organization Setup Locked</h1>
        </div>
        <p className="text-sm text-amber-900/80">
          The current account does not have the `manage_department_setup` permission. Sign in with `sysadmin@example.com / 1234`.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1760px] mx-auto">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-on-surface tracking-tighter">Organization Structure</h1>
          <p className="max-w-4xl text-on-surface-variant font-medium">
            Build approval routing from the department structure first: Line Manager comes from the requester profile, Reviewer is optional, and HOD / fallback / finance escalation are mapped here for each department.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-surface-container-high rounded-3xl p-8 text-sm text-on-surface-variant">
          Loading organization structure...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">Departments</h2>
                  <p className="text-xs text-on-surface-variant">Create a department, then open it to map the approval chain.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <input
                  value={newDepartment.code}
                  onChange={(event) => setNewDepartment((current) => ({ ...current, code: event.target.value }))}
                  className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="department-code"
                />
                <input
                  value={newDepartment.name}
                  onChange={(event) => setNewDepartment((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                  placeholder="Department name"
                />
                <button
                  onClick={() => void handleCreateDepartment()}
                  disabled={creatingDepartment || !newDepartment.code.trim() || !newDepartment.name.trim()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  <UserPlus size={16} />
                  {creatingDepartment ? 'Creating...' : 'Create Department'}
                </button>
              </div>

              <div className="space-y-2">
                {departments.map((department) => {
                  const isSelected = selectedDepartmentCode === department.code;
                  const isHealthy =
                    department.setup.isActive &&
                    Boolean(department.setup.hodUserId || department.setup.hodPositionCode);
                  return (
                    <button
                      key={department.code}
                      onClick={() => setSelectedDepartmentCode(department.code)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                        isSelected
                          ? 'border-secondary bg-secondary/10'
                          : 'border-surface-container-high bg-surface-container-low hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{department.name}</p>
                          <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">{department.code}</p>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isHealthy ? 'Ready' : 'Needs setup'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                  <GitBranch size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">
                    {selectedDepartment ? `${selectedDepartment.name} Organization Chain` : 'Organization Chain'}
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    This screen is the source of truth for department-level routing. Requester Line Manager still comes from the user profile in Master Data.
                  </p>
                </div>
              </div>

              {selectedDepartment ? (
                <>
                  <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6">
                    <div className="rounded-3xl border border-surface-container-high bg-surface-container-low/60 p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Department snapshot</p>
                          <h3 className="mt-1 text-lg font-black tracking-tight text-on-surface">{selectedDepartment.name}</h3>
                          <p className="text-xs text-on-surface-variant uppercase tracking-widest">{selectedDepartment.code}</p>
                        </div>
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${departmentHealth.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {departmentHealth.length === 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          {departmentHealth.length === 0 ? 'Healthy chain' : 'Needs attention'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <OrgRoleCard
                          title="Line Manager"
                          subtitle="Requester profile"
                          tone="blue"
                          assigneeName="Resolved from each requester"
                          assigneeMeta="Not mapped here"
                        />
                        <OrgRoleCard
                          title="Reviewer"
                          subtitle={
                            departmentForm.reviewerUserId
                              ? 'Direct user assignment'
                              : departmentForm.reviewerPositionCode
                                ? formatPositionLabel(departmentForm.reviewerPositionCode, positions)
                                : 'Optional step'
                          }
                          tone="violet"
                          assigneeName={resolvedReviewer?.fullName ?? 'Optional / not assigned'}
                          assigneeMeta={resolvedReviewer?.email ?? 'This step can be skipped for departments without reviewer.'}
                        />
                        <OrgRoleCard
                          title="HOD"
                          subtitle={
                            departmentForm.hodUserId
                              ? 'Direct user assignment'
                              : departmentForm.hodPositionCode
                                ? formatPositionLabel(departmentForm.hodPositionCode, positions)
                                : 'Required department approver'
                          }
                          tone="emerald"
                          assigneeName={resolvedHod?.fullName ?? 'Not assigned'}
                          assigneeMeta={resolvedHod?.email ?? 'Map a HOD position and active user to complete this layer.'}
                        />
                        <OrgRoleCard
                          title="Fallback"
                          subtitle={departmentForm.fallbackUserId ? 'Direct user assignment' : formatPositionLabel(departmentForm.fallbackPositionCode, positions)}
                          tone="amber"
                          assigneeName={resolvedFallback?.fullName ?? 'Not assigned'}
                          assigneeMeta={resolvedFallback?.email ?? 'Used when primary routing cannot resolve a valid approver.'}
                        />
                      </div>

                      <div className="rounded-2xl bg-white border border-surface-container-high p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <ArrowDownUp size={16} className="text-secondary" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Local flow order</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {departmentForm.stepOrder.map((stepCode, index) => {
                            const step = localStepOptions.find((entry) => entry.code === stepCode);
                            return (
                              <div key={`${stepCode}-${index}`} className="min-w-[220px] flex-1 rounded-2xl border border-surface-container-high bg-surface-container-low px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Step {index + 1}</p>
                                    <p className="text-sm font-black text-on-surface">{step?.label ?? stepCode}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => moveStep(index, -1)}
                                      disabled={index === 0}
                                      className="rounded-xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveStep(index, 1)}
                                      disabled={index === departmentForm.stepOrder.length - 1}
                                      className="rounded-xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
                                    >
                                      Down
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-on-surface-variant">{step?.hint ?? 'Department-local approval routing step.'}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-surface-container-high bg-surface-container-low/60 p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-2xl bg-primary/10 text-primary">
                            <Users size={18} />
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Who is in this department</p>
                            <h3 className="text-base font-black tracking-tight text-on-surface">{departmentUsers.length} active people</h3>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          {departmentUsers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-surface-container-high bg-white px-4 py-5 text-sm text-on-surface-variant">
                              No active users are assigned to this department yet.
                            </div>
                          ) : (
                            departmentUsers.map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-surface-container-high bg-white px-4 py-3">
                                <p className="text-sm font-bold text-on-surface">{entry.fullName}</p>
                                <p className="text-xs text-on-surface-variant">{entry.email}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                                    {formatPositionLabel(entry.positionCode, positions)}
                                  </span>
                                  {entry.id === resolvedReviewer?.id ? (
                                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-700">
                                      Reviewer
                                    </span>
                                  ) : null}
                                  {entry.id === resolvedHod?.id ? (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                      HOD
                                    </span>
                                  ) : null}
                                  {entry.id === resolvedFallback?.id ? (
                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                      Fallback
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-surface-container-high bg-primary p-5 text-white space-y-4">
                        <div className="flex items-center gap-3">
                          <ShieldCheck size={18} className="text-secondary" />
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Design rule</p>
                            <h3 className="text-base font-black tracking-tight">Org chart first</h3>
                          </div>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed">
                          Keep department routing as simple as possible: Line Manager comes from the requester profile, Reviewer is optional by department, and HOD must be stable before any escalation logic can be trusted.
                        </p>
                        {departmentHealth.length > 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                            {departmentHealth.map((issue) => (
                              <div key={issue} className="flex gap-2 text-xs text-white/85">
                                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-300" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                            This department has enough mapping to preview a stable approval chain.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SelectField
                      label="Reviewer User"
                      value={departmentForm.reviewerUserId}
                      options={departmentUserOptions}
                      onChange={(value) => setDepartmentForm((current) => ({ ...current, reviewerUserId: value }))}
                    />
                    <SelectField
                      label="HOD User"
                      value={departmentForm.hodUserId}
                      options={departmentUserOptions}
                      onChange={(value) => setDepartmentForm((current) => ({ ...current, hodUserId: value }))}
                    />
                    <SelectField
                      label="Fallback User"
                      value={departmentForm.fallbackUserId}
                      options={departmentUserOptions}
                      onChange={(value) => setDepartmentForm((current) => ({ ...current, fallbackUserId: value }))}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Save department mapping</p>
                      <p className="text-sm text-on-surface">
                        Local order only changes inside `Line Manager / Reviewer / HOD`. Finance escalation stays global.
                      </p>
                    </div>
                    <button
                      onClick={() => void saveDepartmentSetup()}
                      disabled={!selectedDepartment || savingDepartment}
                      className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Save size={16} />
                      {savingDepartment ? 'Saving...' : 'Save Department Setup'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Select a department to edit setup.</p>
              )}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Settings size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">Global Escalation Layer</h2>
                  <p className="text-sm text-on-surface-variant">
                    Keep the last finance escalation outside the department chart. Threshold only decides whether CFO / CEO appears.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField
                    label="CFO Position"
                    value={globalForm.cfoPositionCode}
                    options={globalPositionOptions.map((entry) => ({ value: entry.code, label: entry.name }))}
                    onChange={(value) => setGlobalForm((current) => ({ ...current, cfoPositionCode: value }))}
                  />
                  <SelectField
                    label="CEO Position"
                    value={globalForm.ceoPositionCode}
                    options={globalPositionOptions.map((entry) => ({ value: entry.code, label: entry.name }))}
                    onChange={(value) => setGlobalForm((current) => ({ ...current, ceoPositionCode: value }))}
                  />
                  <InputField
                    label="CFO Threshold"
                    value={globalForm.cfoAmountThreshold}
                    onChange={(value) => setGlobalForm((current) => ({ ...current, cfoAmountThreshold: value }))}
                    placeholder="500000"
                  />
                  <InputField
                    label="CEO Threshold"
                    value={globalForm.ceoAmountThreshold}
                    onChange={(value) => setGlobalForm((current) => ({ ...current, ceoAmountThreshold: value }))}
                    placeholder="1000000"
                  />
                </div>

                <div className="rounded-3xl border border-surface-container-high bg-surface-container-low/60 p-5 space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Resolved global approvers</p>
                  <OrgRoleCard
                    title="CFO"
                    subtitle={formatPositionLabel(globalForm.cfoPositionCode, positions)}
                    tone="blue"
                    assigneeName={resolvedCfo?.fullName ?? 'Not assigned'}
                    assigneeMeta={resolvedCfo?.email ?? 'Map a global finance position first.'}
                    compact
                  />
                  <OrgRoleCard
                    title="CEO"
                    subtitle={formatPositionLabel(globalForm.ceoPositionCode, positions)}
                    tone="rose"
                    assigneeName={resolvedCeo?.fullName ?? 'Not assigned'}
                    assigneeMeta={resolvedCeo?.email ?? 'Map the final executive approver here.'}
                    compact
                  />
                  <div className="rounded-2xl bg-white border border-surface-container-high px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Company scope</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{globalConfig?.companyCode ?? 'default'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Save global escalation</p>
                  <p className="text-sm text-on-surface">CFO and CEO positions remain the last finance control points for high-value requests.</p>
                </div>
                <button
                  onClick={() => void saveGlobalSetup()}
                  disabled={savingGlobal}
                  className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingGlobal ? 'Saving...' : 'Save Global Config'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
      >
        <option value="">Not assigned</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
      />
    </div>
  );
}

function OrgRoleCard({
  title,
  subtitle,
  assigneeName,
  assigneeMeta,
  tone,
  compact = false,
}: {
  title: string;
  subtitle: string;
  assigneeName: string;
  assigneeMeta: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  compact?: boolean;
}) {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  } as const;

  return (
    <div className={`rounded-2xl border px-4 ${compact ? 'py-4' : 'py-5'} ${toneMap[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-widest">{title}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{subtitle}</p>
      <p className={`mt-${compact ? '3' : '4'} text-sm font-black`}>{assigneeName}</p>
      <p className="mt-1 text-xs opacity-80">{assigneeMeta}</p>
    </div>
  );
}

