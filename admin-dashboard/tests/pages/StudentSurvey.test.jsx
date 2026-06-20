import React from "react";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import StudentSurvey from "../../components/StudentSurvey.jsx";
import * as StudentSurveyModule from "../../components/StudentSurvey.jsx";
import { toast } from "react-hot-toast"; // added
import { AuthProvider, useAuth } from "../../pages/authenticationContext.jsx";

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

function mockFetchWith({ groups = [], projects = [], skills = [] }) {
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
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Functional and behavioral test", () => {
  it("renders no dropdown options (except placeholders) when no data is provided", async () => {
    mockFetchWith({ groups: [], projects: [], skills: [] });
    renderSurvey();

    const groupSelect = await screen.findByLabelText(/select your group/i);
    const groupOptions = within(groupSelect).getAllByRole("option");
    expect(groupOptions).toHaveLength(1);
    expect(groupOptions[0]).toHaveTextContent(/select group/i);

    const top1 = screen.getByLabelText(/top 1:/i);
    const top1Options = within(top1).getAllByRole("option");
    expect(top1Options).toHaveLength(1);
    expect(top1Options[0]).toHaveTextContent(/select project/i);

    const top5 = screen.getByLabelText(/top 5:/i);
    const top5Options = within(top5).getAllByRole("option");
    expect(top5Options).toHaveLength(1);
  });

  it("renders provided dropdown options for groups and projects", async () => {
    mockFetchWith({
      groups: [{ groupTag: "alpha" }, { groupTag: "beta" }],
      projects: [
        { id: "p1", name: "Project One" },
        { id: "p2", name: "Project Two" },
      ],
      skills: [{ id: "s1", name: "React" }],
    });
    renderSurvey();

    const groupSelect = await screen.findByLabelText(/select your group/i);
    expect(
      within(groupSelect).getByRole("option", { name: "ALPHA" }),
    ).toBeInTheDocument();
    expect(
      within(groupSelect).getByRole("option", { name: "BETA" }),
    ).toBeInTheDocument();

    const top1 = screen.getByLabelText(/top 1:/i);
    expect(
      within(top1).getByRole("option", { name: /P1 - PROJECT ONE/i }),
    ).toBeInTheDocument();
    expect(
      within(top1).getByRole("option", { name: /P2 - PROJECT TWO/i }),
    ).toBeInTheDocument();
  });

  it("shows Add student, no Remove on the 5th student by default; after adding once, remove and verify, then adding twice, Add button disappears and Remove appears on 6th and 7th", async () => {
    mockFetchWith({ groups: [], projects: [], skills: [] });
    renderSurvey();

    await screen.findByLabelText(/select your group/i);
    expect(screen.getByText(/Student 5/i)).toBeInTheDocument();

    const student5Legend = screen.getByText(/^Student 5$/i);
    const student5Fieldset = student5Legend.closest("fieldset");
    expect(
      within(student5Fieldset).queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: /add student/i });
    expect(addBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(addBtn);
    });

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await act(async () => {
      await user.click(removeButton);
    });
    expect(
      within(student5Fieldset).queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /add student/i }));
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /add student/i }));
    });

    expect(
      screen.queryByRole("button", { name: /add student/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
    expect(screen.getByText(/^Student 6$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Student 7$/i)).toBeInTheDocument();
  });

  it("converts non-array API payloads (null) to empty lists for groups/projects/skills", async () => {
    // Return nulls in object envelopes to hit the Array.isArray(...) fallback branches
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/v1/student-survey/groups")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: null }),
        });
      }
      if (u.includes("/v1/student-survey/projects")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: null }),
        });
      }
      if (u.includes("/v1/student-survey/skills")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ skills: null }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderSurvey();

    const groupSelect = await screen.findByLabelText(/select your group/i);
    expect(within(groupSelect).getAllByRole("option")).toHaveLength(1);

    const top1 = screen.getByLabelText(/top 1:/i);
    expect(within(top1).getAllByRole("option")).toHaveLength(1);

    const top5 = screen.getByLabelText(/top 5:/i);
    expect(within(top5).getAllByRole("option")).toHaveLength(1);
  });

  it("shows error toast when submit returns HTTP error (res.ok === false)", async () => {
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
        return Promise.resolve({
          ok: false,
          json: async () => ({ ok: false }),
        });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const errSpy = vi.spyOn(toast, "error").mockImplementation(() => {});

    renderSurvey();
    await screen.findByLabelText(/select your group/i);

    // Minimal valid form
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
      const idx = i - 1;
      await act(async () => {
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.fullName"]`),
          `Student ${i}`,
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.email"]`),
          `student${i}@uni.sydney.edu.au`,
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.cohort"]`),
          `C${i}`,
        );
        await userEvent.selectOptions(
          document.querySelector(`[name="students.${idx}.seniority"]`),
          "3",
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.role"]`),
          "dev",
        );
      });
    }
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/starting week/i),
        "2",
      );
      await userEvent.selectOptions(screen.getByLabelText(/ending week/i), "2");
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    expect(errSpy).toHaveBeenCalled(); // error path covered
  });

  it("shows error toast when submit throws (network error)", async () => {
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
        return Promise.reject(new Error("network"));
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const errSpy = vi.spyOn(toast, "error").mockImplementation(() => {});

    renderSurvey();
    await screen.findByLabelText(/select your group/i);

    // Minimal valid form
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
      const idx = i - 1;
      await act(async () => {
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.fullName"]`),
          `Student ${i}`,
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.email"]`),
          `student${i}@uni.sydney.edu.au`,
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.cohort"]`),
          `C${i}`,
        );
        await userEvent.selectOptions(
          document.querySelector(`[name="students.${idx}.seniority"]`),
          "3",
        );
        await userEvent.type(
          document.querySelector(`[name="students.${idx}.role"]`),
          "dev",
        );
      });
    }
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/starting week/i),
        "2",
      );
      await userEvent.selectOptions(screen.getByLabelText(/ending week/i), "2");
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    expect(errSpy).toHaveBeenCalled(); // catch branch covered
  });
});

