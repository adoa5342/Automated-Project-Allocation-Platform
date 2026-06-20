import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '../../components/UsydAdminPanel';

describe('Card Component', () => {


  test('renders without optional className', () => {
    render(
      <Card>
        <CardHeader>Test Title</CardHeader>
        <CardContent>Test Content</CardContent>
      </Card>
    );
    
     // Indirectly position the Card component via its child elements
    const cardElement = screen.getByText('Test Title').closest('div');
    expect(cardElement).not.toHaveClass('test-card');
  });
})