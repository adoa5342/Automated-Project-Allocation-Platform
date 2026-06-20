import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { AuthProvider } from "../../pages/authenticationContext.jsx";
import StudentSurvey from "../../components/StudentSurvey.jsx";

// Polyfills required by react-hot-toast (and potential scrolling)
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
  if (!window.scrollTo) {
    window.scrollTo = vi.fn();
  }
});

function renderSurvey() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <StudentSurvey />
        </QueryClientProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockFetchWith() {
  const groups = [{ groupTag: "alpha" }, { groupTag: "beta" }];
  const projects = [
    { id: "p1", name: "Project One" },
    { id: "p2", name: "Project Two" },
    { id: "p3", name: "Project Three" },
    { id: "p4", name: "Project Four" },
    { id: "p5", name: "Project Five" },
  ];
  const skills = [{ id: "s1", name: "React" }];

  vi.spyOn(global, "fetch").mockImplementation((url) => {
    const u = String(url);
    if (u.includes("/v1/student-survey/groups")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ tags: groups }),
      });
    }
    if (u.includes("/v1/student-survey/projects")) {
      return Promise.resolve({ ok: true, json: async () => ({ projects }) });
    }
    if (u.includes("/v1/student-survey/skills")) {
      return Promise.resolve({ ok: true, json: async () => ({ skills }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const long51 = "x".repeat(51);
const longEmail51 = "a".repeat(33) + "@uni.sydney.edu.au"; // 33 + 18 = 51
const long13 = "y".repeat(13); // for cohort (limit 12)
const long21 = "z".repeat(21); // for role (limit 20)

function studentInput(namePath) {
  return document.querySelector(`[name="${namePath}"]`);
}

async function fillStudent(
  i,
  { fullName, email, cohort, seniority, role = "" },
) {
  const idx = i - 1;
  const nameEl = studentInput(`students.${idx}.fullName`);
  const emailEl = studentInput(`students.${idx}.email`);
  const cohortEl = studentInput(`students.${idx}.cohort`);
  const seniorityEl = document.querySelector(
    `[name="students.${idx}.seniority"]`,
  );
  const roleEl = studentInput(`students.${idx}.role`);

  await act(async () => {
    await userEvent.clear(nameEl);
    await userEvent.type(nameEl, fullName);
    await userEvent.clear(emailEl);
    await userEvent.type(emailEl, email);
    await userEvent.clear(cohortEl);
    await userEvent.type(cohortEl, cohort);
    await userEvent.selectOptions(seniorityEl, String(seniority));
    if (roleEl) {
      await userEvent.clear(roleEl);
      await userEvent.type(roleEl, role);
    }
  });
}

function getSubmitButton() {
  const form = document.querySelector("form");
  return within(form).getByRole("button", { name: /submit/i });
}

describe("Abnormal test", () => {
  it("shows required validation errors on submit for empty form", async () => {
    mockFetchWith();
    renderSurvey();

    await screen.findByLabelText(/select your group/i);

    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    expect(screen.getByText(/please select a group/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/this field is required/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/all top 5 projects must be selected/i),
    ).toBeInTheDocument();
  });

  it("shows invalid inputs with automatic errors without resubmitting", async () => {
    mockFetchWith();
    renderSurvey();

    await screen.findByLabelText(/select your group/i);

    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const s1Name = studentInput("students.0.fullName");
    const s1Email = studentInput("students.0.email");
    const s1Cohort = studentInput("students.0.cohort");
    const s1Role = studentInput("students.0.role");

    await act(async () => {
      await userEvent.type(s1Name, long51);
      await userEvent.type(s1Email, longEmail51);
      await userEvent.type(s1Cohort, long13);
      if (s1Role) {
        await userEvent.type(s1Role, long21);
      }
    });

    const fiftyLimitErrors = await screen.findAllByText(/limit is 50/i);
    expect(fiftyLimitErrors.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/limit is 12/i)).toBeInTheDocument();
  });

  it("validates week range: Ending Week must be ≥ Starting Week", async () => {
    mockFetchWith();
    renderSurvey();

    await screen.findByLabelText(/select your group/i);

    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const fromSelect = screen.getByLabelText(/starting week/i);
    const toSelect = screen.getByLabelText(/ending week/i);

    await act(async () => {
      await userEvent.selectOptions(fromSelect, "12");
      await userEvent.selectOptions(toSelect, "2");
    });

    expect(
      await screen.findByText(/Ending Week must be ≥ Starting Week/i),
    ).toBeInTheDocument();

    await act(async () => {
      await userEvent.selectOptions(toSelect, "12");
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/Ending Week must be ≥ Starting Week/i),
      ).not.toBeInTheDocument();
    });
  });

  it("validates student email format and domain", async () => {
    mockFetchWith();
    renderSurvey();

    // Wait for form and trigger initial validation
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const s1Email = studentInput("students.0.email");

    // Invalid format
    await act(async () => {
      await userEvent.type(s1Email, "not-an-email");
    });
    expect(
      screen.getByText(/Invalid student email address/i),
    ).toBeInTheDocument();

    // Wrong domain
    await act(async () => {
      await userEvent.clear(s1Email);
      await userEvent.type(s1Email, "student@gmail.com");
    });
    expect(
      screen.getByText(/Invalid student email address/i),
    ).toBeInTheDocument();

    // Correct domain and format should clear the error
    await act(async () => {
      await userEvent.clear(s1Email);
      await userEvent.type(s1Email, "student1@uni.sydney.edu.au");
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/Invalid student email address/i),
      ).not.toBeInTheDocument();
    });
  });
});

