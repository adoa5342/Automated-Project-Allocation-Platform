import { useLocation, useNavigate } from "react-router-dom";
import LogoutButton from "./LogoutButton";

export default function NavBar() {
  const rawRole = (localStorage.getItem("role") || "student").toLowerCase();
  const role = rawRole === "admin" ? "admin" : "student";
  const LINKS = {
    admin: [
      { to: "/survey", label: "Student Survey" },
      { to: "/admin", label: "Admin Dashboard" },
      { to: "/results", label: "Allocation Results" },
    ],
    student: [
      { to: "/survey", label: "Student Survey" },
      { to: "/results", label: "Allocation Result" },
    ],
  };

  const location = useLocation();
  const navigate = useNavigate();
  const base = "hover:text-gray-300 transition";
  const active = "border-b-2 border-white pb-1 font-semibold";

  return (
      <nav className="flex items-center space-x-8 text-base">
        {LINKS[role].map(({ to, label }) => {
          const isActive = location.pathname === to;
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              type="button"
              className={`rounded-md hover:cursor-pointer ${isActive ? `${base} ${active}` : base}`}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </button>
          );
        })}
        <LogoutButton />
      </nav>
  );
}
