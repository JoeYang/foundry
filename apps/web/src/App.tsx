import { Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div style={{ padding: 32 }}>foundry dashboard (Plan 3 scaffold)</div>} />
    </Routes>
  );
}
