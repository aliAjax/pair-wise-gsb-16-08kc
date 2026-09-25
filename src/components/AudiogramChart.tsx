import { Audiogram, Ear, FREQUENCIES, ShiftFinding } from "../audio/types";
import { formatHz } from "../audio/rules";

interface Curve {
  label: string;
  audiogram: Audiogram;
  /** 基线/复测/复查的视觉区分 */
  tone: "baseline" | "annual" | "confirm";
}

interface Props {
  curves: Curve[];
  findings?: ShiftFinding[];
  height?: number;
}

const DB_MIN = -10;
const DB_MAX = 90;
const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 34;

const EAR_COLOR: Record<Ear, string> = { L: "#1d4ed8", R: "#dc2626" };
const TONE_ALPHA: Record<Curve["tone"], number> = {
  baseline: 0.35,
  annual: 1,
  confirm: 0.75,
};

export function findingKeys(findings: ShiftFinding[]): Set<string> {
  const keys = new Set<string>();
  for (const f of findings) {
    if (f.kind === "single") {
      keys.add(`${f.ear}:${f.freqs[0]}`);
    } else {
      keys.add(`${f.ear}:${f.freqs[0]}`);
      keys.add(`${f.ear}:${f.freqs[1]}`);
    }
  }
  return keys;
}

export function AudiogramChart({ curves, findings = [], height = 340 }: Props) {
  const width = 680;
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const x = (i: number) => PAD_L + (innerW / (FREQUENCIES.length - 1)) * i;
  const y = (db: number) =>
    PAD_T + ((Math.min(Math.max(db, DB_MIN), DB_MAX) - DB_MIN) / (DB_MAX - DB_MIN)) * innerH;

  const ticks: number[] = [];
  for (let db = DB_MIN; db <= DB_MAX; db += 10) ticks.push(db);

  const highlight = findingKeys(findings);

  const pathFor = (a: Audiogram, ear: Ear) =>
    FREQUENCIES.map((f, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(a[ear][f])}`).join(" ");

  const annual = curves.find((c) => c.tone === "annual");

  return (
    <svg className="audiogram-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="听力曲线图">
      {/* 网格与纵轴刻度 */}
      {ticks.map((db) => (
        <g key={db}>
          <line x1={PAD_L} y1={y(db)} x2={width - PAD_R} y2={y(db)} className="grid-line" />
          <text x={PAD_L - 8} y={y(db) + 4} className="axis-label" textAnchor="end">
            {db}
          </text>
        </g>
      ))}

      {/* 横轴频点 */}
      {FREQUENCIES.map((f, i) => (
        <text key={f} x={x(i)} y={height - 10} className="axis-label" textAnchor="middle">
          {formatHz(f)}
        </text>
      ))}
      <text x={PAD_L - 34} y={PAD_T - 4} className="axis-label">
        dB HL
      </text>

      {/* 曲线 */}
      {curves.map((c) =>
        (["L", "R"] as Ear[]).map((ear) => (
          <g key={`${c.label}-${ear}`}>
            <path
              d={pathFor(c.audiogram, ear)}
              fill="none"
              stroke={EAR_COLOR[ear]}
              strokeOpacity={TONE_ALPHA[c.tone]}
              strokeWidth={c.tone === "annual" ? 2.4 : 1.6}
              strokeDasharray={c.tone === "confirm" ? "6 4" : c.tone === "baseline" ? "3 3" : undefined}
            />
            {FREQUENCIES.map((f, i) => {
              const hot = c.tone === "annual" && highlight.has(`${ear}:${f}`);
              return (
                <g key={f}>
                  {ear === "L" ? (
                    <text
                      x={x(i)}
                      y={y(c.audiogram.L[f]) + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={hot ? 800 : 600}
                      fill={EAR_COLOR.L}
                      fillOpacity={TONE_ALPHA[c.tone]}
                      stroke="#fff"
                      paintOrder="stroke"
                      strokeWidth="2"
                    >
                      ×
                    </text>
                  ) : (
                    <circle
                      cx={x(i)}
                      cy={y(c.audiogram.R[f])}
                      r={hot ? 5.5 : 3.6}
                      fill={hot ? "#f97316" : "#fff"}
                      stroke={EAR_COLOR.R}
                      strokeOpacity={TONE_ALPHA[c.tone]}
                      strokeWidth="1.8"
                    />
                  )}
                  {hot && (
                    <circle cx={x(i)} cy={y(c.audiogram[ear][f])} r="9" fill="none" stroke="#f97316" strokeWidth="1.4">
                      <title>{`${ear === "L" ? "左" : "右"}耳 ${formatHz(f)} 达到阈移标准`}</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </g>
        )),
      )}

      {/* 图例 */}
      <g className="chart-legend">
        {curves.map((c, i) => (
          <g key={c.label} transform={`translate(${PAD_L + 8}, ${PAD_T + 14 + i * 16})`}>
            <line x1="0" y1="0" x2="22" y2="0" stroke="#64748b" strokeWidth="2"
              strokeDasharray={c.tone === "confirm" ? "6 4" : c.tone === "baseline" ? "3 3" : undefined} />
            <text x="28" y="4" className="legend-text">{c.label}</text>
          </g>
        ))}
        <g transform={`translate(${width - PAD_R - 170}, ${PAD_T + 4})`}>
          <text x="0" y="0" className="legend-text" fill={EAR_COLOR.L} fontWeight="700">× 左耳</text>
          <text x="80" y="0" className="legend-text" fill={EAR_COLOR.R} fontWeight="700">○ 右耳</text>
        </g>
        {annual && findings.length > 0 && (
          <g transform={`translate(${width - PAD_R - 170}, ${PAD_T + 22})`}>
            <circle cx="6" cy="-4" r="5" fill="none" stroke="#f97316" strokeWidth="1.6" />
            <text x="18" y="0" className="legend-text" fill="#c2410c">橙圈=阈移频点</text>
          </g>
        )}
      </g>
    </svg>
  );
}
