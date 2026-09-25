import { Fragment, useMemo, useState, type FormEvent } from "react";
import type { Employee, ExamKind, FollowupTask, ThresholdMap } from "../domain/types";
import {
  EARS,
  FREQUENCIES,
  FREQUENCY_LABELS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  emptyThresholds,
  todayString,
} from "../domain/hearing";
import type { SaveExamResult } from "../state/useHearingStore";

interface Props {
  employees: Employee[];
  /** 每个员工是否已有基线（决定能否录首次检查） */
  hasBaseline: (employeeId: string) => boolean;
  /** 待复测任务（复查录入用） */
  pendingTasks: FollowupTask[];
  defaultEmployeeId?: string;
  defaultKind?: ExamKind;
  onSave: (input: {
    employeeId: string;
    kind: ExamKind;
    date: string;
    thresholds: ThresholdMap;
    taskId?: string;
  }) => SaveExamResult;
}

const KIND_LABEL: Record<ExamKind, string> = {
  baseline: "首次有效检查（基线）",
  annual: "年度复测",
  followup: "复查（阈移后 30 天内）",
};

export default function ExamForm({
  employees,
  hasBaseline,
  pendingTasks,
  defaultEmployeeId,
  defaultKind,
  onSave,
}: Props) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? employees[0]?.id ?? "");
  const [kind, setKind] = useState<ExamKind>(defaultKind ?? "annual");
  const [date, setDate] = useState(todayString());
  const [taskId, setTaskId] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const { value: ear } of EARS) {
      FREQUENCIES.forEach((_, i) => {
        init[`${ear}-${i}`] = "";
      });
    }
    return init;
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const employeeTasks = useMemo(
    () => pendingTasks.filter((t) => t.employeeId === employeeId),
    [pendingTasks, employeeId],
  );

  const baselineReady = employeeId ? hasBaseline(employeeId) : false;

  // 切换员工时，如果当前类型不可用则自动调整
  const effectiveKind: ExamKind = (() => {
    if (kind === "baseline" && baselineReady) return "annual";
    if (kind === "followup" && employeeTasks.length === 0) {
      return baselineReady ? "annual" : "baseline";
    }
    if (kind === "annual" && !baselineReady) return "baseline";
    return kind;
  })();

  const effectiveTaskId =
    effectiveKind === "followup"
      ? employeeTasks.some((t) => t.id === taskId)
        ? taskId
        : employeeTasks[0]?.id ?? ""
      : "";

  function setValue(ear: string, index: number, raw: string) {
    setValues((v) => ({ ...v, [`${ear}-${index}`]: raw }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setMessage({ ok: false, text: "请先选择员工。" });
      return;
    }
    const thresholds = emptyThresholds();
    for (const { value: ear } of EARS) {
      FREQUENCIES.forEach((_, i) => {
        const raw = values[`${ear}-${i}`].trim();
        thresholds[ear][i] = raw === "" ? NaN : Number(raw);
      });
    }
    const result = onSave({
      employeeId,
      kind: effectiveKind,
      date,
      thresholds,
      taskId: effectiveKind === "followup" ? effectiveTaskId : undefined,
    });
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      setValues((v) => {
        const cleared: Record<string, string> = {};
        for (const key of Object.keys(v)) cleared[key] = "";
        return cleared;
      });
    }
  }

  return (
    <form className="exam-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          <span>员工</span>
          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setMessage(null);
            }}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.code} · {emp.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>检查类型</span>
          <select
            value={effectiveKind}
            onChange={(e) => setKind(e.target.value as ExamKind)}
          >
            <option value="baseline" disabled={baselineReady}>
              {KIND_LABEL.baseline}
              {baselineReady ? "（已建立）" : ""}
            </option>
            <option value="annual" disabled={!baselineReady}>
              {KIND_LABEL.annual}
              {!baselineReady ? "（需先建基线）" : ""}
            </option>
            <option value="followup" disabled={employeeTasks.length === 0}>
              {KIND_LABEL.followup}
              {employeeTasks.length === 0 ? "（无待复测任务）" : ""}
            </option>
          </select>
        </label>
        <label>
          <span>检查日期</span>
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {effectiveKind === "followup" && (
          <label>
            <span>对应待复测任务</span>
            <select value={effectiveTaskId} onChange={(e) => setTaskId(e.target.value)}>
              {employeeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.triggerDate} 触发 · {t.findings.length} 项阈移
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="threshold-grid">
        <div className="threshold-head" />
        {FREQUENCY_LABELS.map((label) => (
          <div key={label} className="threshold-head">
            {label} kHz
          </div>
        ))}
        {EARS.map(({ value: ear, label }) => (
          <Fragment key={ear}>
            <div className="threshold-ear">{label}</div>
            {FREQUENCIES.map((_, i) => (
              <input
                key={`${ear}-${i}`}
                type="number"
                inputMode="numeric"
                min={THRESHOLD_MIN}
                max={THRESHOLD_MAX}
                step={5}
                placeholder="—"
                value={values[`${ear}-${i}`]}
                onChange={(e) => setValue(ear, i, e.target.value)}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <p className="form-hint">
        单位 dB HL，范围 {THRESHOLD_MIN} ~ {THRESHOLD_MAX}，须双耳 6 个频点全部填写才能保存。
      </p>

      <div className="form-actions">
        <button type="submit" className="primary-action">
          保存{KIND_LABEL[effectiveKind].split("（")[0]}
        </button>
        {message && (
          <span className={message.ok ? "form-message ok" : "form-message error"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
