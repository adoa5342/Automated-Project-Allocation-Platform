import React, { useState, useEffect, useRef, useCallback } from "react";
import { Upload, PlayCircle, FileText, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import NavBar from "./NavBar";
import { toast, Toaster } from "react-hot-toast";

export function Card({ children, className }) {
  return (
    <div
      className={`rounded-xl shadow-sm border border-gray-200 bg-white ${
        className || ""
      }`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div
      className={`px-4 py-3 border-b border-gray-100 font-semibold text-[#334451] flex items-center gap-2 ${
        className || ""
      }`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }) {
  return <div className={`px-4 py-4 ${className || ""}`}>{children}</div>;
}

export function Slider({ value, max, step, onChange }) {
  return (
    <input
      type="range"
      value={value}
      max={max}
      step={step}
      onChange={onChange}
      className="w-full accent-[#334451]"
    />
  );
}

/* ------------------------------
   Main Component
--------------------------------- */

export default function UsydAdminPanel() {
  const [weights, setWeights] = useState({ preferences: 40, skills: 40, workload: 20 });
  const [avoidPenalty, setAvoidPenalty] = useState(false);
  const [errors, setErrors] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("Never");
  const [counter, setCounter] = useState(0);
  const [allocationStatus, setAllocationStatus] = useState("idle");
  const [importReport, setImportReport] = useState(null);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const normalisedWeights = (weights) => ({
    weight_skill: weights.skills / 100,
    weight_preference: weights.preferences / 100,
    weight_workload: weights.workload / 100,
    weight_priority: 0, // check if this is to be deleted from algorithm as well
    avoid_penalty: avoidPenalty ? -1 : 0,
  });

  const buildCriteria = (normalisedWeights) => {
    const header = "weight_skill,weight_preference,weight_workload,weight_priority,avoid_penalty";
    const row = [
      normalisedWeights.weight_skill,
      normalisedWeights.weight_preference,
      normalisedWeights.weight_workload,
      normalisedWeights.weight_priority,
      normalisedWeights.avoid_penalty,
    ].join(",");
    return header + "\n" + row + "\n";
  };

  const stringToFile = (csvStr, filename = "criteria_weights.csv") => {
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    return new File([blob], filename, { type: "text/csv" });
  };

  const saveCriteria = async () => {
    const normalised = normalisedWeights(weights, avoidPenalty);
    const csv = buildCriteria(normalised);
    const file = stringToFile(csv, "criteria_weights.csv");
    await handleFileUpload("criteria_weights", file);
    return weights;
  };

  const handleFileUpload = async (fileType, file) => {
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      
      const response = await fetch(`http://localhost:3000/api/v1/import/csv`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: formData,
      });

      const result = await response.json();
      const isZipFile = file.name.toLowerCase().endsWith('.zip');
      const isCriteria = file.name.toLowerCase() === "criteria_weights.csv";
      
      if (result.ok) {
        await refreshFileStatuses();
        setImportReport(result);

        if (isCriteria) {
          toast.success("Processed Criteria Weights");
        } else {
          toast.success(isZipFile ? "Uploaded ZIP File" : "Uploaded File");
        }

      } else {
        setErrors(prev => prev + 1);

        console.error("Upload Failed:", result.errors);
        toast.error(isZipFile ? "Failed To Upload ZIP File" : "Failed To Upload File");
      }
    } catch (error) {
      setErrors(prev => prev + 1);
      console.error("Upload Error:", error);
      toast.error("Upload Error");
    }
  };

  const handleRunAllocation = async () => {
    setAllocationStatus("running");
    try {
      await saveCriteria();

      const result = await axios.post('http://localhost:3000/api/v1/allocate', {
        runId: `auto_import_${Date.now()}`
      }, {
        timeout: 120000, // two minute timeout
        headers: { ...authHeaders() }
      });

      console.log(result)
      
      if (result.data.ok) {
        setAllocationStatus("completed");
        setLastUpdated(new Date().toLocaleDateString());
      } else {
        setAllocationStatus("failed");
        console.error("Allocation Failed:", result.error);
      }
    } catch (error) {
      setAllocationStatus("failed");
      console.error("Allocation Error:", error);
    }
  };

  const [pastAllocations, setPastAllocations] = useState([]);
  const [allocationsExpanded, setAllocationsExpanded] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedHistoryDetails, setSelectedHistoryDetails] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState(null);

  if (process.env.NODE_ENV === 'test') {
    globalThis.__TEST_SET_MODAL_OPEN__ = (v) => setModalOpen(v);
    globalThis.__TEST_SET_HISTORY_DETAILS__ = (d) => setSelectedHistoryDetails(d);
    globalThis.__TEST_SET_LOADING_DETAILS__ = (v) => setLoadingDetails(v);
    globalThis.__TEST_SET_DETAIL_ERROR__ = (e) => setDetailError(e);
  }

  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);

  const FOCUSABLE_SELECTOR =
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const hideModal = () => {
    setSelectedHistoryDetails(null);
    setModalOpen(false);
  };

  const onOverlayClick = useCallback(() => {
    hideModal();
  }, [hideModal]);

  const trapFocus = useCallback((e) => {
    if (!modalOpen || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") hideModal();
      trapFocus(e);
    };

    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKeyDown);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, hideModal, trapFocus]);

  const fetchPastAllocations = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch("http://localhost:3000/api/v1/allocation/history", { headers: { ...authHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch allocation history');
      const data = await response.json();
      setPastAllocations(data);

      if (data.length > 0) {
        const latest = data[0];
        setLastUpdated(new Date(latest.create_time).toLocaleDateString());
      }

    } catch (error) {
      setHistoryError(error.message);
      console.error('Error fetching allocation history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchAllocationDetail = async (runId) => {
    setLoadingDetails(true);
    setDetailError(null);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/allocation/history/${runId}`, { headers: { ...authHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch allocation details');
      
      const data = await response.json();
      setSelectedHistoryDetails(data);
      setModalOpen(true);
    } catch (error) {
      setDetailError(error.message);
      console.error('Error fetching allocation details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchPastAllocations();
  }, []);

  useEffect(() => {
    refreshFileStatuses();
  }, []);

  const [files, setFiles] = useState([
    { label: "Group Tags", file: "group_tags.csv", status: "Missing", type: "tags"},
    { label: "Skills", file: "skills.csv", status: "Missing", type: "skills" },
    { label: "Projects", file: "projects.csv", status: "Missing", type: "projects" },
    { label: "Project Required Skills", file: "project_required_skills.csv", status: "Missing", type: "project_required_skills" },
  ]);

  const getStatusColour = (status) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-700";
      // case "Missing":
      //   return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const checkTableHasRows = async (table) => {
    try {
      const res = await fetch("http://localhost:3000/api/v1/database/records", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ table, args: { take: 1 } }),
      });

      const { ok, data } = await res.json();
      return !!(ok && Array.isArray(data) && data.length > 0);

    } catch {
      return false;
    }
  };

  const refreshFileStatuses = async () => {
    const next = await Promise.all(
      files.map(async (f) => {
        const table = FILE_TYPE_TO_TABLE[f.type];
        const present = table ? await checkTableHasRows(table) : false;
        return { ...f, status: present ? "Present" : "Missing" };
      })
    );

    setFiles(next);
    const presentCount = next.filter(f => f.status === "Present").length;
    setCounter(presentCount);
  };

  const handleBrowseClick = (fileType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .zip';
    input.onchange = (e) => {
      const file = e.target.files[0];
      console.log(file)
      if (file) {
        handleFileUpload(fileType, file);
      }
    };
    input.click();
  };

  const handleWeightChange = (key, nextValue) => {
    setWeights(prev => {
      nextValue = Math.max(0, Math.min(100, Number(nextValue)));
      const keys = ["skills", "preferences", "workload"];
      const others = keys.filter(k => k !== key);

      const remaining = 100 - nextValue;
      let a = prev[others[0]];
      let b = prev[others[1]];
      const sumAB = a + b;

      let newA, newB;
      if (sumAB === 0) { // split evenly if both were 0
        newA = remaining / 2;
        newB = remaining / 2;
      } else { // keep proportions
        newA = (a / sumAB) * remaining;
        newB = (b / sumAB) * remaining;
      }

      return {
        ...prev,
        [key]: nextValue,
        [others[0]]: Math.round(newA),
        [others[1]]: Math.round(newB),
      };
    });
  };

  const handleClearDatabase = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/v1/database", {
        method: "POST",
        headers: { ...authHeaders() },
      });
      const result = await res.json();

      if (result.ok) {
        setErrors(0);
        await refreshFileStatuses();
        setLastUpdated(new Date().toLocaleDateString());
        toast.success("Database Cleared.");
      } else {
        console.error("Clear Failed:", result.error);
        toast.error("Failed To Clear Database");
      }
    } catch (err) {
      console.error("Clear Error:", err);
      toast.error("Clear Error");
    }
  };

  const [previewType, setPreviewType] = React.useState("students");
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const FILE_TYPE_TO_TABLE = {
    tags: "group_tag",
    skills: "skill",
    projects: "project",
    project_required_skills: "project_required_skill",
  };

  const PREVIEW_TO_TABLE = {
    students: "user",
    skills: "skill",
    projects: "project",
    project_required_skills: "project_required_skill",
    group_tags: "group_tag",
    groups: "group",
    group_members: "group_member",
    group_skills: "group_skill",
    group_preferences: "group_preference",
    group_availability: "group_availability",
    criteria_weights: "criteria_weights",
    assignments: "assignment",
  };

  const PREVIEW_ARGS = {
    user: { take: 10, orderBy: { id: "desc" } },
    project: { take: 10, orderBy: { id: "desc" } },
    skill: { take: 10 },
    project_required_skill: {take: 10},
    group_tag: {take: 10, orderBy: {id: "asc" } },
    group: { take: 10, orderBy: { id: "desc" } },
    group_member: { take: 10 },
    group_skill: { take: 10 },
    group_preference: { take: 10, orderBy: {rank: "asc"} },
    group_availability: { take: 10 },
    criteria_weight: { take: 10 },
  };

  const TABLE_CONFIG = {
    students: {
      columns: [
        ["Student ID", "id"],
        ["Full Name", "fullName"],
        ["Email", "email"],
        ["Cohort", "cohort"],
        ["Role", "role"],
        ["Seniority", "seniority"],
      ],
    },
    skills: {
      columns: [
        ["Skill ID", "id"],
        ["Name", "name"],
        ["Category", "category"],
        ["Description", "description"],
        ["Group Skills", (s) => s._count?.groupSkills ?? 0],
        ["Required By", (s) => s._count?.requiredBy ?? 0],
      ],
    },
    projects: {
      columns: [
        ["Project ID", "id"],
        ["Title", "title"],
        ["Client Organisation", "client_org"],
        ["Supervisor", "supervisor"],
        ["Capacity", "capacitySlots"],
        ["Estimated Hours/Week", "estimatedHoursPerWeek"],
        ["Priority", "priority"],
        ["Cohort", "cohort"],
        ["Due Week", "dueWeek"],
        ["Tags", "tags"],
        ["Description", "description"],
      ],
    },
    project_required_skills: {
      columns: [
        ["Project ID", (r) => r.project?.id ?? r.projectId],
        ["Skill ID", (r) => r.skill?.id ?? r.skillId],
        ["Minimum Level", "minLevel"],
        ["Importance", "importance"],
        ["Project", (r) => r.project?.title ?? "—"],
        ["Skill", (r) => r.skill?.name ?? "—"],
      ],
    },
    group_tags: {
      columns: [
        ["Group Tag", "groupTag"],
      ]
    },
    groups: {
      columns: [
        ["Group ID", "id"],
        ["Name", "name"],
        ["Members", (g) => g._count?.members ?? 0],
        ["Skills", (g) => g._count?.skills ?? 0],
        ["Availability", (g) => g._count?.availability ?? 0],
        ["Preferences", (g) => g._count?.preferences ?? 0],
        ["Lock", (g) => g.lock?.id ?? "-"],
        ["Assignment", (g) => g.Assignment?.[0]?.projectId ?? "-"]
      ]
    },
    group_members: {
      columns: [
        ["Group ID", "groupId"],
        ["Student ID", "userId"],
        ["Member Role", "memberRole"],
        ["Group", (m) => m.group?.name ?? "—"],
        ["Student", (m) => m.user?.fullName ?? "—"]
      ]
    },
    group_skills: {
      columns: [
        ["Group ID", "groupId"],
        ["Skill ID", "skillId"],
        ["Level", "level"],
        ["Group", (s) => s.group?.name ?? "-"],
        ["Skill", (s) => s.skill?.name ?? "-"]
      ]
    },
    group_preferences: {
      columns: [
        ["Group ID", "groupId"],
        ["Project ID", "projectId"],
        ["Rank", "rank"],
        ["Group", (p) => p.group?.name ?? "-"],
        ["Project", (p) => p.project?.title ?? "-"]
      ]
    },
    group_availability: {
      columns: [
        ["Group ID", "groupId"],
        ["From Week", "fromWeek"],
        ["To Week", "toWeek"],
        ["Hours Per Week", "hoursPerWeek"],
        ["Group", (a) => a.group?.name ?? "-"]
      ]
    },
    criteria_weights: {
      columns: [
        ["Criteria ID", "id"],
        ["Skill Weight", "weightSkill"],
        ["Preference Weight", "weightPreference"],
        ["Workload Weight", "weightWorkload"],
        ["Priority Weight", "weightPriority"],
        ["Avoid Penalty", "avoidPenalty"]
      ]
    }
  };

  if (process.env.NODE_ENV === 'test') {
    globalThis.__TEST_TABLE_CONFIG__ = TABLE_CONFIG;
  }


  const downloadCSV = (filename, headers) => {
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);

    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplates = () => {
    downloadCSV("skills.csv", ["skill_id", "name", "category", "description"]);
    downloadCSV("projects.csv", ["project_id", "title", "client_org", "supervisor", "capacity_slots", "estimated_hours_per_week", "priority", "cohort", "due_week", "tags", "description"]);
    downloadCSV("project_required_skills.csv", ["project_id", "skill_id", "min_level", "importance"]);
    downloadCSV("group_tags.csv", ["group_tag"]);
  };

  if (process.env.NODE_ENV === 'test') {
    globalThis.__TEST_RUN_DOWNLOAD_TEMPLATES__ = handleDownloadTemplates;
  }

  function renderCell(row, field) {
    return typeof field === "function" ? field(row) : (row?.[field] ?? "—");
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const table = PREVIEW_TO_TABLE[previewType];
        const args = PREVIEW_ARGS[table] || { take: 10 };
        
        const res = await fetch("http://localhost:3000/api/v1/database/records", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ table, args}),
        });

        const { ok, data, error } = await res.json();
        console.log(data);
        if (!ok) throw new Error(error || "Request failed");

        setRows(data);
        setLoading(false);
      } catch (e) {
        setRows([]);
        setError(e.message || String(e));
        setLoading(false);
      };
    })();
    return () => { cancelled = true; };
  }, [previewType]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Top Nav */}
      <header className="flex w-full items-center justify-between bg-[#334451] px-8 py-5 text-white shadow-md">
        <h1 className="text-xl font-bold tracking-wide">Admin Dashboard</h1>
        <NavBar />
      </header>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex flex-col items-center justify-center"
        >
          <span className="text-3xl font-bold text-[#334451]">
            {counter}/{files.length}
          </span>
          <span className="text-sm text-gray-500">Files Present</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex flex-col items-center justify-center"
        >
          <span className="text-3xl font-bold text-red-500">{errors}</span>
          <span className="text-sm text-gray-500">Errors</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex flex-col items-center justify-center"
        >
          <span className="text-2xl font-bold text-[#334451]">
            {lastUpdated}
          </span>
          <span className="text-sm text-gray-500">Last Updated</span>
        </motion.div>
      </section>

      {/* Allocation Details */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden={!modalOpen}
          >
            <div className="absolute inset-0 bg-black/50" onClick={onOverlayClick}/>

            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="allocation-detail-title"
              className="relative bg-white rounded-xl shadow-xl max-w-5xl w-[95%] max-h-[80vh] overflow-auto"
              initial={{ y: 20, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()} // prevent overlay close when clicking inside
            >

              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                <h2 id="allocation-detail-title" className="text-lg font-semibold text-[#334451]">
                  Detail View{selectedHistoryDetails?.runId ? ` — ${selectedHistoryDetails.runId}` : ""}
                </h2>
                <button ref={closeBtnRef} onClick={hideModal} className="inline-flex items-center justify-center text-sm !text-[#334451] hover:underline px-2 py-0.5">Close</button>
              </div>

              <div className="p-5">
                {loadingDetails ? (
                  <div className="py-6 text-center text-gray-500">Loading...</div>
                ) : detailError ? (
                  <div className="py-6 text-center text-red-600">{detailError}</div>
                ) : selectedHistoryDetails ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-t border-gray-200">
                      <thead className="bg-gray-100 text-[#334451] sticky top-0 z-10">
                        <tr>
                          <th className="border px-3 py-2 text-left">Project</th>
                          <th className="border px-3 py-2 text-left">Group</th>
                          <th className="border px-3 py-2 text-left">Status</th>
                          <th className="border px-3 py-2 text-left">Score</th>
                          <th className="border px-3 py-2 text-left">Members</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedHistoryDetails.assignments.map((a) => (
                          <tr key={a.id} className="border-t hover:bg-gray-50">
                            <td className="border px-3 py-2 whitespace-nowrap">
                              {a.projectName} ({a.projectId})
                            </td>
                            <td className="border px-3 py-2 whitespace-nowrap">
                              {a.groupName} ({a.groupId})
                            </td>
                            <td className="border px-3 py-2 whitespace-nowrap">{a.status}</td>
                            <td className="border px-3 py-2 whitespace-nowrap">{Number(a.score).toFixed(2)}</td>
                            <td className="border px-3 py-2">
                              {a.members.map((m) => m.userName).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-gray-500">No details to display.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <main className="flex-1 p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* File Upload */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Card>
            <CardHeader>
              <Upload className="w-5 h-5" /> File Upload
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-100 text-[#334451]">
                  <tr>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(({ label, file, status, type }) => (
                    <tr key={file} className="border-t">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2 text-gray-500">{file}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColour(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-[#334451] text-white px-3 py-1 rounded-md text-xs hover:bg-[#2a353a] transition"
                          onClick={() => handleBrowseClick(type)}
                        >
                          Browse
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between mt-6">
                <button className="text-sm !text-[#334451] hover:underline" onClick={handleDownloadTemplates}>
                  Download Templates
                </button>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-[#334451] text-white px-5 py-2 rounded-md text-sm hover:bg-[#2a353a] transition"
                    onClick={() => handleClearDatabase()}
                  >
                    Clear Database
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-[#334451] text-white px-5 py-2 rounded-md text-sm hover:bg-[#2a353a] transition"
                    onClick={() => handleBrowseClick()}
                  >
                    Upload All
                  </motion.button>
                  </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Card>
            <CardHeader className="flex justify-between items-center">
              <span>Data Preview</span>
              <select
                value={previewType}
                onChange={(e) => setPreviewType(e.target.value)}
                className="text-sm border rounded-md px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#334451]/50"
              >
                <option value="students">Students</option>
                <option value="skills">Skills</option>
                <option value="projects">Projects</option>
                <option value="project_required_skills">Project Required Skills</option>
                <option value="group_tags">Group Tags</option>
                <option value="groups">Groups</option>
                <option value="group_members">Group Members</option>
                <option value="group_skills">Group Skills</option>
                <option value="group_preferences">Group Preferences</option>
                <option value="group_availability">Group Availability</option>
                <option value="criteria_weights">Criteria Weights</option>
              </select>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-90">
                {(() => {
                  const cfg = TABLE_CONFIG[previewType];
                  const cols = (cfg?.columns ?? deriveColumns(rows));
                  const colCount = cols.length || 1;

                  return (
                    <table className="min-w-full text-sm border-t border-gray-200">
                      <thead className="bg-gray-100 text-[#334451] sticky top-0 z-10">
                        <tr>
                          {cols.map(([label], idx) => (
                            <th key={idx} className="border px-3 py-2 text-left whitespace-nowrap">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={colCount} className="text-center text-gray-400 py-6">Loading…</td>
                          </tr>
                        ) : error ? (
                          <tr>
                            <td colSpan={colCount} className="text-center text-red-600 py-6">{error}</td>
                          </tr>
                        ) : (rows?.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={colCount} className="text-center text-gray-400 py-6">No preview data</td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.id ?? JSON.stringify(row)} className="border-t">
                              {cols.map(([_, field], i) => (
                                <td
                                  key={i}
                                  className={
                                    "border px-3 py-2 " +
                                    (Array.isArray(field) ? "" : String(field).toLowerCase().includes("description")
                                      ? "max-w-[24rem] overflow-hidden text-ellipsis whitespace-nowrap"
                                      : "whitespace-nowrap")
                                  }
                                >
                                  {renderCell(row, field)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Configurables */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <Settings className="w-5 h-5" /> Configurables
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h2 className="font-semibold mb-4 text-[#334451] text-base">
                  Weightings
                </h2>
                <div className="space-y-6">
                  {["Skills", "Preferences", "Workload"].map((key) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-[#334451] font-medium">
                          {key}
                        </label>
                        <span className="text-xs text-gray-600">
                          {weights[key.toLowerCase()]}%
                        </span>
                      </div>
                      <Slider
                        value={weights[key.toLowerCase()]}
                        max={100}
                        step={1}
                        onChange={(e) => handleWeightChange(key.toLowerCase(), Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-end h-full">
                {/* <div>
                  <h2 className="font-semibold mb-4 text-[#334451] text-base">
                    Priority
                  </h2>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-[#334451]">
                    <li>First Priority</li>
                    <li>Second Priority</li>
                    <li>Third Priority</li>
                    <li>Fourth Priority</li>
                    <li>Fifth Priority</li>
                  </ol>
                </div> */}
                <div className="mt-6 pb-3">
                  <h2 className="font-semibold mb-2 text-[#334451] text-base">
                    Penalty
                  </h2>
                  <label className="flex items-center space-x-2 text-sm text-[#334451]">
                    <input type="checkbox" className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={avoidPenalty} onChange={(e) => setAvoidPenalty(e.target.checked)}/>
                    <span>Check To Avoid Penalty</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Run Controls & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            <Card>
              <CardHeader>
                <PlayCircle className="w-5 h-5" /> Run Controls & History
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-[#334451] text-white px-5 py-2 rounded-md text-sm shadow hover:bg-[#2a353a] transition"
                  onClick={handleRunAllocation}
                >
                  Run Allocation
                </motion.button>
                <div className="text-sm text-gray-500">
                  Status: queued / running / done + runtime
                </div>

                <div className="text-sm text-gray-500">
                  Status: {allocationStatus}
                  {allocationStatus === "running" && " (please wait...)"}
                  {allocationStatus === "completed" && ` - Completed at ${new Date().toLocaleTimeString()}`}
                  {allocationStatus === "failed" && " - Failed, check console"}
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {isLoadingHistory ? (
                    <div className="py-3 text-center text-gray-500">Loading history...</div>
                  ) : historyError ? (
                    <div className="py-3 text-center text-red-500">{historyError}</div>
                  ) : pastAllocations.length === 0 ? (
                    <div className="py-3 text-center text-gray-500">No allocation records</div>
                  ) : (
                    <table className="min-w-full text-sm border-t border-gray-200">
                      <thead className="bg-gray-100 text-[#334451] sticky top-0 z-10">
                        <tr>
                          <th className="border px-3 py-2 text-left whitespace-nowrap">ID</th>
                          <th className="border px-3 py-2 text-left whitespace-nowrap">Date</th>
                          <th className="border px-3 py-2 text-left whitespace-nowrap">Projects</th>
                          <th className="border px-3 py-2 text-left whitespace-nowrap">Students</th>
                          <th className="border px-3 py-2 text-left whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastAllocations.map((allocation) => (
                          <tr key={allocation.id} className="border-t hover:bg-gray-50">
                            <td className="border px-3 py-2 whitespace-nowrap">{allocation.id}</td>
                            <td className="border px-3 py-2 whitespace-nowrap">
                              {new Date(allocation.create_time).toLocaleDateString()}
                            </td>
                            <td className="border px-3 py-2 whitespace-nowrap">{allocation.project_count}</td>
                            <td className="border px-3 py-2 whitespace-nowrap">{allocation.user_count}</td>
                            <td className="border px-3 py-2 whitespace-nowrap">
                              <button
                                onClick={() => fetchAllocationDetail(allocation.id)}
                                className="px-2 py-0.5 text-sm !text-[#334451] hover:underline"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4 }}
          >
            <Card>
              <CardHeader>
                <FileText className="w-5 h-5" /> Notes & Constraints
              </CardHeader>
              <CardContent className="pt-6 text-sm text-gray-600 leading-relaxed">
                Document any hard rules, fairness constraints, or special notes
                here to guide allocations and decision-making.
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
