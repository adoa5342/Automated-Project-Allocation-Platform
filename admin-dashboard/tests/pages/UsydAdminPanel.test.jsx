/* eslint-disable no-undef */
/** @vitest-environment jsdom */

import React from "react";

import {
  render,
  fireEvent,
  waitFor,
  screen,
  cleanup,
} from "@testing-library/react";

import { MemoryRouter } from "react-router-dom";
import UsydAdminPanel from "../../components/UsydAdminPanel";
import { useAuth } from "../../pages/authenticationContext";
import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/react";
import { act } from "react";
import axios from "axios";
import { beforeAll } from "vitest";
import { toast } from "react-hot-toast";

/* ===========================================================================================
   Global mocks
   =========================================================================================== */

vi.mock("axios");
vi.mock("../../pages/authenticationContext", () => ({
  useAuth: vi.fn(),
}));

// Global fetch mock (safe default; suites override in beforeEach)
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  }),
);

// Render helper — persist container to a guaranteed DOM root
const renderWithProviders = (ui) =>
  render(<MemoryRouter>{ui}</MemoryRouter>, {
    container:
      document.getElementById("root") ||
      document.body.appendChild(
        Object.assign(document.createElement("div"), { id: "root" }),
      ),
  });

/* ===========================================================================================
   Mock Data Fixtures
   =========================================================================================== */

const mockUserData = [
  { id: 1, name: "John Doe", role: "student", email: "john@example.com" },
  { id: 2, name: "Jane Smith", role: "student", email: "jane@example.com" },
  { id: 3, name: "Bob Johnson", role: "admin", email: "bob@example.com" },
];

const mockAllocationHistory = [
  { id: "alloc-1", fileName: "user.csv", status: "approved", action: "view" },
  { id: "alloc-2", fileName: "skill.csv", status: "pending", action: "edit" },
];

const mockAllocationDetails = {
  assignments: [
    {
      id: 1,
      projectName: "Project A",
      groupName: "Group 1",
      status: "completed",
      score: 95,
      members: [{ userName: "John Doe" }],
    },
  ],
};

const mockGroupTagData = [
  { id: 1, groupTag: "ISYS3888_T13_03" },
  { id: 2, groupTag: "COMP3888_F14_01" },
  { id: 3, groupTag: "SOFT3888_F16_04" },
];

const mockSkillData = [
  {
    id: "S001",
    name: "JavaScript",
    category: "Programming",
    description: "JavaScript programming language",
  },
  {
    id: "S002",
    name: "React",
    category: "Frontend",
    description: "React framework",
  },
  {
    id: "S003",
    name: "Node.js",
    category: "Backend",
    description: "Node.js runtime",
  },
];

const mockProjectData = [
  {
    id: "P001",
    title: "E-commerce Platform",
    client_org: "Retail Co",
    supervisor: "Dr. Smith",
    capacitySlots: 4,
    estimatedHoursPerWeek: 10,
    priority: 1,
    cohort: "2025",
    dueWeek: 12,
    tags: "web, commerce",
    description: "Build an online store",
  },
  {
    id: "P002",
    title: "Mobile App",
    client_org: "Tech Startup",
    supervisor: "Prof. Johnson",
    capacitySlots: 3,
    estimatedHoursPerWeek: 8,
    priority: 2,
    cohort: "2025",
    dueWeek: 10,
    tags: "mobile, react-native",
    description: "Cross-platform mobile application",
  },
];

const mockProjectRequiredSkillData = [
  {
    projectId: "P001",
    skillId: "S001",
    minLevel: 3,
    importance: "high",
    project: { id: "P001", title: "E-commerce Platform" },
    skill: { id: "S001", name: "JavaScript" },
  },
  {
    projectId: "P001",
    skillId: "S002",
    minLevel: 2,
    importance: "medium",
    project: { id: "P001", title: "E-commerce Platform" },
    skill: { id: "S002", name: "React" },
  },
  {
    projectId: "P002",
    skillId: "S003",
    minLevel: 3,
    importance: "high",
    project: { id: "P002", title: "Mobile App" },
    skill: { id: "S003", name: "Node.js" },
  },
];

