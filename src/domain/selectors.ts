import type {
  DataState,
  Employee,
  Exam,
  FollowupTask,
} from "./types";
import {
  FOLLOWUP_DAYS,
  addDays,
  annualExams,
  baselineOf,
  diffDays,
  evaluateShift,
  followupExams,
} from "./hearing";

export type EmployeeStatus = "qualified" | "pending" | "untested";

export interface EmployeeSummary {
  employee: Employee;
  baseline?: Exam;
  latestAnnual?: Exam;
  followups: Exam[];
  openTasks: FollowupTask[];
  completedTasks: FollowupTask[];
  status: EmployeeStatus;
  /** 最近一次年度复测相对基线的阈移命中（无论是否已建任务都实时判定） */
  latestFindings: ReturnType<typeof evaluateShift>;
}

export function summarize(state: DataState, employeeId: string): EmployeeSummary {
  const employee = state.employees.find((e) => e.id === employeeId)!;
  const baseline = baselineOf(state.exams, employeeId);
  const annuals = annualExams(state.exams, employeeId);
  const latestAnnual = annuals.length > 0 ? annuals[annuals.length - 1] : undefined;
  const followups = followupExams(state.exams, employeeId);
  const tasks = state.tasks.filter((t) => t.employeeId === employeeId);
  const openTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const latestFindings =
    baseline && latestAnnual
      ? evaluateShift(baseline.thresholds, latestAnnual.thresholds)
      : [];

  let status: EmployeeStatus = "untested";
  if (latestAnnual) {
    status = openTasks.length > 0 ? "pending" : "qualified";
  }

  return {
    employee,
    baseline,
    latestAnnual,
    followups,
    openTasks,
    completedTasks,
    status,
    latestFindings,
  };
}

export function allSummaries(state: DataState): EmployeeSummary[] {
  return state.employees.map((e) => summarize(state, e.id));
}

/** 复查期限 = 触发日 + 30 天 */
export function taskDeadline(task: FollowupTask): string {
  return addDays(task.triggerDate, FOLLOWUP_DAYS);
}

export function taskDaysLeft(task: FollowupTask, today: string): number {
  return diffDays(today, taskDeadline(task));
}

export interface DashboardMetrics {
  total: number;
  tested: number;
  pending: number;
  overdue: number;
  qualified: number;
}

/** 指标随员工筛选集合联动 */
export function metricsFor(
  state: DataState,
  employeeIds: Set<string> | "all",
  today: string,
): DashboardMetrics {
  const summaries = allSummaries(state).filter(
    (s) => employeeIds === "all" || employeeIds.has(s.employee.id),
  );
  let tested = 0;
  let pending = 0;
  let overdue = 0;
  let qualified = 0;
  for (const s of summaries) {
    if (s.latestAnnual) tested += 1;
    if (s.openTasks.length > 0) {
      pending += 1;
      if (s.openTasks.some((t) => taskDaysLeft(t, today) < 0)) overdue += 1;
    }
    if (s.status === "qualified") qualified += 1;
  }
  return { total: summaries.length, tested, pending, overdue, qualified };
}

/** 待复测名单（未完成复查的任务） */
export function pendingList(
  state: DataState,
  employeeIds: Set<string> | "all",
): FollowupTask[] {
  return state.tasks
    .filter((t) => t.status === "pending")
    .filter((t) => employeeIds === "all" || employeeIds.has(t.employeeId))
    .sort((a, b) => taskDeadline(a).localeCompare(taskDeadline(b)));
}

/** 年度合格名单：有年度复测且无未完成复查任务 */
export function qualifiedList(
  state: DataState,
  employeeIds: Set<string> | "all",
): EmployeeSummary[] {
  return allSummaries(state)
    .filter((s) => employeeIds === "all" || employeeIds.has(s.employee.id))
    .filter((s) => s.status === "qualified")
    .sort((a, b) => a.employee.code.localeCompare(b.employee.code));
}
