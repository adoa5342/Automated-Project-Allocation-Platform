import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import "../styles/StudentSurvey.css";
import StudentField from "./StudentField.jsx";
import SkillsField from "./SkillsField.jsx";
import { toast, Toaster } from "react-hot-toast";
import NavBar from "./NavBar.jsx";
import { motion, AnimatePresence } from "framer-motion";

// zod validation schema
const studentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .nonempty("This field is required")
    .max(50, "Input is too long, limit is 50"),
  email: z
    .string()
    .trim()
    .nonempty("This field is required")
    .max(50, "Input is too long, limit is 50")
    .email("Invalid student email address")
    .refine((val) => val.endsWith("@uni.sydney.edu.au"), {
      message: "Invalid student email address",
    }),
  cohort: z
    .string()
    .trim()
    .nonempty("This field is required")
    .max(12, "Input is too long, limit is 12"),
  role: z
    .string()
    .trim()
    .max(20, "Input is too long, limit is 20")
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  seniority: z.string().nonempty("Selection is required"),
});

const schema = z.object({
  groupId: z
    .string()
    .trim()
    .nonempty("Please select a group")
    .max(50, "Input is too long, limit is 50"),
  students: z
    .array(studentSchema)
    .min(5, "At least 5 students")
    .max(7, "Max 7 students")
    .superRefine((students, ctx) => {
      const seen = new Set();
      for (const s of students) {
        const email = (s.email || "").trim().toLowerCase();
        if (!email) continue;
        if (seen.has(email)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Emails must be unique!",
            path: [], // root-level error on `students`
          });
          break;
        }
        seen.add(email);
      }
    }),
  topProjects: z.array(z.string()).superRefine((arr, ctx) => {
    if (arr.some((p) => p.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All top 5 projects must be selected",
        path: [],
      });
    }
  }),
  availability: z
    .object({
      fromWeek: z.number().int().min(2).max(12),
      toWeek: z.number().int().min(2).max(12),
      hoursPerWeek: z.number().min(0).max(168),
    })
    .refine((a) => a.toWeek >= a.fromWeek, {
      message: "Ending Week must be ≥ Starting Week",
      path: ["toWeek"],
    }),
});

