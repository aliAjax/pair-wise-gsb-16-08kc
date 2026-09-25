/** 耳别 */
export type Ear = "left" | "right";

/** 检查类型：基线（首次有效检查）/ 年度复测 / 复查（阈移后 30 天内复查） */
export type ExamKind = "baseline" | "annual" | "followup";

/** 复查任务状态 */
export type FollowupStatus = "pending" | "completed";

/** 每名员工、每耳、每个频点的听阈（dB HL） */
export type ThresholdMap = Record<Ear, number[]>;

export interface Employee {
  id: string;
  name: string;
  /** 工号 */
  code: string;
  /** 车间 / 岗位 */
  workshop: string;
}

export interface Exam {
  id: string;
  employeeId: string;
  kind: ExamKind;
  /** 检查日期，格式 YYYY-MM-DD */
  date: string;
  /** 阈值顺序与 FREQUENCIES 一一对应 */
  thresholds: ThresholdMap;
  /** 复查单关联的复查任务 */
  taskId?: string;
}

/** 阈移判定命中项：耳别 + 频点 + 超出值 */
export interface ShiftFinding {
  ear: Ear;
  /** 命中规则：相邻两频点平均 / 单一频点 */
  rule: "pair" | "single";
  /** 涉及的频点下标（pair 为相邻两个，single 为一个） */
  indices: number[];
  /** 相对基线的提高值（dB） */
  shift: number;
  /** 该规则的判定阈值（dB） */
  limit: number;
  /** 超出判定阈值的数值（dB） */
  excess: number;
}

/** 待复查任务：年度复测触发阈移后登记，30 天内完成复查 */
export interface FollowupTask {
  id: string;
  employeeId: string;
  /** 触发阈移的年度复测 */
  triggerExamId: string;
  /** 触发日期（复查期限由此起算 30 天） */
  triggerDate: string;
  findings: ShiftFinding[];
  /** 预约复查日，YYYY-MM-DD */
  appointmentDate: string | null;
  status: FollowupStatus;
  /** 完成复查的检查记录 id */
  followupExamId: string | null;
}

/** 持久化到 localStorage 的整体数据 */
export interface DataState {
  employees: Employee[];
  exams: Exam[];
  tasks: FollowupTask[];
}
