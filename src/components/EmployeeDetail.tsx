import { useState } from "react";
import { Audiogram, Employee } from "../audio/types";
import { findBaseline, formatHz, pta } from "../audio/rules";
import { latestAnnual } from "../audio/records";
import { AudiogramChart } from "./AudiogramChart";
import { ExamForm } from "./ExamForm";
import {
  CompleteFollowUpForm,
  DeadlineTag,
  FindingsText,
  ScheduleControl,
} from "./FollowUpActions";
import { HearingExam } from "../audio/types";

function ExamHistory({ employee }: { employee: Employee }) {
  const baseline = findBaseline(employee.exams);
  const annuals = employee.exams
    .filter((e) => e.kind === "annual")
    .sort((a, b) => b.date.localeCompare(a.date));

  const Row = ({ exam, tag }: { exam: HearingExam; tag: string }) => (
    <div className="exam-row">
      <div className="exam-row-main">
        <span className={`tag ${exam.kind === "baseline" ? "tag-baseline" : "tag-annual"}`}>{tag}</span>
        <strong>{exam.date}</strong>
        <span className="muted-line">{exam.tester}</span>
        {exam.note && <span className="muted-line note-clamp">{exam.note}</span>}
      </div>
      <div className="exam-row-pts">
        <span className="pta">
          左 PTA <b>{pta(exam.audiogram.L)}</b>
        </span>
        <span className="pta">
          右 PTA <b>{pta(exam.audiogram.R)}</b>
        </span>
        <span className="freq-cells">
          {(["L", "R"] as const).map((ear) =>
            ([500, 1000, 2000, 3000, 4000, 6000] as const).map((f) => (
              <i key={`${ear}${f}`} title={`${ear === "L" ? "左" : "右"}耳 ${formatHz(f)}`}>
                {exam.audiogram[ear][f]}
              </i>
            )),
          )}
        </span>
      </div>
    </div>
  );

  return (
    <div className="exam-history">
      {baseline && <Row exam={baseline} tag="首次有效检查 · 基线" />}
      {annuals.map((exam) => (
        <Row key={exam.id} exam={exam} tag="年度复测" />
      ))}
      {!baseline && <p className="muted-line">尚无首次有效检查，请先录入基线。</p>}
    </div>
  );
}

export function EmployeeDetail({
  employee,
  today,
  onAddExam,
  onSchedule,
  onComplete,
}: {
  employee: Employee;
  today: string;
  onAddExam: (exam: Omit<HearingExam, "id">) => void;
  onSchedule: (followUpId: string, date: string) => void;
  onComplete: (followUpId: string, date: string, audiogram: Audiogram, note: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "newExam" | "complete">("view");
  const [activeFu, setActiveFu] = useState<string | null>(null);

  const baseline = findBaseline(employee.exams);
  const annualInfo = latestAnnual(employee);
  const openFu = employee.followUps.find((f) => f.id === activeFu && f.status === "open") ?? null;

  const curves = [];
  if (baseline) {
    curves.push({ label: `基线 ${baseline.date}`, audiogram: baseline.audiogram, tone: "baseline" as const });
  }
  if (annualInfo) {
    curves.push({ label: `复测 ${annualInfo.exam.date}`, audiogram: annualInfo.exam.audiogram, tone: "annual" as const });
  }
  const confirmed = employee.followUps
    .filter((f) => f.status === "completed" && f.confirmAudiogram)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  if (confirmed?.confirmAudiogram) {
    curves.push({ label: `复查 ${confirmed.completedAt}`, audiogram: confirmed.confirmAudiogram, tone: "confirm" as const });
  }

  const pending = employee.followUps.some((f) => f.status === "open");

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>
            {employee.name} <span className="emp-id">{employee.id}</span>
          </h2>
          <p className="muted-line">
            {employee.workshop} · {employee.post} · 噪声接触 {employee.tenure} 年
          </p>
        </div>
        <div className="detail-actions">
          {pending && <span className="tag tag-danger">待复测中 · 暂不入年度合格名单</span>}
          {!pending && annualInfo && <span className="tag tag-ok">年度听力监护合格</span>}
          {!annualInfo && <span className="tag tag-warn">本年度尚未复测</span>}
          <button className="primary-action" onClick={() => setMode(mode === "newExam" ? "view" : "newExam")}>
            {mode === "newExam" ? "收起录入" : "录入检查"}
          </button>
        </div>
      </div>

      {mode === "newExam" && (
        <div className="panel-inset">
          <ExamForm
            employee={employee}
            onSave={(exam) => {
              onAddExam(exam);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
          />
        </div>
      )}

      <div className="chart-card">
        <AudiogramChart curves={curves} findings={annualInfo?.findings ?? []} />
      </div>

      {employee.followUps.length > 0 && (
        <div className="followup-section">
          <h3>待复测 / 复查随访</h3>
          {[...employee.followUps]
            .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
            .map((fu) => {
              const exam = employee.exams.find((x) => x.id === fu.examId);
              const showForm = mode === "complete" && activeFu === fu.id;
              return (
                <article key={fu.id} className={`followup-card ${fu.status === "open" ? "open" : "done"}`}>
                  <div className="followup-head">
                    <div>
                      <strong>由 {exam?.date ?? "—"} 年度复测触发</strong>
                      <DeadlineTag fu={fu} today={today} />
                      {fu.appointmentDate && fu.status === "open" && (
                        <span className="tag tag-info">预约日 {fu.appointmentDate}</span>
                      )}
                    </div>
                    {fu.status === "open" && !showForm && (
                      <button
                        className="primary-action small"
                        onClick={() => {
                          setMode("complete");
                          setActiveFu(fu.id);
                        }}
                      >
                        登记复查结果
                      </button>
                    )}
                  </div>
                  <FindingsText followUp={fu} />
                  {fu.status === "open" && !showForm && (
                    <ScheduleControl
                      followUp={fu}
                      onSchedule={(date) => onSchedule(fu.id, date)}
                    />
                  )}
                  {showForm && (
                    <CompleteFollowUpForm
                      employee={employee}
                      followUp={fu}
                      onComplete={(date, audiogram, note) => {
                        onComplete(fu.id, date, audiogram, note);
                        setMode("view");
                        setActiveFu(null);
                      }}
                      onCancel={() => {
                        setMode("view");
                        setActiveFu(null);
                      }}
                    />
                  )}
                  {fu.status === "completed" && fu.note && <p className="muted-line">复查说明：{fu.note}</p>}
                </article>
              );
            })}
        </div>
      )}

      <div className="archive-section">
        <h3>检查留档（首次有效检查与复测分开保存）</h3>
        <ExamHistory employee={employee} />
      </div>
    </div>
  );
}