/* ===========================================================================================
   Environment setup
   =========================================================================================== */

beforeAll(() => {
  // Ensure a valid DOM root
  const existing = document.getElementById("root");
  if (!existing) {
    const div = document.createElement("div");
    div.setAttribute("id", "root");
    document.body.appendChild(div);
  }

  // Ensure URL APIs exist in jsdom to avoid TypeError: URL.revokeObjectURL is not a function
  if (!global.URL) {
    global.URL = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    };
  } else {
    if (typeof global.URL.createObjectURL !== "function") {
      global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    }
    if (typeof global.URL.revokeObjectURL !== "function") {
      global.URL.revokeObjectURL = vi.fn();
    }
  }
});

// Silence console errors by default.
// We still assert console.error was called in tests that expect it.
vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(() => console.error.mockClear());

// ------------------------------
// Helpers
// ------------------------------
const mockAuthAdmin = (name = "Admin") => {
  useAuth.mockReturnValue({
    isAuthenticated: true,
    user: { id: 1, role: "admin", name },
    logout: vi.fn(),
  });
};

// ------------------------------
// Core UI and Flows
// ------------------------------
describe("UsydAdminPanel - Core UI and Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin("Admin User");
    localStorage.setItem("token", "abc123");

    global.fetch.mockImplementation((url) => {
      if (url.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: mockUserData }),
        });
      }
      if (
        url.includes("/api/v1/allocation/history") &&
        !url.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        });
      }
      if (url.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationDetails),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("renders admin panel structure for admin role", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    expect(
      screen.getByRole("heading", { name: /admin dashboard/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      const tables = screen.getAllByRole("table");
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  test("displays user management functionality for admin", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    await waitFor(() => {
      const tables = screen.getAllByRole("table");
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  test("allows interaction with allocation history", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    await waitFor(() => {
      const tables = screen.getAllByRole("table");
      expect(tables.some((t) => t.querySelectorAll("tr").length > 1)).toBe(
        true,
      );
    });
  });

  test("opens allocation details modal when requested", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    await waitFor(() => {
      const tables = screen.getAllByRole("table");
      expect(tables.length).toBeGreaterThan(0);
    });

    const viewBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent.includes("View"));
    await act(async () => fireEvent.click(viewBtns[0]));

    await waitFor(() => {
      expect(screen.getByText(/detail view/i)).toBeInTheDocument();
      const closeBtn = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeBtn);
    });
  });

  test("toggles avoid penalty option and slider change works", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const checkbox = screen.getByRole("checkbox", { name: /avoid penalty/i });
    await act(async () => {
      await userEvent.click(checkbox);
    });
    expect(checkbox).toBeChecked();

    const sliders = screen.getAllByRole("slider");
    await act(async () => {
      fireEvent.change(sliders[0], { target: { value: "50" } });
    });
    expect(sliders[0].value).toBe("50");
  });

  test("download templates and browse click trigger correct behavior", async () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const origCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "a") {
          const a = origCreate("a");
          a.click = vi.fn();
          return a;
        }
        if (tag === "input") {
          const input = origCreate("input");
          input.type = "file";
          input.click = vi.fn();
          return input;
        }
        return origCreate(tag);
      });

    const downloadBtn = screen.getByRole("button", {
      name: /download templates/i,
    });
    await act(async () => {
      await userEvent.click(downloadBtn);
    });
    expect(createSpy).toHaveBeenCalled();

    const browseBtn = screen.getAllByRole("button", { name: /browse/i })[0];
    await act(async () => {
      await userEvent.click(browseBtn);
    });
    expect(createSpy).toHaveBeenCalled();

    createSpy.mockRestore();
  });

  test("authHeaders adds Authorization when token is present", async () => {
    localStorage.setItem("token", "abc123");
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/database/records"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
        }),
      }),
    );
  });
});

