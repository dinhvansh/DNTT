import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, Save, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  createDepartment,
  getApprovalSetup,
  updateDepartmentApprovalSetup,
  updateGlobalApproverConfig,
  type ApprovalDepartment,
  type GlobalApproverConfig,
  type SetupUser,
} from './api/approvalSetup';
import { createActorContext } from './api/paymentRequests';

function emptyDepartmentForm() {
  return {
    reviewerUserId: '',
    hodUserId: '',
    fallbackUserId: '',
  };
}

function emptyGlobalForm() {
  return {
    cfoUserId: '',
    ceoUserId: '',
    cfoAmountThreshold: '',
    ceoAmountThreshold: '',
  };
}

export default function ApprovalSetup() {
  const { actor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [departments, setDepartments] = useState<ApprovalDepartment[]>([]);
  const [users, setUsers] = useState<SetupUser[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalApproverConfig | null>(null);
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('');
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm());
  const [globalForm, setGlobalForm] = useState(emptyGlobalForm());
  const [newDepartment, setNewDepartment] = useState({ code: '', name: '' });

  const canManage = actor?.permissions.includes('manage_department_setup') ?? false;
  const actorContext = useMemo(
    () => (actor ? createActorContext({
      userId: actor.userId,
      departmentId: actor.departmentId,
      permissions: actor.permissions,
    }) : null),
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
      hodUserId: selectedDepartment.setup.hodUserId ?? '',
      fallbackUserId: selectedDepartment.setup.fallbackUserId ?? '',
    });
  }, [selectedDepartment]);

  useEffect(() => {
    if (!globalConfig) {
      setGlobalForm(emptyGlobalForm());
      return;
    }

    setGlobalForm({
      cfoUserId: globalConfig.cfoUserId ?? '',
      ceoUserId: globalConfig.ceoUserId ?? '',
      cfoAmountThreshold: globalConfig.cfoAmountThreshold?.toString() ?? '',
      ceoAmountThreshold: globalConfig.ceoAmountThreshold?.toString() ?? '',
    });
  }, [globalConfig]);

  const userOptions = useMemo(() => {
    return users.map((entry) => ({
      value: entry.id,
      label: `${entry.fullName} (${entry.departmentId ?? 'no-department'})`,
    }));
  }, [users]);

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
          hodUserId: departmentForm.hodUserId || null,
          fallbackUserId: departmentForm.fallbackUserId || null,
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
          cfoUserId: globalForm.cfoUserId || null,
          ceoUserId: globalForm.ceoUserId || null,
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

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-3xl p-8 space-y-4">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertCircle size={24} />
          <h1 className="text-2xl font-black tracking-tight">Approval Setup Locked</h1>
        </div>
        <p className="text-sm text-amber-900/80">
          Tài khoản hiện tại chưa có quyền `manage_department_setup`. Hãy đăng nhập bằng `sysadmin@example.com / 1234` để tạo phòng ban và cấu hình reviewer, HOD, CFO, CEO.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-2">Approval Setup</h1>
          <p className="text-on-surface-variant font-medium">
            Configure department reviewer and HOD mapping, then set global CFO and CEO thresholds.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-surface-container-high rounded-3xl p-8 text-sm text-on-surface-variant">
          Loading approval setup...
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
                  <p className="text-xs text-on-surface-variant">Create and select a department to manage approvers.</p>
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
                {departments.map((department) => (
                  <button
                    key={department.code}
                    onClick={() => setSelectedDepartmentCode(department.code)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selectedDepartmentCode === department.code
                        ? 'border-secondary bg-secondary/10'
                        : 'border-surface-container-high bg-surface-container-low hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-on-surface">{department.name}</p>
                        <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">{department.code}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                        {department.setup.isActive ? 'Mapped' : 'Empty'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">
                    {selectedDepartment ? `${selectedDepartment.name} Approval Mapping` : 'Department Approval Mapping'}
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Line Manager vẫn lấy từ hồ sơ user. Màn này chỉ quản lý Reviewer, HOD và fallback theo phòng ban.
                  </p>
                </div>
              </div>

              {selectedDepartment ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SelectField
                    label="Reviewer"
                    value={departmentForm.reviewerUserId}
                    options={userOptions}
                    onChange={(value) => setDepartmentForm((current) => ({ ...current, reviewerUserId: value }))}
                  />
                  <SelectField
                    label="HOD"
                    value={departmentForm.hodUserId}
                    options={userOptions}
                    onChange={(value) => setDepartmentForm((current) => ({ ...current, hodUserId: value }))}
                  />
                  <SelectField
                    label="Fallback"
                    value={departmentForm.fallbackUserId}
                    options={userOptions}
                    onChange={(value) => setDepartmentForm((current) => ({ ...current, fallbackUserId: value }))}
                  />
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">Select a department to edit setup.</p>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Current rule</p>
                  <p className="text-sm text-on-surface">Reviewer and HOD are resolved per department. Deduplicate happens during submit.</p>
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
            </div>

            <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Settings size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">Global CFO / CEO Config</h2>
                  <p className="text-sm text-on-surface-variant">
                    Threshold chỉ bật step, không thay đổi khung workflow. CEO threshold phải lớn hơn hoặc bằng CFO threshold.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="CFO"
                  value={globalForm.cfoUserId}
                  options={userOptions}
                  onChange={(value) => setGlobalForm((current) => ({ ...current, cfoUserId: value }))}
                />
                <SelectField
                  label="CEO"
                  value={globalForm.ceoUserId}
                  options={userOptions}
                  onChange={(value) => setGlobalForm((current) => ({ ...current, ceoUserId: value }))}
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

              <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Company scope</p>
                  <p className="text-sm text-on-surface">{globalConfig?.companyCode ?? 'default'}</p>
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
    <label className="space-y-2">
      <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</span>
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
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20"
        placeholder={placeholder}
      />
    </label>
  );
}
