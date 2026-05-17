import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DecayBadge } from '../../src/components/DecayBadge.js';

describe('DecayBadge', () => {
  it('renders nothing when decay=fresh', () => {
    const { container } = render(<DecayBadge decay="fresh" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders stale badge when decay=stale', () => {
    render(<DecayBadge decay="stale" />);
    expect(screen.getByTestId('decay-badge-stale')).toHaveTextContent('stale');
  });
  it('renders fossil badge when decay=fossil', () => {
    render(<DecayBadge decay="fossil" />);
    expect(screen.getByTestId('decay-badge-fossil')).toHaveTextContent('fossil');
  });
});