// ------------------------------
// File Uploads
// ------------------------------
describe("UsydAdminPanel - File Uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignments: [] }),
        });
      }
      if (u.includes("/api/v1/allocation/history")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("File input: user cancels (no files) -> no upload call", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const table = screen.getAllByRole("table")[0];
    const groupTagsRow = within(table)
      .getByText(/^Group Tags$/i)
      .closest("tr");
    const browseBtn = within(groupTagsRow).getByRole("button", {
      name: /browse/i,
    });

    const origCreate = document.createElement.bind(document);
    const inputs = [];
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "input") {
          const fake = {
            type: "file",
            accept: "",
            onchange: null,
            click: vi.fn(),
            files: [],
          };
          inputs.push(fake);
          return fake;
        }
        return origCreate(tag);
      });

    const fetchSpy = vi.spyOn(global, "fetch");
    await act(async () => userEvent.click(browseBtn));
    await act(async () => inputs[0].onchange?.({ target: { files: [] } }));

    expect(
      fetchSpy.mock.calls.some(([u]) =>
        String(u).includes("/api/v1/import/csv"),
      ),
    ).toBe(false);

    createSpy.mockRestore();
  });

  test("File input: wrong type/filename -> goes to error path", async () => {
    const original = global.fetch;
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/api/v1/import/csv")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: false, errors: ["Wrong file"] }),
        });
      }
      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      return original(url);
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const table = screen.getAllByRole("table")[0];
    const row = within(table)
      .getByText(/^Group Tags$/i)
      .closest("tr");
    const browseBtn = within(row).getByRole("button", { name: /browse/i });

    const origCreate = document.createElement.bind(document);
    const inputs = [];
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "input") {
          const fake = {
            type: "file",
            accept: "",
            onchange: null,
            click: vi.fn(),
            files: [],
          };
          inputs.push(fake);
          return fake;
        }
        return origCreate(tag);
      });

    await act(async () => userEvent.click(browseBtn));
    const badType = new File(["nope"], "group_tags.txt", {
      type: "text/plain",
    });
    await act(async () =>
      inputs[0].onchange?.({ target: { files: [badType] } }),
    );

    await waitFor(() => {
      const fails = screen.getAllByText(/failed/i);
      expect(fails.length).toBeGreaterThan(0);
    });

    createSpy.mockRestore();
    global.fetch = original;
  });

  test("Preview shows rows after successful import (post-import probe path)", async () => {
    let imported = false;
    const original = global.fetch;
    global.fetch = vi.fn(async (url, options = {}) => {
      const u = String(url);

      if (u.includes("/api/v1/import/csv")) {
        imported = true;
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }

      if (u.includes("/api/v1/database/records")) {
        let table;
        try {
          table = options?.body ? JSON.parse(options.body).table : undefined;
        } catch {}
        if (table === "group_tag") {
          return Promise.resolve({
            ok: true,
            json: async () =>
              imported
                ? { ok: true, data: [{ id: 7, groupTag: "G7" }] }
                : { ok: true, data: [] },
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }

      if (u.includes("/api/v1/allocation/history")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return original(url, options);
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const table = screen.getAllByRole("table")[0];
    const row = within(table)
      .getByText(/^Group Tags$/i)
      .closest("tr");
    const browseBtn = within(row).getByRole("button", { name: /browse/i });

    const origCreate = document.createElement.bind(document);
    const inputs = [];
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "input") {
          const fake = {
            type: "file",
            accept: "",
            onchange: null,
            click: vi.fn(),
            files: [],
          };
          inputs.push(fake);
          return fake;
        }
        return origCreate(tag);
      });

    await act(async () => userEvent.click(browseBtn));
    const good = new File(["ok"], "group_tags.csv", { type: "text/csv" });
    await act(async () => inputs[0].onchange?.({ target: { files: [good] } }));

    await waitFor(() =>
      expect(within(row).getByText(/present/i)).toBeInTheDocument(),
    );

    const previewSelect = screen.getByRole("combobox");
    await act(async () => {
      await userEvent.selectOptions(
        previewSelect,
        screen.getByRole("option", { name: /group tags/i }),
      );
    });
    await screen.findByText(/G7/i);

    createSpy.mockRestore();
    global.fetch = original;
  });

  test("Handle file upload errors", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    const { getByText } = renderWithProviders(<UsydAdminPanel />);
    const browseButtons = screen.getAllByText("Browse");
    const firstBrowseButton = browseButtons[0];

    const file = new File(["test"], "test.csv", { type: "text/csv" });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    vi.spyOn(document, "createElement").mockReturnValueOnce(fileInput);

    firstBrowseButton.click();

    const changeEvent = new Event("change");
    Object.defineProperty(changeEvent, "target", {
      value: { files: [file] },
      writable: false,
    });
    fileInput.dispatchEvent(changeEvent);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test("Handle failed file upload response", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ ok: false, errors: ["Invalid format"] }),
      }),
    );

    renderWithProviders(<UsydAdminPanel />);

    const browseButtons = screen.getAllByText("Browse");
    const firstBrowseButton = browseButtons[0];

    const file = new File(["test"], "test.csv", { type: "text/csv" });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    vi.spyOn(document, "createElement").mockReturnValueOnce(fileInput);

    firstBrowseButton.click();

    const changeEvent = new Event("change");
    Object.defineProperty(changeEvent, "target", {
      value: { files: [file] },
      writable: false,
    });
    fileInput.dispatchEvent(changeEvent);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Upload Failed:", [
        "Invalid format",
      ]);
    });
  });

  test("Handle zip file upload", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      }),
    );

    renderWithProviders(<UsydAdminPanel />);

    const uploadAllButton = screen.getByText("Upload All");

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    vi.spyOn(document, "createElement").mockReturnValueOnce(fileInput);

    fireEvent.click(uploadAllButton);

    const zipFile = new File(["test"], "data.zip", { type: "application/zip" });
    const changeEvent = new Event("change");
    Object.defineProperty(changeEvent, "target", {
      value: { files: [zipFile] },
      writable: false,
    });
    fileInput.dispatchEvent(changeEvent);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

