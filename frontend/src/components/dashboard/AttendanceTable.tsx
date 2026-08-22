import React, { useState } from 'react';
import { Search, UserCheck, AlertTriangle, ShieldCheck, UserX, Edit3, User } from 'lucide-react';
import { AttendanceRecord, Student } from '../../services/api';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  allStudents: Student[];
  onOpenOverride: (studentId: string, currentStatus?: string) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  records,
  allStudents,
  onOpenOverride,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Combine student list with today's attendance to show all students (including absent/not yet checked in)
  const combinedList = allStudents.map(student => {
    const att = records.find(r => r.student_id === student.id);
    return {
      student,
      attendance: att || null,
      status: att ? att.status : 'BELUM_HADIR',
    };
  });

  const filtered = combinedList.filter(item => {
    const matchSearch =
      item.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.class_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'BELUM_HADIR' && !item.attendance) ||
      (item.attendance && item.attendance.status === statusFilter);

    return matchSearch && matchStatus;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'HADIR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <UserCheck className="w-3.5 h-3.5" />
            HADIR
          </span>
        );
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            TERLAMBAT
          </span>
        );
      case 'IZIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            IZIN
          </span>
        );
      case 'SAKIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            SAKIT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <UserX className="w-3.5 h-3.5" />
            Belum Hadir
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col rounded-2xl glass-panel p-5 overflow-hidden">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari siswa / NIS..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'BELUM_HADIR'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st === 'all' ? 'Semua Status' : st === 'BELUM_HADIR' ? 'Belum Hadir' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Siswa</th>
              <th className="py-3 px-4">Kelas & Spesifikasi</th>
              <th className="py-3 px-4">Jam Masuk</th>
              <th className="py-3 px-4">Jam Pulang</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Metode Presensi</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Tidak ada data siswa yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filtered.map(({ student, attendance, status }) => (
                <tr key={student.id} className="hover:bg-slate-900/40 transition">
                  {/* Student */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400">
                        {student.nickname.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-100">{student.full_name}</div>
                        <div className="text-xs text-slate-400">NIS: {student.nis}</div>
                      </div>
                    </div>
                  </td>

                  {/* Class & Needs */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-300">{student.class_name}</div>
                    <div className="text-xs text-slate-400">{student.category}</div>
                  </td>

                  {/* Time In */}
                  <td className="py-3.5 px-4">
                    {attendance && attendance.time_in ? (
                      <span className="font-semibold text-emerald-300">{attendance.time_in}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  {/* Time Out */}
                  <td className="py-3.5 px-4">
                    {attendance && attendance.time_out ? (
                      <span className="font-semibold text-amber-300">{attendance.time_out}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">{renderStatusBadge(status)}</td>


                  {/* Method */}
                  <td className="py-3.5 px-4">
                    {attendance ? (
                      <div>
                        <span className="text-xs font-semibold text-slate-300">
                          {attendance.verification_method === 'FACE_RECOGNITION'
                            ? 'Face AI Scanner'
                            : 'Manual Guru'}
                        </span>
                        {attendance.notes && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">
                            {attendance.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Belum tercatat</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onOpenOverride(student.id, attendance?.status)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 inline-flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ubah Status</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
