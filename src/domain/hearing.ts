import type { Ear, Exam, ShiftFinding, ThresholdMap } from "./types";

/** 标准听阈测试频点：0.5 ~ 6 kHz */
export const FREQUENCIES = [500, 1000, 2000, 3000, 4000, 6000] as const;
export const FREQUENCY_LABELS = ["0.5", "1", "2", "3", "4", "6"];

export const EARS: { value: Ear; label: string; short: string }[] = [
  { value: "left", label: "左耳", short: "左" },
  { value: "right", label: "右耳", short: "右" },
];

/** 相邻两频点平均阈移判定阈值（dB） */
export const PAIR_SHIFT_LIMIT = 10;
/** 任一频点阈移判定阈值（dB） */
export const SINGLE_SHIFT_LIMIT = 15;
/** 触发阈移后要求完成复查的天数 */
export const FOLLOWUP_DAYS = 30;

export const THRESHOLD_MIN = -10;
export const THRESHOLD_MAX = 120;

export function earLabel(ear: Ear): string {
  return ear === "left" ? "左耳" : "右耳";
}

/** 单耳 PTA（语频均值 0.5/1/2 kHz），频点不全时返回 null */
export function pta(thresholds: number[]): number | null {
  const used = [0, 1, 2].map((i) => thresholds[i]);
  if (used.some((v) => v === undefined || v === null || Number.isNaN(v))) {
    return null;
  }
  return Math.round((used[0] + used[1] + used[2]) / 3);
}

export function emptyThresholds(): ThresholdMap {
  return {
    left: FREQUENCIES.map(() => NaN),
    right: FREQUENCIES.map(() => NaN),
  };
}

export function isValidThresholdRow(row: number[]): boolean {
  return (
    row.length === FREQUENCIES.length &&
    row.every(
      (v) =>
        typeof v === "number" &&
        Number.isFinite(v) &&
        v >= THRESHOLD_MIN &&
        v <= THRESHOLD_MAX,
    )
  );
}

export function isValidThresholds(t: ThresholdMap): boolean {
  return isValidThresholdRow(t.left) && isValidThresholdRow(t.right);
}

/**
 * 阈移判定（标准 STS 判定，题目给定规则）：
 * 以基线为基准，单耳满足任一条件即命中：
 *  1. 相邻两个频点的平均听阈均较基线提高 ≥ 10 dB（pair）
 *  2. 任一频点听阈较基线提高 ≥ 15 dB（single）
 * 返回所有命中项（耳别、频点、超出值），供待复测名单与提示使用。
 */
export function evaluateShift(
  baseline: ThresholdMap,
  current: ThresholdMap,
): ShiftFinding[] {
  const findings: ShiftFinding[] = [];

  for (const ear of ["left", "right"] as Ear[]) {
    const base = baseline[ear];
    const now = current[ear];
    const shifts = FREQUENCIES.map((_, i) => now[i] - base[i]);

    // 规则一：相邻两频点平均提高 >= 10 dB
    for (let i = 0; i < shifts.length - 1; i++) {
      const avg = (shifts[i] + shifts[i + 1]) / 2;
      if (avg >= PAIR_SHIFT_LIMIT) {
        findings.push({
          ear,
          rule: "pair",
          indices: [i, i + 1],
          shift: Math.round(avg * 10) / 10,
          limit: PAIR_SHIFT_LIMIT,
          excess: Math.round((avg - PAIR_SHIFT_LIMIT) * 10) / 10,
        });
      }
    }

    // 规则二：任一频点提高 >= 15 dB
    shifts.forEach((shift, i) => {
      if (shift >= SINGLE_SHIFT_LIMIT) {
        findings.push({
          ear,
          rule: "single",
          indices: [i],
          shift,
          limit: SINGLE_SHIFT_LIMIT,
          excess: shift - SINGLE_SHIFT_LIMIT,
        });
      }
    });
  }

  return findings;
}

/** 命中文本，例如「左耳 4k 单频点提高 20 dB（超 5 dB）」 */
export function describeFinding(f: ShiftFinding): string {
  const freqs = f.indices.map((i) => `${FREQUENCY_LABELS[i]}k`).join("-");
  const tail =
    f.excess > 0
      ? `超 ${f.excess} dB`
      : `达到 ${f.limit} dB 判定阈值`;
  if (f.rule === "pair") {
    return `${earLabel(f.ear)} ${freqs} 相邻两频点平均提高 ${f.shift} dB（${tail}）`;
  }
  return `${earLabel(f.ear)} ${freqs} 单频点提高 ${f.shift} dB（${tail}）`;
}

/** 命中项涉及的频点集合，供曲线图标记 */
export function findingFrequencySet(
  findings: ShiftFinding[],
): Record<Ear, Set<number>> {
  const result: Record<Ear, Set<number>> = {
    left: new Set(),
    right: new Set(),
  };
  for (const f of findings) {
    for (const i of f.indices) result[f.ear].add(i);
  }
  return result;
}

/* ---------------- 日期工具（YYYY-MM-DD，按本地日历日） ---------------- */

export function toDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toDayString(new Date());
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDayString(date);
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 预约/期限状态：已逾期、临期（≤7 天）、正常 */
export function urgency(deadline: string, now: string): "overdue" | "soon" | "normal" {
  const left = diffDays(now, deadline);
  if (left < 0) return "overdue";
  if (left <= 7) return "soon";
  return "normal";
}

/* ---------------- 记录查询 ---------------- */

export function baselineOf(exams: Exam[], employeeId: string): Exam | undefined {
  return exams
    .filter((e) => e.employeeId === employeeId && e.kind === "baseline")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function annualExams(exams: Exam[], employeeId: string): Exam[] {
  return exams
    .filter((e) => e.employeeId === employeeId && e.kind === "annual")
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function followupExams(exams: Exam[], employeeId: string): Exam[] {
  return exams
    .filter((e) => e.employeeId === employeeId && e.kind === "followup")
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 该员工最近一次年度复测（曲线默认对比对象） */
export function latestAnnual(exams: Exam[], employeeId: string): Exam | undefined {
  const list = annualExams(exams, employeeId);
  return list.length > 0 ? list[list.length - 1] : undefined;
}
