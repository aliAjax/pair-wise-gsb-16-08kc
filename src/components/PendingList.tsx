import { useState } from "react";
import type { DataState, FollowupTask } from "../domain/types";
import {
  FOLLOWUP_DAYS,
  describeFinding,
  todayString,
} from "../domain/hearing";
import { taskDeadline, taskDaysLeft } from "../domain/selectors";

interface Props {
  state: DataState;
  tasks: FollowupTask[];
  onSetAppointment: (taskId: string, date: string | null) => void;
  /** 从待复测单直接跳到员工复查录入 */
  onScheduleFollowup: (employeeId: string) => void;
}

export default function PendingList({
  state,
  tasks,
  onSetAppointment,
  onScheduleFollowup,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const today = todayString();

  if (tasks.length === 0) {
    return <p className="empty-hint">当前筛选范围内没有待复测员工。</p>;
  }

  return (
    <div className="pending-list">
      {tasks.map((task) => {
        const employee = state.employees.find((e) => e.id === task.employeeId);
        const triggerExam = state.exams.find((e) => e.id === task.triggerExamId);
        if (!employee) return null;
        const deadline = taskDeadline(task);
        const daysLeft = taskDaysLeft(task, today);
        const overdue = daysLeft < 0;
        const urgencyClass = overdue ? "overdue" : daysLeft <= 7 ? "soon" : "normal";

        return (
          <article key={task.id} className={`pending-card ${urgencyClass}`}>
            <div className="pending-head">
              <div>
                <h4>
                  {employee.name}
                  <span className="muted-code">{employee.code}</span>
                </h4>
                <p className="pending-meta">
                  复测日 {task.triggerDate}
                  {triggerExam && <> · 基线对比</>} · 复查期限 {deadline}
                  （{FOLLOWUP_DAYS} 天）
                </p>
              </div>
              <span className={`deadline-badge ${urgencyClass}`}>
                {overdue
                  ? `已逾期 ${Math.abs(daysLeft)} 天`
                  : daysLeft === 0
                    ? "今天到期"
                    : `剩余 ${daysLeft} 天`}
              </span>
            </div>

            <ul className="finding-list">
              {task.findings.map((f, i) => (
                <li key={i}>{describeFinding(f)}</li>
              ))}
            </ul>

            <div className="pending-foot">
              <div className="appointment">
                {editing === task.id ? (
                  <>
                    <label className="inline-date">
                      <span>预约日</span>
                      <input
                        type="date"
                        value={draftDate}
                        onChange={(e) => setDraftDate(e.target.value)}
                      />
                    </label>
                    <button
                      className="mini primary-action"
                      onClick={() => {
                        onSetAppointment(task.id, draftDate || null);
                        setEditing(null);
                      }}
                    >
                      确定
                    </button>
                    <button className="mini" onClick={() => setEditing(null)}>
                      取消
                    </button>
                  </>
                ) : task.appointmentDate ? (
                  <>
                    <span className="appt-set">
                      已预约：<strong>{task.appointmentDate}</strong>
                      {task.appointmentDate < today && (
                        <em className="overdue-text">（预约日已过）</em>
                      )}
                    </span>
                    <button
                      className="mini"
                      onClick={() => {
                        setDraftDate(task.appointmentDate ?? "");
                        setEditing(task.id);
                      }}
                    >
                      改约
                    </button>
                  </>
                ) : (
                  <>
                    <span className="appt-empty">尚未预约复查日</span>
                    <button
                      className="mini primary-action"
                      onClick={() => {
                        setDraftDate(deadline);
                        setEditing(task.id);
                      }}
                    >
                      登记预约日
                    </button>
                  </>
                )}
              </div>
              <button
                className="mini primary-action"
                onClick={() => onScheduleFollowup(employee.id)}
              >
                录入复查结果
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
