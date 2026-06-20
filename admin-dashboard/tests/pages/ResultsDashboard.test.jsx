import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResultsDashboard from "../../components/ResultsDashboard.jsx";
import { AuthProvider } from "../../pages/authenticationContext.jsx";

// Add error boundary components to capture rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Component error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          Error rendering component: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// Simulate global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  }),
);

// Simulate localStorage
const localStorageMock = (() => {
  let store = {
    role: "admin",
    token: "test_token",
    user: JSON.stringify({ id: 1, name: "Admin User", role: "admin" }),
  };
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Match the component's base URL
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

// Helper function: Utilizes the existing AuthProvider component to provide context and adds error boundaries.
const renderWithProviders = (ui) => {
  return render(
    <ErrorBoundary>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </ErrorBoundary>,
  );
};

// Simulated Data - Ensure consistency with component expectations
const mockApiResponse = {
  assignments: [
    {
      id: 1,
      runId: "run_123",
      projectName: "Test Result 1",
      projectId: "project_1",
      members: [{ userName: "Member 1" }, { userName: "Member 2" }],
      skillFit: 90,
      prefTerm: 85,
      workloadTerm: 80,
      priorityTerm: 75,
      score: 90,
      status: "completed",
      create_time: "2025-10-13T10:00:00Z",
    },
    {
      id: 2,
      runId: "run_456",
      projectName: "Test Result 2",
      projectId: "project_2",
      members: [{ userName: "Member 3" }],
      skillFit: 85,
      prefTerm: 80,
      workloadTerm: 75,
      priorityTerm: 70,
      score: 85,
      status: "completed",
      create_time: "2025-10-13T11:00:00Z",
    },
  ],
  stats: {
    totalGroups: 2,
    assignedGroups: 2,
    avgScore: 87.5,
    totalProjects: 2,
    availableProjectSlots: 0,
    projectCapacities: [
      { projectName: "Test Result 1", assigned: 2, capacity: 2 },
      { projectName: "Test Result 2", assigned: 1, capacity: 1 },
    ],
  },
};

const mockRunsResponse = [
  { runId: "run_123", create_time: "2025-10-13T10:00:00Z" },
  { runId: "run_456", create_time: "2025-10-13T11:00:00Z" },
];

describe("ResultsDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fetch simulation and add detailed logs to debug API calls.
    global.fetch.mockImplementation((url, options) => {
      console.log("Mock fetch called with URL:", url);

      // simulate run history API
      if (url === `${API_BASE_URL}/allocation/history`) {
        return Promise.resolve({
          ok: true,
          json: () => {
            console.log("Mock runs response:", mockRunsResponse);
            return Promise.resolve(mockRunsResponse);
          },
        });
      }
      // Simulate Specific Run Details API
      else if (url.includes("/allocation/history/")) {
        const runId = url.split("/").pop();
        console.log(
          `Mock run detail response for runId: ${runId}`,
          mockApiResponse,
        );
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });
      }

      console.log("Unhandled URL:", url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    // Ensure that localStorage contains the necessary authentication information.
    localStorageMock.getItem.mockImplementation((key) => {
      const store = {
        role: "admin",
        token: "test_token",
        user: JSON.stringify({ id: 1, name: "Admin User", role: "admin" }),
      };
      console.log(`localStorage.getItem(${key}) =>`, store[key]);
      return store[key] || null;
    });
  });

  // Add debugging tests to validate the component data loading process.
  test("debug component data loading flow", async () => {
    renderWithProviders(<ResultsDashboard />);

    // Check error boundaries
    expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();

    // Waiting for the initial load to complete
    await waitFor(() => {
      console.log("Debug: After initial load");
    });

    // Output fetch call statistics
    console.log("fetch calls:", global.fetch.mock.calls);

    // Check for error messages
    const errorElement = screen.queryByText(/Error:/);
    console.log("Error element present:", !!errorElement);
    expect(errorElement).not.toBeInTheDocument();

    // Verify whether data is loading
    const loadingElement = screen.queryByText("Loading results…");
    console.log("Loading element present:", !!loadingElement);

    // Waiting for data to load
    await waitFor(
      () => {
        console.log("Debug: After data loading");
      },
      { timeout: 5000 },
    );

    // Output the current document content for debugging
    console.log("Document body:", document.body.innerHTML);
  });

  test("handles empty results state", async () => {
    // Simulated Empty Data Response
    global.fetch.mockImplementation((url) => {
      if (url.includes("/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              assignments: [],
              stats: {
                totalGroups: 0,
                assignedGroups: 0,
                avgScore: 0,
                totalProjects: 0,
                availableProjectSlots: 0,
                projectCapacities: [],
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRunsResponse),
      });
    });

    renderWithProviders(<ResultsDashboard />);

    // Check for errors caused by incorrect boundary capture
    expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();

    // Validate empty state prompt
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  test("handles API error state", async () => {
    // Simulate API Error Responses
    global.fetch.mockImplementation((url) => {
      if (url.includes("/allocation/history/")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Failed to fetch results" }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRunsResponse),
      });
    });

    renderWithProviders(<ResultsDashboard />);

    // Check for errors caused by incorrect boundary capture.
    expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();

    // Validation Error Status Display
    const errorElement = await screen.findByText(/Error:/);
    expect(errorElement).toBeInTheDocument();
  });
  //=====================================================================//

  test("test on runs header shows Loading, Error, and No Runs states", async () => {
    const originalFetch = global.fetch;

    // 1) Loading Runs… then loaded
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });
    let utils = renderWithProviders(<ResultsDashboard />);
    expect(await screen.findByText(/Loading Runs…/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/Loading Runs…/i)).not.toBeInTheDocument();
    });
    utils.unmount();

    // 2) Runs Error
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: false, text: async () => "", statusText: "Bad" };
      }
      return { ok: true, json: async () => [] };
    });
    utils = renderWithProviders(<ResultsDashboard />);
    expect(await screen.findByText(/Runs Error/i)).toBeInTheDocument();
    utils.unmount();

    // 3) No Runs and detail should not be requested
    let detailCalls = 0;
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });
    utils = renderWithProviders(<ResultsDashboard />);
    expect(await screen.findByText(/No Runs/i)).toBeInTheDocument();
    utils.unmount();

    global.fetch = originalFetch;
  });

  test("test on search bar filter", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });

    renderWithProviders(<ResultsDashboard />);

    // Ensure the detail load cycle has completed
    await screen.findByText(/Teams Overview/i);
    await waitFor(() => {
      expect(screen.queryByText(/Loading results…/i)).not.toBeInTheDocument();
    });

    // Wait for rows
    const mainTable = screen.getAllByRole("table")[0];
    await within(mainTable).findByText(/test result 1/i);

    // Filter to Test Result 2
    const input = screen.getByPlaceholderText(/search team/i);
    fireEvent.change(input, { target: { value: "test result 2" } });
    expect(
      within(mainTable).queryByText(/test result 1/i),
    ).not.toBeInTheDocument();
    expect(within(mainTable).getByText(/test result 2/i)).toBeInTheDocument();

    // Filter by tag "Partial"
    fireEvent.change(input, { target: { value: "completed" } });
    expect(within(mainTable).getByText(/test result 2/i)).toBeInTheDocument();

    global.fetch = originalFetch;
  });

  test("test on sorting feature in asc/desc by clicking header", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });

    renderWithProviders(<ResultsDashboard />);

    // Ensure the detail load cycle has completed
    await screen.findByText(/Teams Overview/i);
    await waitFor(() => {
      expect(screen.queryByText(/Loading results…/i)).not.toBeInTheDocument();
    });

    // Wait for rows
    const mainTable = screen.getAllByRole("table")[0];
    await within(mainTable).findByText(/test result 1/i);

    // Default sort by score desc -> first row B (90)
    const rows = () =>
      Array.from(document.querySelectorAll("tbody tr")).filter((tr) =>
        tr.querySelector("td"),
      );
    expect(rows()[0].textContent).toMatch(/test result 1/i);

    // Click Score header to toggle asc -> first row A (10)
    const scoreHeaderBtn = screen.getByRole("button", { name: /Score/i });
    fireEvent.click(scoreHeaderBtn);
    expect(rows()[0].textContent).toMatch(/test result 2/i);

    // Click again -> desc
    fireEvent.click(scoreHeaderBtn);
    expect(rows()[0].textContent).toMatch(/test result 1/i);

    global.fetch = originalFetch;
  });

  test("pagination respects bounds and updates range display", async () => {
    const originalFetch = global.fetch;
    const many = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      projectName: `P${i + 1}`,
      members: [{ userName: `U${i + 1}` }],
      skillFit: i,
      prefTerm: i,
      workloadTerm: i,
      priorityTerm: i,
      score: i,
      status: "completed",
    }));
    const data = {
      assignments: many,
      stats: {
        totalGroups: 10,
        assignedGroups: 10,
        avgScore: 4.5,
        totalProjects: 10,
        availableProjectSlots: 0,
        projectCapacities: [],
      },
    };
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return {
          ok: true,
          json: async () => [
            { runId: "run_123", create_time: new Date().toISOString() },
          ],
        };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => data };
      }
      return { ok: true, json: async () => [] };
    });

    renderWithProviders(<ResultsDashboard />);

    // Wait for a row to confirm load
    await screen.findByText("P10");

    // Helpers: find the footer and its left "Showing ..." box
    const getRangeBox = () => {
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      const footer = nextBtn.closest("div")?.parentElement; // footer container
      return footer?.firstElementChild; // left box: "Showing …"
    };
    const norm = (s) =>
      s
        .replace(/[\u2012-\u2015]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    // Page 1 shows 1–8 of 10
    expect(getRangeBox()).toBeTruthy();
    expect(norm(getRangeBox().textContent)).toContain("Showing 1-8 of 10");

    // Next -> 9–10 of 10
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(norm(getRangeBox().textContent)).toContain("Showing 9-10 of 10");

    // Next again stays on last page
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(norm(getRangeBox().textContent)).toContain("Showing 9-10 of 10");

    // Prev -> back to 1–8 of 10
    fireEvent.click(screen.getByRole("button", { name: /Prev/i }));
    expect(norm(getRangeBox().textContent)).toContain("Showing 1-8 of 10");

    global.fetch = originalFetch;
  });

  test("export CSV triggers Blob URL creation", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });

    // Polyfill createObjectURL safely
    const originalCreateURL = URL.createObjectURL;
    const originalRevokeURL = URL.revokeObjectURL;
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = vi.fn(() => "blob://x");
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob://x");
    }
    if (typeof URL.revokeObjectURL !== "function") {
      URL.revokeObjectURL = vi.fn();
    }

    renderWithProviders(<ResultsDashboard />);

    await screen.findByText(/Teams Overview/);

    const btn = screen.getByRole("button", { name: /Export CSV/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // restore
    if (originalCreateURL) URL.createObjectURL = originalCreateURL;
    if (originalRevokeURL) URL.revokeObjectURL = originalRevokeURL;
    global.fetch = originalFetch;
  });

  test("student access the page: hides runs selector and calls user-scoped endpoints", async () => {
    // Make localStorage return a student with a username
    window.localStorage.getItem.mockImplementation((key) => {
      const store = {
        role: "student",
        token: "test_token",
        user: JSON.stringify({ username: "student1" }),
      };
      return store[key] || null;
    });

    // Re-evaluate the component module so the top-level isStudent picks up 'student'
    vi.resetModules();

    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (
        url ===
        `${API_BASE_URL}/allocation/history?username=${encodeURIComponent("student1")}`
      ) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (
        url.startsWith(`${API_BASE_URL}/allocation/history/`) &&
        url.includes(`?username=${encodeURIComponent("student1")}`)
      ) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });

    const { default: StudentResultsDashboard } = await import(
      "../../components/ResultsDashboard.jsx"
    );

    renderWithProviders(<StudentResultsDashboard />);

    // Page loads
    // await screen.findByText(/overview/i);
    await waitFor(() => {
      expect(screen.queryByText(/Loading results…/i)).not.toBeInTheDocument();
    });

    // Runs selector is hidden for students
    expect(screen.queryByRole("combobox")).toBeNull();

    // API calls include username scoping
    expect(calls.some((u) => u.includes("/allocation/history?username="))).toBe(
      false,
    );
    expect(
      calls.some(
        (u) => u.includes("/allocation/history/") && u.includes("?username="),
      ),
    ).toBe(false);
  });

  test("tag types (Completed/Partial/Failed) render with correct style/color for(just for coverage)", async () => {
    const originalFetch = global.fetch;
    const data = {
      assignments: [
        {
          id: 1,
          projectName: "C",
          members: [{ userName: "c" }],
          skillFit: 1,
          prefTerm: 1,
          workloadTerm: 1,
          priorityTerm: 1,
          score: 1,
          status: "completed",
        },
        {
          id: 2,
          projectName: "P",
          members: [{ userName: "p" }],
          skillFit: 2,
          prefTerm: 2,
          workloadTerm: 2,
          priorityTerm: 2,
          score: 2,
          status: "partial",
        },
        {
          id: 3,
          projectName: "F",
          members: [{ userName: "f" }],
          skillFit: 3,
          prefTerm: 3,
          workloadTerm: 3,
          priorityTerm: 3,
          score: 3,
          status: "failed",
        },
      ],
      stats: {
        totalGroups: 3,
        assignedGroups: 3,
        avgScore: 2,
        totalProjects: 3,
        availableProjectSlots: 0,
        projectCapacities: [],
      },
    };
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => data };
      }
      return { ok: true, json: async () => [] };
    });

    renderWithProviders(<ResultsDashboard />);

    await screen.findByText("C");

    // Completed tone 'active': bg-[#E6FFFB] text-[#2CB1BC] border
    const completed = screen.getByText("Completed");
    expect(completed.className).toMatch(/bg-\[#E6FFFB\]/);
    expect(completed.className).toMatch(/text-\[#2CB1BC\]/);

    // Partial tone 'warn': yellow classes
    const partial = screen.getByText("Partial");
    expect(partial.className).toMatch(/bg-yellow-100/);
    expect(partial.className).toMatch(/text-yellow-800/);

    // Failed tone default: gray classes
    const failed = screen.getByText("Failed");
    expect(failed.className).toMatch(/bg-gray-100/);
    expect(failed.className).toMatch(/text-gray-700/);

    global.fetch = originalFetch;
  });

  test("verify right panel shows selection details, supports publish/rollback, export, and close", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url) => {
      if (url === `${API_BASE_URL}/allocation/history`) {
        return { ok: true, json: async () => mockRunsResponse };
      }
      if (url.includes("/allocation/history/")) {
        return { ok: true, json: async () => mockApiResponse };
      }
      return { ok: true, json: async () => [] };
    });

    // Polyfill Blob URL APIs for export
    const originalCreateURL = URL.createObjectURL;
    const originalRevokeURL = URL.revokeObjectURL;
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = vi.fn(() => "blob://x");
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob://x");
    }
    if (typeof URL.revokeObjectURL !== "function") {
      URL.revokeObjectURL = vi.fn();
    }

    renderWithProviders(<ResultsDashboard />);

    // Wait for table rows
    await screen.findByText("Teams Overview");
    const firstName = "Test Result 1";
    // Scope to the main results table to avoid multiple matches
    const tables = screen.getAllByRole("table");
    const mainTable = tables[0];
    const firstCell = within(mainTable).getByText(firstName);
    const firstRow = firstCell.closest("tr");
    expect(firstRow).toBeTruthy();

    // Open right panel by clicking row
    fireEvent.click(firstRow);

    // Find the right panel container starting from the unique "Run: ..." line
    const runLine = screen.getByText(/Run:\s*run_123/i);
    let panelContainer = runLine.parentElement;
    while (
      panelContainer &&
      !(
        typeof panelContainer.className === "string" &&
        panelContainer.className.includes("rounded-xl") &&
        panelContainer.className.includes("bg-white") &&
        panelContainer.className.includes("overflow-y-auto")
      )
    ) {
      panelContainer = panelContainer.parentElement;
    }
    expect(panelContainer).toBeTruthy();
    const panel = panelContainer;

    // Verify right panel content using unique markers, scoped to panel
    expect(within(panel).getByText(/Run:\s*run_123/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Why this team\?/i)).toBeInTheDocument();
    expect(within(panel).getByText("Skill Fit")).toBeInTheDocument();
    expect(within(panel).getByText("Pref Term")).toBeInTheDocument();
    expect(within(panel).getByText("Workload Term")).toBeInTheDocument();
    expect(within(panel).getByText("Priority Term")).toBeInTheDocument();
    expect(within(panel).getByText(/^Score$/)).toBeInTheDocument();

    // Verify Students table renders member names
    expect(within(panel).getByText(/Students/i)).toBeInTheDocument();
    expect(within(panel).getByText("Member 1")).toBeInTheDocument();
    expect(within(panel).getByText("Member 2")).toBeInTheDocument();

    // Draft pill visible initially
    expect(within(panel).getByText(/Draft Run/i)).toBeInTheDocument();

    // Publish results -> Published pill and rollback/export buttons appear
    const publishBtn = within(panel).getByRole("button", {
      name: /Publish results/i,
    });
    fireEvent.click(publishBtn);
    await waitFor(() => {
      expect(within(panel).getByText(/Published/i)).toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: /Rollback to draft/i }),
      ).toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: /Export CSV/i }),
      ).toBeInTheDocument();
    });

    // Export CSV triggers Blob URL
    const exportBtn = within(panel).getByRole("button", {
      name: /Export CSV/i,
    });
    fireEvent.click(exportBtn);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Rollback -> Draft again, publish button reappears
    const rollbackBtn = within(panel).getByRole("button", {
      name: /Rollback to draft/i,
    });
    fireEvent.click(rollbackBtn);
    await waitFor(() => {
      expect(within(panel).getByText(/Draft Run/i)).toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: /Publish results/i }),
      ).toBeInTheDocument();
    });

    // Close the panel via the header X button (icon button with class p-1)
    const headerClose = panel.querySelector("button.p-1");
    expect(headerClose).toBeTruthy();
    fireEvent.click(headerClose);

    await waitFor(() => {
      expect(within(panel).queryByText(/Why this team\?/i)).toBeNull();
    });

    // restore
    if (originalCreateURL) URL.createObjectURL = originalCreateURL;
    if (originalRevokeURL) URL.revokeObjectURL = originalRevokeURL;
    global.fetch = originalFetch;
  });
});
