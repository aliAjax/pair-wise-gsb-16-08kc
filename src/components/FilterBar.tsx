export type StatusFilter = "all" | "pending" | "qualified" | "untested";

interface Props {
  query: string;
  onQuery: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  workshops: string[];
  workshop: string;
  onWorkshop: (v: string) => void;
  counts: Record<StatusFilter, number>;
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待复测" },
  { value: "qualified", label: "年度合格" },
  { value: "untested", label: "未复测" },
];

export default function FilterBar({
  query,
  onQuery,
  status,
  onStatus,
  workshops,
  workshop,
  onWorkshop,
  counts,
}: Props) {
  return (
    <div className="filter-bar">
      <input
        className="search-input"
        type="search"
        placeholder="搜索姓名 / 工号 / 岗位"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="status-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={status === tab.value ? "active" : ""}
            onClick={() => onStatus(tab.value)}
          >
            {tab.label}
            <span className="tab-count">{counts[tab.value]}</span>
          </button>
        ))}
      </div>
      <select
        className="workshop-select"
        value={workshop}
        onChange={(e) => onWorkshop(e.target.value)}
      >
        <option value="">全部车间</option>
        {workshops.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
    </div>
  );
}
