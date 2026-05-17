import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/p/:slug" element={<ProjectDetailPage />} />
      <Route path="/p/:slug/:tab" element={<ProjectDetailPage />} />
    </Routes>
  );
}
