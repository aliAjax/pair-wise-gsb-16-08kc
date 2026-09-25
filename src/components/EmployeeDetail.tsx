import type { EmployeeSummary } from "../domain/selectors";
import {
  describeFinding,
  earLabel,
  pta,
} from "../domain/hearing";
import Audiogram from "./Audiogram";

interface Props {
  summary: EmployeeSummary | null;
}

const EXAM_LABEL = {
  baseline: "基线（首次有效检查）",
  annual: "年度复测",
  followup: "复查",
} as const;

function ThresholdRow({ label, values }: { label: string; values: number[] }) {
  return (
    <div className="archive-row">
      <span className="archive-ear">{label}</span>
      {values.map((v, i) => (
        <span key={i} className="archive-db">
          {v}
        </span>
      ))}
      <span className="archive-pta">PTA {pta(values)} dB</span>
    </div>
  );
}

export default function EmployeeDetail({ summary }: Props) {
  if (!summary) {
    return <p className="empty-hint">请选择左侧员工查看听力曲线与留档。</p>;
  }

  const { employee, baseline, latestAnnual, followups, openTasks, latestFindings } = summary;

  const series = [];
  if (baseline) {
    series.push({ exam: baseline, variant: "baseline" as const, label: `基线 ${baseline.date}` });
  }
  if (latestAnnual) {
    series.push({
      exam: latestAnnual,
      variant: "annual" as const,
      label: `复测 ${latestAnnual.date}`,
    });
  }
  for (const f of followups) {
    series.push({
      exam: f,
      variant: "followup" as const,
      label: `复查 ${f.date}`,
    });
  }

  return (
    <div className="employee-detail">
      <div className="detail-head">
        <div>
          <h3>
            {employee.name}
            <span className="muted-code">{employee.code}</span>
          </h3>
          <p>{employee.workshop}</p>
        </div>
        <div className="detail-status">
          {openTasks.length > 0 ? (
            <span className="status-pill pending">待复测</span>
          ) : latestAnnual ? (
            <span className="status-pill qualified">年度合格</span>
          ) : (
            <span className="status-pill untested">未复测</span>
          )}
        </div>
      </div>

      {!baseline && (
        <div className="notice warning">
          该员工尚无基线（首次有效检查），请先在下方录入首次有效检查，年度复测才能据此判定阈移。
        </div>
      )}

      {baseline && !latestAnnual && (
        <div className="notice">基线已建立，等待本年度复测。</div>
      )}

      {latestAnnual && latestFindings.length > 0 && (
        <div className="notice danger">
          <strong>最近复测检出阈移 {latestFindings.length} 项：</strong>
          <ul>
            {latestFindings.map((f, i) => (
              <li key={i}>{describeFinding(f)}</li>
            ))}
          </ul>
          {openTasks.length > 0
            ? "已列入待复测名单，请在 30 天内完成复查；完成前不计入年度合格名单。"
            : "复查已完成，原基线与复测曲线均保留。"}
        </div>
      )}

      {latestAnnual && latestFindings.length === 0 && (
        <div className="notice ok">
          最近年度复测相对基线未发生标准阈移（相邻两频点平均 ≥10 dB 或单频点 ≥15 dB）。
        </div>
      )}

      {series.length > 0 && (
        <Audiogram series={series} findings={latestFindings} />
      )}

      <div className="archive">
        <h4>检查留档（按类型分开保存，基线不可覆盖）</h4>
        {[
          ...(baseline ? [baseline] : []),
          ...(latestAnnual ? [latestAnnual] : []),
          ...followups,
        ].map((exam) => (
          <div key={exam.id} className={`archive-card kind-${exam.kind}`}>
            <div className="archive-card-head">
              <span className="kind-tag">{EXAM_LABEL[exam.kind]}</span>
              <span>{exam.date}</span>
            </div>
            <div className="archive-grid-head">
              <span />
              {["0.5k", "1k", "2k", "3k", "4k", "6k"].map((f) => (
                <span key={f}>{f}</span>
              ))}
              <span />
            </div>
            <ThresholdRow label="左耳" values={exam.thresholds.left} />
            <ThresholdRow label={earLabel("right")} values={exam.thresholds.right} />
          </div>
        ))}
        {!baseline && <p className="empty-hint">暂无检查记录。</p>}
      </div>
    </div>
  );
}