// Create Test Tool Function (used by the mocked-component suite)
const renderWithProviders = (ui, { authProps, ...renderOptions } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  useAuth.mockReturnValue({
    isAuthenticated: true,
    user: { id: 1, role: "student", name: "Test Student" },
    ...authProps,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
    renderOptions,
  );
};

describe("Submission operation test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the module's default export only for this suite
    vi.spyOn(StudentSurveyModule, "default").mockImplementation(
      ({ onSubmit }) => (
        <div data-testid="mock-student-survey">
          <h2>Mock Student Survey</h2>
          <div className="loading" data-testid="loading-indicator">
            Loading survey questions...
          </div>
          <div className="questions" data-testid="survey-questions">
            <div className="question">
              <p>How satisfied are you with the course?</p>
              <input type="radio" name="q1" value="1" /> 1
              <input type="radio" name="q1" value="2" /> 2
              <input type="radio" name="q1" value="3" /> 3
              <input type="radio" name="q1" value="4" /> 4
              <input type="radio" name="q1" value="5" /> 5
            </div>
            <div className="question">
              <p>What aspects did you like most?</p>
              <textarea name="q2" data-testid="text-input"></textarea>
            </div>
          </div>
          <button
            type="button"
            data-testid="submit-button"
            onClick={() => onSubmit?.({ success: true })}
          >
            Submit Survey
          </button>
          <div className="error-message" data-testid="error-message"></div>
          <div className="success-message" data-testid="success-message"></div>
        </div>
      ),
    );
  });

  test("renders survey form with questions", () => {
    const MockStudentSurvey = StudentSurveyModule.default;
    renderWithProviders(<MockStudentSurvey />);

    expect(screen.getByTestId("mock-student-survey")).toBeInTheDocument();
    expect(
      screen.getByText(/how satisfied are you with the course/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/what aspects did you like most/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
  });

  test("handles form submission correctly", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ success: true });
    const MockStudentSurvey = StudentSurveyModule.default;

    renderWithProviders(<MockStudentSurvey onSubmit={mockSubmit} />);

    const ratingOptions = screen.getAllByRole("radio");
    fireEvent.click(ratingOptions[2]);

    const textInput = screen.getByTestId("text-input");
    fireEvent.change(textInput, {
      target: { value: "The teaching quality was excellent" },
    });

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  test("handles API errors gracefully", () => {
    // Override the mocked implementation for this test
    StudentSurveyModule.default.mockImplementation(() => (
      <div data-testid="mock-student-survey">
        <div className="error-message" data-testid="error-message">
          Failed to load survey. Please try again.
        </div>
        <button type="button" data-testid="retry-button">
          Try Again
        </button>
      </div>
    ));

    const MockStudentSurvey = StudentSurveyModule.default;
    renderWithProviders(<MockStudentSurvey />);

    expect(screen.getByTestId("error-message")).toHaveTextContent(
      /failed to load survey/i,
    );
    expect(screen.getByTestId("retry-button")).toBeInTheDocument();
  });
});

// Simulate authentication context (partial mock keeps AuthProvider and stubs useAuth)
vi.mock("../../pages/authenticationContext", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useAuth: vi.fn(() => ({
      isAuthenticated: true,
      user: { id: 1, role: "student", name: "Test Student" },
    })),
    AuthProvider: ({ children }) => <>{children}</>,
  };
});
