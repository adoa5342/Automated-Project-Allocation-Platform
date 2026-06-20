import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import StudentField from '../../components/StudentField';

const mockRegister = jest.fn((name) => ({
  onChange: jest.fn(),
  name,
}));

describe('StudentField Component', () => {
  beforeEach(() => {
    mockRegister.mockClear();
  });

  test('renders student fields with initial values', () => {
    const { container } = render(
      <StudentField
        index={1}
        onRemove={jest.fn()}
        studentError={{}}
        student={`student-1`}
        register={mockRegister}
      />
    );

    const nameInput = container.querySelector(`input[name="student-1.fullName"]`);
    expect(nameInput).toBeTruthy();
  });

  test('triggers onChange when field values change', () => {
    const onChangeMock = jest.fn();
    mockRegister.mockImplementation((name) => ({
      onChange: onChangeMock,
      name,
    }));

    const { container } = render(
      <StudentField
        index={1}
        onRemove={jest.fn()}
        studentError={{}}
        student={`student-1`}
        register={mockRegister}
      />
    );

    const nameInput = container.querySelector(`input[name="student-1.fullName"]`);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    expect(onChangeMock).toHaveBeenCalled();  // Verify whether the mocked onChange method was called.
  });

});