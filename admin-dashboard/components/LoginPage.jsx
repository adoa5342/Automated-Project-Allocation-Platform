import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../pages/authenticationContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState({ username: "", password: "", general: "" });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // reset field errors and any prior general error
    let newErrors = { username: "", password: "", general: "" };

    if (!username) newErrors.username = "This field cannot be left blank";
    if (!password) newErrors.password = "This field cannot be left blank";

    setError(newErrors);

    if (newErrors.username || newErrors.password) {
      setLoading(false);
      return;
    }

    try {
      const result = await login(username, password);
      
      if (result.success) {
        const from = location.state?.from?.pathname;

        if (from) {
          navigate(from, { replace: true });
        } else {
          if (result.role === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/survey', { replace: true });
          }
        }

      } else {
        setError(prev => ({ ...prev, general: result.message || 'Invalid username or password' }));
      }

    } catch (error) {
      setError(prev => ({ ...prev, general: 'An error occurred during login' }));
      
    } finally {
      setLoading(false);
    }

  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#424242]">
      <div className="text-center">

      <div className="flex flex-col items-center mb-8 w-full">
        <img 
          src="/usyd.PNG" 
          alt="University of Sydney Logo" 
          className="w-full max-w-sm object-contain mb-4"
        />
      </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#424242] text-white w-80 text-left"
        >
          <h2 className="text-center mb-6 font-semibold">Sign In</h2>

          {error.general && (
            <p className="bg-[#e53935] text-white text-sm px-3 py-2 mb-4 rounded">
              {error.general}
            </p>
          )}

          {/* Username Field */}
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border border-gray-400 rounded text-black bg-gray-50"
          />
          {error.username && (
            <p className="bg-[#e53935] text-white text-sm px-2 py-1 mt-1 rounded">
              {error.username}
            </p>
          )}

          {/* Password Field */}
          <label className="block text-sm font-medium mt-4 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-gray-400 rounded text-black bg-gray-50"
          />
          {error.password && (
            <p className="bg-[#e53935] text-white text-sm px-2 py-1 mt-1 rounded">
              {error.password}
            </p>
          )}

          {/* Keep signed in */}
          <div className="flex items-center mt-3">
            <input type="checkbox" id="remember" className="mr-2" />
            <label htmlFor="remember" className="text-sm">
              Keep me signed in
            </label>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full bg-[#e64a19] hover:bg-[#d84315] text-white py-2 mt-5 rounded"
          >
            {loading ? 'Signing in...' : 'Next'}
          </button>

          {/* Links */}
          <div className="flex justify-between mt-4 text-sm underline">
            <a href="#">Unlock account?</a>
            <a href="#">Help</a>
            <a href="#">Privacy</a>
          </div>
        </form>
      </div>
    </div>
  );
}
