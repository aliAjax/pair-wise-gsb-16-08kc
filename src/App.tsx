import { useMemo, useState } from "react";
import "./styles.css";
import { Audiogram, Employee } from "./audio/types";
import { addExam, completeFollowUp, hasOpenFollowUp, latestAnnual, scheduleFollowUp } from "./audio/records";
import { describeFinding } from "./audio/rules";
import { loadEmployees, resetEmployees, saveEmployees } from "./audio/storage";
import { EmployeeDetail } from "./components/EmployeeDetail";
import { DeadlineTag, followUpDeadline } from "./components/FollowUpActions";

type StatusFilter = "all" | "pending" | "qualified" | "due";

interface Filters {
  workshop: string;
  status: StatusFilter;
  keyword: string;
}

const TODAY = new Date().toISOString().slice(0, 10);

function statusOf(emp: Employee): "none" | "pending" | "qualified" {
  if (hasOpenFollowUp(emp)) return "pending";
  return latestAnnual(emp) ? "qualified" : "none";
}

function NewEmployeeForm({
  workshops,
  onAdd,
  onCancel,
}: {
  workshops: string[];
  onAdd: (data: { id: string; name: string; workshop: string; post: string; tenure: number }) => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState(workshops[0] ?? "");
  const [post, setPost] = useState("");
  const [tenure, setTenure] = useState(0);
  const valid = id.trim() !== "" && name.trim() !== "" && workshop !== "" && post.trim() !== "";

  return (
    <div className="new-employee-form">
      <label>
        <span>工号</span>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="如 G-1301" />
      </label>
      <label>
        <span>姓名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span>车间</span>
        <input value={workshop} list="workshop-list" onChange={(e) => setWorkshop(e.target.value)} />
        <datalist id="workshop-list">
          {workshops.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </label>
      <label>
        <span>噪声岗位</span>
        <input value={post} onChange={(e) => setPost(e.target.value)} placeholder="如 冲压操作工" />
      </label>
      <label>
        <span>接触工龄（年）</span>
        <input type="number" min={0} value={tenure} onChange={(e) => setTenure(Number(e.target.value))} />
      </label>
      <div className="form-actions">
        <button
          className="primary-action"
          disabled={!valid}
          onClick={() => onAdd({ id: id.trim(), name: name.trim(), workshop, post: post.trim(), tenure })}
        >
          建档
        </button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function App() {
  const [employees, setEmployees] = useState<Employee[]>(() => loadEmployees());
  const [selectedId, setSelectedId] = useState<string | null>(() => null);
  const [filters, setFilters] = useState<Filters>({ workshop: "all", status: "all", keyword: "" });
  const [addingEmployee, setAddingEmployee] = useState(false);

  const workshops = useMemo(
    () => [...new Set(employees.map((e) => e.workshop))],
    [employees],
  );

  const matches = (emp: Employee): boolean => {
    if (filters.workshop !== "all" && emp.workshop !== filters.workshop) return false;
    if (filters.keyword.trim() !== "") {
      const kw = filters.keyword.trim().toLowerCase();
      if (!(`${emp.name} ${emp.id} ${emp.post}`.toLowerCase().includes(kw))) return false;
    }
    if (filters.status !== "all") {
      const st = statusOf(emp);
      if (filters.status === "pending" && st !== "pending") return false;
      if (filters.status === "qualified" && st !== "qualified") return false;
      if (filters.status === "due") {
        // 待复测且未预约（或已逾期）
        const due = emp.followUps.some(
          (fu) =>
            fu.status === "open" &&
            (fu.appointmentDate === null ||
              fu.appointmentDate > followUpDeadline(fu) ||
              TODAY > followUpDeadline(fu)),
        );
        if (!due) return false;
      }
    }
    return true;
  };

  // 筛选后的员工集合：指标、名单、曲线（详情仅可选中筛选范围内员工）同步受其影响
  const filtered = useMemo(() => employees.filter(matches), [employees, filters]);

  const selected =
    (selectedId !== null ? filtered.find((e) => e.id === selectedId) : undefined) ?? filtered[0] ?? null;

  // —— 指标（随筛选变化）——
  const openCount = filtered.filter((e) => statusOf(e) === "pending").length;
  const qualifiedCount = filtered.filter((e) => statusOf(e) === "qualified").length;
  const overdueCount = filtered.reduce(
    (n, e) =>
      n +
      e.followUps.filter(
        (fu) => fu.status === "open" && (TODAY > followUpDeadline(fu) || fu.appointmentDate === null),
      ).length,
    0,
  );

  // —— 名单（随筛选变化）——
  const pendingList = filtered
    .flatMap((emp) =>
      emp.followUps
        .filter((fu) => fu.status === "open")
        .map((fu) => ({ emp, fu, exam: emp.exams.find((x) => x.id === fu.examId) })),
    )
    .sort((a, b) => followUpDeadline(a.fu).localeCompare(followUpDeadline(b.fu)));

  const qualifiedList = filtered.filter((e) => statusOf(e) === "qualified");

  const commit = (updater: (prev: Employee[]) => Employee[]) =>
    setEmployees((prev) => {
      const next = updater(prev);
      saveEmployees(next);
      return next;
    });

  const handleAddEmployee = (data: { id: string; name: string; workshop: string; post: string; tenure: number }) => {
    if (employees.some((e) => e.id === data.id)) {
      alert("该工号已存在");
      return;
    }
    commit((prev) => [...prev, { ...data, exams: [], followUps: [] }]);
    setAddingEmployee(false);
    setSelectedId(data.id);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">职业健康监护 · 噪声岗位年度听力复测</p>
          <h1>职业听力监护台</h1>
          <p className="subtitle">
            按员工、左右耳与 0.5–6kHz 保存听阈；首次有效检查（基线）与年度复测分开留档。
            复测对照片线：单耳任一频点提高 ≥15 dB，或相邻两频点平均提高 ≥10 dB，即判定标准听阈推移、列入 30 天内待复测。
          </p>
        </div>
        <div className="stack-card">
          <span>数据保存在本机浏览器</span>
          <strong>关闭再打开，记录与预约仍在</strong>
          <button
            className="reset-btn"
            onClick={() => {
              if (confirm("恢复为示例档案？当前录入将被清除。")) {
                const seeded = resetEmployees();
                setEmployees(seeded);
                setSelectedId(null);
              }
            }}
          >
            恢复示例数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>筛选范围内员工</span>
          <strong>{filtered.length}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>待复测（阈移）</span>
          <strong>{openCount}</strong>
          <i className="status-danger" />
        </article>
        <article className="metric-card">
          <span>待安排 / 已逾期</span>
          <strong>{overdueCount}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>年度合格名单</span>
          <strong>{qualifiedCount}</strong>
          <i className="status-ok" />
        </article>
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <div className="section-heading tight">
            <h2>员工筛选</h2>
            <button className="primary-action small" onClick={() => setAddingEmployee((v) => !v)}>
              {addingEmployee ? "收起" : "新员工建档"}
            </button>
          </div>

          {addingEmployee && (
            <NewEmployeeForm
              workshops={workshops}
              onAdd={handleAddEmployee}
              onCancel={() => setAddingEmployee(false)}
            />
          )}

          <label className="filter-field">
            <span>姓名 / 工号 / 岗位</span>
            <input
              placeholder="搜索员工"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </label>

          <div className="filter-group">
            <span className="filter-caption">车间</span>
            <div className="chips muted selectable">
              <button
                className={filters.workshop === "all" ? "chip-active" : ""}
                onClick={() => setFilters({ ...filters, workshop: "all" })}
              >
                全部车间
              </button>
              {workshops.map((w) => (
                <button
                  key={w}
                  className={filters.workshop === w ? "chip-active" : ""}
                  onClick={() => setFilters({ ...filters, workshop: w })}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-caption">监护状态</span>
            <div className="chips muted selectable status-chips">
              <button className={filters.status === "all" ? "chip-active" : ""} onClick={() => setFilters({ ...filters, status: "all" })}>
                全部
              </button>
              <button className={filters.status === "pending" ? "chip-active" : ""} onClick={() => setFilters({ ...filters, status: "pending" })}>
                待复测
              </button>
              <button className={filters.status === "due" ? "chip-active" : ""} onClick={() => setFilters({ ...filters, status: "due" })}>
                待安排/逾期
              </button>
              <button className={filters.status === "qualified" ? "chip-active" : ""} onClick={() => setFilters({ ...filters, status: "qualified" })}>
                年度合格
              </button>
            </div>
          </div>

          <div className="roster">
            <span className="filter-caption">员工名册（{filtered.length}）</span>
            {filtered.map((emp) => {
              const st = statusOf(emp);
              return (
                <button
                  key={emp.id}
                  className={`roster-item ${selected?.id === emp.id ? "active" : ""}`}
                  onClick={() => setSelectedId(emp.id)}
                >
                  <span className="roster-name">
                    {emp.name} <i>{emp.id}</i>
                  </span>
                  <span className="roster-meta">{emp.workshop}</span>
                  {st === "pending" && <span className="dot dot-danger" title="待复测" />}
                  {st === "qualified" && <span className="dot dot-ok" title="年度合格" />}
                  {st === "none" && <span className="dot dot-idle" title="未复测" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="muted-line empty-hint">没有符合筛选条件的员工</p>}
          </div>
        </aside>

        <section className="panel">
          {selected ? (
            <EmployeeDetail
              key={selected.id}
              employee={selected}
              today={TODAY}
              onAddExam={(exam) =>
                commit((prev) => addExam(prev, selected.id, exam))
              }
              onSchedule={(fuId, date) => commit((prev) => scheduleFollowUp(prev, selected.id, fuId, date))}
              onComplete={(fuId, date, audiogram, note) =>
                commit((prev) => completeFollowUp(prev, selected.id, fuId, date, audiogram, note))
              }
            />
          ) : (
            <p className="muted-line empty-hint">请先在左侧选择或新建员工。</p>
          )}
        </section>
      </section>

      <section className="lists-grid">
        <section className="panel list-panel">
          <div className="section-heading">
            <div>
              <p>30 天复查窗口</p>
              <h2>待复测名单（{pendingList.length}）</h2>
            </div>
          </div>
          <div className="pending-list">
            {pendingList.map(({ emp, fu, exam }) => (
              <button key={fu.id} className="pending-card" onClick={() => setSelectedId(emp.id)}>
                <div className="pending-top">
                  <strong>
                    {emp.name} <i>{emp.id}</i>
                  </strong>
                  <DeadlineTag fu={fu} today={TODAY} />
                </div>
                <p className="muted-line">
                  {emp.workshop} · 复测日 {exam?.date ?? "—"}
                  {fu.appointmentDate ? ` · 已预约 ${fu.appointmentDate}` : " · 尚未预约"}
                </p>
                <ul className="findings-list compact">
                  {fu.findings.map((f, i) => (
                    <li key={i}>{describeFinding(f)}</li>
                  ))}
                </ul>
              </button>
            ))}
            {pendingList.length === 0 && <p className="muted-line empty-hint">当前筛选范围内没有待复测人员。</p>}
          </div>
        </section>

        <section className="panel list-panel">
          <div className="section-heading">
            <div>
              <p>完成年度复测且无未结待复测</p>
              <h2>年度合格名单（{qualifiedList.length}）</h2>
            </div>
          </div>
          <div className="qualified-list">
            {qualifiedList.map((emp) => {
              const info = latestAnnual(emp);
              return (
                <button key={emp.id} className="qualified-card" onClick={() => setSelectedId(emp.id)}>
                  <strong>
                    {emp.name} <i>{emp.id}</i>
                  </strong>
                  <span className="muted-line">
                    {emp.workshop} · 复测日 {info?.exam.date}
                  </span>
                  <span className="tag tag-ok">合格</span>
                </button>
              );
            })}
            {qualifiedList.length === 0 && (
              <p className="muted-line empty-hint">待复测未完成的员工不会进入本名单。</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
