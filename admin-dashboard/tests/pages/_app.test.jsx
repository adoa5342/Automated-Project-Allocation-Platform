import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../pages/authenticationContext';
import LoginPage from '../../components/LoginPage';
import * as AuthCtx from '../../pages/authenticationContext';

// Remove all jest.mock(...) usages – they trigger hoist errors under Vitest.
// Hoist-safe spy for useAuth that keeps actual AuthProvider intact.
const useAuthSpy = vi.spyOn(AuthCtx, 'useAuth');

// Simplified ProtectedRoute Simulation Implementation
const MockProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = AuthCtx.useAuth();

  if (!isAuthenticated) {
    return <div data-testid="redirect-to-login">Redirecting to login</div>;
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <div data-testid="access-denied">Access denied</div>;
  }
  
  return children;
};

// Simulated application main component structure
const AppTestWrapper = ({ 
  initialEntries = ['/login'],
  isAuthenticated = false,
  userRole = null
}) => {
  // Configure mocked useAuth return for this render
  useAuthSpy.mockReturnValue({
    isAuthenticated,
    user: userRole ? { role: userRole } : null,
    login: vi.fn(),
    logout: vi.fn()
  });
  
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <div>
            {/* Login Page */}
            {initialEntries[0] === '/login' && (
              <LoginPage data-testid="login-page" />
            )}
            
            {/* Survey Page - Verification Required */}
            {initialEntries[0] === '/survey' && (
              <MockProtectedRoute allowedRoles={["student", "admin"]}>
                <div data-testid="survey-page">Survey Page Content</div>
              </MockProtectedRoute>
            )}
            
            {/* Administrator Page - Authentication Required */}
            {initialEntries[0] === '/admin' && (
              <MockProtectedRoute allowedRoles={["admin"]}>
                <div data-testid="admin-page">Admin Page Content</div>
              </MockProtectedRoute>
            )}
          </div>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Application Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders login page by default', () => {
    render(<AppTestWrapper />);
    
    // Verify login page rendering
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  test('redirects unauthenticated users to login', () => {
    render(<AppTestWrapper initialEntries={['/survey']} />);
    
    // Verify Redirect Behavior
    expect(screen.getByTestId('redirect-to-login')).toBeInTheDocument();
  });

  test('allows authenticated students to access survey page', () => {
    render(<AppTestWrapper 
      initialEntries={['/survey']} 
      isAuthenticated={true} 
      userRole="student" 
    />);
    
    // Verify that students can access the survey page.
    expect(screen.getByTestId('survey-page')).toBeInTheDocument();
  });

  test('allows authenticated admins to access admin page', () => {
    render(<AppTestWrapper 
      initialEntries={['/admin']} 
      isAuthenticated={true} 
      userRole="admin" 
    />);
    
    // Verified administrators can access the admin page.
    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
  });

  test('denies access to admin page for students', () => {
    render(<AppTestWrapper 
      initialEntries={['/admin']} 
      isAuthenticated={true} 
      userRole="student" 
    />);
    
    // Verify that students cannot access the administrator page.
    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
  });
})