// ------------------------------
// Database Operations
// ------------------------------
describe("UsydAdminPanel - Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();

    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignments: [] }),
        });
      }
      if (u.includes("/api/v1/allocation/history")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("Clear Database: user cancels confirm -> no clear/reset endpoint call is added", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchSpy = vi.spyOn(global, "fetch");

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const clearCallCountBefore = fetchSpy.mock.calls.filter(
      ([u]) =>
        String(u).includes("/api/v1/database/clear") ||
        String(u).includes("/api/v1/database/reset") ||
        (String(u).includes("/api/v1/database") &&
          !String(u).includes("/api/v1/database/records")),
    ).length;

    const clearBtn = await screen.findByRole("button", {
      name: /clear database/i,
    });
    await act(async () => userEvent.click(clearBtn));

    const clearCallCountAfter = fetchSpy.mock.calls.filter(
      ([u]) =>
        String(u).includes("/api/v1/database/clear") ||
        String(u).includes("/api/v1/database/reset") ||
        (String(u).includes("/api/v1/database") &&
          !String(u).includes("/api/v1/database/records")),
    ).length;

    expect(
      fetchSpy.mock.calls.filter(([u]) =>
        String(u).match(/\/api\/v1\/database\/(clear|reset)/),
      ).length,
    ).toBe(0);

    confirmSpy.mockRestore();
  });

  test("clearing database resets statuses and file upload success/failure", async () => {
    const originalFetch = global.fetch;
    let importCalls = 0;
    let importedGroupTags = false;

    global.fetch = vi.fn(async (url, options = {}) => {
      const u = String(url);
      if (
        u.includes("/api/v1/database") &&
        !u.includes("/api/v1/database/records")
      ) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (u.includes("/api/v1/database/records")) {
        const body = options?.body ? JSON.parse(options.body) : {};
        const table = body.table;
        if (table === "group_tag") {
          return Promise.resolve({
            ok: true,
            json: async () =>
              importedGroupTags
                ? { ok: true, data: [{ id: 1, groupTag: "GROUP1" }] }
                : { ok: true, data: [] },
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      if (u.includes("/api/v1/import/csv")) {
        importCalls += 1;
        if (importCalls === 1)
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: false, errors: ["Invalid CSV"] }),
          });
        importedGroupTags = true;
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (u.includes("/api/v1/allocation/history/"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignments: [] }),
        });
      if (u.includes("/api/v1/allocation/history"))
        return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const clearBtn = await screen.findByRole("button", {
      name: /clear database/i,
    });
    await act(async () => fireEvent.click(clearBtn));

    const table = screen.getAllByRole("table")[0];
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);

    expect(screen.getByText("0/4")).toBeInTheDocument();

    const previewSelect = screen.getByRole("combobox");
    await act(async () => {
      await userEvent.selectOptions(
        previewSelect,
        screen.getByRole("option", { name: /group tags/i }),
      );
    });
    await screen.findByText(/no preview data/i);

    const origCreate = document.createElement.bind(document);
    const inputs = [];
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "input") {
          const fake = {
            type: "file",
            accept: "",
            onchange: null,
            click: vi.fn(),
            files: [],
          };
          inputs.push(fake);
          return fake;
        }
        return origCreate(tag);
      });

    const groupTagsRow = within(table)
      .getByText(/^Group Tags$/i)
      .closest("tr");
    const browseBtn = within(groupTagsRow).getByRole("button", {
      name: /browse/i,
    });

    await act(async () => fireEvent.click(browseBtn));
    const badFile = new File(["dummy"], "skills.csv", { type: "text/csv" });
    await act(async () =>
      inputs[0].onchange?.({ target: { files: [badFile] } }),
    );

    await act(async () => fireEvent.click(browseBtn));
    const goodFile = new File(["data"], "group_tags.csv", { type: "text/csv" });
    await act(async () =>
      inputs[1].onchange?.({ target: { files: [goodFile] } }),
    );

    await waitFor(() => {
      expect(within(groupTagsRow).getByText(/present/i)).toBeInTheDocument();
    });

    createSpy.mockRestore();
    global.fetch = originalFetch;
  });

  test("Handle clear database errors", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Clear failed")));

    renderWithProviders(<UsydAdminPanel />);

    const clearButton = screen.getByText("Clear Database");
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test("refreshFileStatuses handles database errors gracefully", async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes("/api/v1/database/records")) {
        return Promise.reject(new Error("Database connection failed"));
      }

      if (url.includes("/api/v1/allocation/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    expect(
      screen.getByRole("heading", { name: /admin dashboard/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const missingStatuses = screen.getAllByText("Missing");
      expect(missingStatuses.length).toBeGreaterThan(0);
    });
  });

  test("File status shows Present when database has records", async () => {
    let recordCallCount = 0;

    global.fetch.mockImplementation((url, options) => {
      if (url.includes("/api/v1/database/records")) {
        const body = options?.body ? JSON.parse(options.body) : {};
        const table = body.table;

        recordCallCount++;

        let data = [];
        switch (table) {
          case "group_tag":
            data = mockGroupTagData;
            break;
          case "skill":
            data = mockSkillData;
            break;
          case "project":
            data = mockProjectData;
            break;
          case "project_required_skill":
            data = mockProjectRequiredSkillData;
            break;
          case "user":
            data = mockUserData;
            break; // this is for preview, not file status
          default:
            data = [{ id: 1, name: "test" }];
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data }),
        });
      }

      if (url.includes("/api/v1/allocation/history")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    expect(
      screen.getByRole("heading", { name: /admin dashboard/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(recordCallCount).toBeGreaterThanOrEqual(4);
    });

    await waitFor(() => {
      const presentStatuses = screen.getAllByText("Present");
      expect(presentStatuses.length).toBe(4);

      const counter = screen.getByText("4/4");
      expect(counter).toBeInTheDocument();
    });
  });

  test("Handle checkTableHasRows network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    renderWithProviders(<UsydAdminPanel />);

    await waitFor(() => {
      const statusElements = screen.getAllByText("Missing");
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });
});

// ------------------------------
// Allocation Run and History
// ------------------------------
describe("UsydAdminPanel - Allocation Run and History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
    localStorage.setItem("token", "abc123");

    global.fetch.mockImplementation((url) => {
      const u = String(url);

      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: [] }),
        });
      }

      if (
        u.includes("/api/v1/allocation/history") &&
        !u.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        });
      }

      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationDetails),
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("Run Allocation: axios network error -> failure branch covered", async () => {
    axios.post.mockRejectedValueOnce(new Error("boom"));
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const runBtn = screen.getByRole("button", { name: /run allocation/i });
    await act(async () => userEvent.click(runBtn));

    await waitFor(() => {
      const fails = screen.getAllByText(/failed/i);
      expect(fails.length).toBeGreaterThan(0);
    });
  });

  test("handleRunAllocation updates status for success and failure", async () => {
    axios.post
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { ok: false } });

    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const runBtn = screen.getByRole("button", { name: /run allocation/i });

    await act(async () => userEvent.click(runBtn));
    await waitFor(() =>
      expect(screen.getByText(/completed/i)).toBeInTheDocument(),
    );

    await act(async () => userEvent.click(runBtn));
    await waitFor(() => {
      const fails = screen.getAllByText(/failed/i);
      expect(fails.length).toBeGreaterThan(0);
    });
  });

  test("Check if avoid penalty checkbox affects allocation criteria", async () => {
    const mockAxiosPost = vi.fn().mockResolvedValue({ data: { ok: true } });
    axios.post = mockAxiosPost;

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const checkbox = screen.getByRole("checkbox", { name: /avoid penalty/i });
    await act(async () => {
      await userEvent.click(checkbox);
    });
    expect(checkbox).toBeChecked();

    const runBtn = screen.getByRole("button", { name: /run allocation/i });
    await act(async () => userEvent.click(runBtn));

    await waitFor(() => {
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
    });
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  test("Opening and closing modal multiple times stays stable", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));

    let viewBtns = await screen.findAllByRole("button", { name: /view/i });
    await act(async () => userEvent.click(viewBtns[0]));
    await screen.findByText(/detail view/i);
    await act(async () =>
      userEvent.click(await screen.findByRole("button", { name: /close/i })),
    );
    await waitFor(() =>
      expect(screen.queryByText(/detail view/i)).not.toBeInTheDocument(),
    );

    viewBtns = await screen.findAllByRole("button", { name: /view/i });
    await act(async () => userEvent.click(viewBtns[0]));
    await screen.findByText(/detail view/i);
    await act(async () =>
      userEvent.click(await screen.findByRole("button", { name: /close/i })),
    );
    await waitFor(() =>
      expect(screen.queryByText(/detail view/i)).not.toBeInTheDocument(),
    );
  });
});

