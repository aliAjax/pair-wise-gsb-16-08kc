// 职业听力监护台 —— 初始档案数据（首次有效检查 + 年度复测）

import { Audiogram, EarThresholds, Employee } from "./types";

const e = (L: EarThresholds, R: EarThresholds): Audiogram => ({ L, R });

// 正常听阈模板（dB HL）
const norm: EarThresholds = { 500: 15, 1000: 15, 2000: 15, 3000: 20, 4000: 20, 6000: 25 };

function cloneEars(a: Audiogram): Audiogram {
  return {
    L: { ...a.L },
    R: { ...a.R },
  };
}

/** 在模板上按 {频率: 增量} 偏移，便于构造阈移样例 */
function shift(base: Audiogram, patch: Partial<Record<keyof EarThresholds, number>>, ear: "L" | "R" | "both" = "both"): Audiogram {
  const out = cloneEars(base);
  const apply = (side: "L" | "R") => {
    for (const [f, db] of Object.entries(patch)) {
      const key = Number(f) as keyof EarThresholds;
      out[side][key] += db ?? 0;
    }
  };
  if (ear === "both") {
    apply("L");
    apply("R");
  } else {
    apply(ear);
  }
  return out;
}

export function seedEmployees(): Employee[] {
  // 1) 刘建国：基线正常；2026 年度复测左耳 4k 单频点 +15，4k-6k 相邻平均 +12.5 → 待复测
  const liuBase = e({ ...norm }, { ...norm });
  const liuAnnual = shift(liuBase, { 4000: 15, 6000: 10 }, "L");

  // 2) 陈敏：基线轻度高频下降；年度复测双耳 3k/4k 平均 +10 → 待复测
  const chenBase = e(
    { 500: 15, 1000: 20, 2000: 20, 3000: 30, 4000: 35, 6000: 40 },
    { 500: 20, 1000: 20, 2000: 25, 3000: 30, 4000: 35, 6000: 40 },
  );
  const chenAnnual = shift(chenBase, { 3000: 10, 4000: 10 });

  // 3) 赵伟：基线与复测基本一致 → 年度合格
  const zhaoBase = e(
    { 500: 10, 1000: 10, 2000: 15, 3000: 15, 4000: 20, 6000: 20 },
    { 500: 10, 1000: 15, 2000: 15, 3000: 15, 4000: 20, 6000: 25 },
  );
  const zhaoAnnual = shift(zhaoBase, { 2000: 5, 4000: 5 }, "R");

  // 4) 孙丽：右耳 6k 单频点 +20 → 待复测
  const sunBase = e({ ...norm }, { ...norm });
  const sunAnnual = shift(sunBase, { 6000: 20 }, "R");

  // 5) 周强：只有基线，今年还未复测
  const zhouBase = e(
    { 500: 20, 1000: 20, 2000: 25, 3000: 25, 4000: 30, 6000: 35 },
    { 500: 20, 1000: 20, 2000: 20, 3000: 25, 4000: 30, 6000: 30 },
  );

  return [
    {
      id: "G-1024",
      name: "刘建国",
      workshop: "冲压一车间",
      post: "冲压操作工",
      tenure: 9,
      exams: [
        { id: "ex-liu-b", kind: "baseline", date: "2025-03-12", tester: "厂卫生站 王医生", audiogram: liuBase, note: "首次有效检查，作为基线存档" },
        { id: "ex-liu-a1", kind: "annual", date: "2026-03-18", tester: "厂卫生站 王医生", audiogram: liuAnnual, note: "年度复测，脱离噪声 16 小时后检查" },
      ],
      followUps: [],
    },
    {
      id: "G-1187",
      name: "陈敏",
      workshop: "冲压一车间",
      post: "打磨工",
      tenure: 14,
      exams: [
        { id: "ex-chen-b", kind: "baseline", date: "2025-04-02", tester: "厂卫生站 王医生", audiogram: chenBase },
        { id: "ex-chen-a1", kind: "annual", date: "2026-04-08", tester: "职防院 李医生", audiogram: chenAnnual },
      ],
      followUps: [],
    },
    {
      id: "G-0903",
      name: "赵伟",
      workshop: "装配二车间",
      post: "装配钳工",
      tenure: 5,
      exams: [
        { id: "ex-zhao-b", kind: "baseline", date: "2025-05-20", tester: "厂卫生站 王医生", audiogram: zhaoBase },
        { id: "ex-zhao-a1", kind: "annual", date: "2026-05-22", tester: "厂卫生站 王医生", audiogram: zhaoAnnual },
      ],
      followUps: [],
    },
    {
      id: "G-1255",
      name: "孙丽",
      workshop: "装配二车间",
      post: "铆钉工",
      tenure: 3,
      exams: [
        { id: "ex-sun-b", kind: "baseline", date: "2025-06-10", tester: "厂卫生站 王医生", audiogram: sunBase },
        { id: "ex-sun-a1", kind: "annual", date: "2026-06-12", tester: "职防院 李医生", audiogram: sunAnnual },
      ],
      followUps: [],
    },
    {
      id: "G-0776",
      name: "周强",
      workshop: "空压站",
      post: "空压巡检工",
      tenure: 11,
      exams: [
        { id: "ex-zhou-b", kind: "baseline", date: "2025-09-01", tester: "职防院 李医生", audiogram: zhouBase, note: "首次有效检查" },
      ],
      followUps: [],
    },
  ];
}
