-- =========================================================================
-- SKH SANTO FRANSISKUS ASISI - SUPABASE DATABASE SCHEMA
-- Jalankan query SQL ini di Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- 1. Table: students (Data Master Siswa)
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

-- 2. Table: face_embeddings (Vektor Fitur Wajah 128-Dimensi & Foto)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pose_label VARCHAR(50),
    photo_path TEXT,
    embedding_vector TEXT NOT NULL, -- JSON Stringified Array of 128-d Float
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: attendances (Catatan Presensi Masuk & Pulang)
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in VARCHAR(20),
    time_out VARCHAR(20),
    status VARCHAR(50) DEFAULT 'HADIR', -- HADIR, TERLAMBAT, PULANG, IZIN, SAKIT
    confidence_score FLOAT DEFAULT 1.0,
    verification_method VARCHAR(50) DEFAULT 'FACE_RECOGNITION',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for Lightning Fast Face Matching & Dashboard Queries
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_student ON public.face_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_student_date ON public.attendances(student_id, date);

-- Enable Row Level Security (RLS) with Public Access for Kiosk Application
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Allow Public Read/Write for Kiosk & Web App
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
CREATE POLICY "Allow public delete attendances" ON public.attendances FOR DELETE USING (true);
