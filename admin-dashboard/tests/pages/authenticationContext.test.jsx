import React, { createContext, useContext, useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Test-Specific AuthContext
const TestAuthContext = createContext();

const TestAuthProvider = ({ children, mockLoginSuccess = true }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        console.log('Load user data from localStorage:', savedUser);
      } else {
        console.log('No user data in localStorage');
      }
    } catch (err) {
      console.error('Failed to load localStorage:', err);
    }
  }, []);
  
  // Simulated Login Method
  const login = async (email, password) => {
    console.log('Begin the login process:', { email, password });
    setLoading(true);
    setError(null);
    
    try {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (mockLoginSuccess) {
        // Simulate a successful response
        const mockUser = { id: '123', name: 'Test User', role: 'student' };
        setUser(mockUser);
        localStorage.setItem('user', JSON.stringify(mockUser));
        console.log('Login Successful - Set User Status:', mockUser);
        return { success: true };
      } else {
        // Failure response
        const errorMsg = 'Invalid username or password';
        setError(errorMsg);
        console.log('Login Failed - Incorrect Settings:', errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (err) {
      const errorMsg = 'An error occurred during the login process.';
      setError(errorMsg);
      console.error('Login error:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
      console.log('Login process completed - Loading state reset');
    }
  };
  
  // Simulated Logout Method - introduce delay to ensure state loading can be captured
  const logout = async () => {
    console.log('Initiate the logout process');
    setLoading(true);
    
    try {
      // Add a brief delay to ensure the UI has time to update the loading status.
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setUser(null);
      localStorage.removeItem('user');
      console.log('Logout successful - User session cleared');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
      console.log('Logout process completed - Loading state reset');
    }
  };
  
  return (
    <TestAuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout
    }}>
      {children}
    </TestAuthContext.Provider>
  );
};

//Test Hook
const useTestAuth = () => useContext(TestAuthContext);

// Test Component
const TestComponent = () => {
  const { user, loading, error, login, logout } = useTestAuth();
  
  return (
    <div>
      <div data-testid="user-name">{user?.name || 'Not logged in'}</div>
      <div data-testid="loading-status">{loading ? 'Loading' : 'Idle'}</div>
      <div data-testid="error-message">{error || 'No Error'}</div>
      
      <button 
        data-testid="login-button" 
        onClick={() => login('test@example.com', 'password')}
        disabled={loading}
      >Login</button>
      
      <button 
        data-testid="logout-button" 
        onClick={logout}
        disabled={!user || loading}
      >Log out</button>
    </div>
  );
};

describe('Certification Process Simulation Test', () => {
  beforeEach(() => {
    localStorage.clear();
    console.log('\n===== Test case begins =====');
  });
  
  afterEach(() => {
    console.log('===== Test case completed =====\n');
  });
  
  test('1. Successful Login Process - Status Updated Correctly', async () => {
    render(
      <TestAuthProvider>
        <TestComponent />
      </TestAuthProvider>
    );
    
    // Initial state verification
    expect(screen.getByTestId('user-name')).toHaveTextContent('Not logged in');
    expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
    
    // Execute Login
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Verify loading status
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Loading');
    }, { timeout: 1000 });
    
    // Verify the final state
    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
    }, { timeout: 1000 });
  });
  
  test('2. Restore login status from localStorage', async () => {
    // Pre set localStorage
    const mockUser = { id: '123', name: 'Persistent User', role: 'student' };
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    render(
      <TestAuthProvider>
        <TestComponent />
      </TestAuthProvider>
    );
    
    // Verification status restored
    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Persistent User');
    }, { timeout: 1000 });
  });
  
  test('3. Logout Function - Status Cleared Correctly', async () => {
    // Pre set user status
    const mockUser = { id: '123', name: 'Test User', role: 'student' };
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    render(
      <TestAuthProvider>
        <TestComponent />
      </TestAuthProvider>
    );
    
    // Verify initial state
    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    }, { timeout: 1000 });
    
    // Execute logout
    fireEvent.click(screen.getByTestId('logout-button'));
    
    // Verify loading status - Increase timeout duration
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Loading');
    }, { timeout: 1500 });  // Extend timeout period
    
    //Verify the final state
    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Not logged in');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
      expect(localStorage.getItem('user')).toBeNull();
    }, { timeout: 1000 });
  });
  
  test('4. Login Failure Scenario - Error Status Displayed Correctly', async () => {
    render(
      <TestAuthProvider mockLoginSuccess={false}>
        <TestComponent />
      </TestAuthProvider>
    );
    
    // Execute Login
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Verification Error Status
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username or password');
    }, { timeout: 1000 });
  });
});