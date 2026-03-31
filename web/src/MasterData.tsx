import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, ShieldAlert, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  createMasterDataDepartment,
  createMasterDataPosition,
  createMasterDataVendor,
  createMasterDataUser,
  deleteMasterDataDepartment,
  deleteMasterDataPosition,
  deleteMasterDataUser,
  getMasterData,
  updateMasterDataDepartment,
  updateMasterDataPosition,
  updateMasterDataUser,
  type MasterDataDepartment,
  type MasterDataPosition,
  type MasterDataRole,
  type MasterDataUser,
  type MasterDataVendor,
} from './api/masterData';

interface UserFormState {
  fullName: string;
  email: string;
  departmentId: string;
  positionCode: string;
  lineManagerId: string;
  roleCode: string;
  isActive: boolean;
}

interface VendorFormState {
  code: string;
  name: string;
  currency: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
}

interface DepartmentFormState {
  code: string;
  name: string;
  isActive: boolean;
}

interface PositionFormState {
  code: string;
  name: string;
  isGlobal: boolean;
  isActive: boolean;
}

const emptyCreateForm: UserFormState = {
  fullName: '',
  email: '',
  departmentId: '',
  positionCode: 'staff',
  lineManagerId: '',
  roleCode: 'staff',
  isActive: true,
};

const emptyVendorForm: VendorFormState = {
  code: '',
  name: '',
  currency: 'VND',
  bankAccountName: '',
  bankAccountNumber: '',
  bankName: '',
};

const emptyDepartmentForm: DepartmentFormState = {
  code: '',
  name: '',
  isActive: true,
};

const emptyPositionForm: PositionFormState = {
  code: '',
  name: '',
  isGlobal: false,
  isActive: true,
};

