/* 纯逻辑冒烟测试：判定规则、名单、种子数据一致性。
   运行：npx esbuild scripts/smoke.ts --bundle --platform=node --format=cjs | node */
import { createSeedState } from "../src/domain/storage";
import {
  evaluateShift,
  emptyThresholds,
  FREQUENCIES,
  isValidThresholds,
  describeFinding,
  addDays,
  diffDays,
} from "../src/domain/hearing";
import {
  allSummaries,
  metricsFor,
  pendingList,
  qualifiedList,
  taskDeadline,
} from "../src/domain/selectors";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}`, detail ?? "");
  }
}

function t(v: number) {
  return FREQUENCIES.map(() => v);
}

console.log("1) 判定规则");
{
  const base = emptyThresholds();
  base.left = t(10);
  base.right = t(10);

  // 无变化
  check("完全无阈移", evaluateShift(base, { left: t(10), right: t(10) }).length === 0);

  // 9 dB 单频点不命中
  const a = emptyThresholds();
  a.left = t(10);
  a.right = t(10);
  a.left[4] = 19;
  check("单频点 +9 dB 不命中", evaluateShift(base, a).length === 0);

  // 15 dB 单频点命中
  const b = emptyThresholds();
  b.left = t(10);
  b.right = t(10);
  b.right[3] = 25;
  const fb = evaluateShift(base, b);
  check("单频点 +15 dB 命中 single", fb.length === 1 && fb[0].rule === "single" && fb[0].ear === "right");
  check("超出值 = 0", fb[0]?.excess === 0);

  // 相邻两频点平均 +10，单频点都 <15：20,20（基线 10）→ 平均 10，命中 pair 但不命中 single
  const c = emptyThresholds();
  c.left = t(10);
  c.right = t(10);
  c.left[0] = 20;
  c.left[1] = 20;
  const fc = evaluateShift(base, c);
  check("相邻 0.5-1k 平均 +10 仅命中 pair", fc.length === 1 && fc[0].rule === "pair");
  check("pair 频点下标 [0,1]", JSON.stringify(fc[0]?.indices) === "[0,1]");

  // 9 + 11 相邻 => 平均 10 命中；单频点都不到 15
  const d = emptyThresholds();
  d.left = t(10);
  d.right = t(10);
  d.left[2] = 19;
  d.left[3] = 21;
  const fd = evaluateShift(base, d);
  check("相邻 +9/+11 平均 10 命中 pair", fd.some((f) => f.rule === "pair" && f.shift === 10));
  check("相邻 +9/+11 无 single", !fd.some((f) => f.rule === "single"));

  // +20 单频点同时触发自身 single 和相邻 pair
  const e = emptyThresholds();
  e.left = t(10);
  e.right = t(10);
  e.left[4] = 30;
  const fe = evaluateShift(base, e);
  check("4k +20 触发 single", fe.some((f) => f.rule === "single"));
  check("4k +20 触发相邻 pair", fe.some((f) => f.rule === "pair"));
  check("描述含耳别频点超出值", describeFinding(fe.find((f) => f.rule === "single")!).includes("左耳") && describeFinding(fe.find((f) => f.rule === "single")!).includes("4k"));

  // 右耳不受左耳影响
  check("右耳未检出", !fe.some((f) => f.ear === "right"));
}

console.log("2) 阈值校验");
{
  const ok = emptyThresholds();
  ok.left = t(10);
  ok.right = t(20);
  check("完整阈值有效", isValidThresholds(ok));
  const bad = emptyThresholds();
  bad.left = t(10);
  bad.right = t(20);
  bad.right[2] = NaN;
  check("缺一个频点无效", !isValidThresholds(bad));
  const out = emptyThresholds();
  out.left = t(10);
  out.right = t(20);
  out.right[5] = 200;
  check("超出范围无效", !isValidThresholds(out));
}

console.log("3) 日期");
{
  check("+30 天", addDays("2026-09-01", 30) === "2026-10-01");
  check("跨月", addDays("2026-01-31", 1) === "2026-02-01");
  check("相差天数", diffDays("2026-09-01", "2026-10-01") === 30);
}

console.log("4) 种子数据一致性");
{
  const state = createSeedState();
  const summaries = allSummaries(state);
  check("5 名员工", summaries.length === 5);
  const byId = (id: string) => summaries.find((s) => s.employee.id === id)!;

  check("emp-001 待复测", byId("emp-001").status === "pending");
  check("emp-002 待复测", byId("emp-002").status === "pending");
  check("emp-003 合格", byId("emp-003").status === "qualified");
  check("emp-004 复查完成后合格", byId("emp-004").status === "qualified");
  check("emp-005 未复测", byId("emp-005").status === "untested");

  // 任务 findings 必须与 evaluateShift 实时判定一致
  for (const task of state.tasks) {
    const base = state.exams.find(
      (x) => x.employeeId === task.employeeId && x.kind === "baseline",
    )!;
    const annual = state.exams.find((x) => x.id === task.triggerExamId)!;
    const live = evaluateShift(base.thresholds, annual.thresholds);
    check(
      `任务 ${task.id} findings 与判定一致（${live.length} 项）`,
      JSON.stringify(live) === JSON.stringify(task.findings),
    );
  }

  // emp-001: 左耳 4k +20 单频点（同时产生 pair），右耳无
  const f1 = byId("emp-001").latestFindings;
  check("emp-001 含左耳 single 4k", f1.some((f) => f.ear === "left" && f.rule === "single" && f.indices[0] === 4));
  check("emp-001 右耳无命中", !f1.some((f) => f.ear === "right"));

  // emp-002: 只有左耳 pair 3-4k（12.5dB），无 single，右耳无
  const f2 = byId("emp-002").latestFindings;
  check("emp-002 仅 pair 命中", f2.every((f) => f.rule === "pair"));
  check("emp-002 命中 3-4k", f2.some((f) => f.ear === "left" && JSON.stringify(f.indices) === "[3,4]"));
  check("emp-002 超出 2.5 dB", f2[0]?.excess === 2.5);

  // emp-003 无阈移
  check("emp-003 无 findings", byId("emp-003").latestFindings.length === 0);

  // emp-004 有完成的复查记录，基线仍在
  check("emp-004 基线保留", !!byId("emp-004").baseline);
  check("emp-004 有复查曲线", byId("emp-004").followups.length === 1);

  const pending = pendingList(state, "all");
  check("待复测 2 人", pending.length === 2);
  check("按期限排序（emp-002 更早到期在前）", pending[0]?.employeeId === "emp-002");

  const qualifiedNow = qualifiedList(state, "all");
  check("合格名单 2 人（含复查完成者）", qualifiedNow.length === 2 && qualifiedNow.every((s) => ["emp-003", "emp-004"].includes(s.employee.id)));
  check("待复测员工不在合格名单", !qualifiedNow.some((s) => ["emp-001", "emp-002"].includes(s.employee.id)));

  const m = metricsFor(state, "all", "2026-09-25");
  check("指标：总数 5", m.total === 5, m);
  check("指标：已复测 4", m.tested === 4, m);
  check("指标：待复测 2", m.pending === 2, m);
  check("指标：合格 2", m.qualified === 2, m);

  // emp-002 触发日 = 今天-35 天 → 期限 -5 天逾期；emp-001 触发日 -12 天 → 剩 18 天
  const t2 = state.tasks.find((t) => t.id === "task-002")!;
  check("task-002 期限 = 触发+30", taskDeadline(t2) === addDays(t2.triggerDate, 30));

  // 筛选联动：只选冲压车间
  const pressIds = new Set(
    summaries.filter((s) => s.employee.workshop.startsWith("冲压车间")).map((s) => s.employee.id),
  );
  const mp = metricsFor(state, pressIds, "2026-09-25");
  check("冲压车间筛选：总数 2", mp.total === 2, mp);
  check("冲压车间筛选：待复测 2", mp.pending === 2, mp);
  check("冲压车间筛选：合格 0", mp.qualified === 0, mp);
  check(
    "冲压车间待复测名单 2 人",
    pendingList(state, pressIds).length === 2,
  );
}

console.log(failures === 0 ? "\n全部通过 ✅" : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
