import { Eyebrow } from './Eyebrow.js';

export function NextStepBlock({ text }: { text: string }) {
  return (
    <div
      style={{
        paddingLeft: 12,
        borderLeft: '2px solid var(--accent-500)',
        background: 'var(--accent-50)',
        padding: '12px 16px',
      }}
    >
      <div style={{ marginBottom: 4 }}><Eyebrow>Next step</Eyebrow></div>
      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>{text}</div>
    </div>
  );
}
