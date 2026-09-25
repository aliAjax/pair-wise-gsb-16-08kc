// 职业听力监护台 —— 保存层：localStorage 持久化（关闭再打开数据还在）

import { Employee } from "./types";
import { seedEmployees } from "./seed";
import { ensureFollowUps } from "./records";

const STORAGE_KEY = "hearing-conservation-employees-v1";

export function loadEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = ensureFollowUps(seedEmployees());
      saveEmployees(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Employee[];
    if (!Array.isArray(parsed)) return [];
    // 兼容旧存档：为阈移复测补开立随访单后落盘
    const normalized = ensureFollowUps(parsed);
    if (normalized.some((e, i) => e !== parsed[i])) saveEmployees(normalized);
    return normalized;
  } catch {
    return ensureFollowUps(seedEmployees());
  }
}

export function saveEmployees(employees: Employee[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

export function resetEmployees(): Employee[] {
  const seeded = seedEmployees();
  saveEmployees(seeded);
  return seeded;
}
