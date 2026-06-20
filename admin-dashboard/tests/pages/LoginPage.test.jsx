import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../../pages/login';
import { useAuth } from '../../pages/authenticationContext';
import { useNavigate, useLocation } from 'react-router-dom';

// Simulation Dependency
jest.mock('../../pages/authenticationContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

describe('LoginPage Component', () => {
  const mockLogin = jest.fn();
  const mockNavigate = jest.fn();
  const mockLocation = {
    state: { from: { pathname: '/login' } }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configure default simulated return values
    useAuth.mockReturnValue({
      login: mockLogin
    });
    
    useNavigate.mockReturnValue(mockNavigate);
    useLocation.mockReturnValue(mockLocation);
  });

  // Utility function: Get input field
  const getInputs = () => {
    // Use document.querySelector to directly select input elements by type
    const usernameInput = document.querySelector('input[type="text"]');
    const passwordInput = document.querySelector('input[type="password"]');
    
    return { usernameInput, passwordInput };
  };

  test('renders all form elements correctly', () => {
    render(<LoginPage />);
    const { usernameInput, passwordInput } = getInputs();
    
    // Verify input field exists
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    
    // Verify button and other elements
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByText(/keep me signed in/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  test('handles loading state correctly', async () => {
    render(<LoginPage />);
    const { usernameInput, passwordInput } = getInputs();
    
    // Simulate user input
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Simulate the login process (asynchronously)
    const mockPromise = Promise.resolve({ success: true, role: 'student' });
    mockLogin.mockImplementation(() => mockPromise);
    
    // Submit Form
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    // Verify loading status
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
    });
    
    // Please wait while logging in.
    await mockPromise;
  });

  test('validates required fields on submit', async () => {
    render(<LoginPage />);
    
    // Submit an empty form
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    // Validation Error Message
    await waitFor(() => {
      const errorMessages = screen.getAllByText(/this field cannot be left blank/i);
      expect(errorMessages).toHaveLength(2); // Error messages for two fields
    });
    
    // The login verification was not invoked.
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('submits form with valid credentials and redirects appropriately', async () => {
    render(<LoginPage />);
    const { usernameInput, passwordInput } = getInputs();
    
    // Enter credentials
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Simulated login successful (student role)
    mockLogin.mockResolvedValueOnce({
      success: true,
      role: 'student',
      user: { role: 'student' }
    });
    
    // Submit Form
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    // Verify Login Calls and Navigation - Validate Actual Redirect Paths
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
      // Verify redirect to location.state.from.pathname
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  test('displays error message on login failure', async () => {
    render(<LoginPage />);
    const { usernameInput, passwordInput } = getInputs();
    const errorMessage = 'Invalid username or password';
    
    // Incorrect credentials entered
    fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    
    // Simulated login failed
    mockLogin.mockResolvedValueOnce({
      success: false,
      message: errorMessage
    });
    
    // Submit Form
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    // Verification error message displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
})