function StudentSurvey() {
  const BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"; // base url to fetch and post data to backend

  // zod and react hookform for form validation
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      groupId: "",
      students: Array.from({ length: 5 }, () => ({
        fullName: "",
        email: "",
        cohort: "",
        role: "",
        seniority: "",
      })),
      topProjects: ["", "", "", "", ""],
      availability: { fromWeek: 2, toWeek: 12, hoursPerWeek: 10 },
      skills: [],
    },
    reValidateMode: "onChange",
    mode: "onSubmit",
  });

  // Use the watch function obtained from useForm to monitor changes in topProjects.
  const topProjects = watch("topProjects", []);

  // VARIABLES AND STATES FOR FORM FUNCTIONALITIES

  const { fields, append, remove } = useFieldArray({
    control,
    name: "students",
  }); // to keep student list sync with react hook form tracking

  // FUNCTIONS FOR FORM FUNCTIONALITIES

  function addStudent() {
    if (fields.length >= 7) return;
    append({ fullName: "", email: "", cohort: "", role: "", seniority: "" });
  }

  function removeStudent(index) {
    if (fields.length <= 5) return; // always keep at least 5 students
    remove(index);
  }

  async function submitProceed(data) {
    // parse skills (not from 'data')
    const selectedSkills = skillSets
      .filter((s) => s.checked)
      .map((s) => ({ id: s.id, name: s.name, level: s.level }));

    // make payload to send to backend
    const payload = {
      groupName: data.groupId.trim(),
      students: data.students.map((s) => ({
        fullName: s.fullName.trim(),
        email: s.email.trim(),
        cohort: s.cohort.trim(),
        role: (s.role ?? "").trim(),
        seniority: Number(s.seniority),
      })),
      topProjects: data.topProjects,
      availability: data.availability,
      skills: selectedSkills,
    };

    try {
      const res = await fetch(`${BASE_URL}/v1/student-survey/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // if there is error thrown from server
      if (!res.ok) {
        toast.error("Failed to submit the form! Try again!");
        return;
      }

      const result = await res.json().catch(() => ({}));
      reset();
      setSkillSets(skills.map((s) => ({ ...s, checked: false, level: 3 })));
      toast.success("Your form has been submitted successfully!");
    } catch (err) {
      toast.error("Failed to submit the form! Try again!");
    }
  }

  // FUNCTION TO FETCH DATA FROM BACKEND
  async function fetchJson(url, signal) {
    const result = await fetch(url, { signal });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return result.json();
  }

  // first fetch necessary data (group names, skills and projects) from server to render the form
  const {
    data: groups = [],
    isPending: groupsLoading,
    error: groupsErr,
  } = useQuery({
    queryKey: ["groups"],
    queryFn: async ({ signal }) => {
      const data = await fetchJson(
        `${BASE_URL}/v1/student-survey/groups`,
        signal,
      );
      if (Array.isArray(data?.tags)) return data.tags;
      return [];
    },
    select: (arr) =>
      [...arr].sort((a, b) => a.groupTag.localeCompare(b.groupTag)),
  });

  const {
    data: projects = [],
    isPending: projectsLoading,
    error: projectsErr,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: async ({ signal }) => {
      const data = await fetchJson(
        `${BASE_URL}/v1/student-survey/projects`,
        signal,
      );
      // if (Array.isArray(data)) return data;
      if (Array.isArray(data?.projects)) return data.projects;
      return [];
    },
    select: (arr) => [...arr].sort((a, b) => a.id.localeCompare(b.id)),
  });

  const {
    data: skills = [],
    isPending: skillsLoading,
    error: skillsErr,
  } = useQuery({
    queryKey: ["skills"],
    queryFn: async ({ signal }) => {
      const data = await fetchJson(
        `${BASE_URL}/v1/student-survey/skills`,
        signal,
      );
      // if (Array.isArray(data)) return data;
      if (Array.isArray(data?.skills)) return data.skills;
      return [];
    },
    select: (arr) => [...arr].sort((a, b) => a.id.localeCompare(b.id)),
  });

  // set list of skill sets, with default as [ {"id":"s01", "name":"skill01", "checked":false, "level":3}, {...}, ... ]
  const [skillSets, setSkillSets] = useState([]);
  useEffect(() => {
    if (skills.length) {
      setSkillSets(skills.map((s) => ({ ...s, checked: false, level: 3 })));
    }
  }, [skills]);

  const loading = projectsLoading || skillsLoading || groupsLoading;
  const errorMsg =
    projectsErr?.message || skillsErr?.message || groupsErr?.message;

  // display loading message if data is being fetched
  if (loading) return <p>Loading…</p>;
  if (errorMsg) return <p>Error: {errorMsg}</p>;

  // once done data fetching, return the entire survey UI
  return (
    <div className="flex min-h-screen flex-col bg-gray-200 font-sans">
      {/* Nav bar  */}
      <header className="flex w-full items-center justify-between bg-[#334451] px-8 py-5 text-white shadow-md">
        <h1 className="text-xl font-bold tracking-wide">Student Survey</h1>
        <NavBar />
      </header>

      {/* Main Form */}
      <div className="flex flex-1 justify-center p-20">
        <div className="w-full max-w-6xl rounded-xl bg-white p-12 shadow-xl ring-1 ring-black/5">
          <h1 className="mb-5 text-5xl font-bold">Project Selection Form</h1>
          <p className="mb-15 text-lg text-gray-700">
            Each group can submit multiple times until the allocation result is finalized. The size limit for COMP3988 and COMP5615 is 5
            people.
          </p>
          <form
            className="space-y-6"
            action=""
            onSubmit={handleSubmit(submitProceed)}
          >
            {/* GROUP NAME */}
            <div className="input-block">
              <label htmlFor="groupId">1. Select your group:</label>
              <select
                id="groupId"
                name="groupId"
                className="hover: cursor-pointer"
                defaultValue=""
                {...register("groupId")}
              >
                <option value="" disabled>
                  — Select group —
                </option>
                {groups.map((group) => (
                  <option key={group.groupTag} value={group.groupTag}>
                    {group.groupTag.toUpperCase()}
                  </option>
                ))}
              </select>
              {errors.groupId && (
                <p className="text-base text-red-600">
                  {errors.groupId.message}
                </p>
              )}
            </div>

            {/* STUDENTS INFO */}
            <div className="input-block">
              <label>2. Information for students in your group:</label>

              {fields.map((field, index) => (
                <StudentField
                  key={field.id}
                  index={index + 1}
                  removable={index >= 5}
                  onRemove={() => removeStudent(index)}
                  register={register}
                  studentError={errors.students?.[index]}
                  student={`students.${index}`}
                  emailRootError={errors.students?.root?.message}
                />
              ))}

              {fields.length >= 7 ? null : (
                <button
                  className="my-5 mb-0 rounded-md bg-[#334451] text-base text-white hover:bg-[#2a353a]"
                  type="button"
                  onClick={addStudent}
                >
                  + Add student
                </button>
              )}
            </div>

            {/* TOP 5 PROJECT PREFERENCES */}
            <div className="input-block">
              <label className="block">
                {" "}
                3. Your group's top 5 preferred projects:{" "}
              </label>

              {[1, 2, 3, 4, 5].map((i) => {
                // Current dropdown index
                const currentIndex = i - 1;
                // Retrieve the currently selected items (excluding the value of the current dropdown)
                const selectedProjects = topProjects.filter(
                  (project, idx) => idx !== currentIndex && project,
                );

                return (
                  <div key={i} className="flex items-center gap-2 font-normal">
                    <label
                      htmlFor={`project-${i}`}
                      className="inline-block w-16"
                    >
                      {" "}
                      Top {i}:{" "}
                    </label>
                    <select
                      id={`project-${i}`}
                      name={`project-${i}`}
                      className="hover: cursor-pointer"
                      defaultValue=""
                      {...register(`topProjects.${currentIndex}`)}
                    >
                      <option value="" disabled>
                        {" "}
                        — Select project —{" "}
                      </option>
                      {projects.map((project) => {
                        const isSelected = selectedProjects.includes(
                          project.id,
                        );
                        return (
                          <option
                            key={project.id}
                            name={project.id}
                            value={project.id}
                            disabled={isSelected}
                          >
                            {project.id.toUpperCase()} -{" "}
                            {project.name.toUpperCase()}{" "}
                            {isSelected ? "(Already selected)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}

              {(errors.topProjects?.message ||
                errors.topProjects?.root?.message) && (
                <p className="mb-5 text-base text-red-600">
                  {errors.topProjects.message ??
                    errors.topProjects.root.message}
                </p>
              )}
            </div>

            {/* SKILLS */}
            <div className="input-block">
              <label className="block"> 4. Your group's skills:</label>
              <SkillsField
                skills={skills}
                skillSetsParam={skillSets}
                setSkillSetsParam={setSkillSets}
              ></SkillsField>
            </div>

            {/* AVAILABILITY */}
            <div className="input-block">
              <label htmlFor="">
                5. Your group's dedication to the project:
              </label>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 font-normal">
                  <label htmlFor="fromWeek" className="whitespace-nowrap">
                    {" "}
                    Starting week:{" "}
                  </label>
                  <select
                    id="fromWeek"
                    name="fromWeek"
                    className="hover: cursor-pointer"
                    defaultValue=""
                    {...register("availability.fromWeek", {
                      valueAsNumber: true,
                    })}
                  >
                    <option value="" disabled>
                      {" "}
                      — Select week —{" "}
                    </option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((week) => (
                      <option key={week} name={week} value={week}>
                        {" "}
                        Week {week}{" "}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 font-normal">
                  <label htmlFor="toWeek" className="whitespace-nowrap">
                    {" "}
                    Ending week:{" "}
                  </label>
                  <select
                    id="toWeek"
                    name="toWeek"
                    defaultValue=""
                    className="hover: cursor-pointer"
                    {...register("availability.toWeek", {
                      valueAsNumber: true,
                    })}
                  >
                    <option value="" disabled>
                      {" "}
                      — Select week —{" "}
                    </option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((week) => (
                      <option key={week} name={week} value={week}>
                        {" "}
                        Week {week}{" "}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {errors.availability?.toWeek && (
                <p className="text-base text-red-600">
                  {errors.availability.toWeek.message}
                </p>
              )}

              <div className="flex flex-wrap items-center font-normal">
                <div className="mr-10">
                  <label htmlFor="hoursPerWeek" className="mr-4">
                    Average hours per week:
                  </label>
                  <input
                    id="hoursPerWeek"
                    name="hoursPerWeek"
                    type="number"
                    min="0"
                    max="168"
                    // required
                    {...register("availability.hoursPerWeek", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="mb-10 flex flex-row-reverse">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isSubmitting}
                className="rounded-md bg-[#334451] p-3 px-5 text-xl text-white transition hover:bg-[#2a353a]"
                type="submit"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </motion.button>
            </div>
          </form>
        </div>
        <Toaster />
      </div>
    </div>
  );
}

export default StudentSurvey;