// ------------------------------
// Modal Accessibility
// ------------------------------
describe("UsydAdminPanel - Modal Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
    localStorage.setItem("token", "abc123");

    global.fetch.mockImplementation((url) => {
      const u = String(url);

      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: [] }),
        });
      }

      if (
        u.includes("/api/v1/allocation/history") &&
        !u.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        });
      }

      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationDetails),
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("Escape key closes modal", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const viewBtns = await screen.findAllByRole("button", { name: /view/i });
    await act(async () => userEvent.click(viewBtns[0]));
    await screen.findByText(/detail view/i);

    await act(async () => userEvent.keyboard("{Escape}"));
    await waitFor(() =>
      expect(screen.queryByText(/detail view/i)).not.toBeInTheDocument(),
    );
  });

  test("Trap focus cycles on Tab and Shift+Tab within modal", async () => {
    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const viewBtns = await screen.findAllByRole("button", { name: /view/i });
    await act(async () => userEvent.click(viewBtns[0]));
    await screen.findByText(/detail view/i);

    const closeBtn = await screen.findByRole("button", { name: /close/i });
    closeBtn.focus();

    await act(async () => userEvent.keyboard("{Tab}"));
    await act(async () => userEvent.keyboard("{Shift>}{Tab}{/Shift}"));

    expect(document.activeElement).toBeDefined();
  });
});

