import { useMemo, useState, useEffect } from "react";
import NavBar from "./NavBar.jsx";
import {
  FiDownload,
  FiSearch,
  FiUsers,
  FiBarChart2,
  FiFilter,
  FiChevronUp,
  FiChevronDown,
  FiX,
  FiInfo,
} from "react-icons/fi";

const API_BASE_URL = "http://127.0.0.1:3000/api/v1";
const isStudent = localStorage.getItem("role") === "student";

// tiny helper
async function getJSON(url, opts) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(opts?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...(opts || {}), headers });
  if (!res.ok)
    throw new Error(
      (await res.text().catch(() => "")).trim() || res.statusText
    );
  return res.json();
}
const toPct = (v, min, max) => {
  if (v == null) return 0;
  if (max === min) return 100;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
};

export default function ResultsDashboard() {
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState(null);
  const [runId, setRunId] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [runStatus, setRunStatus] = useState("draft");

  useEffect(() => {
    (async () => {
      setRunsLoading(true);
      setRunsError(null);
      try {
        const username = isStudent ? JSON.parse(localStorage.getItem("user"))?.username : null;
        const url = username ? `${API_BASE_URL}/allocation/history?username=${encodeURIComponent(username)}`
                    : `${API_BASE_URL}/allocation/history`;

        const data = await getJSON(url);

        // console.log("DATA: ", data);
        // console.log("Assignments in detail:", data?.assignments);

        setRuns(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length) setRunId(data[0].runId);
      } catch (e) {
        setRunsError(String(e));
      } finally {
        setRunsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!runId) return;
    setSelected(null);
    setDetailLoading(true);
    setDetailError(null);
    (async () => {
      try {
        const username = isStudent ? JSON.parse(localStorage.getItem("user"))?.username : null;
        const url = username ? `${API_BASE_URL}/allocation/history/${encodeURIComponent(runId)}?username=${encodeURIComponent(username)}`
                    : `${API_BASE_URL}/allocation/history/${encodeURIComponent(runId)}`;

        const data = await getJSON(url);
        setDetail(data);
      } catch (e) {
        setDetailError(String(e));
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [runId]);

  const statistics = useMemo(() => {
    return detail?.stats || {
      totalGroups: 0,
      assignedGroups: 0,
      avgScore: 0,
      totalProjects: 0,
      availableProjectSlots: 0,
      projectCapacities: [],
    }
  }, [detail]);

  const teams = useMemo(() => {
    const a = detail?.assignments || [];
    return a.map((x) => ({
      id: x.id,
      name: x.projectName || x.projectId,
      membersCount: x.members?.length || 0,
      members: (x.members || []).map((m) => ({ name: m.userName || m.userId })),
      skillFit: x.skillFit ?? 0,
      prefTerm: x.prefTerm ?? 0,
      workloadTerm: x.workloadTerm ?? 0,
      priorityTerm: x.priorityTerm ?? 0,
      score: x.score ?? 0,
      tags: [
        x.status === "completed"
          ? "Completed"
          : x.status === "partial"
            ? "Partial"
            : "Failed",
      ],
    }));
  }, [detail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = teams.filter((t) =>
      q
        ? t.name.toLowerCase().includes(q) ||
          t.tags.join(" ").toLowerCase().includes(q) ||
          t.members.some((m) => (m.name || "").toLowerCase().includes(q))
        : true
    );
    const sorted = [...base].sort((a, b) => {
      const A = a[sortKey];
      const B = b[sortKey];
      const cmp = (A ?? -Infinity) - (B ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [teams, query, sortKey, sortDir]);

  // ranges for progress bars (normalise to 0–100 within the filtered set)
  const ranges = useMemo(() => {
    const vals = (key) => filtered.map((t) => t[key]).filter((v) => v != null);
    const mk = (key) => {
      const arr = vals(key);
      return { min: Math.min(...arr, 0), max: Math.max(...arr, 1) };
    };
    return {
      skillFit: mk("skillFit"),
      prefTerm: mk("prefTerm"),
      workloadTerm: mk("workloadTerm"),
      priorityTerm: mk("priorityTerm"),
      score: mk("score"),
    };
  }, [filtered]);

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages]);

  const headCell = (label, key, w) => (
    <th className={"px-3 py-2 text-left " + (w || "")}>
      <button
        className="inline-flex items-center gap-1 font-medium !text-[#334451]"
        onClick={() => {
          if (sortKey === key)
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir("desc");
          }
        }}
      >
        {label}
        {sortKey === key ? (
          sortDir === "asc" ? (
            <FiChevronUp className="w-4 h-4" />
          ) : (
            <FiChevronDown className="w-4 h-4" />
          )
        ) : null}
      </button>
    </th>
  );

  const Progress = ({ value }) => (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div style={{ width: `${value}%` }} className="h-full bg-[#2CB1BC]" />
    </div>
  );

  const Pill = ({ children, tone = "default" }) => (
    <span
      className={
        "px-2 py-0.5 rounded-md text-xs font-medium " +
        (tone === "active"
          ? "bg-[#E6FFFB] text-[#2CB1BC] border border-[#2CB1BC]"
          : tone === "warn"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-700")
      }
    >
      {children}
    </span>
  );

  const exportCSV = () => {
    const header = [
      "Team",
      "Members",
      "SkillFit",
      "PrefTerm",
      "WorkloadTerm",
      "PriorityTerm",
      "Score",
    ];
    const lines = filtered.map((t) =>
      [
        t.name,
        t.membersCount,
        t.skillFit,
        t.prefTerm,
        t.workloadTerm,
        t.priorityTerm,
        t.score,
      ].join(",")
    );
    const blob = new Blob([[header.join(",")].concat(lines).join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_${runId || "no-run"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="w-full bg-[#334451] text-white flex items-center px-8 py-5 shadow-md">
        <h1 className="font-bold text-xl tracking-wide">Results Dashboard</h1>

        <div className={`mx-auto flex items-center gap-3 text-sm ${isStudent ? "invisible" : ""}`} aria-hidden={isStudent}>
          <div className="flex items-center bg-white/10 rounded-lg overflow-hidden h-8">
            {runsLoading ? (
              <span className="px-3 leading-none">Loading Runs…</span>
            ) : runsError ? (
              <span className="px-3 leading-none text-red-200">Runs Error</span>
            ) : runs.length === 0 ? (
              <span className="px-3 leading-none">No Runs</span>
            ) : (
              <>
                <span className="px-3 border-r border-white/20 h-full flex items-center leading-none">
                  Run
                </span>
                <select
                  className="bg-transparent px-3 h-full outline-none leading-none text-sm text-black"
                  value={runId}
                  onChange={(e) => setRunId(e.target.value)}
                >
                  {runs.map((r) => (
                    <option
                      key={r.runId}
                      value={r.runId}
                      className="text-black"
                    >
                      {r.runId} • {new Date(r.create_time).toLocaleString()}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <Pill tone="active">
            {runStatus === "draft" ? "Draft Run" : "Published"}
          </Pill>
        </div>

        <NavBar />
      </header>

      {detailLoading && (
        <div className="flex-1 grid place-items-center text-gray-500">
          Loading results…
        </div>
      )}
      {detailError && (
        <div className="flex-1 grid place-items-center text-red-600">
          Error: {detailError}
        </div>
      )}

      {!detailLoading && !detailError && (
        <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_480px] overflow-hidden">
          <div className="flex flex-col min-h-0">
            <div className="flex flex-wrap items-center gap-3 mb-4 px-6 lg:px-8 pt-6">
              {/* Search bar */}
              <div className="relative">
                <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search team, member, tag…"
                  className="w-72 pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#334451]/40"
                />
              </div>

              {/* Export button */}
              <button
                onClick={exportCSV}
                className="ml-auto inline-flex items-center gap-2 bg-[#334451] text-white px-3 py-2 rounded-md text-sm shadow hover:bg-[#2a353a]"
                disabled={!filtered.length}
              >
                <FiDownload className="w-4 h-4" /> Export CSV
              </button>
            </div>

            {/* Results table */}
            <div className="border border-gray-200 shadow-sm rounded-xl bg-white min-h-0 flex-1 h-full overflow-hidden mx-6 lg:mx-8">
              <div className="text-[#334451] font-semibold text-lg border-b border-gray-100 flex items-center gap-2 px-4 py-3">
                <FiFilter className="w-5 h-5" /> Teams Overview
              </div>
              <div className="p-0 h-full flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        {headCell("Team", "name", "w-[24rem]")}
                        {headCell("Members", "membersCount")}
                        {headCell("Skill Fit", "skillFit")}
                        {headCell("Pref Term", "prefTerm")}
                        {headCell("Workload Term", "workloadTerm")}
                        {headCell("Priority Term", "priorityTerm")}
                        {headCell("Score", "score")}
                        <th className="px-3 py-2 text-left">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => (
                        <tr
                          key={t.id}
                          className="border-t hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => setSelected(t)}
                        >
                          <td className="px-3 py-3">
                            <div className="font-medium text-[#334451]">
                              {t.name}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <FiUsers className="w-3 h-3" /> {t.membersCount}{" "}
                              members
                            </div>
                          </td>
                          <td className="px-3 py-3">{t.membersCount}</td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={toPct(
                                  t.skillFit,
                                  ranges.skillFit.min,
                                  ranges.skillFit.max
                                )}
                              />
                              <span className="w-16 text-right text-xs text-gray-600">
                                {Number(t.skillFit).toFixed(2)}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={toPct(
                                  t.prefTerm,
                                  ranges.prefTerm.min,
                                  ranges.prefTerm.max
                                )}
                              />
                              <span className="w-16 text-right text-xs text-gray-600">
                                {Number(t.prefTerm).toFixed(2)}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={toPct(
                                  t.workloadTerm,
                                  ranges.workloadTerm.min,
                                  ranges.workloadTerm.max
                                )}
                              />
                              <span className="w-16 text-right text-xs text-gray-600">
                                {Number(t.workloadTerm).toFixed(2)}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={toPct(
                                  t.priorityTerm,
                                  ranges.priorityTerm.min,
                                  ranges.priorityTerm.max
                                )}
                              />
                              <span className="w-16 text-right text-xs text-gray-600">
                                {Number(t.priorityTerm).toFixed(2)}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="inline-flex items-center gap-2 font-semibold text-[#334451]">
                              {Number(t.score).toFixed(2)}
                              <FiBarChart2 className="w-4 h-4 text-[#2CB1BC]" />
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.tags.map((tag) => (
                                <Pill
                                  key={tag}
                                  tone={
                                    tag === "Completed"
                                      ? "active"
                                      : tag === "Partial"
                                        ? "warn"
                                        : "default"
                                  }
                                >
                                  {tag}
                                </Pill>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-8 text-center text-gray-400"
                          >
                            No results.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <div>
                    Showing{" "}
                    <span className="font-medium">
                      {(page - 1) * pageSize + 1}
                    </span>
                    –
                    <span className="font-medium">
                      {Math.min(page * pageSize, filtered.length)}
                    </span>{" "}
                    of <span className="font-medium">{filtered.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200"
                    >
                      Prev
                    </button>
                    <div className="px-2">
                      {page}/{totalPages}
                    </div>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="min-h-0 p-6 lg:p-8">
            {selected ? (
              // Details for selected row
              <div className="border border-gray-200 shadow-sm rounded-xl bg-white h-full overflow-y-auto">
                <div className="text-[#334451] font-semibold text-lg border-b border-gray-100 flex items-center justify-between px-4 py-3">
                  <div>{selected.name}</div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <FiX className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <div className="p-4 space-y-5">
                  <div className="text-sm text-gray-600">Run: {runId}</div>

                  <div>
                    <div className="font-semibold text-[#334451] mb-2 flex items-center gap-2">
                      <FiInfo className="w-4 h-4" /> Why this team?
                    </div>
                    <div className="space-y-3">
                      {[
                        {
                          label: "Skill Fit",
                          value: selected.skillFit,
                          range: ranges.skillFit,
                        },
                        {
                          label: "Pref Term",
                          value: selected.prefTerm,
                          range: ranges.prefTerm,
                        },
                        {
                          label: "Workload Term",
                          value: selected.workloadTerm,
                          range: ranges.workloadTerm,
                        },
                        {
                          label: "Priority Term",
                          value: selected.priorityTerm,
                          range: ranges.priorityTerm,
                        },
                      ].map((w) => (
                        <div
                          key={w.label}
                          className="grid grid-cols-[120px_1fr_56px] items-center gap-2 text-sm"
                        >
                          <span className="text-gray-600">{w.label}</span>
                          <Progress
                            value={toPct(w.value, w.range.min, w.range.max)}
                          />
                          <span className="text-right text-gray-600">
                            {Number(w.value).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="grid grid-cols-[120px_1fr_56px] items-center gap-2 text-sm">
                        <span className="text-gray-800 font-medium">Score</span>
                        <Progress
                          value={toPct(
                            selected.score,
                            ranges.score.min,
                            ranges.score.max
                          )}
                        />
                        <span className="text-right text-gray-800 font-semibold">
                          {Number(selected.score).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-[#334451] mb-2 flex items-center gap-2">
                      <FiUsers className="w-4 h-4" /> Students
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.members.map((s, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2">{s.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-2">
                      {selected.tags.map((t) => (
                        <Pill
                          key={t}
                          tone={
                            t === "Completed"
                              ? "active"
                              : t === "Partial"
                                ? "warn"
                                : "default"
                          }
                        >
                          {t}
                        </Pill>
                      ))}
                      <Pill tone="active">
                        {runStatus === "draft" ? "Draft Run" : "Published"}
                      </Pill>
                    </div>
                    {runStatus === "draft" ? (
                      <button
                        onClick={() => setRunStatus("published")}
                        className="bg-[#2CB1BC] text-white px-4 py-2 rounded-md text-sm shadow hover:brightness-95"
                      >
                        Publish results
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRunStatus("draft")}
                          className="px-3 py-2 rounded-md text-sm !text-[#334451] bg-gray-100 hover:bg-gray-200"
                        >
                          Rollback to draft
                        </button>
                        <button
                          onClick={exportCSV}
                          className="px-3 py-2 rounded-md text-sm !text-[#334451] bg-gray-100 hover:bg-gray-200"
                        >
                          Export CSV
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // General allocation statistics (default)
              <div className="grid h-full grid-cols-2 gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="col-span-2 border border-gray-200 p-5 text-center">
                  <h2 className="m-1 text-2xl font-bold tracking-wide">Statistics</h2>
                  <p className="text-xs font-semibold tracking-wide text-gray-800">{ runId }</p>
                </div>

                <div className="flex flex-col items-center py-5">
                  <p className="text-3xl font-semibold">{ statistics.assignedGroups }<span className="text-base"> /{ statistics.totalGroups }</span></p>
                  <p className="mt-1 text-sm text-gray-600">Groups Allocated</p>
                </div>

                <div className="flex flex-col items-center py-5">
                  <p className="text-3xl font-semibold">{ Number(statistics.avgScore).toFixed(2) }</p>
                  <p className="mt-1 text-sm text-gray-600">Average Match Score</p>
                </div>

                {/* Add more stats here if needed */}

                <div className="col-span-2 p-3">
                  <p className="px-2 py-3 text-lg font-semibold">{ statistics.totalProjects } Projects <span className="text-gray-600">({ statistics.availableProjectSlots } Available Slots)</span></p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full table-fixed text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-300 text-left">
                        <tr>
                          <th className="w-2/3 px-3 py-2">Project Name</th>
                          <th className="w-1/3 px-3 py-2">Assigned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.projectCapacities.map((p, idx) => (
                          <tr key={idx} className="border-b border-gray-300">
                            <td className="px-3 py-2">{ p.projectName }</td>
                            <td className="px-3 py-2">{ p.assigned } / { p.capacity }</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
