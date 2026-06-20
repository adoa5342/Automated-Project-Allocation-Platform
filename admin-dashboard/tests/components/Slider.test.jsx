import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from '../../components/UsydAdminPanel';

describe('Slider Component', () => {
  const mockOnChange = jest.fn();
  
  test('renders slider with default value', () => {
    const { container } = render(
      <Slider value={[50]} onChange={mockOnChange} min={0} max={100} />
    );
    
    const sliderElement = container.querySelector('input[type="range"]');
    expect(sliderElement).toBeTruthy();
    expect(sliderElement.value).toBe('50');
  });
})