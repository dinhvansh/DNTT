import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  getMasterData,
  type MasterDataDepartment,
  type MasterDataPosition,
  type MasterDataUser,
} from './api/masterData';

interface ChartNode extends MasterDataUser {
  reports: ChartNode[];
}

function toTitleCaseLabel(value: string | null | undefined) {
  if (!value) return '-';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getTone(positionCode: string | null | undefined) {
  switch (positionCode) {
    case 'ceo':
      return 'from-amber-400 to-orange-500 text-amber-950';
    case 'cfo':
      return 'from-emerald-400 to-teal-500 text-emerald-950';
    case 'hod':
      return 'from-sky-400 to-blue-500 text-blue-950';
    case 'reviewer':
      return 'from-violet-400 to-fuchsia-500 text-violet-950';
    case 'line_manager':
      return 'from-slate-500 to-slate-700 text-white';
    default:
      return 'from-zinc-200 to-zinc-300 text-zinc-800';
  }
}

function flattenTree(nodes: ChartNode[]): ChartNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.reports)]);
}

function pruneTree(nodes: ChartNode[], predicate: (node: ChartNode) => boolean): ChartNode[] {
  const next: ChartNode[] = [];

  for (const node of nodes) {
    const prunedChildren = pruneTree(node.reports, predicate);
    if (predicate(node) || prunedChildren.length > 0) {
      next.push({
        ...node,
        reports: prunedChildren,
      });
    }
  }

  return next;
}

function countDirectReports(roots: ChartNode[], userId: string): number {
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.id === userId) return current.reports.length;
    queue.push(...current.reports);
  }
  return 0;
}

