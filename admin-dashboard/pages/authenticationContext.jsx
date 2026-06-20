import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        const userRole = localStorage.getItem('role');
        
        if (token && userData && userRole) {
            setUser({...JSON.parse(userData), role: userRole});
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await fetch('http://localhost:3000/api/v1/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            console.log(data);

            if (data.ok) {
                const userWithRole = {
                    ...data.user,
                    role: data.user.role
                };

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('role', data.user.role);

                setUser(userWithRole);

                return { 
                    success: true, 
                    user: userWithRole,
                    role: data.user.role 
                };

            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error occurred' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        setUser(null);
    };

    const value = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        userRole: user?.role
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}