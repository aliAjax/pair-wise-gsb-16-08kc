import type { Ear, Exam, ShiftFinding } from "../domain/types";
import {
  EARS,
  FREQUENCIES,
  FREQUENCY_LABELS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  findingFrequencySet,
} from "../domain/hearing";

interface Series {
  exam: Exam;
  /** 曲线样式：基线虚线、年度实线、复查点线 */
  variant: "baseline" | "annual" | "followup";
  label: string;
}

interface Props {
  series: Series[];
  /** 需要高亮的阈移命中（耳别+频点） */
  findings: ShiftFinding[];
  height?: number;
}

const COLORS: Record<Ear, string> = {
  left: "#1d4ed8", // 左耳蓝
  right: "#dc2626", // 右耳红
};

const DASH: Record<Series["variant"], string | undefined> = {
  baseline: "5 4",
  annual: undefined,
  followup: "2 3",
};

const WIDTH = 560;
const HEIGHT = 340;
const PAD = { top: 18, right: 16, bottom: 34, left: 44 };

function x(i: number): number {
  const inner = WIDTH - PAD.left - PAD.right;
  return PAD.left + (inner * i) / (FREQUENCIES.length - 1);
}

function y(db: number): number {
  const inner = HEIGHT - PAD.top - PAD.bottom;
  const t = (db - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN);
  return PAD.top + inner * t;
}

const GRID_DBS = [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

/** 单耳曲线：左耳 × 标记，右耳 ○ 标记 */
function EarCurve({
  ear,
  values,
  color,
  dash,
  flagged,
}: {
  ear: Ear;
  values: number[];
  color: string;
  dash?: string;
  flagged: Set<number>;
}) {
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <g>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dash}
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const isFlagged = flagged.has(i);
        return (
          <g key={i}>
            {isFlagged && (
              <circle
                cx={x(i)}
                cy={y(v)}
                r={9}
                fill="none"
                stroke="#f97316"
                strokeWidth={2.5}
              />
            )}
            {ear === "left" ? (
              <g
                stroke={color}
                strokeWidth={2.4}
                strokeLinecap="round"
              >
                <line x1={x(i) - 4.5} y1={y(v) - 4.5} x2={x(i) + 4.5} y2={y(v) + 4.5} />
                <line x1={x(i) - 4.5} y1={y(v) + 4.5} x2={x(i) + 4.5} y2={y(v) - 4.5} />
              </g>
            ) : (
              <circle cx={x(i)} cy={y(v)} r={4.5} fill="none" stroke={color} strokeWidth={2.4} />
            )}
          </g>
        );
      })}
    </g>
  );
}

export default function Audiogram({ series, findings, height = HEIGHT }: Props) {
  const flagged = findingFrequencySet(findings);
  const scale = height / HEIGHT;

  return (
    <div className="audiogram-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", maxHeight: height * 1.4 }}
        role="img"
        aria-label="听力曲线图"
      >
        <g transform={`scale(1)`}>
          {/* 网格 */}
          {GRID_DBS.map((db) => (
            <g key={db}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(db)}
                y2={y(db)}
                stroke={db === 25 ? "#cbd5e1" : "#e8eef6"}
                strokeWidth={db === 25 ? 1.4 : 1}
              />
              <text x={PAD.left - 8} y={y(db) + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {db}
              </text>
            </g>
          ))}
          {FREQUENCIES.map((f, i) => (
            <g key={f}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="#eef2f8"
              />
              <text
                x={x(i)}
                y={HEIGHT - PAD.bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="#475569"
              >
                {FREQUENCY_LABELS[i]}
              </text>
            </g>
          ))}
          <text
            x={WIDTH / 2}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontSize={11}
            fill="#64748b"
          >
            频率（kHz）
          </text>
          <text
            x={12}
            y={HEIGHT / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#64748b"
            transform={`rotate(-90 12 ${HEIGHT / 2})`}
          >
            听阈（dB HL）
          </text>

          {/* 曲线：先基线后复测，保证最新曲线在上层 */}
          {series.map((s) => (
            <g key={s.exam.id}>
              {EARS.map(({ value: ear }) => (
                <EarCurve
                  key={ear}
                  ear={ear}
                  values={s.exam.thresholds[ear]}
                  color={COLORS[ear]}
                  dash={DASH[s.variant]}
                  flagged={s.variant === "annual" ? flagged[ear] : new Set()}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>

      <div className="audiogram-legend" style={{ fontSize: 12 * Math.max(scale, 0.9) }}>
        {series.map((s) => (
          <span key={s.exam.id} className="legend-item">
            <i
              className="legend-line"
              style={{ borderTop: `2px ${s.variant === "annual" ? "solid" : s.variant === "baseline" ? "dashed" : "dotted"} #334155` }}
            />
            {s.label}
          </span>
        ))}
        <span className="legend-item"><b style={{ color: COLORS.left }}>×</b> 左耳</span>
        <span className="legend-item"><b style={{ color: COLORS.right }}>○</b> 右耳</span>
        {findings.length > 0 && (
          <span className="legend-item"><i className="legend-flag" /> 阈移频点</span>
        )}
      </div>
    </div>
  );
}