export default function OrganizationChart() {
  const { actor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<MasterDataDepartment[]>([]);
  const [positions, setPositions] = useState<MasterDataPosition[]>([]);
  const [users, setUsers] = useState<MasterDataUser[]>([]);
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<string[]>([]);

  const actorContext = useMemo(() => {
    if (!actor) return null;
    return {
      userId: actor.userId,
      departmentId: actor.departmentId,
      permissions: actor.permissions,
    };
  }, [actor]);

  const canManage = actorContext?.permissions.includes('manage_department_setup') ?? false;

  async function loadData() {
    if (!actorContext) return;
    setLoading(true);
    try {
      const result = await getMasterData(actorContext);
      setUsers(result.data.users ?? []);
      setDepartments(result.data.departments ?? []);
      setPositions(result.data.positions ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load organization chart.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [actorContext]);

  const positionLabels = useMemo(
    () => new Map(positions.map((entry) => [entry.code, entry.name])),
    [positions]
  );
  const departmentLabels = useMemo(
    () => new Map(departments.map((entry) => [entry.code, entry.name])),
    [departments]
  );

  const visibleUsers = useMemo(
    () =>
      users.filter(
        (entry) =>
          (showInactive || entry.isActive) &&
          (selectedDepartmentCode === 'all' || entry.departmentId === selectedDepartmentCode)
      ),
    [selectedDepartmentCode, showInactive, users]
  );

  const visibleUsersById = useMemo(() => new Map(visibleUsers.map((entry) => [entry.id, entry])), [visibleUsers]);

  const chartRoots = useMemo(() => {
    const nodeMap = new Map<string, ChartNode>();
    for (const user of visibleUsers) {
      nodeMap.set(user.id, { ...user, reports: [] });
    }

    const roots: ChartNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.lineManagerId && nodeMap.has(node.lineManagerId) && node.lineManagerId !== node.id) {
        nodeMap.get(node.lineManagerId)?.reports.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortTree = (nodes: ChartNode[]) => {
      nodes.sort((left, right) => left.fullName.localeCompare(right.fullName));
      nodes.forEach((node) => sortTree(node.reports));
    };

    sortTree(roots);
    return roots;
  }, [visibleUsers]);

  const filteredChartRoots = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return chartRoots;
    }

    return pruneTree(chartRoots, (node) => {
      const positionLabel = positionLabels.get(node.positionCode ?? '') ?? node.positionCode ?? '';
      const departmentLabel = departmentLabels.get(node.departmentId ?? '') ?? node.departmentId ?? '';
      return (
        node.fullName.toLowerCase().includes(normalizedQuery) ||
        node.email.toLowerCase().includes(normalizedQuery) ||
        positionLabel.toLowerCase().includes(normalizedQuery) ||
        departmentLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [chartRoots, departmentLabels, positionLabels, searchQuery]);

  const flattenedFilteredTree = useMemo(() => flattenTree(filteredChartRoots), [filteredChartRoots]);

  const selectedUser = useMemo(
    () => flattenedFilteredTree.find((entry) => entry.id === selectedUserId) ?? flattenedFilteredTree[0] ?? null,
    [flattenedFilteredTree, selectedUserId]
  );

  const selectedUserManager = useMemo(
    () =>
      selectedUser?.lineManagerId
        ? visibleUsersById.get(selectedUser.lineManagerId) ?? null
        : null,
    [selectedUser, visibleUsersById]
  );

  const selectedDepartment = useMemo(
    () => departments.find((entry) => entry.code === selectedDepartmentCode) ?? null,
    [departments, selectedDepartmentCode]
  );

  function toggleCollapse(userId: string) {
    setCollapsedNodeIds((current) =>
      current.includes(userId)
        ? current.filter((entry) => entry !== userId)
        : [...current, userId]
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-surface-container-high p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3 text-red-700">
          <ShieldAlert size={22} />
          <h1 className="text-2xl font-black tracking-tight">Organization Chart Access Restricted</h1>
        </div>
        <p className="text-sm text-on-surface-variant">
          This screen is only available for admin users with `manage_department_setup`.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[2400px] mx-auto px-4 xl:px-6 2xl:px-8">
      <style>{`
        .org-chart-root .org-tree,
        .org-chart-root .org-tree ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .org-chart-root .org-tree {
          display: flex;
          justify-content: center;
          gap: 36px;
          position: relative;
          padding-top: 36px;
        }
        .org-chart-root .org-tree > li {
          position: relative;
          padding: 34px 14px 0;
          text-align: center;
        }
        .org-chart-root .org-tree > li::before,
        .org-chart-root .org-tree > li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          width: 50%;
          height: 34px;
          border-top: 3px solid rgb(203 213 225);
        }
        .org-chart-root .org-tree > li::after {
          right: auto;
          left: 50%;
          border-left: 3px solid rgb(203 213 225);
        }
        .org-chart-root .org-tree > li:only-child::before,
        .org-chart-root .org-tree > li:only-child::after {
          display: none;
        }
        .org-chart-root .org-tree > li:only-child {
          padding-top: 0;
        }
        .org-chart-root .org-tree > li:first-child::before,
        .org-chart-root .org-tree > li:last-child::after {
          border: 0;
        }
        .org-chart-root .org-tree > li:last-child::before {
          border-right: 3px solid rgb(203 213 225);
          border-radius: 0 16px 0 0;
        }
        .org-chart-root .org-tree > li:first-child::after {
          border-radius: 16px 0 0 0;
        }
        .org-chart-root .org-tree > li > .node-shell {
          position: relative;
        }
        .org-chart-root .org-tree > li > .node-shell::before {
          content: '';
          position: absolute;
          top: -34px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 34px;
          background: rgb(203 213 225);
        }
        .org-chart-root > .org-tree:first-child > li > .node-shell::before,
        .org-chart-root > .node-shell::before {
          display: none;
        }
      `}</style>

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-on-surface mb-2">Organization Chart</h1>
          <p className="text-on-surface-variant font-medium">
            Visualize reporting lines from `department + position + reports to`, then narrow the tree by department, person, or active status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-surface-container-high text-sm font-semibold hover:bg-surface-container-low transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <section className="space-y-6">
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Building2 size={20} className="text-secondary" />
              <div>
                <h2 className="text-lg font-black tracking-tight">Scope</h2>
                <p className="text-xs text-on-surface-variant">Filter the org tree before you inspect reporting lines.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Department</label>
              <select
                value={selectedDepartmentCode}
                onChange={(event) => {
                  setSelectedDepartmentCode(event.target.value);
                  setSelectedUserId('');
                }}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none"
              >
                <option value="all">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.code}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Name, email, position..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface-container-low border border-surface-container-high outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-on-surface rounded-2xl bg-surface-container-low px-4 py-3">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Show inactive users
            </label>

            <div className="grid grid-cols-2 gap-3">
              <InfoStat label="People" value={String(flattenedFilteredTree.length)} />
              <InfoStat label="Roots" value={String(filteredChartRoots.length)} />
            </div>

            <div className="rounded-3xl bg-primary text-white p-5 space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-secondary" />
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Tree logic</p>
              </div>
              <p className="text-sm leading-relaxed text-white/85">
                Each node is placed only by `Reports To`. Use collapse to simplify busy branches and search to isolate one person fast.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-secondary" />
              <div>
                <h2 className="text-lg font-black tracking-tight">Selected Node</h2>
                <p className="text-xs text-on-surface-variant">Click a card in the tree to inspect that person.</p>
              </div>
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${getTone(selectedUser.positionCode)} flex items-center justify-center text-sm font-black shadow-lg`}>
                    {getInitials(selectedUser.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black tracking-tight text-on-surface truncate">{selectedUser.fullName}</p>
                    <p className="text-sm text-on-surface-variant truncate">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoStat
                    label="Department"
                    value={selectedDepartmentCode === 'all'
                      ? (departmentLabels.get(selectedUser.departmentId ?? '') ?? selectedUser.departmentId ?? '-')
                      : (selectedDepartment?.name ?? selectedUser.departmentId ?? '-')}
                  />
                  <InfoStat
                    label="Position"
                    value={positionLabels.get(selectedUser.positionCode ?? '') ?? toTitleCaseLabel(selectedUser.positionCode)}
                  />
                  <InfoStat
                    label="Reports To"
                    value={selectedUserManager?.fullName ?? 'Top level in current scope'}
                  />
                  <InfoStat
                    label="Direct Reports"
                    value={String(filteredChartRoots.length ? countDirectReports(filteredChartRoots, selectedUser.id) : 0)}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No node selected in the current scope.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[36px] border border-surface-container-high shadow-sm p-4 xl:p-6 overflow-hidden">
          {loading ? (
            <div className="text-sm text-on-surface-variant">Loading organization chart...</div>
          ) : filteredChartRoots.length === 0 ? (
            <div className="text-sm text-on-surface-variant">No users match the current department, search, and active filters.</div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="min-w-max px-2 xl:px-6 py-4 rounded-[32px] bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eef4ff_55%,#ffffff_100%)]">
                <div className="flex justify-center">
                  <div className="org-chart-root">
                    {filteredChartRoots.length === 1 ? (
                      <TreeNode
                        node={filteredChartRoots[0]}
                        selectedUserId={selectedUser?.id ?? ''}
                        onSelect={setSelectedUserId}
                        positionLabels={positionLabels}
                        departmentLabels={departmentLabels}
                        collapsedNodeIds={collapsedNodeIds}
                        onToggleCollapse={toggleCollapse}
                      />
                    ) : (
                      <ul className="org-tree">
                        {filteredChartRoots.map((root) => (
                          <li key={root.id}>
                            <TreeNode
                              node={root}
                              selectedUserId={selectedUser?.id ?? ''}
                              onSelect={setSelectedUserId}
                              positionLabels={positionLabels}
                              departmentLabels={departmentLabels}
                              collapsedNodeIds={collapsedNodeIds}
                              onToggleCollapse={toggleCollapse}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-black tracking-tight text-on-surface break-words">{value}</p>
    </div>
  );
}

function TreeNode({
  node,
  selectedUserId,
  onSelect,
  positionLabels,
  departmentLabels,
  collapsedNodeIds,
  onToggleCollapse,
}: {
  node: ChartNode;
  selectedUserId: string;
  onSelect: (userId: string) => void;
  positionLabels: Map<string, string>;
  departmentLabels: Map<string, string>;
  collapsedNodeIds: string[];
  onToggleCollapse: (userId: string) => void;
}) {
  const isSelected = selectedUserId === node.id;
  const isCollapsed = collapsedNodeIds.includes(node.id);

  return (
    <>
      <div
        className={`node-shell w-[340px] rounded-[30px] border bg-white text-left shadow-sm transition-all overflow-hidden ${
          isSelected
            ? 'border-secondary shadow-xl shadow-secondary/15 -translate-y-0.5'
            : 'border-surface-container-high hover:border-secondary/40 hover:-translate-y-0.5'
        }`}
        style={{ opacity: node.isActive ? 1 : 0.6 }}
      >
        <div className={`px-6 py-3 bg-gradient-to-r ${getTone(node.positionCode)} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-[18px] bg-white/80 flex items-center justify-center text-sm font-black text-slate-900 shrink-0 shadow-sm">
              {getInitials(node.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] truncate opacity-80">
                {positionLabels.get(node.positionCode ?? '') ?? toTitleCaseLabel(node.positionCode)}
              </p>
              <p className="text-sm font-black truncate">
                {departmentLabels.get(node.departmentId ?? '') ?? node.departmentId ?? '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {node.reports.length > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/85 text-slate-700 hover:bg-white"
                title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
            ) : null}
            <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
              {node.reports.length} report{node.reports.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="w-full px-6 py-5 text-left"
        >
          <div className="min-w-0">
            <p className="text-lg font-black text-on-surface truncate">{node.fullName}</p>
            <p className="mt-1 text-sm text-on-surface-variant truncate">{node.email}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {positionLabels.get(node.positionCode ?? '') ?? toTitleCaseLabel(node.positionCode)}
            </span>
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {departmentLabels.get(node.departmentId ?? '') ?? node.departmentId ?? '-'}
            </span>
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {node.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </button>
      </div>

      {node.reports.length > 0 && !isCollapsed ? (
        <ul className="org-tree">
          {node.reports.map((child) => (
            <li key={child.id}>
              <TreeNode
                node={child}
                selectedUserId={selectedUserId}
                onSelect={onSelect}
                positionLabels={positionLabels}
                departmentLabels={departmentLabels}
                collapsedNodeIds={collapsedNodeIds}
                onToggleCollapse={onToggleCollapse}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
