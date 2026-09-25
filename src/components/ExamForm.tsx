import { useMemo, useState } from "react";
import {
  Audiogram,
  Employee,
  ExamKind,
  FREQUENCIES,
  Frequency,
  HearingExam,
  ShiftFinding,
} from "../audio/types";
import { describeFinding, findBaseline, judgeShift } from "../audio/rules";
import { ThresholdInput } from "./ThresholdInput";

function blankAudiogram(): Audiogram {
  const row = () =>
    FREQUENCIES.reduce((acc, f) => {
      acc[f] = 20;
      return acc;
    }, {} as Record<Frequency, number>);
  return { L: row(), R: row() };
}

export function ExamForm({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee;
  onSave: (exam: Omit<HearingExam, "id">) => void;
  onCancel: () => void;
}) {
  const baseline = findBaseline(employee.exams);
  const kind: ExamKind = baseline ? "annual" : "baseline";

  const [date, setDate] = useState("");
  const [tester, setTester] = useState("");
  const [audiogram, setAudiogram] = useState<Audiogram>(blankAudiogram);
  const [note, setNote] = useState("");

  const setFreq =
    (ear: "L" | "R") =>
    (f: Frequency, v: number) =>
      setAudiogram((prev) => ({ ...prev, [ear]: { ...prev[ear], [f]: v } }));

  const preview: ShiftFinding[] = useMemo(
    () => (baseline && kind === "annual" ? judgeShift(baseline.audiogram, audiogram) : []),
    [baseline, kind, audiogram],
  );

  const hotFreqs = useMemo(() => {
    const set = new Set<number>();
    for (const f of preview) f.freqs.forEach((hz) => set.add(hz));
    return [...set];
  }, [preview]);

  const valid =
    date !== "" &&
    tester.trim() !== "" &&
    FREQUENCIES.every((f) => Number.isFinite(audiogram.L[f]) && Number.isFinite(audiogram.R[f]));

  return (
    <div className="exam-form">
      <div className="form-row">
        <label className="inline-label">
          <span>检查类别</span>
          <div className="kind-box">
            <span className={`tag ${kind === "baseline" ? "tag-baseline" : "tag-muted"}`}>
              {kind === "baseline" ? "首次有效检查（建立基线）" : "年度复测（对照基线）"}
            </span>
            {baseline && (
              <em className="muted-line">基线日 {baseline.date}，新结果只追加留档，不覆盖基线</em>
            )}
          </div>
        </label>
        <label className="inline-label">
          <span>检查日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="inline-label grow">
          <span>检查者 / 机构</span>
          <input value={tester} placeholder="如：厂卫生站 王医生" onChange={(e) => setTester(e.target.value)} />
        </label>
      </div>

      <div className="dual-threshold">
        <ThresholdInput
          ear="L"
          values={audiogram.L}
          reference={baseline?.audiogram.L}
          highlightFreqs={hotFreqs}
          onChange={setFreq("L")}
        />
        <ThresholdInput
          ear="R"
          values={audiogram.R}
          reference={baseline?.audiogram.R}
          highlightFreqs={hotFreqs}
          onChange={setFreq("R")}
        />
      </div>

      <label className="inline-label full">
        <span>备注（可选）</span>
        <input value={note} placeholder="如：脱离噪声 16 小时后检查" onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className={`judge-preview ${preview.length > 0 ? "is-shift" : ""}`}>
        {!baseline ? (
          <p className="muted-line">该员工尚无基线，本次检查将作为首次有效检查存档。</p>
        ) : preview.length > 0 ? (
          <>
            <strong className="shift-title">即时判定：达到标准听阈推移，保存后自动列入待复测</strong>
            <ul className="findings-list">
              {preview.map((f, i) => (
                <li key={i}>{describeFinding(f)}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted-line">即时判定：各耳单频点提高 &lt;15 dB、相邻两频点平均提高 &lt;10 dB，未见阈移。</p>
        )}
      </div>

      <div className="form-actions">
        <button
          className="primary-action"
          disabled={!valid}
          onClick={() => onSave({ kind, date, tester: tester.trim(), audiogram, note: note.trim() || undefined })}
        >
          保存检查记录
        </button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
