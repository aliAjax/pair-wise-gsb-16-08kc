import type { EmployeeSummary } from "../domain/selectors";
import { pta } from "../domain/hearing";

interface Props {
  summaries: EmployeeSummary[];
  onSelect: (employeeId: string) => void;
}

export default function QualifiedList({ summaries, onSelect }: Props) {
  if (summaries.length === 0) {
    return <p className="empty-hint">当前筛选范围内暂无可列入年度合格名单的员工。</p>;
  }

  return (
    <div className="qualified-table-wrap">
      <table className="qualified-table">
        <thead>
          <tr>
            <th>工号</th>
            <th>姓名</th>
            <th>岗位</th>
            <th>基线日期</th>
            <th>复测日期</th>
            <th>左耳 PTA</th>
            <th>右耳 PTA</th>
            <th>结论</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const lPta = s.latestAnnual ? pta(s.latestAnnual.thresholds.left) : null;
            const rPta = s.latestAnnual ? pta(s.latestAnnual.thresholds.right) : null;
            return (
              <tr key={s.employee.id} onClick={() => onSelect(s.employee.id)}>
                <td>{s.employee.code}</td>
                <td>{s.employee.name}</td>
                <td className="workshop-cell">{s.employee.workshop}</td>
                <td>{s.baseline?.date ?? "—"}</td>
                <td>{s.latestAnnual?.date ?? "—"}</td>
                <td>{lPta === null ? "—" : `${lPta} dB`}</td>
                <td>{rPta === null ? "—" : `${rPta} dB`}</td>
                <td>
                  <span className="ok-pill">
                    {s.completedTasks.length > 0 ? "复查后合格" : "年度合格"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="table-hint">
        共 {summaries.length} 人 · 存在未完成复查任务的员工不会出现在此名单中，复查完成后恢复。
      </p>
    </div>
  );
}
