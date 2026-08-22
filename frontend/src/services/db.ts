import { supabase } from './supabase';
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
    photo_data: string;
    vector: number[];
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
  date: string;
  time_in: string;
  status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPHA';
  confidence_score: number;
  verification_method: string;
  captured_photo?: string | null;
  notes?: string | null;
  created_at: string;
}

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
  private studentsKey = 'skh_students_v2';
  private attendancesKey = 'skh_attendances_v2';

  constructor() {
    this.initDatabase();
    this.syncFromSupabase();
  }

  private initDatabase() {
    const existing = localStorage.getItem(this.studentsKey);
    if (!existing) {
      localStorage.setItem(this.studentsKey, JSON.stringify(INITIAL_STUDENTS));
    }
  }

  /**
   * Automatically fetch live students & embeddings from Supabase Cloud
   */
  async syncFromSupabase() {
    if (!supabase) return;
    try {
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('*, face_embeddings(*)');

      if (!sErr && studentsData && studentsData.length > 0) {
        const mapped: StudentRecord[] = studentsData.map(s => ({
          id: s.id,
          nis: s.nis,
          full_name: s.full_name,
          nickname: s.nickname,
          class_name: s.class_name,
          category: s.category,
          is_active: s.is_active,
          created_at: s.created_at,
          photo_count: s.face_embeddings ? s.face_embeddings.length : 0,
          latest_photo: s.face_embeddings && s.face_embeddings.length > 0 ? s.face_embeddings[0].photo_path : null,
          embeddings: (s.face_embeddings || []).map((e: { id: string; pose_label: string; photo_path: string; embedding_vector: string }) => {
            let vec: number[] = [];
            try {
              vec = JSON.parse(e.embedding_vector);
            } catch {}
            return {
              id: e.id,
              pose_label: e.pose_label,
              photo_data: e.photo_path || '',
              vector: vec,
            };
          }),
        }));
        localStorage.setItem(this.studentsKey, JSON.stringify(mapped));
        console.log(`[Database] Synced ${mapped.length} students from Supabase.`);
      }
    } catch (e) {
      console.warn('[Database] Sync notice:', e);
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

  async saveStudent(studentData: {
    nis: string;
    full_name: string;
    nickname: string;
    class_name: string;
    category: string;
    photos: Array<{ pose_label: string; photo_data: string; descriptor: Float32Array }>;
  }): Promise<StudentRecord> {
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

    // Async sync to Supabase Cloud if available
    if (supabase) {
      try {
        await supabase.from('students').upsert({
          id: newStudent.id,
          nis: newStudent.nis,
          full_name: newStudent.full_name,
          nickname: newStudent.nickname,
          class_name: newStudent.class_name,
          category: newStudent.category,
          is_active: true,
        });

        if (embeddings.length > 0) {
          const embPayload = embeddings.map(e => ({
            id: e.id,
            student_id: newStudent.id,
            embedding_vector: JSON.stringify(e.vector),
            pose_label: e.pose_label,
          }));
          await supabase.from('face_embeddings').insert(embPayload);
        }
      } catch (err) {
        console.warn('[Database] Supabase push notice:', err);
      }
    }

    return newStudent;
  }

  async deleteStudent(id: string): Promise<boolean> {
    const raw = localStorage.getItem(this.studentsKey);
    let list: StudentRecord[] = raw ? JSON.parse(raw) : [];
    list = list.filter(s => s.id !== id);
    localStorage.setItem(this.studentsKey, JSON.stringify(list));

    if (supabase) {
      try {
        await supabase.from('students').delete().eq('id', id);
      } catch (e) {
        console.warn('[Database] Supabase delete notice:', e);
      }
    }
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

  async recordAttendance(
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
  ): Promise<{ status: 'RECORDED_SUCCESS' | 'ALREADY_RECORDED'; message: string; record: AttendanceRecord }> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const allAttendances = this.getAttendances();
    const existing = allAttendances.find(a => a.student_id === student.id && a.date === todayStr);

    if (existing) {
      return {
        status: 'ALREADY_RECORDED',
        message: `Halo ${student.nickname}, presensi kamu sudah tercatat hari ini pada pukul ${existing.time_in}.`,
        record: existing,
      };
    }

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

    // Sync to Supabase
    if (supabase) {
      try {
        await supabase.from('attendances').insert({
          id: newRecord.id,
          student_id: newRecord.student_id,
          date: newRecord.date,
          time_in: newRecord.time_in,
          status: newRecord.status,
          confidence_score: newRecord.confidence_score,
          verification_method: newRecord.verification_method,
          notes: newRecord.notes,
        });
      } catch (err) {
        console.warn('[Database] Supabase attendance push notice:', err);
      }
    }

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
