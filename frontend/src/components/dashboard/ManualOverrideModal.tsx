import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShieldAlert, UserCheck, AlertTriangle, ShieldCheck, UserX } from 'lucide-react';
import { api, Student } from '../../services/api';

interface ManualOverrideModalProps {
  student: Student | null;
  currentStatus?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  student,
  currentStatus = 'HADIR',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<string>(currentStatus || 'HADIR');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.manualOverride({
        student_id: student.id,
        status: status,
        notes: notes || `Presensi manual oleh guru: ${status}`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan status presensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'HADIR', label: 'Hadir', icon: <UserCheck className="w-4 h-4 text-emerald-400" />, desc: 'Siswa hadir di sekolah' },
    { value: 'TERLAMBAT', label: 'Terlambat', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, desc: 'Hadir setelah 07:30' },
    { value: 'IZIN', label: 'Izin', icon: <ShieldCheck className="w-4 h-4 text-blue-400" />, desc: 'Ada surat keterangan wali' },
    { value: 'SAKIT', label: 'Sakit', icon: <AlertTriangle className="w-4 h-4 text-rose-400" />, desc: 'Keterangan sakit / istirahat' },
    { value: 'ALPHA', label: 'Alpha', icon: <UserX className="w-4 h-4 text-slate-400" />, desc: 'Tanpa keterangan' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white">Manual Override Presensi</h3>
              <p className="text-xs text-slate-400">Validasi langsung oleh guru pendamping</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student Summary */}
          <div className="flex items-center gap-3 my-4 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-lg">
              {student.nickname.charAt(0)}
            </div>
            <div>
              <h4 className="font-bold text-slate-100">{student.full_name}</h4>
              <div className="text-xs text-slate-400">
                {student.class_name} • NIS: {student.nis}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Pilih Status Kehadiran:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {statusOptions.map(opt => (
                  <label
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      status === opt.value
                        ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200'
                        : 'bg-slate-850 bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {opt.icon}
                      <div>
                        <div className="text-sm font-bold">{opt.label}</div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                    </div>
                    {status === opt.value && <Check className="w-4 h-4 text-emerald-400" />}
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Catatan Guru Pendamping (Opsional):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Didampingi Ibu Maria, ada terapi wicara..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Presensi'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
