import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveBadge } from '../../src/components/LiveBadge.js';

describe('LiveBadge', () => {
  it('renders nothing when live=false', () => {
    const { container } = render(<LiveBadge live={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders live label when live=true', () => {
    render(<LiveBadge live={true} />);
    expect(screen.getByTestId('live-badge')).toHaveTextContent('live');
  });
});
