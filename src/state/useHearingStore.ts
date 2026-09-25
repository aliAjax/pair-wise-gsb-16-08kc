import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DataState,
  Employee,
  Exam,
  ExamKind,
  FollowupTask,
  ThresholdMap,
} from "../domain/types";
import {
  baselineOf,
  evaluateShift,
  isValidThresholds,
} from "../domain/hearing";
import { loadState, makeId, resetState, saveState } from "../domain/storage";

export interface SaveExamInput {
  employeeId: string;
  kind: ExamKind;
  date: string;
  thresholds: ThresholdMap;
  /** 复查单必填：对应的待复测任务 */
  taskId?: string;
}

export interface SaveExamResult {
  ok: boolean;
  message: string;
  /** 年度复测触发的阈移命中（供页面提示） */
  findings?: ReturnType<typeof evaluateShift>;
  /** 新创建的待复测任务 */
  task?: FollowupTask;
}

/**
 * 数据层：负责记录的读取、判定结果落库与持久化。
 * 页面组件只调用这里暴露的动作，不直接操作 localStorage。
 * 所有判定结果在事件处理时基于当前 state 一次性算出，保证返回值可靠。
 */
export function useHearingStore() {
  const [state, setState] = useState<DataState>(() => loadState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // 任何变更立即持久化，关闭再打开数据仍在
  useEffect(() => {
    saveState(state);
  }, [state]);

  const addEmployee = useCallback(
    (input: Omit<Employee, "id">): Employee => {
      const employee: Employee = { ...input, id: makeId("emp") };
      setState((s) => ({ ...s, employees: [...s.employees, employee] }));
      return employee;
    },
    [],
  );

  /**
   * 保存一次检查记录。
   * - baseline：仅当该员工尚无基线（首次有效检查）时允许，保存后不可被覆盖
   * - annual：相对基线判定阈移，命中则自动创建待复测任务
   * - followup：必须关联待复测任务，保存后任务完成；不改写基线与年度曲线
   */
  const saveExam = useCallback((input: SaveExamInput): SaveExamResult => {
    if (!isValidThresholds(input.thresholds)) {
      return { ok: false, message: "阈值不完整或超出范围（-10 ~ 120 dB），未保存。" };
    }
    if (!input.date) {
      return { ok: false, message: "请填写检查日期。" };
    }

    const s = stateRef.current;
    const employee = s.employees.find((e) => e.id === input.employeeId);
    if (!employee) {
      return { ok: false, message: "员工不存在。" };
    }
    const baseline = baselineOf(s.exams, input.employeeId);

    if (input.kind === "baseline") {
      if (baseline) {
        return {
          ok: false,
          message: "该员工已有基线（首次有效检查），基线不可覆盖。",
        };
      }
      const exam: Exam = {
        id: makeId("exam"),
        employeeId: input.employeeId,
        kind: "baseline",
        date: input.date,
        thresholds: input.thresholds,
      };
      setState({ ...s, exams: [...s.exams, exam] });
      return { ok: true, message: "基线（首次有效检查）已保存。" };
    }

    if (input.kind === "annual") {
      if (!baseline) {
        return {
          ok: false,
          message: "该员工还没有基线，请先录入首次有效检查。",
        };
      }
      const exam: Exam = {
        id: makeId("exam"),
        employeeId: input.employeeId,
        kind: "annual",
        date: input.date,
        thresholds: input.thresholds,
      };
      // 判定与记录分离：调纯函数 evaluateShift，只在命中时建待复测任务
      const findings = evaluateShift(baseline.thresholds, input.thresholds);
      let tasks = s.tasks;
      let task: FollowupTask | undefined;
      if (findings.length > 0) {
        task = {
          id: makeId("task"),
          employeeId: input.employeeId,
          triggerExamId: exam.id,
          triggerDate: input.date,
          findings,
          appointmentDate: null,
          status: "pending",
          followupExamId: null,
        };
        tasks = [...tasks, task];
      }
      setState({ ...s, exams: [...s.exams, exam], tasks });
      return {
        ok: true,
        message:
          findings.length > 0
            ? `年度复测已保存，检出阈移 ${findings.length} 项，已列入待复测（30 天内复查）。`
            : "年度复测已保存，未检出阈移。",
        findings,
        task,
      };
    }

    // followup：复查结果单独留档，任务标记完成，基线与年度曲线均不动
    const task = s.tasks.find(
      (t) => t.id === input.taskId && t.employeeId === input.employeeId,
    );
    if (!task || task.status !== "pending") {
      return { ok: false, message: "未找到对应的待复测任务。" };
    }
    const exam: Exam = {
      id: makeId("exam"),
      employeeId: input.employeeId,
      kind: "followup",
      date: input.date,
      thresholds: input.thresholds,
      taskId: task.id,
    };
    const tasks = s.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: "completed" as const, followupExamId: exam.id }
        : t,
    );
    setState({ ...s, exams: [...s.exams, exam], tasks });
    return {
      ok: true,
      message: "复查结果已保存，该员工复查完成；基线与年度曲线保持不变。",
    };
  }, []);

  /** 登记 / 修改预约复查日 */
  const setAppointment = useCallback((taskId: string, date: string | null) => {
    const s = stateRef.current;
    setState({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, appointmentDate: date } : t,
      ),
    });
  }, []);

  /** 恢复演示数据 */
  const reset = useCallback(() => {
    setState(resetState());
  }, []);

  return { state, addEmployee, saveExam, setAppointment, reset };
}
