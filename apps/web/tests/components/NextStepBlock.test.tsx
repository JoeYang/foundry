import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NextStepBlock } from '../../src/components/NextStepBlock.js';

describe('NextStepBlock', () => {
  it('renders the text provided', () => {
    render(<NextStepBlock text="Finish the integration tests" />);
    expect(screen.getByText('Finish the integration tests')).toBeInTheDocument();
  });
  it('renders "Next step" eyebrow label', () => {
    render(<NextStepBlock text="Some next step" />);
    expect(screen.getByText('Next step')).toBeInTheDocument();
  });
});
