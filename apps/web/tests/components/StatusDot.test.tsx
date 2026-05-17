import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusDot } from '../../src/components/StatusDot.js';

describe('StatusDot', () => {
  it('has accessible aria-label for active status', () => {
    render(<StatusDot status="active" />);
    expect(screen.getByLabelText('status: active')).toBeInTheDocument();
  });
  it('has accessible aria-label for paused status', () => {
    render(<StatusDot status="paused" />);
    expect(screen.getByLabelText('status: paused')).toBeInTheDocument();
  });
  it('has accessible aria-label for blocked status', () => {
    render(<StatusDot status="blocked" />);
    expect(screen.getByLabelText('status: blocked')).toBeInTheDocument();
  });
  it('has accessible aria-label for done status', () => {
    render(<StatusDot status="done" />);
    expect(screen.getByLabelText('status: done')).toBeInTheDocument();
  });
});
