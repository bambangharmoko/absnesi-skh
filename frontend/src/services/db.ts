import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

export interface StudentRecord {
  id: string;
  nis: string;
  full_name: string;
  nickname: string;
  class_name: string;
  category: string;
  is_active: boolean;
  created_at: string;
  photo_count?: number;
  latest_photo?: string | null;
  embeddings: Array<{
    id: string;
    pose_label: string;
    photo_data: string; // Base64 data URL
    vector: number[]; // 128-d float array
  }>;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_nickname: string;
  student_nis: string;
  class_name: string;
  category: string;
  date: string; // YYYY-MM-DD
  time_in: string; // HH:MM:SS
  status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPHA';
  confidence_score: number;
  verification_method: string;
  captured_photo?: string | null;
  notes?: string | null;
  created_at: string;
}

// Initial Demo Seed Data
const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: '5d9baac8-87c7-485e-95ba-35f1f0a14f49',
    nis: 'SKH-20260822',
    full_name: 'Jonathan',
    nickname: 'Jo',
    class_name: 'Kelas 1 Autis',
    category: 'Autism Spectrum',
    is_active: true,
    created_at: new Date().toISOString(),
    photo_count: 5,
    latest_photo: null,
    embeddings: [],
  },
  {
    id: '202dbba5-218a-49b6-9eb2-277d16407508',
    nis: 'SKH-2026-TEST-999',
    full_name: 'Ahmad Fauzi',
    nickname: 'Fauzi',
    class_name: 'Kelas 1 Autis',
    category: 'Autism Spectrum',
    is_active: true,
    created_at: new Date().toISOString(),
    photo_count: 5,
    latest_photo: null,
    embeddings: [],
  },
  {
    id: '15417f9c-5d8f-4166-9bbd-4bb00d5a900a',
    nis: 'SKH-TEST-001',
    full_name: 'Test Student',
    nickname: 'Test',
    class_name: 'Kelas 2 Tuna Rungu',
    category: 'Tuna Rungu',
    is_active: true,
    created_at: new Date().toISOString(),
    photo_count: 5,
    latest_photo: null,
    embeddings: [],
  }
];

