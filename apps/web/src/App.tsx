import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
    </Routes>
  );
}
