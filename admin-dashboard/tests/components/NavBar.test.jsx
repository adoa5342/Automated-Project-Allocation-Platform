// Imports & component under test
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import NavBar from "../../components/NavBar";

// Mock: Auth context used by LogoutButton (ensures logout is defined)
vi.mock("../../pages/authenticationContext", () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from "../../pages/authenticationContext";

// Mock: localStorage with small helper API used across tests
const localStorageMock = (() => {
  let store = {};
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
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Helper: show current route so we can assert navigation results
function PathProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

// Helper: render with router + path probe
const renderWithRouter = (ui, { initialEntries = ["/"] } = {}) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
      <PathProbe />
    </MemoryRouter>,
  );

// Helper: set role (and token) in localStorage for the scenario
const setRole = (role) => {
  localStorageMock.clear();
  if (role) {
    localStorageMock.setItem("role", role);
    localStorageMock.setItem(
      "user",
      JSON.stringify({ id: 1, name: "User", role }),
    );
    localStorageMock.setItem("token", "test_token");
  }
};

// Helper: sync mocked useAuth to current localStorage state
const updateAuthMock = () => {
  const role = localStorageMock.getItem("role") || "student";
  const token = localStorageMock.getItem("token");
  useAuth.mockReturnValue({
    isAuthenticated: !!token,
    user: { id: 1, name: "User", role },
    logout: vi.fn(),
  });
};

describe("NavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // Scenario table: expected labels per role
  const cases = [
    {
      name: "admin authenticated",
      role: "admin",
      expected: [
        "Student Survey",
        "Admin Dashboard",
        "Allocation Results",
        "Logout",
      ],
      unexpected: ["Allocation Result"],
    },
    {
      name: "student authenticated",
      role: "student",
      expected: ["Student Survey", "Allocation Result", "Logout"],
      unexpected: ["Admin Dashboard", "Allocation Results"],
    },
    {
      name: "unauthenticated (defaults to student)",
      role: null,
      expected: ["Student Survey", "Allocation Result", "Logout"],
      unexpected: ["Admin Dashboard", "Allocation Results"],
    },
  ];

  // Verify which labels render (and which do not) for each role
  test.each(cases)("renders links for %s", ({ role, expected, unexpected }) => {
    setRole(role);
    updateAuthMock();
    renderWithRouter(<NavBar />, { initialEntries: ["/survey"] });

    const nav = screen.getByRole("navigation");
    // Presence checks
    expected.forEach((label) => {
      expect(
        within(nav).getByRole("button", { name: label }),
      ).toBeInTheDocument();
    });
    // Absence checks
    unexpected.forEach((label) => {
      expect(
        within(nav).queryByRole("button", { name: label }),
      ).not.toBeInTheDocument();
    });
    // Exact order/count assert
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(expected);
  });

  // Verifies active state reflecting current route and updates when clicking another link (admin)
  test("active link reflects current location and updates on click (admin)", () => {
    setRole("admin");
    updateAuthMock();
    renderWithRouter(<NavBar />, { initialEntries: ["/admin"] });

    const nav = screen.getByRole("navigation");
    const adminBtn = within(nav).getByRole("button", {
      name: "Admin Dashboard",
    });
    expect(adminBtn).toHaveAttribute("aria-current", "page");

    const surveyBtn = within(nav).getByRole("button", {
      name: "Student Survey",
    });
    expect(surveyBtn).not.toHaveAttribute("aria-current");

    // Click navigates and flips active state
    fireEvent.click(surveyBtn);
    expect(
      within(nav).getByRole("button", { name: "Student Survey" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("button", { name: "Admin Dashboard" }),
    ).not.toHaveAttribute("aria-current");
  });

  // Verifies active state reflecting current location (student)
  test("active link reflects current location (student)", () => {
    setRole("student");
    updateAuthMock();
    renderWithRouter(<NavBar />, { initialEntries: ["/results"] });

    const nav = screen.getByRole("navigation");
    const resultBtn = within(nav).getByRole("button", {
      name: "Allocation Result",
    });
    expect(resultBtn).toHaveAttribute("aria-current", "page");
  });

  // Verifies each admin label navigates to its expected route
  test("navigates to the correct route for each admin link", () => {
    setRole("admin");
    updateAuthMock();
    renderWithRouter(<NavBar />, { initialEntries: ["/admin"] });

    const nav = screen.getByRole("navigation");
    const adminLinks = [
      { label: "Student Survey", path: "/survey" },
      { label: "Admin Dashboard", path: "/admin" },
      { label: "Allocation Results", path: "/results" },
    ];

    adminLinks.forEach(({ label, path }) => {
      fireEvent.click(within(nav).getByRole("button", { name: label }));
      expect(screen.getByTestId("path").textContent).toBe(path);
    });
  });

  // Verifies each student label navigates to its expected route
  test("navigates to the correct route for each student link", () => {
    setRole("student");
    updateAuthMock();
    renderWithRouter(<NavBar />, { initialEntries: ["/survey"] });

    const nav = screen.getByRole("navigation");
    const studentLinks = [
      { label: "Student Survey", path: "/survey" },
      { label: "Allocation Result", path: "/results" },
    ];

    studentLinks.forEach(({ label, path }) => {
      fireEvent.click(within(nav).getByRole("button", { name: label }));
      expect(screen.getByTestId("path").textContent).toBe(path);
    });
  });
});