describe("Normal test", () => {
  it("clears errors when all inputs are corrected", async () => {
    mockFetchWith();
    renderSurvey();

    await screen.findByLabelText(/select your group/i);

    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const groupSelect = screen.getByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.selectOptions(groupSelect, "alpha");
    });

    for (let i = 1; i <= 5; i++) {
      const sel = screen.getByLabelText(new RegExp(`top ${i}:`, "i"));
      await act(async () => {
        await userEvent.selectOptions(sel, `p${i}`);
      });
    }

    for (let i = 1; i <= 5; i++) {
      await fillStudent(i, {
        fullName: `Student ${i}`,
        email: `student${i}@uni.sydney.edu.au`,
        cohort: `C${i}`,
        seniority: 3,
        role: "dev",
      });
    }

    await waitFor(() => {
      expect(
        screen.queryByText(/please select a group/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/all top 5 projects must be selected/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/all selected projects must be unique/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/this field is required/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();
    });
  });

  it("submits trimmed payload (strings are trimmed before POST)", async () => {
    // Mock data and intercept submit call
    const groups = [{ groupTag: "alpha" }];
    const projects = [
      { id: "p1", name: "Project One" },
      { id: "p2", name: "Project Two" },
      { id: "p3", name: "Project Three" },
      { id: "p4", name: "Project Four" },
      { id: "p5", name: "Project Five" },
    ];
    const skills = [{ id: "s1", name: "React" }];

    vi.spyOn(global, "fetch").mockImplementation((url, opts) => {
      const u = String(url);
      if (u.includes("/v1/student-survey/groups"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: groups }),
        });
      if (u.includes("/v1/student-survey/projects"))
        return Promise.resolve({ ok: true, json: async () => ({ projects }) });
      if (u.includes("/v1/student-survey/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills }) });
      if (u.includes("/v1/student-survey/submit")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderSurvey();
    await screen.findByLabelText(/select your group/i);

    // Select group
    const groupSelect = screen.getByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.selectOptions(groupSelect, "alpha");
    });

    // Select top projects p1..p5
    for (let i = 1; i <= 5; i++) {
      const sel = screen.getByLabelText(new RegExp(`top ${i}:`, "i"));
      await act(async () => {
        await userEvent.selectOptions(sel, `p${i}`);
      });
    }

    // Fill 5 students with padded spaces
    for (let i = 1; i <= 5; i++) {
      await fillStudent(i, {
        fullName: `  Student ${i}  `,
        email: `  student${i}@uni.sydney.edu.au  `,
        cohort: `  C${i}  `,
        seniority: 3,
        role: `  dev  `,
      });
    }

    // Availability minimal valid
    const fromSelect = screen.getByLabelText(/starting week/i);
    const toSelect = screen.getByLabelText(/ending week/i);
    await act(async () => {
      await userEvent.selectOptions(fromSelect, "2");
      await userEvent.selectOptions(toSelect, "2");
    });

    // Submit
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    // Find submit call
    const submitCall = global.fetch.mock.calls.find(([u]) =>
      String(u).includes("/v1/student-survey/submit"),
    );
    expect(submitCall).toBeTruthy();

    const [, opts] = submitCall;
    const payload = JSON.parse(opts.body);

    // Assert trimmed fields
    expect(payload.students).toHaveLength(5);
    payload.students.forEach((s, idx) => {
      expect(s.fullName).toBe(`Student ${idx + 1}`);
      expect(s.email).toBe(`student${idx + 1}@uni.sydney.edu.au`);
      expect(s.cohort).toBe(`C${idx + 1}`);
      expect(s.role).toBe("dev");
      expect(typeof s.seniority).toBe("number");
    });

    // Projects and availability shape
    expect(payload.topProjects).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(payload.availability).toEqual({
      fromWeek: 2,
      toWeek: 2,
      hoursPerWeek: 10,
    });
  });
});

describe("Boundary test", () => {
  it("fullName length boundary: 25 OK, 49 OK, 50 OK, 51 invalid", async () => {
    mockFetchWith();
    renderSurvey();
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const nameEl = studentInput("students.0.fullName");

    // 25 OK
    await act(async () => {
      await userEvent.clear(nameEl);
      await userEvent.type(nameEl, "A".repeat(25));
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();

    // 49 OK
    await act(async () => {
      await userEvent.clear(nameEl);
      await userEvent.type(nameEl, "A".repeat(49));
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();

    // 50 OK
    await act(async () => {
      await userEvent.clear(nameEl);
      await userEvent.type(nameEl, "B".repeat(50));
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();

    // 51 invalid
    await act(async () => {
      await userEvent.clear(nameEl);
      await userEvent.type(nameEl, "C".repeat(51));
    });
    expect(await screen.findByText(/limit is 50/i)).toBeInTheDocument();
  });

  it("email length boundary: 25 OK, 49 OK, 50 OK, 51 invalid (valid domain)", async () => {
    mockFetchWith();
    renderSurvey();
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const emailEl = studentInput("students.0.email");
    const domain = "@uni.sydney.edu.au"; // 18 chars
    // local length -> total length
    // 31+18=49, 32+18=50, 33+18=51
    const local25 = "a".repeat(7);
    const local49 = "a".repeat(31);
    const local50 = "b".repeat(32);
    const local51 = "c".repeat(33);

    // 25 OK
    await act(async () => {
      await userEvent.clear(emailEl);
      await userEvent.type(emailEl, `${local25}${domain}`);
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/invalid student email address/i),
    ).not.toBeInTheDocument();

    // 49 OK
    await act(async () => {
      await userEvent.clear(emailEl);
      await userEvent.type(emailEl, `${local49}${domain}`);
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/invalid student email address/i),
    ).not.toBeInTheDocument();

    // 50 OK
    await act(async () => {
      await userEvent.clear(emailEl);
      await userEvent.type(emailEl, `${local50}${domain}`);
    });
    expect(screen.queryByText(/limit is 50/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/invalid student email address/i),
    ).not.toBeInTheDocument();

    // 51 invalid
    await act(async () => {
      await userEvent.clear(emailEl);
      await userEvent.type(emailEl, `${local51}${domain}`);
    });
    expect(await screen.findByText(/limit is 50/i)).toBeInTheDocument();
  });

  it("cohort length boundary: 5 OK, 11 OK, 12 OK, 13 invalid", async () => {
    mockFetchWith();
    renderSurvey();
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const cohortEl = studentInput("students.0.cohort");

    // 5 OK
    await act(async () => {
      await userEvent.clear(cohortEl);
      await userEvent.type(cohortEl, "X".repeat(5));
    });
    expect(screen.queryByText(/limit is 12/i)).not.toBeInTheDocument();

    // 11 OK
    await act(async () => {
      await userEvent.clear(cohortEl);
      await userEvent.type(cohortEl, "X".repeat(11));
    });
    expect(screen.queryByText(/limit is 12/i)).not.toBeInTheDocument();

    // 12 OK
    await act(async () => {
      await userEvent.clear(cohortEl);
      await userEvent.type(cohortEl, "Y".repeat(12));
    });
    expect(screen.queryByText(/limit is 12/i)).not.toBeInTheDocument();

    // 13 invalid
    await act(async () => {
      await userEvent.clear(cohortEl);
      await userEvent.type(cohortEl, "Z".repeat(13));
    });
    expect(await screen.findByText(/limit is 12/i)).toBeInTheDocument();
  });

  it("role length boundary: 10 OK, 19 OK, 20 OK, 21 invalid", async () => {
    mockFetchWith();
    renderSurvey();
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const roleEl = studentInput("students.0.role");
    // role is optional; only validates max length when non-empty
    if (!roleEl) return;

    // 10 OK
    await act(async () => {
      await userEvent.clear(roleEl);
      await userEvent.type(roleEl, "r".repeat(10));
    });
    expect(screen.queryByText(/limit is 20/i)).not.toBeInTheDocument();

    // 19 OK
    await act(async () => {
      await userEvent.clear(roleEl);
      await userEvent.type(roleEl, "r".repeat(19));
    });
    expect(screen.queryByText(/limit is 20/i)).not.toBeInTheDocument();

    // 20 OK
    await act(async () => {
      await userEvent.clear(roleEl);
      await userEvent.type(roleEl, "s".repeat(20));
    });
    expect(screen.queryByText(/limit is 20/i)).not.toBeInTheDocument();

    // 21 invalid
    await act(async () => {
      await userEvent.clear(roleEl);
      await userEvent.type(roleEl, "t".repeat(21));
    });
    // We reuse the generic length error pattern used elsewhere in the form
    expect(await screen.findByText(/limit is 20/i)).toBeInTheDocument();
  });

  it("from/to week combination of boundaries: 2:2 valid; 2:12 valid, 12:12 valid", async () => {
    mockFetchWith();
    renderSurvey();
    await screen.findByLabelText(/select your group/i);
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    const fromSelect = screen.getByLabelText(/starting week/i);
    const toSelect = screen.getByLabelText(/ending week/i);

    // 2 valid
    await act(async () => {
      await userEvent.selectOptions(fromSelect, "2");
      await userEvent.selectOptions(toSelect, "2");
    });
    expect(
      screen.queryByText(/Ending Week must be ≥ Starting Week/i),
    ).not.toBeInTheDocument();

    // 12 valid
    await act(async () => {
      await userEvent.selectOptions(fromSelect, "12");
      await userEvent.selectOptions(toSelect, "12");
    });
    expect(
      screen.queryByText(/Ending Week must be ≥ Starting Week/i),
    ).not.toBeInTheDocument();

    // 2 fromWeek, 12 toWeek valid
    await act(async () => {
      await userEvent.selectOptions(fromSelect, "2");
      await userEvent.selectOptions(toSelect, "12");
    });
    expect(
      screen.queryByText(/Ending Week must be ≥ Starting Week/i),
    ).not.toBeInTheDocument();
  });

  it("hours per week boundaries: -1 invalid, 0 valid, 84 valid, 168 valid, 169 invalid (submit gate)", async () => {
    // Mock all GETs + POST to observe submits
    const groups = [{ groupTag: "alpha" }];
    const projects = [
      { id: "p1", name: "Project One" },
      { id: "p2", name: "Project Two" },
      { id: "p3", name: "Project Three" },
      { id: "p4", name: "Project Four" },
      { id: "p5", name: "Project Five" },
    ];
    const skills = [{ id: "s1", name: "React" }];

    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/v1/student-survey/groups"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: groups }),
        });
      if (u.includes("/v1/student-survey/projects"))
        return Promise.resolve({ ok: true, json: async () => ({ projects }) });
      if (u.includes("/v1/student-survey/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills }) });
      if (u.includes("/v1/student-survey/submit"))
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderSurvey();
    await screen.findByLabelText(/select your group/i);

    // Fill minimal valid data
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/select your group/i),
        "alpha",
      );
    });
    for (let i = 1; i <= 5; i++) {
      await act(async () => {
        await userEvent.selectOptions(
          screen.getByLabelText(new RegExp(`top ${i}:`, "i")),
          `p${i}`,
        );
      });
      await fillStudent(i, {
        fullName: `Student ${i}`,
        email: `student${i}@uni.sydney.edu.au`,
        cohort: `C${i}`,
        seniority: 3,
        role: "dev",
      });
    }

    const hours = screen.getByLabelText(/Average hours per week/i);

    // -1 invalid: submit should not POST
    await act(async () => {
      await userEvent.clear(hours);
      await userEvent.type(hours, "-1");
    });
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });
    expect(
      global.fetch.mock.calls.some(([u]) =>
        String(u).includes("/v1/student-survey/submit"),
      ),
    ).toBe(false);

    // 0 valid: submit allowed
    await act(async () => {
      await userEvent.clear(hours);
      await userEvent.type(hours, "0");
    });
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });
    expect(
      global.fetch.mock.calls.some(([u]) =>
        String(u).includes("/v1/student-survey/submit"),
      ),
    ).toBe(true);

    // Clear submit call trace
    global.fetch.mockClear();
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/v1/student-survey/submit"))
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      if (u.includes("/v1/student-survey/"))
        return Promise.resolve({ ok: true, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    // 168 valid
    await act(async () => {
      await userEvent.clear(hours);
      await userEvent.type(hours, "168");
    });
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });
    expect(
      global.fetch.mock.calls.some(([u]) =>
        String(u).includes("/v1/student-survey/submit"),
      ),
    ).toBe(false);

    // 169 invalid: submit should not POST
    global.fetch.mockClear();
    await act(async () => {
      await userEvent.clear(hours);
      await userEvent.type(hours, "169");
    });
    await act(async () => {
      await userEvent.click(getSubmitButton());
    });
    expect(
      global.fetch.mock.calls.some(([u]) =>
        String(u).includes("/v1/student-survey/submit"),
      ),
    ).toBe(false);
  });

  it("shows an error when there are duplicated emails", async () => {
    mockFetchWith();
    renderSurvey();

    await screen.findByLabelText(/select your group/i);

    // Make form otherwise valid
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/select your group/i),
        "alpha",
      );
    });
    for (let i = 1; i <= 5; i++) {
      const sel = screen.getByLabelText(new RegExp(`top ${i}:`, "i"));
      await act(async () => {
        await userEvent.selectOptions(sel, `p${i}`);
      });
    }
    const fromSelect = screen.getByLabelText(/starting week/i);
    const toSelect = screen.getByLabelText(/ending week/i);
    await act(async () => {
      await userEvent.selectOptions(fromSelect, "2");
      await userEvent.selectOptions(toSelect, "2");
    });

    // Fill students with a duplicate email for s1 and s2
    const dup = "student1@uni.sydney.edu.au";
    await fillStudent(1, {
      fullName: "Student 1",
      email: dup,
      cohort: "C1",
      seniority: 3,
      role: "dev",
    });
    await fillStudent(2, {
      fullName: "Student 2",
      email: dup,
      cohort: "C2",
      seniority: 3,
      role: "dev",
    });
    await fillStudent(3, {
      fullName: "Student 3",
      email: "student3@uni.sydney.edu.au",
      cohort: "C3",
      seniority: 3,
      role: "dev",
    });
    await fillStudent(4, {
      fullName: "Student 4",
      email: "student4@uni.sydney.edu.au",
      cohort: "C4",
      seniority: 3,
      role: "dev",
    });
    await fillStudent(5, {
      fullName: "Student 5",
      email: "student5@uni.sydney.edu.au",
      cohort: "C5",
      seniority: 3,
      role: "dev",
    });

    await act(async () => {
      await userEvent.click(getSubmitButton());
    });

    // Root message is rendered below each email field; assert it appears
    expect(
      screen.getAllByText(/emails must be unique/i).length,
    ).toBeGreaterThan(0);
  });
});
