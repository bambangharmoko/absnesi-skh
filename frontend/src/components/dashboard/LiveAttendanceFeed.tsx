import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldCheck, UserCheck, AlertTriangle, UserX, Award } from 'lucide-react';
import { AttendanceRecord } from '../../services/api';

interface LiveAttendanceFeedProps {
  records: AttendanceRecord[];
}

export const LiveAttendanceFeed: React.FC<LiveAttendanceFeedProps> = ({ records }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HADIR':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: <UserCheck className="w-3.5 h-3.5" />,
          label: 'HADIR TEPAT WAKTU',
        };
      case 'TERLAMBAT':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'TERLAMBAT',
        };
      case 'IZIN':
        return {
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          label: 'IZIN',
        };
      case 'SAKIT':
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'SAKIT',
        };
      default:
        return {
          bg: 'bg-slate-700 text-slate-300 border-slate-600',
          icon: <UserX className="w-3.5 h-3.5" />,
          label: status,
        };
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl glass-panel p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-base font-bold text-white tracking-wide">Live Feed Presensi</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">Real-time Stream</span>
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <Clock className="w-8 h-8 mb-2 opacity-50 text-slate-500" />
          <p className="text-sm">Belum ada aktivitas presensi masuk hari ini.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 max-h-[460px]">
          {records.slice(0, 10).map((item, idx) => {
            const badge = getStatusBadge(item.status);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <span className="font-bold text-emerald-400 text-base">
                      {item.student_nickname?.charAt(0) || item.student_name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-slate-100">{item.student_name}</h5>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">{item.class_name}</span>
                      {item.time_in && (
                        <>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[11px] text-emerald-400 font-medium">
                            Masuk: {item.time_in}
                          </span>
                        </>
                      )}
                      {item.time_out && (
                        <>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[11px] text-amber-400 font-medium">
                            Pulang: {item.time_out}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  {item.verification_method === 'FACE_RECOGNITION' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <Award className="w-3 h-3 text-amber-400" />
                      Face AI: {Math.round(item.confidence_score * 100)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-blue-400 font-medium">Oleh Guru</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
