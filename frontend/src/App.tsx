import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { KioskPage } from './pages/KioskPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { RegisterStudentPage } from './pages/RegisterStudentPage';
import { ReportsPage } from './pages/ReportsPage';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'kiosk' | 'dashboard' | 'students' | 'register' | 'reports'>('kiosk');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={page => setCurrentPage(page)}
      />

      {/* Page Content */}
      <main className="flex-1 flex flex-col">
        {currentPage === 'kiosk' && (
          <KioskPage onGoToDashboard={() => setCurrentPage('dashboard')} />
        )}
        {currentPage === 'dashboard' && (
          <DashboardPage onNavigate={page => setCurrentPage(page)} />
        )}
        {currentPage === 'students' && (
          <StudentsPage onNavigate={page => setCurrentPage(page)} />
        )}
        {currentPage === 'register' && (
          <RegisterStudentPage
            onSuccess={() => setCurrentPage('students')}
            onCancel={() => setCurrentPage('students')}
          />
        )}
        {currentPage === 'reports' && (
          <ReportsPage />
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          © 2026 Sistem Presensi Siswa Face Recognition • SKH Santo Fransiskus Asisi
        </p>
      </footer>
    </div>
  );
};

export default App;
