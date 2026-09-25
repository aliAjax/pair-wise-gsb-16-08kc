import { useMemo, useState, type FormEvent } from "react";
import "./styles.css";
import { useHearingStore } from "./state/useHearingStore";
import {
  allSummaries,
  metricsFor,
  pendingList,
  qualifiedList,
  taskDaysLeft,
  taskDeadline,
} from "./domain/selectors";
import { todayString } from "./domain/hearing";
import type { ExamKind } from "./domain/types";
import FilterBar, { type StatusFilter } from "./components/FilterBar";
import EmployeeDetail from "./components/EmployeeDetail";
import PendingList from "./components/PendingList";
import QualifiedList from "./components/QualifiedList";
import ExamForm from "./components/ExamForm";

type Tab = "dashboard" | "pending" | "qualified" | "entry";

const TABS: { value: Tab; label: string }[] = [
  { value: "dashboard", label: "监护总览" },
  { value: "pending", label: "待复测名单" },
  { value: "qualified", label: "年度合格名单" },
  { value: "entry", label: "检查录入" },
];

function MetricCard({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: number;
  unit?: string;
  tone: "neutral" | "ok" | "warn" | "danger";
  hint?: string;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit && <em>{unit}</em>}
      </strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export default function App() {
  const { state, addEmployee, saveExam, setAppointment, reset } = useHearingStore();
  const today = todayString();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [workshop, setWorkshop] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(state.employees[0]?.id ?? null);

  // 从待复测名单跳转录入时，指定员工与检查类型（用 nonce 强制重置表单）
  const [formRequest, setFormRequest] = useState<{
    employeeId?: string;
    kind?: ExamKind;
    nonce: number;
  }>({ nonce: 0 });

  const summaries = useMemo(() => allSummaries(state), [state]);

  const workshops = useMemo(
    () => [...new Set(summaries.map((s) => s.employee.workshop.split(" · ")[0]))],
    [summaries],
  );

  // 姓名/工号/岗位 + 车间 筛选（状态标签在此基础上再过滤）
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries.filter((s) => {
      if (workshop && s.employee.workshop.split(" · ")[0] !== workshop) return false;
      if (!q) return true;
      const hay = `${s.employee.name} ${s.employee.code} ${s.employee.workshop}`.toLowerCase();
      return hay.includes(q);
    });
  }, [summaries, query, workshop]);

  const counts: Record<StatusFilter, number> = useMemo(
    () => ({
      all: candidates.length,
      pending: candidates.filter((s) => s.status === "pending").length,
      qualified: candidates.filter((s) => s.status === "qualified").length,
      untested: candidates.filter((s) => s.status === "untested").length,
    }),
    [candidates],
  );

  const filtered = useMemo(
    () => (status === "all" ? candidates : candidates.filter((s) => s.status === status)),
    [candidates, status],
  );

  // 筛选后的员工集合：指标、待复测、合格名单、曲线统一使用它
  const filteredIds = useMemo(() => new Set(filtered.map((s) => s.employee.id)), [filtered]);

  const metrics = useMemo(
    () => metricsFor(state, filteredIds, today),
    [state, filteredIds, today],
  );

  const pending = useMemo(() => pendingList(state, filteredIds), [state, filteredIds]);
  const qualified = useMemo(() => qualifiedList(state, filteredIds), [state, filteredIds]);

  const selectedSummary = useMemo(() => {
    if (!selectedId || !filteredIds.has(selectedId)) return null;
    return summaries.find((s) => s.employee.id === selectedId) ?? null;
  }, [selectedId, filteredIds, summaries]);

  const hasBaseline = (employeeId: string) =>
    summaries.some((s) => s.employee.id === employeeId && s.baseline);

  function goToFollowup(employeeId: string) {
    setSelectedId(employeeId);
    setFormRequest({ employeeId, kind: "followup", nonce: Date.now() });
    setTab("entry");
  }

  // 新增员工（录入页小表单）
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newWorkshop, setNewWorkshop] = useState(workshops[0] ?? "冲压车间");
  const [newPost, setNewPost] = useState("");

  function handleAddEmployee(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim() || !newWorkshop.trim()) return;
    const emp = addEmployee({
      name: newName.trim(),
      code: newCode.trim(),
      workshop: `${newWorkshop.trim()}${newPost.trim() ? ` · ${newPost.trim()}` : ""}`,
    });
    setNewName("");
    setNewCode("");
    setNewPost("");
    setSelectedId(emp.id);
    setFormRequest({ employeeId: emp.id, kind: "baseline", nonce: Date.now() });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">职业健康监护 · 噪声岗位</p>
          <h1>职业听力监护台</h1>
          <p className="subtitle">
            按员工、左右耳及 0.5~6 kHz 保存听阈；首次有效检查作为基线单独留档。
            年度复测以基线判定标准阈移：单耳相邻两频点平均提高 ≥10 dB 或任一频点提高 ≥15 dB
            即列入待复测，30 天内完成复查；复查完成前不进入年度合格名单，任何新结果均不覆盖基线。
          </p>
        </div>
        <div className="stack-card">
          <span>判定规则（基线 → 复测）</span>
          <strong>相邻两频点平均 ≥ 10 dB</strong>
          <strong>任一频点 ≥ 15 dB</strong>
          <button
            className="reset-button"
            onClick={() => {
              if (window.confirm("将清空当前全部记录并恢复演示数据，确定吗？")) reset();
            }}
          >
            恢复演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="噪声岗位人数" value={metrics.total} unit="人" tone="neutral" hint="当前筛选范围" />
        <MetricCard label="本年度已复测" value={metrics.tested} unit="人" tone="neutral" />
        <MetricCard
          label="待复测（30 天内复查）"
          value={metrics.pending}
          unit="人"
          tone={metrics.pending > 0 ? "warn" : "ok"}
        />
        <MetricCard
          label="其中已逾期"
          value={metrics.overdue}
          unit="人"
          tone={metrics.overdue > 0 ? "danger" : "ok"}
          hint="超过 30 天复查期限"
        />
        <MetricCard label="年度合格" value={metrics.qualified} unit="人" tone="ok" hint="无未完成复查任务" />
      </section>

      <FilterBar
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        workshops={workshops}
        workshop={workshop}
        onWorkshop={setWorkshop}
        counts={counts}
      />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.value} className={tab === t.value ? "active" : ""} onClick={() => setTab(t.value)}>
            {t.label}
            {t.value === "pending" && pending.length > 0 && (
              <span className="tab-badge">{pending.length}</span>
            )}
            {t.value === "qualified" && (
              <span className="tab-badge muted">{qualified.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <section className="workspace">
          <aside className="panel narrow employee-list-panel">
            <div className="list-head">
              <h2>员工</h2>
              <span>{filtered.length} 人</span>
            </div>
            <div className="employee-list">
              {filtered.map((s) => (
                <button
                  key={s.employee.id}
                  className={`employee-item ${selectedId === s.employee.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(s.employee.id)}
                >
                  <span className="emp-name">
                    {s.employee.name}
                    <em>{s.employee.code}</em>
                  </span>
                  <span className="emp-post">{s.employee.workshop}</span>
                  <span className={`mini-status status-${s.status}`}>
                    {s.status === "pending"
                      ? `待复测${s.openTasks.some((t) => taskDaysLeft(t, today) < 0) ? " · 逾期" : ""}`
                      : s.status === "qualified"
                        ? "年度合格"
                        : "未复测"}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && <p className="empty-hint">没有符合筛选条件的员工。</p>}
            </div>
          </aside>

          <section className="panel">
            <EmployeeDetail summary={selectedSummary} />
          </section>
        </section>
      )}

      {tab === "pending" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>标准阈移（STS）跟进</p>
              <h2>待复测名单</h2>
            </div>
            <span className="heading-count">{pending.length} 人待复查</span>
          </div>
          <PendingList
            state={state}
            tasks={pending}
            onSetAppointment={setAppointment}
            onScheduleFollowup={goToFollowup}
          />
        </section>
      )}

      {tab === "qualified" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>年度听力监护结论</p>
              <h2>年度合格名单</h2>
            </div>
            <span className="heading-count">{qualified.length} 人</span>
          </div>
          <QualifiedList
            summaries={qualified}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("dashboard");
            }}
          />
        </section>
      )}

      {tab === "entry" && (
        <section className="entry-stack">
          <div className="panel">
            <div className="section-heading">
              <div>
                <p>阈值录入</p>
                <h2>检查记录</h2>
              </div>
            </div>
            <ExamForm
              key={formRequest.nonce}
              employees={summaries.map((s) => s.employee)}
              hasBaseline={hasBaseline}
              pendingTasks={state.tasks.filter((t) => t.status === "pending")}
              defaultEmployeeId={formRequest.employeeId}
              defaultKind={formRequest.kind}
              onSave={saveExam}
            />
          </div>

          <div className="panel">
            <div className="section-heading">
              <div>
                <p>新入职 / 新转岗到噪声岗位</p>
                <h2>新增员工</h2>
              </div>
            </div>
            <form className="add-employee-form" onSubmit={handleAddEmployee}>
              <label>
                <span>姓名</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="姓名" required />
              </label>
              <label>
                <span>工号</span>
                <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="如 CJ-2100" required />
              </label>
              <label>
                <span>车间</span>
                <input value={newWorkshop} onChange={(e) => setNewWorkshop(e.target.value)} list="workshop-list" required />
                <datalist id="workshop-list">
                  {workshops.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>岗位（可空）</span>
                <input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="如 冲压工" />
              </label>
              <button type="submit" className="primary-action">
                新增并录入基线
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="section-heading">
              <div>
                <p>待复查期限速览</p>
                <h2>未完成任务预约情况</h2>
              </div>
            </div>
            <div className="appointment-overview">
              {state.tasks
                .filter((t) => t.status === "pending")
                .map((t) => {
                  const emp = state.employees.find((e) => e.id === t.employeeId);
                  return (
                    <div key={t.id} className="appt-row">
                      <span>{emp?.name}</span>
                      <span>期限 {taskDeadline(t)}</span>
                      <span>{t.appointmentDate ? `已约 ${t.appointmentDate}` : "未预约"}</span>
                      <button className="mini" onClick={() => goToFollowup(t.employeeId)}>
                        录入复查
                      </button>
                    </div>
                  );
                })}
              {state.tasks.every((t) => t.status === "completed") && (
                <p className="empty-hint">当前没有未完成的复查任务。</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