class DatabaseService {
  private studentsKey = 'skh_students_v1';
  private attendancesKey = 'skh_attendances_v1';
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.initDatabase();
    this.initSupabase();
  }

  private initDatabase() {
    const existing = localStorage.getItem(this.studentsKey);
    if (!existing) {
      localStorage.setItem(this.studentsKey, JSON.stringify(INITIAL_STUDENTS));
    }
  }

  private initSupabase() {
    const supabaseUrl = 'https://lygoswawqplklqvnouao.supabase.co';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[Database] Supabase Client initialized.');
      } catch (e) {
        console.warn('[Database] Supabase init notice:', e);
      }
    }
  }

  // ==========================================
  // STUDENTS API
  // ==========================================

  getStudents(className?: string, search?: string): StudentRecord[] {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];

    if (className && className !== 'ALL' && className !== 'all') {
      list = list.filter(s => s.class_name.toLowerCase() === className.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        s =>
          s.full_name.toLowerCase().includes(q) ||
          s.nickname.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q)
      );
    }

    return list.map(s => ({
      ...s,
      photo_count: s.embeddings ? s.embeddings.length : 0,
      latest_photo: s.embeddings && s.embeddings.length > 0 ? s.embeddings[0].photo_data : null,
    }));
  }

  getStudentById(id: string): StudentRecord | null {
    const list = this.getStudents();
    return list.find(s => s.id === id) || null;
  }

  saveStudent(studentData: {
    nis: string;
    full_name: string;
    nickname: string;
    class_name: string;
    category: string;
    photos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }>;
  }): StudentRecord {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];

    const existingIndex = list.findIndex(s => s.nis.trim() === studentData.nis.trim());
    const id = existingIndex >= 0 ? list[existingIndex].id : crypto.randomUUID();

    const embeddings = studentData.photos.map((p, idx) => ({
      id: crypto.randomUUID(),
      pose_label: p.pose_label || `Pose ${idx + 1}`,
      photo_data: p.photo_data,
      vector: Array.from(p.descriptor),
    }));

    const newStudent: StudentRecord = {
      id,
      nis: studentData.nis.trim(),
      full_name: studentData.full_name.trim(),
      nickname: studentData.nickname.trim(),
      class_name: studentData.class_name,
      category: studentData.category.trim() || 'Umum',
      is_active: true,
      created_at: existingIndex >= 0 ? list[existingIndex].created_at : new Date().toISOString(),
      photo_count: embeddings.length,
      latest_photo: embeddings.length > 0 ? embeddings[0].photo_data : null,
      embeddings,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newStudent;
    } else {
      list.unshift(newStudent);
    }

    localStorage.setItem(this.studentsKey, JSON.stringify(list));
    return newStudent;
  }

  deleteStudent(id: string): boolean {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];
    list = list.filter(s => s.id !== id);
    localStorage.setItem(this.studentsKey, JSON.stringify(list));
    return true;
  }

  // ==========================================
  // ATTENDANCES API
  // ==========================================

  getAttendances(date?: string, className?: string, status?: string): AttendanceRecord[] {
    const raw = localStorage.getItem(this.attendancesKey);
    let list: AttendanceRecord[] = raw ? JSON.parse(raw) : [];

    if (date) {
      list = list.filter(a => a.date === date);
    }

    if (className && className !== 'ALL' && className !== 'all') {
      list = list.filter(a => a.class_name.toLowerCase() === className.toLowerCase());
    }

    if (status && status !== 'ALL' && status !== 'all') {
      list = list.filter(a => a.status.toUpperCase() === status.toUpperCase());
    }

    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  recordAttendance(
    student: {
      id: string;
      nis: string;
      full_name: string;
      nickname: string;
      class_name: string;
      category: string;
    },
    confidence: number,
    capturedPhoto?: string | null
  ): { status: 'RECORDED_SUCCESS' | 'ALREADY_RECORDED'; message: string; record: AttendanceRecord } {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const allAttendances = this.getAttendances();
    const existing = allAttendances.find(a => a.student_id === student.id && a.date === todayStr);

    if (existing) {
      return {
        status: 'ALREADY_RECORDED',
        message: `Halo ${student.nickname}, presensi kamu sudah tercatat hari ini pada pukul ${existing.time_in}.`,
        record: existing,
      };
    }

    // Determine status (Hadir vs Terlambat: threshold 07:30)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 7 || (hours === 7 && minutes > 30);
    const attendanceStatus: 'HADIR' | 'TERLAMBAT' = isLate ? 'TERLAMBAT' : 'HADIR';

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      student_id: student.id,
      student_name: student.full_name,
      student_nickname: student.nickname,
      student_nis: student.nis,
      class_name: student.class_name,
      category: student.category,
      date: todayStr,
      time_in: timeStr,
      status: attendanceStatus,
      confidence_score: confidence,
      verification_method: 'FACE_RECOGNITION',
      captured_photo: capturedPhoto || null,
      notes: isLate ? 'Datang terlambat' : 'Tepat waktu',
      created_at: now.toISOString(),
    };

    allAttendances.unshift(newRecord);
    localStorage.setItem(this.attendancesKey, JSON.stringify(allAttendances));

    return {
      status: 'RECORDED_SUCCESS',
      message: `Presensi berhasil! Selamat datang di sekolah, ${student.nickname}.`,
      record: newRecord,
    };
  }

  getStats(date?: string) {
    const todayStr = date || new Date().toISOString().split('T')[0];
    const students = this.getStudents();
    const attendances = this.getAttendances(todayStr);

    const totalStudents = students.length;
    const hadir = attendances.filter(a => a.status === 'HADIR').length;
    const terlambat = attendances.filter(a => a.status === 'TERLAMBAT').length;
    const totalPresent = hadir + terlambat;
    const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    return {
      total_students: totalStudents,
      present_count: totalPresent,
      ontime_count: hadir,
      late_count: terlambat,
      attendance_rate: attendanceRate,
      date: todayStr,
    };
  }

  // ==========================================
  // EXCEL EXPORT
  // ==========================================

  exportExcel(date?: string, className?: string): void {
    const list = this.getAttendances(date, className);
    const rows = list.map((a, idx) => ({
      No: idx + 1,
      Tanggal: a.date,
      Waktu: a.time_in,
      NIS: a.student_nis,
      'Nama Siswa': a.student_name,
      Panggilan: a.student_nickname,
      Kelas: a.class_name,
      Kategori: a.category,
      Status: a.status,
      'Metode Verifikasi': a.verification_method,
      Confidence: `${Math.round(a.confidence_score * 100)}%`,
      Catatan: a.notes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Presensi SKH');

    const filename = `Laporan_Absensi_SKH_${date || 'Semua'}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }
}

export const db = new DatabaseService();
