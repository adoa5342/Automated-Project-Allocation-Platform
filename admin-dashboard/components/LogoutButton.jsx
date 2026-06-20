import { useAuth } from '../pages/authenticationContext';
import { useNavigate } from 'react-router-dom';

export default function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md hover: cursor-pointer transition"
    >
      Logout
    </button>
  );
}