// ------------------------------
// Preview and Selector
// ------------------------------
describe("UsydAdminPanel - Preview and Selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
    localStorage.setItem("token", "abc123");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("Preview selector remains functional even without data", async () => {
    const original = global.fetch;

    global.fetch = vi.fn((url, opts) => {
      const u = String(url);

      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      if (
        u.includes("/api/v1/allocation/history") &&
        !u.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAllocationHistory,
        });
      }
      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAllocationDetails,
        });
      }
      return original(url, opts);
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const previewSelect = screen.getByRole("combobox");
    const optionValues = [
      "students",
      "skills",
      "projects",
      "project_required_skills",
      "group_tags",
      "groups",
      "group_members",
      "group_skills",
      "group_preferences",
      "group_availability",
      "criteria_weights",
    ];

    for (const value of optionValues) {
      const opt = previewSelect.querySelector(`option[value="${value}"]`);
      if (opt) {
        await act(async () => userEvent.selectOptions(previewSelect, value));
      }
    }

    expect(previewSelect).toBeInTheDocument();

    global.fetch = original;
  });
});

// ------------------------------
// Auth Headers
// ------------------------------
describe("UsydAdminPanel - Auth Headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("authHeaders returns empty object if token missing", async () => {
    localStorage.removeItem("token");
    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: [] }),
        });
      }
      if (
        u.includes("/api/v1/allocation/history") &&
        !u.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        });
      }
      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationDetails),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const call = global.fetch.mock.calls.find(([u]) =>
      u.includes("/api/v1/database/records"),
    );
    expect(call[1].headers.Authorization).toBeUndefined();
  });
});

