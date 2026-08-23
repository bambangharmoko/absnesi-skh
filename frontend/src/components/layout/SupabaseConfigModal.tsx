import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  X,
  Key,
  Globe,
  Cloud,
  Check,
} from 'lucide-react';
import {
  getSavedSupabaseUrl,
  getSavedSupabaseAnonKey,
  setSupabaseCredentials,
  isSupabaseConfigured,
} from '../../services/supabase';
import { db } from '../../services/db';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSyncSuccess,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSupabaseUrl(getSavedSupabaseUrl());
      setSupabaseAnonKey(getSavedSupabaseAnonKey());
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndSync = async () => {
    const cleanUrl = supabaseUrl.trim();
    const cleanKey = supabaseAnonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setStatusMessage({
        type: 'error',
        text: 'Harap masukkan URL Supabase dan Anon API Key dengan lengkap.',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({
      type: 'info',
      text: 'Menghubungkan ke Supabase Cloud & menyinkronkan data siswa...',
    });

    try {
      const isInitialized = setSupabaseCredentials(cleanUrl, cleanKey);
      if (!isInitialized) {
        throw new Error('Format kredensial Supabase tidak valid.');
      }

      // Sync data from & to Supabase
      const success = await db.syncFromSupabase();

      if (success) {
        const total = db.getStudents().length;
        setStatusMessage({
          type: 'success',
          text: `✅ Berhasil terhubung ke Supabase Cloud! ${total} data siswa kini tersinkronisasi di semua perangkat.`,
        });
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Gagal membaca tabel Supabase. Pastikan tabel (students, face_embeddings, attendances) sudah dibuat via SQL Editor di Supabase.',
        });
      }
    } catch (err: unknown) {
      console.error('Supabase connect error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi server Supabase.';
      setStatusMessage({
        type: 'error',
        text: `Koneksi gagal: ${msg}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sqlSchemaCode = `-- 1. Table: students
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nis VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'Umum',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: face_embeddings
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pose_label VARCHAR(50),
    photo_path TEXT,
    embedding_vector TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: attendances
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in VARCHAR(20),
    time_out VARCHAR(20),
    status VARCHAR(50) DEFAULT 'HADIR',
    confidence_score FLOAT DEFAULT 1.0,
    verification_method VARCHAR(50) DEFAULT 'FACE_RECOGNITION',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & Policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

CREATE POLICY "Allow public read face_embeddings" ON public.face_embeddings FOR SELECT USING (true);
CREATE POLICY "Allow public insert face_embeddings" ON public.face_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete face_embeddings" ON public.face_embeddings FOR DELETE USING (true);

CREATE POLICY "Allow public read attendances" ON public.attendances FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendances" ON public.attendances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update attendances" ON public.attendances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete attendances" ON public.attendances FOR DELETE USING (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>Pengaturan Supabase Cloud Sync</span>
              {isSupabaseConfigured() ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Terhubung
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Belum Terhubung
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Sinkronisasi data siswa & riwayat presensi di seluruh HP, laptop, dan tablet secara real-time
            </p>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 animate-fadeIn ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            ) : (
              <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin text-cyan-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Input Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Project URL</span>
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://lygoswawqplklqvnouao.supabase.co"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Anon Public API Key (Project API Key)</span>
            </label>
            <textarea
              rows={3}
              value={supabaseAnonKey}
              onChange={e => setSupabaseAnonKey(e.target.value)}
              placeholder="Masukkan Anon Public Key (eyJhbGciOi...)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition resize-none placeholder-slate-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Dapatkan di: <b>Supabase Dashboard ➔ Project Settings ➔ API ➔ Project API Keys (anon public)</b>
            </p>
          </div>
        </div>

        {/* SQL Schema Helper */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Belum membuat tabel di Supabase?</span>
            </span>
            <button
              onClick={handleCopySql}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Tersalin!' : 'Salin SQL Schema'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Salin SQL di atas, lalu tempel di menu <b>SQL Editor</b> di dashboard Supabase Anda dan klik <b>Run</b>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Buka Dashboard Supabase</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Tutup
            </button>

            <button
              onClick={handleSaveAndSync}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{isLoading ? 'Menghubungkan...' : 'Simpan & Sinkronkan Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
