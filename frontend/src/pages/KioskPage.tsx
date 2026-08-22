import React, { useState, useEffect } from 'react';
import { CameraScanner } from '../components/kiosk/CameraScanner';
import { CelebrationModal } from '../components/kiosk/CelebrationModal';
import { VerifyFrameResponse, api, AttendanceSummary } from '../services/api';
import { Maximize2, Minimize2, Sparkles, Volume2, ShieldCheck, Heart } from 'lucide-react';

interface KioskPageProps {
  onGoToDashboard: () => void;
}

export const KioskPage: React.FC<KioskPageProps> = ({ onGoToDashboard }) => {
  const [celebrationData, setCelebrationData] = useState<VerifyFrameResponse | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const loadSummary = () => {
    api.getAttendanceSummary(selectedClass).then(setSummary).catch(() => {});
  };

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 8000);
    return () => clearInterval(interval);
  }, [selectedClass]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleVerified = (response: VerifyFrameResponse) => {
    setCelebrationData(response);
    loadSummary();
  };

  return (
    <div className="flex flex-col flex-1 h-full max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              KIOSK PRESENSI WAJAH
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Silakan berdiri dan tatap kamera • Sistem mengenali otomatis tanpa sentuh
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          >
            <option value="all">Semua Kelas SKH</option>
            <option value="Kelas 1 Autis">Kelas 1 Autis</option>
            <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
            <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
          </select>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
            title="Layar Penuh (Fullscreen Kiosk)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left: Camera Scanner HUD (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-[520px] sm:h-[600px]">
          <CameraScanner
            onVerified={handleVerified}
            selectedClass={selectedClass}
            isPaused={celebrationData !== null}
          />
        </div>

        {/* Right: Live Counter & Info Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Attendance Stats Widget */}
          <div className="rounded-3xl glass-panel p-5 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Ringkasan Hari Ini
            </h4>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30">
                <div className="text-2xl font-black text-emerald-400">
                  {summary ? summary.total_present : 0}
                </div>
                <div className="text-xs font-semibold text-emerald-200/80 mt-0.5">Hadir Tepat Waktu</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30">
                <div className="text-2xl font-black text-amber-400">
                  {summary ? summary.total_late : 0}
                </div>
                <div className="text-xs font-semibold text-amber-200/80 mt-0.5">Terlambat</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30">
                <div className="text-2xl font-black text-blue-400">
                  {summary ? summary.total_permission + summary.total_sick : 0}
                </div>
                <div className="text-xs font-semibold text-blue-200/80 mt-0.5">Izin / Sakit</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700">
                <div className="text-2xl font-black text-slate-300">
                  {summary ? summary.total_students : 0}
                </div>
                <div className="text-xs font-semibold text-slate-400 mt-0.5">Total Siswa</div>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="pt-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                <span>Persentase Kehadiran</span>
                <span className="text-emerald-400 font-bold">{summary?.attendance_rate || 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${summary?.attendance_rate || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Child-Friendly Guidance Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-5 border border-indigo-500/20 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Heart className="w-4 h-4 text-pink-400 animate-pulse" />
                <span>Petunjuk Ramah Anak</span>
              </div>
              <h5 className="text-base font-bold text-white mb-2">
                "Senyum Ceria & Tatap Kamera"
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Sistem akan memutar ucapan selamat pagi dengan nama siswa dan efek suara ramah saat wajah berhasil terverifikasi.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Dilengkapi Text-to-Speech Suara Bahasa Indonesia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Popup Modal */}
      <CelebrationModal
        data={celebrationData}
        onClose={() => setCelebrationData(null)}
      />
    </div>
  );
};
