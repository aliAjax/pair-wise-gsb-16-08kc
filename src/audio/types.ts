// 职业听力监护台 —— 记录层：类型定义（与页面、判定、存储解耦）

export type Ear = "L" | "R";

export const FREQUENCIES = [500, 1000, 2000, 3000, 4000, 6000] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** 单耳 0.5~6 kHz 六个频点的听阈值（dB HL），键为频率 Hz */
export type EarThresholds = Record<Frequency, number>;

/** 一次听力检查的左右耳阈值 */
export type Audiogram = {
  L: EarThresholds;
  R: EarThresholds;
};

/** 检查类别：首次有效检查（基线）与年度复测分开留档 */
export type ExamKind = "baseline" | "annual";

export interface HearingExam {
  id: string;
  kind: ExamKind;
  date: string; // ISO yyyy-mm-dd
  tester: string;
  audiogram: Audiogram;
  note?: string;
}

/** 阈移判定命中条目 */
export type ShiftFinding =
  | { kind: "single"; ear: Ear; freqs: [number]; over: number }
  | { kind: "adjacent"; ear: Ear; freqs: [number, number]; over: number };

/** 待复测随访（登记预约、复查结果都挂在这里，不动基线和年度复测曲线） */
export interface FollowUp {
  id: string;
  /** 触发本次待复测的年度复测 id */
  examId: string;
  findings: ShiftFinding[];
  openedAt: string;
  /** 预约复查日（ISO） */
  appointmentDate: string | null;
  status: "open" | "completed";
  completedAt: string | null;
  /** 复查阈值（完成时填写），保留原曲线，不覆盖基线 */
  confirmAudiogram: Audiogram | null;
  note?: string;
}

export interface Employee {
  id: string; // 工号
  name: string;
  workshop: string;
  post: string;
  /** 噪声接触工龄（年） */
  tenure: number;
  exams: HearingExam[];
  followUps: FollowUp[];
}

/** 一次年度复测与其阈移判定结果（页面列表/指标用） */
export interface AnnualWithShift {
  employeeId: string;
  employeeName: string;
  workshop: string;
  exam: HearingExam;
  findings: ShiftFinding[];
  followUp: FollowUp | null;
}
