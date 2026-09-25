import { useState } from "react";
import { Audiogram, Employee, FollowUp, FREQUENCIES, Frequency } from "../audio/types";
import { describeFinding, formatHz } from "../audio/rules";
import { ThresholdInput } from "./ThresholdInput";

export const MS_PER_DAY = 86400000;

/** 30 天复查期限 */
export function followUpDeadline(fu: FollowUp): string {
  const d = new Date(fu.openedAt + "T00:00:00");
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / MS_PER_DAY);
}

export function DeadlineTag({ fu, today }: { fu: FollowUp; today: string }) {
  if (fu.status === "completed") {
    return <span className="tag tag-ok">已于 {fu.completedAt} 复查</span>;
  }
  const deadline = followUpDeadline(fu);
  const left = daysBetween(today, deadline);
  if (left < 0) return <span className="tag tag-danger">已逾期 {-left} 天（限 {deadline} 前）</span>;
  if (left <= 7) return <span className="tag tag-danger">剩 {left} 天到期（限 {deadline}）</span>;
  return <span className="tag tag-warn">限 {deadline} 前复查（剩 {left} 天）</span>;
}

export function FindingsText({ followUp }: { followUp: FollowUp }) {
  return (
    <ul className="findings-list">
      {followUp.findings.map((f, i) => (
        <li key={i} className={f.kind === "single" ? "finding-single" : "finding-adjacent"}>
          {describeFinding(f)}
        </li>
      ))}
    </ul>
  );
}

export function ScheduleControl({
  followUp,
  onSchedule,
}: {
  followUp: FollowUp;
  onSchedule: (date: string) => void;
}) {
  const [date, setDate] = useState(followUp.appointmentDate ?? "");
  if (followUp.status === "completed") {
    return <p className="muted-line">预约已完成，原基线与复测曲线保留归档。</p>;
  }
  const deadline = followUpDeadline(followUp);
  const overWindow = date !== "" && date > deadline;
  return (
    <div className="schedule-row">
      <label className="inline-label">
        <span>预约复查日</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button className="primary-action small" disabled={!date} onClick={() => onSchedule(date)}>
        登记预约
      </button>
      {followUp.appointmentDate && (
        <span className="tag tag-info">已预约 {followUp.appointmentDate}</span>
      )}
      {overWindow && <span className="tag tag-danger">超出 30 天复查窗口</span>}
    </div>
  );
}

function emptyFrom(source: Audiogram): Audiogram {
  return { L: { ...source.L }, R: { ...source.R } };
}

/** 完成复查：录入复查听阈，保留原曲线 */
export function CompleteFollowUpForm({
  employee,
  followUp,
  onComplete,
  onCancel,
}: {
  employee: Employee;
  followUp: FollowUp;
  onComplete: (date: string, audiogram: Audiogram, note: string) => void;
  onCancel?: () => void;
}) {
  const triggerExam = employee.exams.find((x) => x.id === followUp.examId);
  const [date, setDate] = useState(followUp.appointmentDate ?? "");
  const [audiogram, setAudiogram] = useState<Audiogram>(() =>
    emptyFrom(triggerExam ? triggerExam.audiogram : ({ L: {}, R: {} } as Audiogram)),
  );
  const [note, setNote] = useState("");

  const setFreq = (ear: "L" | "R") => (f: Frequency, v: number) =>
    setAudiogram((prev) => ({ ...prev, [ear]: { ...prev[ear], [f]: v } }));

  const valid =
    date !== "" && FREQUENCIES.every((f) => Number.isFinite(audiogram.L[f]) && Number.isFinite(audiogram.R[f]));

  return (
    <div className="complete-form">
      <div className="complete-head">
        <h4>复查听阈登记（完成于 30 天窗口内）</h4>
        <p className="muted-line">
          触发复测：{triggerExam?.date ?? "—"} · 频点 {FREQUENCIES.map(formatHz).join(" / ")}，
          已默认带入当次复测值，可按复查结果修改；保存后原曲线保留，基线不变。
        </p>
      </div>
      <div className="form-row">
        <label className="inline-label">
          <span>复查日期</span>
          <input type="date" value={date} max={followUpDeadline(followUp)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="inline-label grow">
          <span>复查说明（可选）</span>
          <input value={note} placeholder="如：脱离噪声 40 小时后复查" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="dual-threshold">
        <ThresholdInput ear="L" values={audiogram.L} onChange={setFreq("L")} />
        <ThresholdInput ear="R" values={audiogram.R} onChange={setFreq("R")} />
      </div>
      <div className="form-actions">
        <button className="primary-action" disabled={!valid} onClick={() => onComplete(date, audiogram, note)}>
          完成复查并归档
        </button>
        {onCancel && <button onClick={onCancel}>取消</button>}
      </div>
    </div>
  );
}
