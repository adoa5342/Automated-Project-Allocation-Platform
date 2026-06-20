import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./authenticationContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, userRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    const fallback = userRole === "admin" ? "/admin" : "/survey";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