export default function MasterData() {
  const { actor, resetPassword } = useAuth();
  const [users, setUsers] = useState<MasterDataUser[]>([]);
  const [departments, setDepartments] = useState<MasterDataDepartment[]>([]);
  const [roles, setRoles] = useState<MasterDataRole[]>([]);
  const [positions, setPositions] = useState<MasterDataPosition[]>([]);
  const [vendors, setVendors] = useState<MasterDataVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [emailQuery, setEmailQuery] = useState('');
  const [createForm, setCreateForm] = useState<UserFormState>(emptyCreateForm);
  const [editForm, setEditForm] = useState<UserFormState>(emptyCreateForm);
  const [vendorForm, setVendorForm] = useState<VendorFormState>(emptyVendorForm);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(emptyDepartmentForm);
  const [positionForm, setPositionForm] = useState<PositionFormState>(emptyPositionForm);
  const [editingDepartment, setEditingDepartment] = useState<MasterDataDepartment | null>(null);
  const [editingPosition, setEditingPosition] = useState<MasterDataPosition | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('1234');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isCreateDepartmentOpen, setIsCreateDepartmentOpen] = useState(false);
  const [isCreatePositionOpen, setIsCreatePositionOpen] = useState(false);
  const [isEditDepartmentOpen, setIsEditDepartmentOpen] = useState(false);
  const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);

  const actorContext = useMemo(() => {
    if (!actor) return null;
    return {
      userId: actor.userId,
      departmentId: actor.departmentId,
      permissions: actor.permissions,
    };
  }, [actor]);

  const canManage = actorContext?.permissions.includes('manage_department_setup') ?? false;

  const selectedUser = useMemo(
    () => users.find((entry) => entry.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const userById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const positionLabels = useMemo(() => new Map(positions.map((entry) => [entry.code, entry.name])), [positions]);
  const roleLabels = useMemo(() => new Map(roles.map((entry) => [entry.code, entry.name])), [roles]);

  const lineManagerOptions = useMemo(
    () => users.filter((entry) => entry.id !== selectedUserId && entry.isActive),
    [selectedUserId, users]
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = emailQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesDepartment = departmentFilter === 'all' || user.departmentId === departmentFilter;
      const matchesQuery =
        !normalizedQuery ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.fullName.toLowerCase().includes(normalizedQuery);
      return matchesDepartment && matchesQuery;
    });
  }, [departmentFilter, emailQuery, users]);

  const groupedUsers = useMemo(() => {
    const departmentNameByCode = new Map(departments.map((entry) => [entry.code, entry.name]));
    const grouped = new Map<string, MasterDataUser[]>();

    for (const user of filteredUsers) {
      const key = user.departmentId ?? 'unassigned';
      const current = grouped.get(key) ?? [];
      current.push(user);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .map(([departmentCode, departmentUsers]) => ({
        departmentCode,
        departmentName: departmentNameByCode.get(departmentCode) ?? departmentCode,
        users: departmentUsers,
      }))
      .sort((left, right) => left.departmentName.localeCompare(right.departmentName));
  }, [departments, filteredUsers]);

  const departmentSummaries = useMemo(() => {
    return departments
      .map((department) => {
        const departmentUsers = users.filter((entry) => entry.departmentId === department.code);
        const hod = departmentUsers.find((entry) => entry.positionCode === 'hod' && entry.isActive) ?? null;
        const reviewer = departmentUsers.find((entry) => entry.positionCode === 'reviewer' && entry.isActive) ?? null;
        const managerCount = departmentUsers.filter(
          (entry) => entry.positionCode === 'line_manager' && entry.isActive
        ).length;

        return {
          code: department.code,
          name: department.name,
          isActive: department.isActive,
          totalUsers: departmentUsers.length,
          hodName: hod?.fullName ?? 'Not assigned',
          reviewerName: reviewer?.fullName ?? 'Optional / none',
          managerCount,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [departments, users]);

  const positionSummaries = useMemo(() => {
    return positions
      .map((position) => {
        const assignedUsers = users.filter((entry) => entry.positionCode === position.code);
        return {
          ...position,
          assignedCount: assignedUsers.length,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [positions, users]);

  async function loadData() {
    if (!actorContext) return;
    setLoading(true);
    try {
      const result = await getMasterData(actorContext);
      const nextUsers = result.data?.users ?? [];
      const nextDepartments = result.data?.departments ?? [];
      const nextRoles = result.data?.roles ?? [];
      const nextPositions = result.data?.positions ?? [];
      const nextVendors = result.data?.vendors ?? [];

      setUsers(nextUsers);
      setDepartments(nextDepartments);
      setRoles(nextRoles);
      setPositions(nextPositions);
      setVendors(nextVendors);
      setSelectedUserId((current) => (current && nextUsers.some((entry) => entry.id === current) ? current : nextUsers[0]?.id ?? ''));
      setCreateForm((current) => ({
        ...current,
        departmentId: current.departmentId || nextDepartments[0]?.code || '',
        positionCode: current.positionCode || nextPositions.find((entry) => entry.code === 'staff')?.code || 'staff',
        roleCode: current.roleCode || nextRoles.find((entry) => entry.code === 'staff')?.code || 'staff',
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load master data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [actorContext]);

  useEffect(() => {
    if (!selectedUser) {
      setEditForm(emptyCreateForm);
      setResetPasswordValue('1234');
      return;
    }

    setEditForm({
      fullName: selectedUser.fullName,
      email: selectedUser.email,
      departmentId: selectedUser.departmentId ?? '',
      positionCode: selectedUser.positionCode ?? 'staff',
      lineManagerId: selectedUser.lineManagerId ?? '',
      roleCode: selectedUser.roleCode ?? 'staff',
      isActive: selectedUser.isActive,
    });
    setResetPasswordValue('1234');
  }, [selectedUser]);

  useEffect(() => {
    if (!editingDepartment) {
      setDepartmentForm(emptyDepartmentForm);
      return;
    }

    setDepartmentForm({
      code: editingDepartment.code,
      name: editingDepartment.name,
      isActive: editingDepartment.isActive,
    });
  }, [editingDepartment]);

  useEffect(() => {
    if (!editingPosition) {
      setPositionForm(emptyPositionForm);
      return;
    }

    setPositionForm({
      code: editingPosition.code,
      name: editingPosition.name,
      isGlobal: editingPosition.isGlobal,
      isActive: editingPosition.isActive,
    });
  }, [editingPosition]);

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext) return;
    setSaving(true);
    try {
      const response = await createMasterDataUser(
        {
          fullName: createForm.fullName.trim(),
          email: createForm.email.trim().toLowerCase(),
          departmentId: createForm.departmentId,
          positionCode: createForm.positionCode,
          lineManagerId: createForm.lineManagerId || null,
          roleCode: createForm.roleCode,
        },
        actorContext
      );
      toast.success(`Created ${response.data.email}`);
      setCreateForm((current) => ({
        ...emptyCreateForm,
        departmentId: current.departmentId,
        positionCode: current.positionCode,
        roleCode: current.roleCode,
      }));
      setIsCreateUserOpen(false);
      await loadData();
      setSelectedUserId(response.data.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext || !selectedUser) return;
    setSaving(true);
    try {
      await updateMasterDataUser(
        selectedUser.id,
        {
          fullName: editForm.fullName.trim(),
          departmentId: editForm.departmentId,
          positionCode: editForm.positionCode,
          lineManagerId: editForm.lineManagerId || null,
          roleCode: editForm.roleCode,
          isActive: editForm.isActive,
        },
        actorContext
      );
      toast.success(`Updated ${selectedUser.email}`);
      setIsEditUserOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      await resetPassword({
        email: selectedUser.email,
        displayName: editForm.fullName.trim() || selectedUser.fullName,
        password: resetPasswordValue,
      });
      toast.success(`Password reset for ${selectedUser.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVendor(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext) return;
    setSaving(true);
    try {
      const response = await createMasterDataVendor(
        {
          code: vendorForm.code.trim().toUpperCase(),
          name: vendorForm.name.trim(),
          currency: vendorForm.currency,
          bankAccountName: vendorForm.bankAccountName.trim() || null,
          bankAccountNumber: vendorForm.bankAccountNumber.trim() || null,
          bankName: vendorForm.bankName.trim() || null,
        },
        actorContext
      );
      toast.success(`Created vendor ${response.data.code}`);
      setVendorForm(emptyVendorForm);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create vendor.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDepartment(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext) return;
    setSaving(true);
    try {
      const response = await createMasterDataDepartment(
        {
          code: departmentForm.code.trim().toLowerCase(),
          name: departmentForm.name.trim(),
        },
        actorContext
      );
      toast.success(`Created department ${response.data.code}`);
      setDepartmentForm(emptyDepartmentForm);
      setIsCreateDepartmentOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create department.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDepartment(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext || !editingDepartment) return;
    setSaving(true);
    try {
      await updateMasterDataDepartment(
        editingDepartment.code,
        {
          name: departmentForm.name.trim(),
          isActive: departmentForm.isActive,
        },
        actorContext
      );
      toast.success(`Updated department ${editingDepartment.code}`);
      setIsEditDepartmentOpen(false);
      setEditingDepartment(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update department.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePosition(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext) return;
    setSaving(true);
    try {
      const response = await createMasterDataPosition(
        {
          code: positionForm.code.trim().toLowerCase(),
          name: positionForm.name.trim(),
          isGlobal: positionForm.isGlobal,
        },
        actorContext
      );
      toast.success(`Created position ${response.data.code}`);
      setPositionForm(emptyPositionForm);
      setIsCreatePositionOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create position.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePosition(event: React.FormEvent) {
    event.preventDefault();
    if (!actorContext || !editingPosition) return;
    setSaving(true);
    try {
      await updateMasterDataPosition(
        editingPosition.code,
        {
          name: positionForm.name.trim(),
          isGlobal: positionForm.isGlobal,
          isActive: positionForm.isActive,
        },
        actorContext
      );
      toast.success(`Updated position ${editingPosition.code}`);
      setIsEditPositionOpen(false);
      setEditingPosition(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update position.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(user: MasterDataUser) {
    if (!actorContext) return;
    const confirmed = window.confirm(`Delete ${user.fullName} (${user.email})?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteMasterDataUser(user.id, actorContext);
      toast.success(`Deleted ${user.email}`);
      if (selectedUserId === user.id) {
        setSelectedUserId('');
      }
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDepartment(department: MasterDataDepartment) {
    if (!actorContext) return;
    const confirmed = window.confirm(`Delete department ${department.name} (${department.code})?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteMasterDataDepartment(department.code, actorContext);
      toast.success(`Deleted department ${department.code}`);
      setIsEditDepartmentOpen(false);
      setEditingDepartment(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete department.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePosition(position: MasterDataPosition) {
    if (!actorContext) return;
    const confirmed = window.confirm(`Delete position ${position.name} (${position.code})?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteMasterDataPosition(position.code, actorContext);
      toast.success(`Deleted position ${position.code}`);
      setIsEditPositionOpen(false);
      setEditingPosition(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete position.');
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-surface-container-high p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3 text-red-700">
          <ShieldAlert size={22} />
          <h1 className="text-2xl font-black tracking-tight">Master Data Access Restricted</h1>
        </div>
        <p className="text-sm text-on-surface-variant">This screen is only available for admin users with `manage_department_setup`.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1880px] mx-auto px-6 2xl:px-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-on-surface mb-2">Master Data</h1>
          <p className="text-on-surface-variant font-medium">
            Keep the directory clean, then open focused drawers only when you need to create or edit a user.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateUserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary-container transition-colors"
          >
            <Plus size={16} />
            New User
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-surface-container-high text-sm font-semibold hover:bg-surface-container-low transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight">Departments Overview</h2>
            <p className="text-xs text-on-surface-variant">
              Quick scan of each department before you edit people or workflow setup.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatePositionOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container-low"
            >
              <Plus size={14} />
              New Position
            </button>
            <button
              type="button"
              onClick={() => setIsCreateDepartmentOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-white text-xs font-semibold hover:bg-secondary-container"
            >
              <Plus size={14} />
              New Department
            </button>
            <span className="text-xs font-bold bg-surface-container-low px-3 py-1 rounded-full">
              {departmentSummaries.length} department(s)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-6 bg-surface-container-low/30">
          {departmentSummaries.map((department) => (
            <div key={department.code} className="rounded-2xl border border-surface-container-high bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-on-surface truncate">{department.name}</p>
                  <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">{department.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${department.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {department.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDepartment(departments.find((entry) => entry.code === department.code) ?? null);
                      setIsEditDepartmentOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-[11px] font-semibold text-on-surface hover:bg-surface-container-low"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="HOD" value={department.hodName} />
                <MiniStat label="Reviewer" value={department.reviewerName} />
                <MiniStat label="Managers" value={String(department.managerCount)} />
                <MiniStat label="Members" value={String(Math.max(department.totalUsers - department.managerCount, 0))} />
              </div>
              <p className="text-[11px] text-on-surface-variant font-semibold">{department.totalUsers} user(s) assigned</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight">Positions Overview</h2>
            <p className="text-xs text-on-surface-variant">Keep reusable titles active and scoped correctly before assigning users.</p>
          </div>
          <span className="text-xs font-bold bg-surface-container-low px-3 py-1 rounded-full">
            {positionSummaries.length} position(s)
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-6 bg-surface-container-low/30">
          {positionSummaries.map((position) => (
            <div key={position.code} className="rounded-2xl border border-surface-container-high bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-on-surface truncate">{position.name}</p>
                  <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">{position.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPosition(positions.find((entry) => entry.code === position.code) ?? null);
                    setIsEditPositionOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-[11px] font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Scope" value={position.isGlobal ? 'Global' : 'Department'} />
                <MiniStat label="Assigned" value={String(position.assignedCount)} />
                <MiniStat label="Status" value={position.isActive ? 'Active' : 'Inactive'} />
                <MiniStat label="Usage" value={position.assignedCount > 0 ? 'In use' : 'Unused'} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
          <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-secondary" />
              <div>
                <h2 className="text-lg font-black tracking-tight">People Directory</h2>
                <p className="text-xs text-on-surface-variant">One row per user, all important fields visible, actions at the end.</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-surface-container-low px-3 py-1 rounded-full">{filteredUsers.length}</span>
          </div>

          <div className="px-8 py-4 border-b border-surface-container-high bg-surface-container-low/40">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Search Name Or Email</label>
                <input
                  value={emailQuery}
                  onChange={(event) => setEmailQuery(event.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-surface-container-high outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-surface-container-high outline-none"
                >
                  <option value="all">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.code}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-[980px] overflow-y-auto">
            {loading ? (
              <div className="px-8 py-8 text-sm text-on-surface-variant">Loading master data...</div>
            ) : groupedUsers.length === 0 ? (
              <div className="px-8 py-8 text-sm text-on-surface-variant">No users match the current filters.</div>
            ) : (
              <>
                <div className="px-8 py-3 border-b border-surface-container-high bg-white sticky top-0 z-10">
                  <div className="grid grid-cols-[minmax(220px,1.6fr)_160px_160px_minmax(220px,1.2fr)_140px_110px_170px] gap-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                    <div>User</div>
                    <div>Department</div>
                    <div>Position</div>
                    <div>Reports To</div>
                    <div>Role</div>
                    <div>Status</div>
                    <div>Actions</div>
                  </div>
                </div>
                {groupedUsers.map((group) => (
                  <div key={group.departmentCode} className="border-b border-surface-container-high last:border-b-0">
                    <div className="px-8 py-4 bg-surface-container-low">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-on-surface">{group.departmentName}</p>
                          <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">{group.departmentCode}</p>
                        </div>
                        <span className="text-[11px] font-bold text-on-surface-variant">{group.users.length} user(s)</span>
                      </div>
                    </div>

                    <div className="divide-y divide-surface-container-high">
                      {group.users.map((user) => (
                        <div
                          key={user.id}
                          className={`px-8 py-4 transition-colors ${selectedUserId === user.id ? 'bg-secondary/5' : 'hover:bg-surface-container-low'}`}
                        >
                          <div className="grid grid-cols-[minmax(220px,1.6fr)_160px_160px_minmax(220px,1.2fr)_140px_110px_170px] gap-4 items-start">
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate">{user.fullName}</div>
                              <div className="text-xs text-on-surface-variant truncate">{user.email}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                {departments.find((entry) => entry.code === user.departmentId)?.name ?? user.departmentId ?? '-'}
                              </div>
                              <div className="text-[11px] text-on-surface-variant truncate">{user.departmentId ?? '-'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{positionLabels.get(user.positionCode ?? '') ?? '-'}</div>
                              <div className="text-[11px] text-on-surface-variant truncate">{user.positionCode ?? '-'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                {user.lineManagerId ? userById.get(user.lineManagerId)?.fullName ?? user.lineManagerId : 'No line manager'}
                              </div>
                              <div className="text-[11px] text-on-surface-variant truncate">{user.lineManagerId ?? '-'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{roleLabels.get(user.roleCode ?? '') ?? '-'}</div>
                              <div className="text-[11px] text-on-surface-variant truncate">{user.roleCode ?? '-'}</div>
                            </div>
                            <div className={`text-xs font-bold ${user.isActive ? 'text-green-700' : 'text-red-700'}`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setIsEditUserOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface hover:bg-white"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteUser(user)}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

      <section className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-black tracking-tight">Vendor Master</h2>
            <p className="text-xs text-on-surface-variant">Manual vendor setup now, ERP sync hook later.</p>
          </div>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant opacity-60"
            title="ERP vendor sync will be connected later."
          >
            ERP Sync Coming Later
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <form className="space-y-4" onSubmit={(event) => void handleCreateVendor(event)}>
            <LabeledInput label="Vendor Code" value={vendorForm.code} onChange={(value) => setVendorForm((current) => ({ ...current, code: value }))} placeholder="VEND-NEW" />
            <LabeledInput label="Vendor Name" value={vendorForm.name} onChange={(value) => setVendorForm((current) => ({ ...current, name: value }))} placeholder="New Vendor Co" />
            <LabeledSelect
              label="Currency"
              value={vendorForm.currency}
              onChange={(value) => setVendorForm((current) => ({ ...current, currency: value }))}
              options={[
                { value: 'VND', label: 'VND' },
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
              ]}
            />
            <LabeledInput label="Bank Account Name" value={vendorForm.bankAccountName} onChange={(value) => setVendorForm((current) => ({ ...current, bankAccountName: value }))} placeholder="Vendor account name" />
            <LabeledInput label="Bank Account Number" value={vendorForm.bankAccountNumber} onChange={(value) => setVendorForm((current) => ({ ...current, bankAccountNumber: value }))} placeholder="001122334455" />
            <LabeledInput label="Bank Name" value={vendorForm.bankName} onChange={(value) => setVendorForm((current) => ({ ...current, bankName: value }))} placeholder="ACB" />
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-secondary text-white font-bold hover:bg-secondary-container disabled:opacity-60 transition-colors"
            >
              <Plus size={16} />
              Create Vendor
            </button>
          </form>

          <div className="rounded-2xl border border-surface-container-high overflow-hidden">
            <div className="grid grid-cols-[140px_minmax(0,1.4fr)_90px_120px] gap-4 px-4 py-3 bg-surface-container-low text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              <div>Code</div>
              <div>Name</div>
              <div>Currency</div>
              <div>Source</div>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-container-high">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="grid grid-cols-[140px_minmax(0,1.4fr)_90px_120px] gap-4 px-4 py-4 text-sm">
                  <div className="font-bold">{vendor.code}</div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{vendor.name}</div>
                    <div className="text-[11px] text-on-surface-variant truncate">
                      {[vendor.bankName, vendor.bankAccountNumber].filter(Boolean).join(' • ') || 'No bank info'}
                    </div>
                  </div>
                  <div>{vendor.currency}</div>
                  <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{vendor.syncSource}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isCreateUserOpen ? (
        <ModalShell
          title="Create User"
          description="Add the person once, then let org chart and workflow read from the same profile."
          onClose={() => setIsCreateUserOpen(false)}
        >
          <form className="space-y-5" onSubmit={(event) => void handleCreateUser(event)}>
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Identity</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledInput label="Full Name" value={createForm.fullName} onChange={(value) => setCreateForm((current) => ({ ...current, fullName: value }))} placeholder="Full name" />
                <LabeledInput label="Email" value={createForm.email} onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))} placeholder="Email" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Organization</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledSelect label="Department" value={createForm.departmentId} onChange={(value) => setCreateForm((current) => ({ ...current, departmentId: value }))} options={departments.map((department) => ({ value: department.code, label: department.name }))} />
                <LabeledSelect label="Position" value={createForm.positionCode} onChange={(value) => setCreateForm((current) => ({ ...current, positionCode: value }))} options={positions.map((position) => ({ value: position.code, label: position.name }))} />
                <LabeledSelect
                  label="Reports To"
                  value={createForm.lineManagerId}
                  onChange={(value) => setCreateForm((current) => ({ ...current, lineManagerId: value }))}
                  options={[
                    { value: '', label: 'No line manager' },
                    ...lineManagerOptions.map((user) => ({ value: user.id, label: user.fullName })),
                  ]}
                />
                <LabeledSelect label="Role" value={createForm.roleCode} onChange={(value) => setCreateForm((current) => ({ ...current, roleCode: value }))} options={roles.map((role) => ({ value: role.code, label: role.name }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreateUserOpen(false)} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-white font-bold hover:bg-secondary-container disabled:opacity-60 transition-colors">
                <Plus size={16} />
                Create User
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isCreateDepartmentOpen ? (
        <ModalShell
          title="Create Department"
          description="Create the org unit first, then assign people and workflow ownership."
          onClose={() => setIsCreateDepartmentOpen(false)}
        >
          <form className="space-y-5" onSubmit={(event) => void handleCreateDepartment(event)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LabeledInput label="Department Code" value={departmentForm.code} onChange={(value) => setDepartmentForm((current) => ({ ...current, code: value }))} placeholder="dep-legal" />
              <LabeledInput label="Department Name" value={departmentForm.name} onChange={(value) => setDepartmentForm((current) => ({ ...current, name: value }))} placeholder="Legal Department" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreateDepartmentOpen(false)} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-white font-bold hover:bg-secondary-container disabled:opacity-60 transition-colors">
                <Plus size={16} />
                Create Department
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isEditDepartmentOpen && editingDepartment ? (
        <ModalShell
          title="Edit Department"
          description="Adjust department name or disable it without deleting the org unit."
          onClose={() => {
            setIsEditDepartmentOpen(false);
            setEditingDepartment(null);
          }}
        >
          <form className="space-y-5" onSubmit={(event) => void handleUpdateDepartment(event)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Department Code</label>
                <input value={departmentForm.code} disabled className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none opacity-70" />
              </div>
              <LabeledInput label="Department Name" value={departmentForm.name} onChange={(value) => setDepartmentForm((current) => ({ ...current, name: value }))} placeholder="Legal Department" />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={departmentForm.isActive} onChange={(event) => setDepartmentForm((current) => ({ ...current, isActive: event.target.checked }))} />
              Department is active
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeleteDepartment(editingDepartment)}
                className="px-4 py-3 rounded-2xl border border-red-200 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
              <button type="button" onClick={() => {
                setIsEditDepartmentOpen(false);
                setEditingDepartment(null);
              }} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                <Save size={16} />
                Save Department
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isCreatePositionOpen ? (
        <ModalShell
          title="Create Position"
          description="Create reusable workflow titles such as reviewer, HOD, or line manager."
          onClose={() => setIsCreatePositionOpen(false)}
        >
          <form className="space-y-5" onSubmit={(event) => void handleCreatePosition(event)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LabeledInput label="Position Code" value={positionForm.code} onChange={(value) => setPositionForm((current) => ({ ...current, code: value }))} placeholder="senior_manager" />
              <LabeledInput label="Position Name" value={positionForm.name} onChange={(value) => setPositionForm((current) => ({ ...current, name: value }))} placeholder="Senior Manager" />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={positionForm.isGlobal} onChange={(event) => setPositionForm((current) => ({ ...current, isGlobal: event.target.checked }))} />
              Global position usable across multiple departments
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreatePositionOpen(false)} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-white font-bold hover:bg-secondary-container disabled:opacity-60 transition-colors">
                <Plus size={16} />
                Create Position
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isEditPositionOpen && editingPosition ? (
        <ModalShell
          title="Edit Position"
          description="Keep workflow titles reusable, scoped, and easy to understand."
          onClose={() => {
            setIsEditPositionOpen(false);
            setEditingPosition(null);
          }}
        >
          <form className="space-y-5" onSubmit={(event) => void handleUpdatePosition(event)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Position Code</label>
                <input value={positionForm.code} disabled className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none opacity-70" />
              </div>
              <LabeledInput label="Position Name" value={positionForm.name} onChange={(value) => setPositionForm((current) => ({ ...current, name: value }))} placeholder="Senior Manager" />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={positionForm.isGlobal} onChange={(event) => setPositionForm((current) => ({ ...current, isGlobal: event.target.checked }))} />
              Global position usable across multiple departments
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={positionForm.isActive} onChange={(event) => setPositionForm((current) => ({ ...current, isActive: event.target.checked }))} />
              Position is active
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeletePosition(editingPosition)}
                className="px-4 py-3 rounded-2xl border border-red-200 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
              <button type="button" onClick={() => {
                setIsEditPositionOpen(false);
                setEditingPosition(null);
              }} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                <Save size={16} />
                Save Position
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isEditUserOpen && selectedUser ? (
        <ModalShell
          title="Edit User"
          description="Keep org ownership, line manager, and system access aligned from one place."
          onClose={() => setIsEditUserOpen(false)}
        >
          <form className="space-y-5" onSubmit={(event) => void handleUpdateUser(event)}>
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Identity</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledInput label="Full Name" value={editForm.fullName} onChange={(value) => setEditForm((current) => ({ ...current, fullName: value }))} placeholder="Full name" />
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Email</label>
                  <input value={editForm.email} disabled className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none opacity-70" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Organization</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledSelect label="Department" value={editForm.departmentId} onChange={(value) => setEditForm((current) => ({ ...current, departmentId: value }))} options={departments.map((department) => ({ value: department.code, label: department.name }))} />
                <LabeledSelect label="Position" value={editForm.positionCode} onChange={(value) => setEditForm((current) => ({ ...current, positionCode: value }))} options={positions.map((position) => ({ value: position.code, label: position.name }))} />
                <LabeledSelect
                  label="Reports To"
                  value={editForm.lineManagerId}
                  onChange={(value) => setEditForm((current) => ({ ...current, lineManagerId: value }))}
                  options={[
                    { value: '', label: 'No line manager' },
                    ...lineManagerOptions.map((user) => ({ value: user.id, label: user.fullName })),
                  ]}
                />
                <LabeledSelect label="Role" value={editForm.roleCode} onChange={(value) => setEditForm((current) => ({ ...current, roleCode: value }))} options={roles.map((role) => ({ value: role.code, label: role.name }))} />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))} />
              User is active
            </label>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditUserOpen(false)} className="px-4 py-3 rounded-2xl border border-surface-container-high font-semibold text-on-surface">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                <Save size={16} />
                Save User
              </button>
            </div>
          </form>

          <form className="mt-6 pt-6 border-t border-surface-container-high space-y-4" onSubmit={(event) => void handleResetPassword(event)}>
            <div>
              <h3 className="text-sm font-black tracking-tight">Reset Password</h3>
              <p className="text-xs text-on-surface-variant mt-1">Reset the local demo sign-in password for this account.</p>
            </div>
            <input
              type="text"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
              placeholder="1234"
              className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none"
            />
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-secondary text-white font-bold hover:bg-secondary-container disabled:opacity-60 transition-colors">
              <ShieldAlert size={16} />
              Reset Password
            </button>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none" />
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="mt-1 text-xs font-bold text-on-surface break-words">{value}</p>
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-surface-container-high shadow-2xl">
        <div className="px-6 py-5 border-b border-surface-container-high flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-on-surface">{title}</h2>
            <p className="text-sm text-on-surface-variant mt-1">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border border-surface-container-high text-sm font-semibold text-on-surface hover:bg-surface-container-low">
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
