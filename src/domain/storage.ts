import type { DataState, ThresholdMap } from "./types";
import {
  FREQUENCIES,
  addDays,
  emptyThresholds,
  evaluateShift,
} from "./hearing";

const STORAGE_KEY = "occ-hearing-console-v1";

/** 生成便于阅读的 id */
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ---------------- 种子数据（首次打开时写入） ---------------- */

function thresholds(left: number[], right: number[]): ThresholdMap {
  if (left.length !== FREQUENCIES.length || right.length !== FREQUENCIES.length) {
    throw new Error("阈值行数与频点数不一致");
  }
  return { left: left.slice(), right: right.slice() };
}

/** 生成演示数据（以今天为锚点），供首次初始化与“恢复演示数据”使用 */
export function createSeedState(): DataState {
  // 以今天为锚点，保证演示数据里“30 天内复查”有直观意义
  const today = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const employees = [
    { id: "emp-001", code: "CJ-2041", name: "张建国", workshop: "冲压车间 · 冲压工" },
    { id: "emp-002", code: "CJ-2057", name: "李秀英", workshop: "冲压车间 · 检验工" },
    { id: "emp-003", code: "ZZ-1182", name: "王海涛", workshop: "铸造车间 · 浇注工" },
    { id: "emp-004", code: "ZZ-1190", name: "陈丽萍", workshop: "铸造车间 · 落砂工" },
    { id: "emp-005", code: "DY-3306", name: "赵永强", workshop: "动力车间 · 司炉工" },
  ];

  const exams: DataState["exams"] = [];

  // emp-001：年度复测左耳 4 kHz 单频点 +20 dB（触发单频点规则），已预约
  exams.push({
    id: "exam-base-001",
    employeeId: "emp-001",
    kind: "baseline",
    date: iso(-400),
    thresholds: thresholds(
      [10, 10, 10, 15, 15, 20],
      [10, 5, 10, 10, 15, 15],
    ),
  });
  exams.push({
    id: "exam-annual-001",
    employeeId: "emp-001",
    kind: "annual",
    date: iso(-12),
    thresholds: thresholds(
      [10, 15, 15, 20, 35, 30],
      [10, 10, 10, 15, 20, 20],
    ),
  });

  // emp-002：左耳 3-4 kHz 平均 +12.5 dB（仅触发相邻频点规则），已逾期未完成
  exams.push({
    id: "exam-base-002",
    employeeId: "emp-002",
    kind: "baseline",
    date: iso(-380),
    thresholds: thresholds(
      [5, 5, 10, 10, 10, 15],
      [5, 5, 5, 10, 10, 10],
    ),
  });
  exams.push({
    id: "exam-annual-002",
    employeeId: "emp-002",
    kind: "annual",
    date: iso(-35),
    thresholds: thresholds(
      [10, 10, 15, 21, 24, 15],
      [5, 10, 10, 10, 15, 15],
    ),
  });

  // emp-003：无阈移，年度合格
  exams.push({
    id: "exam-base-003",
    employeeId: "emp-003",
    kind: "baseline",
    date: iso(-365),
    thresholds: thresholds(
      [15, 15, 20, 25, 30, 30],
      [15, 20, 20, 25, 30, 35],
    ),
  });
  exams.push({
    id: "exam-annual-003",
    employeeId: "emp-003",
    kind: "annual",
    date: iso(-8),
    thresholds: thresholds(
      [15, 20, 20, 30, 35, 30],
      [20, 20, 25, 30, 30, 35],
    ),
  });

  // emp-004：双耳 4-6 kHz 阈移，已完成复查（恢复），基线与原复测曲线均保留
  exams.push({
    id: "exam-base-004",
    employeeId: "emp-004",
    kind: "baseline",
    date: iso(-500),
    thresholds: thresholds(
      [10, 10, 15, 15, 20, 20],
      [10, 10, 10, 15, 20, 25],
    ),
  });
  exams.push({
    id: "exam-annual-004",
    employeeId: "emp-004",
    kind: "annual",
    date: iso(-60),
    thresholds: thresholds(
      [15, 15, 20, 25, 35, 35],
      [10, 15, 20, 25, 30, 40],
    ),
  });
  exams.push({
    id: "exam-followup-004",
    employeeId: "emp-004",
    kind: "followup",
    date: iso(-42),
    taskId: "task-004",
    thresholds: thresholds(
      [10, 15, 15, 20, 25, 30],
      [10, 10, 15, 20, 25, 30],
    ),
  });

  // emp-005：只有基线，今年还未复测
  exams.push({
    id: "exam-base-005",
    employeeId: "emp-005",
    kind: "baseline",
    date: iso(-300),
    thresholds: thresholds(
      [0, 5, 5, 10, 10, 15],
      [5, 5, 5, 10, 15, 15],
    ),
  });

  // 待复测任务：findings 一律由判定函数按基线实时生成，避免手写不一致
  const examById = (id: string) => exams.find((e) => e.id === id)!;
  const findingsOf = (baseId: string, annualId: string) =>
    evaluateShift(examById(baseId).thresholds, examById(annualId).thresholds);

  const tasks: DataState["tasks"] = [
    {
      id: "task-001",
      employeeId: "emp-001",
      triggerExamId: "exam-annual-001",
      triggerDate: iso(-12),
      findings: findingsOf("exam-base-001", "exam-annual-001"),
      appointmentDate: addDays(iso(-12), 20),
      status: "pending",
      followupExamId: null,
    },
    {
      id: "task-002",
      employeeId: "emp-002",
      triggerExamId: "exam-annual-002",
      triggerDate: iso(-35),
      findings: findingsOf("exam-base-002", "exam-annual-002"),
      appointmentDate: addDays(iso(-35), 28),
      status: "pending",
      followupExamId: null,
    },
    {
      id: "task-004",
      employeeId: "emp-004",
      triggerExamId: "exam-annual-004",
      triggerDate: iso(-60),
      findings: findingsOf("exam-base-004", "exam-annual-004"),
      appointmentDate: addDays(iso(-60), 18),
      status: "completed",
      followupExamId: "exam-followup-004",
    },
  ];

  return { employees, exams, tasks };
}

/** 读取数据；首次访问或数据损坏时返回种子数据 */
export function loadState(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedState();
      saveState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as DataState;
    if (!parsed.employees || !parsed.exams || !parsed.tasks) {
      throw new Error("数据结构不完整");
    }
    return parsed;
  } catch (err) {
    console.warn("听力监护数据读取失败，使用初始数据：", err);
    const seed = createSeedState();
    saveState(seed);
    return seed;
  }
}

/** 保存（每次记录变更后由 store 调用） */
export function saveState(state: DataState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 清空并恢复为演示数据 */
export function resetState(): DataState {
  const seed = createSeedState();
  saveState(seed);
  return seed;
}

export { emptyThresholds };
