// 职业听力监护台 —— 判定层：标准听阈推移（STS）规则
//
// 以首次有效检查（baseline）为基线，对一次年度复测逐耳判定：
//   1) 任一频点听阈较基线提高 >= 15 dB（single）
//   2) 相邻两个频点听阈较基线的提高量平均值 >= 10 dB（adjacent）
// 满足任一条即列入待复测。纯函数，不依赖页面与存储。

import {
  Audiogram,
  Ear,
  EarThresholds,
  FREQUENCIES,
  Frequency,
  ShiftFinding,
} from "./types";

export const SINGLE_FREQ_DB = 15;
export const ADJACENT_PAIR_AVG_DB = 10;

/** 单耳各频点相对基线的提高量（复测阈值 - 基线阈值，dB） */
export function earDeltas(base: EarThresholds, current: EarThresholds): Record<Frequency, number> {
  const result = {} as Record<Frequency, number>;
  for (const f of FREQUENCIES) {
    result[f] = current[f] - base[f];
  }
  return result;
}

/** 单耳阈移判定，返回命中条目（可能同时命中单频点与相邻频点） */
export function judgeEar(ear: Ear, base: EarThresholds, current: EarThresholds): ShiftFinding[] {
  const deltas = earDeltas(base, current);
  const findings: ShiftFinding[] = [];

  // 规则一：任一频点提高 >= 15 dB
  for (const f of FREQUENCIES) {
    if (deltas[f] >= SINGLE_FREQ_DB) {
      findings.push({ kind: "single", ear, freqs: [f], over: deltas[f] });
    }
  }

  // 规则二：相邻两频点平均提高 >= 10 dB
  for (let i = 0; i < FREQUENCIES.length - 1; i++) {
    const f1 = FREQUENCIES[i];
    const f2 = FREQUENCIES[i + 1];
    const avg = (deltas[f1] + deltas[f2]) / 2;
    if (avg >= ADJACENT_PAIR_AVG_DB) {
      findings.push({ kind: "adjacent", ear, freqs: [f1, f2], over: avg });
    }
  }

  return findings;
}

/** 双耳判定 */
export function judgeShift(base: Audiogram, current: Audiogram): ShiftFinding[] {
  return [...judgeEar("L", base.L, current.L), ...judgeEar("R", base.R, current.R)];
}

/** 语言频点 PTA（0.5/1/2 kHz 平均，dB HL） */
export function pta(ear: EarThresholds): number {
  return Math.round(((ear[500] + ear[1000] + ear[2000]) / 3) * 10) / 10;
}

/** 找该员工的首次有效检查（基线） */
export function findBaseline<T extends { kind: string; date: string }>(exams: T[]): T | undefined {
  return exams
    .filter((e) => e.kind === "baseline")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function formatHz(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`;
}

export function describeFinding(f: ShiftFinding): string {
  const earText = f.ear === "L" ? "左耳" : "右耳";
  if (f.kind === "single") {
    return `${earText} ${formatHz(f.freqs[0])} 提高 ${f.over} dB（≥${SINGLE_FREQ_DB}）`;
  }
  const [a, b] = f.freqs;
  return `${earText} ${formatHz(a)}-${formatHz(b)} 相邻两频点平均提高 ${f.over} dB（≥${ADJACENT_PAIR_AVG_DB}）`;
}
