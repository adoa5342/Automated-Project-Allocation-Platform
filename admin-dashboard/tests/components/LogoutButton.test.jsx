import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogoutButton from '../../components/LogoutButton';
import * as authContext from '../../pages/authenticationContext';

describe('LogoutButton Component', () => {
  let mockLogout;

  beforeEach(() => {
    // Reset the logout method to a traceable mock function.
    mockLogout = jest.fn();
    jest.spyOn(authContext, 'useAuth').mockReturnValue({ logout: mockLogout });
  });

  afterEach(() => {
    // Clear all simulations to ensure they do not interfere with other tests.
    jest.restoreAllMocks();
  });

  test('renders logout button when authenticated', () => {
    const { getByText } = render(
      <MemoryRouter>
        <LogoutButton />
      </MemoryRouter>
    );
    const buttonElement = getByText(/logout/i);
    expect(buttonElement).toBeInTheDocument();
  });

  test('triggers logout when button is clicked', () => {
    const { getByText } = render(
      <MemoryRouter>
        <LogoutButton />
      </MemoryRouter>
    );

    const buttonElement = getByText(/logout/i);
    fireEvent.click(buttonElement);

    expect(mockLogout).toHaveBeenCalled(); // Verify whether logout has been called
  });
});