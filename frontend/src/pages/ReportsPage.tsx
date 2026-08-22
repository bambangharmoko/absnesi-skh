import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Filter, Calendar, Printer, CheckCircle2, Users, FileText } from 'lucide-react';
import { api, AttendanceSummary } from '../services/api';

export const ReportsPage: React.FC = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    api.getAttendanceSummary(selectedClass).then(setSummary).catch(() => {});
  }, [selectedClass]);

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const handleDownloadExcel = () => {
    const url = api.getExportExcelUrl(selectedMonth, selectedYear, selectedClass);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Laporan & Rekapitulasi Presensi
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Unduh berkas Excel resmi rekap presensi bulanan SKH Santo Fransiskus Asisi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Cetak PDF</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="rounded-3xl glass-panel p-6 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Bulan:
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Tahun:
          </label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            Kelas Siswa:
          </label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Kelas</option>
            <option value="Kelas 1 Autis">Kelas 1 Autis</option>
            <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
            <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
          </select>
        </div>
      </div>

      {/* Export Preview Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Format Rekapitulasi Presensi SKH (.xlsx)
              </h3>
              <p className="text-xs text-slate-400">
                Laporan mencakup matriks kehadiran harian (H, T, I, S, A) dan persentase kehadiran per siswa
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadExcel}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel Sekarang</span>
          </button>
        </div>

        {/* Features Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Matriks Hari 1 - 31</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Pewarnaan otomatis (Hijau Hadir, Kuning Terlambat, Biru Izin, Merah Sakit)
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Format Resmi SKH</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Kop laporan sekolah, nama siswa, NIS, dan kategori kebutuhan khusus
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Perhitungan Otomatis</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Kalkulasi total hadir dan persentase kehadiran masing-masing siswa
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