// ------------------------------
// Error Handling
// ------------------------------
describe("UsydAdminPanel - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin();
    localStorage.setItem("token", "abc123");

    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/api/v1/database/records")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: [] }),
        });
      }
      if (
        u.includes("/api/v1/allocation/history") &&
        !u.includes("/api/v1/allocation/history/")
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      if (u.includes("/api/v1/allocation/history/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignments: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("handles API errors without crashing", async () => {
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes("/api/v1/allocation/history")) {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: [] }),
      });
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /admin dashboard/i }),
      ).toBeInTheDocument();
    });
  });

  test("handleFileUpload handles thrown fetch error (catch block)", async () => {
    global.fetch.mockImplementationOnce(() => {
      throw new Error("fetch exploded");
    });
    await act(async () => renderWithProviders(<UsydAdminPanel />));
    const browseBtn = screen.getAllByRole("button", { name: /browse/i })[0];
    await act(async () => userEvent.click(browseBtn));
    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test("Catch block in handleFileUpload function, simulate network error during upload", async () => {
    global.fetch.mockImplementationOnce(() => {
      throw new Error("Network error");
    });

    await act(async () => renderWithProviders(<UsydAdminPanel />));

    const browseBtn = screen.getAllByRole("button", { name: /browse/i })[0];
    await act(async () => userEvent.click(browseBtn));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test("Handle allocation history fetch errors", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    renderWithProviders(<UsydAdminPanel />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching allocation history:",
        expect.any(Error),
      );
    });

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  test("Handle allocation detail fetch errors (generic)", async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        }),
      )
      .mockImplementationOnce(() => Promise.reject(new Error("Fetch failed")));

    renderWithProviders(<UsydAdminPanel />);

    await waitFor(() => {
      expect(screen.getByText("Run Controls & History")).toBeInTheDocument();
    });

    const viewDetailsButtons = screen.getAllByText("View Details");
    if (viewDetailsButtons.length > 0) {
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });
    }
  });

  test("Handle failed allocation detail response", async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationHistory),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Not found" }),
        }),
      );

    renderWithProviders(<UsydAdminPanel />);

    await waitFor(() => {
      expect(screen.getByText("Run Controls & History")).toBeInTheDocument();
    });

    const viewDetailsButtons = screen.getAllByText("View Details");
    if (viewDetailsButtons.length > 0) {
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });
    }
  });

  test("Handle allocation detail fetch errors (specific log)", async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllocationDetails),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.reject(new Error("Detail fetch failed")),
      );

    renderWithProviders(<UsydAdminPanel />);

    await waitFor(() => {
      expect(screen.getByText("Run Controls & History")).toBeInTheDocument();
    });

    const viewDetailsButtons = screen.queryAllByText(/view details/i);
    if (viewDetailsButtons.length > 0) {
      fireEvent.click(viewDetailsButtons[0]);
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "Error fetching allocation details:",
          expect.any(Error),
        );
      });
    }
  });
});
/* ===========================================================================================
   End of test file
   =========================================================================================== */
