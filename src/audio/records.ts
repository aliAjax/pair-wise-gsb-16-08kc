// 职业听力监护台 —— 记录操作层：对员工/检查/随访的增改规则（纯函数，不改入参）

import {
  AnnualWithShift,
  Audiogram,
  Employee,
  FollowUp,
  HearingExam,
  ShiftFinding,
} from "./types";
import { findBaseline, judgeShift } from "./rules";

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addEmployee(list: Employee[], data: Omit<Employee, "exams" | "followUps">): Employee[] {
  return [...list, { ...data, exams: [], followUps: [] }];
}

/**
 * 追加一次检查。
 * - baseline 与 annual 分开留档，均只追加不覆盖；
 * - 年度复测若触发阈移，自动开立"待复测"随访单；
 * - 基线一旦建立，任何新结果都不能覆盖基线。
 */
export function addExam(list: Employee[], employeeId: string, exam: Omit<HearingExam, "id">): Employee[] {
  const newExam: HearingExam = { ...exam, id: genId("ex") };
  return list.map((emp) => {
    if (emp.id !== employeeId) return emp;
    let followUps = emp.followUps;
    if (newExam.kind === "annual") {
      const base = findBaseline(emp.exams);
      if (base) {
        const findings = judgeShift(base.audiogram, newExam.audiogram);
        if (findings.length > 0) {
          const fu: FollowUp = {
            id: genId("fu"),
            examId: newExam.id,
            findings,
            openedAt: newExam.date,
            appointmentDate: null,
            status: "open",
            completedAt: null,
            confirmAudiogram: null,
          };
          followUps = [...followUps, fu];
        }
      }
    }
    return { ...emp, exams: [...emp.exams, newExam], followUps };
  });
}

/** 为待复测单登记预约日 */
export function scheduleFollowUp(list: Employee[], employeeId: string, followUpId: string, date: string): Employee[] {
  return list.map((emp) =>
    emp.id !== employeeId
      ? emp
      : {
          ...emp,
          followUps: emp.followUps.map((fu) =>
            fu.id === followUpId && fu.status === "open" ? { ...fu, appointmentDate: date } : fu,
          ),
        },
  );
}

/**
 * 完成复查：填写复查阈值，保留原基线与原年度复测曲线。
 * 完成后该随访单关闭（员工随之可进入年度合格名单）。
 */
export function completeFollowUp(
  list: Employee[],
  employeeId: string,
  followUpId: string,
  completedAt: string,
  confirmAudiogram: Audiogram,
  note?: string,
): Employee[] {
  return list.map((emp) =>
    emp.id !== employeeId
      ? emp
      : {
          ...emp,
          followUps: emp.followUps.map((fu) =>
            fu.id === followUpId
              ? { ...fu, status: "completed", completedAt, confirmAudiogram, note: note ?? fu.note }
              : fu,
          ),
        },
  );
}

/** 该员工是否有未完成的待复测 */
export function hasOpenFollowUp(emp: Employee): boolean {
  return emp.followUps.some((fu) => fu.status === "open");
}

/**
 * 规范化档案：为历史存档中"已判定阈移但缺随访单"的年度复测补开立待复测单。
 * 用于示例数据与旧版本数据迁移；幂等。
 */
export function ensureFollowUps(list: Employee[]): Employee[] {
  return list.map((emp) => {
    const base = findBaseline(emp.exams);
    if (!base) return emp;
    let followUps = emp.followUps;
    for (const exam of emp.exams.filter((e) => e.kind === "annual")) {
      if (followUps.some((fu) => fu.examId === exam.id)) continue;
      const findings = judgeShift(base.audiogram, exam.audiogram);
      if (findings.length === 0) continue;
      followUps = [
        ...followUps,
        {
          id: genId("fu"),
          examId: exam.id,
          findings,
          openedAt: exam.date,
          appointmentDate: null,
          status: "open",
          completedAt: null,
          confirmAudiogram: null,
        },
      ];
    }
    return followUps === emp.followUps ? emp : { ...emp, followUps };
  });
}

/** 最新一次年度复测 + 阈移判定 + 对应随访单 */
export function latestAnnual(emp: Employee): AnnualWithShift | null {
  const base = findBaseline(emp.exams);
  const annual = emp.exams
    .filter((e) => e.kind === "annual")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!annual || !base) return null;
  const findings: ShiftFinding[] = judgeShift(base.audiogram, annual.audiogram);
  const followUp =
    emp.followUps
      .filter((fu) => fu.examId === annual.id)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null;
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    workshop: emp.workshop,
    exam: annual,
    findings,
    followUp,
  };
}
