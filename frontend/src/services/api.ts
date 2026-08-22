export interface Student {
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

export interface AttendanceSummary {
  total_students: number;
  total_present: number;
  total_late: number;
  total_permission: number;
  total_sick: number;
  total_absent: number;
  attendance_rate: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VerifyFrameResponse {
  status: 'MATCHED' | 'UNKNOWN' | 'NO_FACE' | 'ALREADY_CHECKED_IN';
  student?: {
    id: string;
    nis: string;
    name: string;
    nickname: string;
    class_name: string;
    category: string;
    photo_url?: string | null;
  } | null;
  confidence: number;
  attendance_status?: 'RECORDED_SUCCESS' | 'ALREADY_RECORDED' | 'NONE';
  time?: string | null;
  message: string;
  bounding_box?: BoundingBox | null;
}

const API_BASE = '/api/v1';

export const api = {
  // Face Recognition Verification
  async verifyFrame(imageBase64: string, classId?: string): Promise<VerifyFrameResponse> {
    const res = await fetch(`${API_BASE}/recognition/verify-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        class_id: classId && classId !== 'all' ? classId : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`Frame verification error: ${res.statusText}`);
    }
    return res.json();
  },

  // Students CRUD & Multi-Pose Enrollment
  async getStudents(className?: string, search?: string): Promise<Student[]> {
    const params = new URLSearchParams();
    if (className && className !== 'all') params.append('class_name', className);
    if (search) params.append('search', search);
    
    const res = await fetch(`${API_BASE}/students?${params.toString()}`);
    if (!res.ok) throw new Error('Gagal mengambil data siswa');
    return res.json();
  },

  async enrollStudentFace(formData: FormData): Promise<{ status: string; message: string; student_id: string }> {
    const res = await fetch(`${API_BASE}/students/enroll-face`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Gagal mendaftarkan wajah siswa' }));
      throw new Error(err.detail || 'Gagal mendaftarkan wajah siswa');
    }
    return res.json();
  },

  async deleteStudent(studentId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/students/${studentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus siswa');
    return res.json();
  },

  // Attendance Endpoints
  async getTodayAttendance(className?: string, status?: string, dateStr?: string): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (className && className !== 'all') params.append('class_name', className);
    if (status && status !== 'all') params.append('status', status);
    if (dateStr) params.append('date_str', dateStr);

    const res = await fetch(`${API_BASE}/attendance/today?${params.toString()}`);
    if (!res.ok) throw new Error('Gagal mengambil presensi');
    return res.json();
  },

  async getAttendanceSummary(className?: string, dateStr?: string): Promise<AttendanceSummary> {
    const params = new URLSearchParams();
    if (className && className !== 'all') params.append('class_name', className);
    if (dateStr) params.append('date_str', dateStr);

    const res = await fetch(`${API_BASE}/attendance/summary?${params.toString()}`);
    if (!res.ok) throw new Error('Gagal mengambil ringkasan presensi');
    return res.json();
  },

  async manualOverride(data: { student_id: string; status: string; notes?: string; date?: string }): Promise<AttendanceRecord> {
    const res = await fetch(`${API_BASE}/attendance/manual-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal melakukan manual override');
    return res.json();
  },

  // Export Excel
  getExportExcelUrl(month?: number, year?: number, className?: string): string {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    if (className && className !== 'all') params.append('class_name', className);
    return `${API_BASE}/reports/export-excel?${params.toString()}`;
  }
};
