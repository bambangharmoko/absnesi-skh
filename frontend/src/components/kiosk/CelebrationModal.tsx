import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles, Clock, Heart, Award } from 'lucide-react';
import { VerifyFrameResponse } from '../../services/api';

interface CelebrationModalProps {
  data: VerifyFrameResponse | null;
  onClose: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ data, onClose }) => {
  useEffect(() => {
    if (data && (data.attendance_status === 'RECORDED_SUCCESS' || data.status === 'MATCHED')) {
      // Trigger colorful celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });

      // Auto close after 3.2 seconds to serve next student in line
      const timer = setTimeout(() => {
        onClose();
      }, 3200);

      return () => clearTimeout(timer);
    }
  }, [data, onClose]);

  if (!data || !data.student) return null;

  const isSuccess = data.attendance_status === 'RECORDED_SUCCESS';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 md:p-8 text-white shadow-2xl border-2 border-emerald-500/40"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

          {/* Top Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold tracking-wide">
              <Sparkles className="w-4 h-4 animate-spin" />
              {isSuccess ? 'PRESENSI BERHASIL!' : 'SUDAH HADIR HARI INI'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{data.time || '07:15'}</span>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-5">
            {/* Student Photo */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-lg bg-slate-700 flex items-center justify-center">
                {data.student.photo_url ? (
                  <img
                    src={data.student.photo_url}
                    alt={data.student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-3xl font-extrabold text-white">
                    {data.student.nickname.charAt(0)}
                  </div>
                )}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-emerald-500 text-white shadow-md"
              >
                <CheckCircle2 className="w-5 h-5" />
              </motion.div>
            </div>

            {/* Student Details */}
            <div className="text-center sm:text-left flex-1">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
                Halo, {data.student.nickname}! 👋
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
                {data.student.name}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                  {data.student.class_name}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
                  NIS: {data.student.nis}
                </span>
              </div>
            </div>
          </div>

          {/* Friendly Greeting Message */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-emerald-950/40 border border-emerald-500/20 text-center">
            <p className="text-base sm:text-lg font-medium text-emerald-200">
              {data.message}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-400">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Tingkat Kecocokan Wajah: {Math.round(data.confidence * 100)}%</span>
            </div>
          </div>

          {/* Auto-Dismiss Countdown Bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Siap untuk siswa berikutnya...</span>
              <span className="font-semibold text-emerald-400">Otomatis kembali</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.2, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
