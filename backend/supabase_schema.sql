-- ==============================================================================
-- SKH Santo Fransiskus Asisi - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor: (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create USERS Table (Guru & Admin)
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) DEFAULT 'GURU_KELAS',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create STUDENTS Table (Data Siswa SKH)
CREATE TABLE IF NOT EXISTS public.students (
    id VARCHAR(36) PRIMARY KEY,
    nis VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create FACE_EMBEDDINGS Table (Vektor Fitur Wajah 128-dim Deep Learning SFace)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    embedding_vector TEXT NOT NULL,
    photo_path VARCHAR(255),
    pose_label VARCHAR(50) DEFAULT 'Lurus',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create ATTENDANCES Table (Log Presensi Harian)
CREATE TABLE IF NOT EXISTS public.attendances (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,            -- Format: YYYY-MM-DD
    time_in VARCHAR(8) NOT NULL,          -- Format: HH:MM:SS
    status VARCHAR(20) NOT NULL,          -- HADIR, TERLAMBAT, IZIN, SAKIT, ALPHA
    confidence_score FLOAT DEFAULT 0.0,
    verification_method VARCHAR(50) DEFAULT 'FACE_RECOGNITION', -- FACE_RECOGNITION / MANUAL_TEACHER
    captured_photo VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & RECOGNITION MATCHING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_nis ON public.students(nis);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_student_id ON public.face_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_student_date ON public.attendances(student_id, date);

-- ==============================================================================
-- (OPTIONAL) ROW LEVEL SECURITY (RLS) POLICIES
-- For API service backend integration, allow full access to public role:
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to face_embeddings" ON public.face_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendances" ON public.attendances FOR ALL USING (true) WITH CHECK (true);
