import { Ear, FREQUENCIES, Frequency } from "../audio/types";
import { formatHz } from "../audio/rules";

interface Props {
  ear: Ear;
  values: Record<Frequency, number>;
  /** 基线阈值：录入复测/复查时展示对照（只读） */
  reference?: Record<Frequency, number>;
  /** 需要高亮提示的频点（阈移命中） */
  highlightFreqs?: number[];
  onChange: (f: Frequency, value: number) => void;
  disabled?: boolean;
}

export function ThresholdInput({ ear, values, reference, highlightFreqs = [], onChange, disabled }: Props) {
  return (
    <div className="threshold-block">
      <h4 className={ear === "L" ? "ear-left" : "ear-right"}>
        {ear === "L" ? "左耳（L）" : "右耳（R）"}
      </h4>
      <div className="threshold-grid">
        {FREQUENCIES.map((f) => {
          const hot = highlightFreqs.includes(f);
          const delta = reference !== undefined ? values[f] - reference[f] : 0;
          return (
            <label key={f} className={hot ? "freq-hot" : ""}>
              <span>{formatHz(f)}</span>
              <input
                type="number"
                min={-10}
                max={120}
                step={5}
                value={Number.isFinite(values[f]) ? values[f] : ""}
                disabled={disabled}
                onChange={(ev) => {
                  const v = Number(ev.target.value);
                  if (Number.isFinite(v)) onChange(f, v);
                }}
              />
              {reference !== undefined && !disabled && (
                <em className={delta >= 15 ? "delta-bad" : delta >= 10 ? "delta-warn" : "delta-ok"}>
                  基线 {reference[f]} · {delta >= 0 ? "+" : ""}
                  {delta}
                </em>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
