import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Sparkles,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  User,
  Search,
  X,
  Check,
  ChevronRight,
  HelpCircle,
  ThumbsUp,
  RotateCcw,
} from 'lucide-react';
import { api, VerifyFrameResponse, Student } from '../../services/api';
import { db } from '../../services/db';
import { audioFeedback } from './AudioFeedback';

interface CameraScannerProps {
  onVerified: (response: VerifyFrameResponse) => void;
  selectedClass?: string;
  isPaused?: boolean;
}

interface PendingMatch {
  student: {
    id: string;
    nis: string;
    name: string;
    nickname: string;
    class_name: string;
    category: string;
    photo_url?: string | null;
  };
  confidence: number;
  snapshot: string;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onVerified,
  selectedClass,
  isPaused = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hudStatus, setHudStatus] = useState<'SEARCHING' | 'MATCHED' | 'UNKNOWN'>('SEARCHING');
  const [hudLabel, setHudLabel] = useState<string>('Mencari wajah siswa di depan kamera...');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);

  // Verification Step: Student Detected Confirmation State
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState<boolean>(false);

  // Manual Attendance Modal States
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState<string>('');
  const [selectedManualStudent, setSelectedManualStudent] = useState<Student | null>(null);
  const [isVerifyingManual, setIsVerifyingManual] = useState<boolean>(false);
  const [manualAiMessage, setManualAiMessage] = useState<string | null>(null);

  // Load enrolled students list
  const loadStudents = useCallback(() => {
    api.getStudents().then(setEnrolledStudents).catch(() => {});
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Stop Camera & Force Release Hardware Device
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {}
        });
        videoRef.current.srcObject = null;
      }
      try {
        videoRef.current.pause();
      } catch (e) {}
    }
    setIsStreaming(false);
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log('Video play promise:', playErr);
        }
        setIsStreaming(true);
        setCameraError(null);
      }
    } catch (err: unknown) {
      console.warn('Webcam access error:', err);
      setCameraError('Kamera tidak terdeteksi atau izin belum diberikan di peramban.');
      setIsStreaming(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      } else {
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Render HUD Overlay Canvas
  const drawHud = useCallback(
    (
      bbox: { x: number; y: number; w: number; h: number } | null,
      status: 'SEARCHING' | 'MATCHED' | 'UNKNOWN',
      name?: string
    ) => {
      const canvas = hudCanvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const vWidth = video.videoWidth || video.clientWidth || 640;
      const vHeight = video.videoHeight || video.clientHeight || 480;

      if (canvas.width !== vWidth || canvas.height !== vHeight) {
        canvas.width = vWidth;
        canvas.height = vHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!bbox) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const size = Math.min(canvas.width, canvas.height) * 0.45;

        ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      let strokeColor = '#eab308';
      let bgColor = 'rgba(234, 179, 8, 0.2)';

      if (status === 'MATCHED') {
        strokeColor = '#22c55e';
        bgColor = 'rgba(34, 197, 94, 0.25)';
      } else if (status === 'UNKNOWN') {
        strokeColor = '#ef4444';
        bgColor = 'rgba(239, 68, 68, 0.2)';
      }

      const { x, y, w, h } = bbox;
      const cornerLen = Math.min(w, h) * 0.25;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, w, h);

      // Corners
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      if (name) {
        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, Math.max(0, y - 34), w, 34);

        ctx.save();
        ctx.translate(x + w / 2, Math.max(24, y - 10));
        ctx.scale(-1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, 0, 0);
        ctx.restore();
      }
    },
    []
  );

  // Continuous Frame Detection Loop
  useEffect(() => {
    if (isPaused || showManualModal || pendingMatch !== null) return;

    const interval = setInterval(async () => {
      if (isProcessing || isPaused || showManualModal || pendingMatch !== null) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

      setIsProcessing(true);

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.85);

        const res = await api.verifyFrame(base64Image, selectedClass);

        if (res.status === 'MATCHED' && res.student) {
          setHudStatus('MATCHED');
          setHudLabel(`Wajah Cocok: ${res.student.name} (${Math.round(res.confidence * 100)}%)`);
          drawHud(res.bounding_box || null, 'MATCHED', res.student.name);

          // Prompt Verification First (do not save attendance immediately)
          setPendingMatch({
            student: res.student,
            confidence: res.confidence,
            snapshot: base64Image,
          });
        } else if (res.status === 'UNKNOWN') {
          setHudStatus('UNKNOWN');
          setHudLabel('Wajah terdeteksi (Tidak Dikenali)');
          drawHud(res.bounding_box || null, 'UNKNOWN', 'Tidak Dikenali');
        } else {
          setHudStatus('SEARCHING');
          setHudLabel('Mencari wajah siswa di depan kamera...');
          drawHud(null, 'SEARCHING');
        }
      } catch (err) {
        console.warn('Frame verification error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isPaused, isProcessing, selectedClass, drawHud, showManualModal, pendingMatch]);

  // ==========================================
  // CONFIRM ATTENDANCE BUTTON HANDLER
  // ==========================================

  const handleConfirmAttendance = async () => {
    if (!pendingMatch) return;
    setIsSubmittingAttendance(true);

    try {
      const student = pendingMatch.student;
      const attResult = await db.recordAttendance(
        {
          id: student.id,
          nis: student.nis,
          full_name: student.name,
          nickname: student.nickname,
          class_name: student.class_name,
          category: student.category,
        },
        pendingMatch.confidence,
        pendingMatch.snapshot
      );

      const responseObj: VerifyFrameResponse = {
        status: 'MATCHED',
        student: pendingMatch.student,
        confidence: pendingMatch.confidence,
        attendance_status: attResult.status,
        time: attResult.record.time_in,
        message: attResult.message,
        bounding_box: null,
      };

      audioFeedback.playCelebrationChime();
      audioFeedback.speakText(responseObj.message);
      onVerified(responseObj);

      setPendingMatch(null);
    } catch (err) {
      console.warn('Confirm attendance error:', err);
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleCancelPendingMatch = () => {
    setPendingMatch(null);
    setHudStatus('SEARCHING');
    setHudLabel('Mencari wajah siswa di depan kamera...');
    drawHud(null, 'SEARCHING');
  };

  // ==========================================
  // MANUAL ATTENDANCE & PHOTO VERIFICATION
  // ==========================================

  const handleOpenManualAttendance = async () => {
    loadStudents();
    setSelectedManualStudent(null);
    setManualAiMessage(null);
    setPendingMatch(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    let snapshotUrl: string | null = null;

    if (video && canvas && isStreaming && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
      }
    }

    setCapturedSnapshot(snapshotUrl);
    setShowManualModal(true);

    if (snapshotUrl) {
      setIsVerifyingManual(true);
      setManualAiMessage('Memindai wajah dari foto snapshot...');
      try {
        const res = await api.verifyFrame(snapshotUrl, selectedClass);
        if (res.status === 'MATCHED' && res.student) {
          const matched = enrolledStudents.find(s => s.id === res.student?.id);
          if (matched) {
            setSelectedManualStudent(matched);
            setManualAiMessage(`AI Mengenali Wajah: ${matched.full_name} (${Math.round(res.confidence * 100)}%)`);
          }
        } else {
          setManualAiMessage('Wajah tidak dikenali otomatis. Silakan pilih nama siswa dari daftar di bawah.');
        }
      } catch (e) {
        setManualAiMessage('Pilih nama siswa untuk konfirmasi presensi manual.');
      } finally {
        setIsVerifyingManual(false);
      }
    }
  };

  const handleConfirmManualAttendance = async () => {
    if (!selectedManualStudent) return;

    try {
      setIsVerifyingManual(true);
      const res = await api.manualOverride({
        student_id: selectedManualStudent.id,
        status: 'HADIR',
        notes: 'Presensi via Foto & Konfirmasi Manual',
      });

      const responseObj: VerifyFrameResponse = {
        status: 'MATCHED',
        student: {
          id: selectedManualStudent.id,
          nis: selectedManualStudent.nis,
          name: selectedManualStudent.full_name,
          nickname: selectedManualStudent.nickname,
          class_name: selectedManualStudent.class_name,
          category: selectedManualStudent.category,
          photo_url: selectedManualStudent.latest_photo || null,
        },
        confidence: 1.0,
        attendance_status: 'RECORDED_SUCCESS',
        time: res.time_in,
        message: `Presensi manual berhasil! Selamat datang, ${selectedManualStudent.nickname}.`,
        bounding_box: null,
      };

      audioFeedback.playCelebrationChime();
      audioFeedback.speakText(responseObj.message);
      onVerified(responseObj);

      setShowManualModal(false);
    } catch (err) {
      console.warn('Manual attendance error:', err);
    } finally {
      setIsVerifyingManual(false);
    }
  };

  const filteredStudents = enrolledStudents.filter(s => {
    if (selectedClass && selectedClass !== 'all' && selectedClass !== 'ALL') {
      if (s.class_name.toLowerCase() !== selectedClass.toLowerCase()) return false;
    }
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.nickname.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
      {/* Video Stream Container */}
      <div className="relative w-full h-full min-h-[460px] md:min-h-[560px] flex items-center justify-center overflow-hidden bg-slate-900">
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={() => setIsStreaming(true)}
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
            setIsStreaming(true);
          }}
          className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
            isStreaming ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Dynamic HUD Canvas Overlay */}
        <canvas
          ref={hudCanvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1] z-10"
        />

        {/* Laser Scan Line */}
        {isStreaming && !pendingMatch && <div className="scanner-laser z-10" />}

        {/* Fallback Display when Camera is Offline */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md z-20">
            <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
              <CameraOff className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-200 mb-2">
              {cameraError ? 'Izin Kamera Diperlukan' : 'Memulai Kamera...'}
            </h4>
            <p className="text-sm text-slate-400 mb-6">
              {cameraError || 'Mohon izinkan akses webcam pada browser atau lakukan absensi manual dengan tombol di bawah.'}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={startCamera}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition text-sm"
              >
                <Camera className="w-4 h-4" />
                Aktifkan Kamera
              </button>
              <button
                onClick={handleOpenManualAttendance}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition text-sm"
              >
                <UserCheck className="w-4 h-4" />
                Absen Manual (Pilih Siswa)
              </button>
            </div>
          </div>
        )}

        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Top Floating Status & Action Bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-30">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs sm:text-sm font-semibold shadow-lg">
            {hudStatus === 'MATCHED' && <UserCheck className="w-4 h-4 text-emerald-400 animate-bounce" />}
            {hudStatus === 'UNKNOWN' && <ShieldAlert className="w-4 h-4 text-red-400" />}
            {hudStatus === 'SEARCHING' && <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />}
            <span
              className={
                hudStatus === 'MATCHED'
                  ? 'text-emerald-300'
                  : hudStatus === 'UNKNOWN'
                  ? 'text-red-300'
                  : 'text-yellow-300'
              }
            >
              {hudLabel}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'))}
              title="Ganti Kamera Depan/Belakang"
              className="p-2.5 rounded-full glass-panel hover:bg-slate-800 text-slate-300 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleOpenManualAttendance}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Absen Manual & Foto</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* INTERACTIVE VERIFICATION OVERLAY CARD: "KONFIRMASI HADIR" */}
        {/* ========================================================= */}
        {pendingMatch && (
          <div className="absolute inset-x-4 bottom-4 z-40 flex justify-center animate-slideUp">
            <div className="w-full max-w-lg bg-slate-900/95 border-2 border-emerald-500/80 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-400 flex-shrink-0 flex items-center justify-center shadow-lg">
                  {pendingMatch.student.photo_url ? (
                    <img
                      src={pendingMatch.student.photo_url}
                      alt={pendingMatch.student.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-black text-emerald-400">
                      {pendingMatch.student.nickname.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                      {Math.round(pendingMatch.confidence * 100)}% Wajah Cocok
                    </span>
                    <span className="text-xs text-slate-400">{pendingMatch.student.nis}</span>
                  </div>

                  <h3 className="text-lg font-black text-white truncate mt-1">
                    {pendingMatch.student.name}
                  </h3>
                  <p className="text-xs font-semibold text-emerald-400">
                    Panggilan: {pendingMatch.student.nickname} • <span className="text-slate-300">{pendingMatch.student.class_name}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons: Hadir vs Bukan Siswa Ini */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={handleCancelPendingMatch}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Bukan Saya</span>
                </button>

                <button
                  onClick={handleConfirmAttendance}
                  disabled={isSubmittingAttendance}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40 transition transform active:scale-95 disabled:opacity-50"
                >
                  <ThumbsUp className="w-5 h-5 fill-current" />
                  <span>{isSubmittingAttendance ? 'Mencatat Presensi...' : 'KLIK HADIR SEKARANG'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Helper Bar (When No Pending Match) */}
        {!pendingMatch && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-none z-30 flex items-center justify-between">
            <div className="hidden sm:inline-block px-4 py-2 rounded-2xl glass-panel text-xs text-slate-300 shadow-xl border border-slate-700/50">
              💡 <span className="font-semibold text-emerald-400">Tips:</span> Arahkan wajah ke kamera • Klik tombol "Hadir" saat nama Anda muncul
            </div>

            <button
              onClick={handleOpenManualAttendance}
              className="pointer-events-auto px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg backdrop-blur-md transition ml-auto"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Wajah Tidak Terdeteksi? Klik Absen Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL: ABSENSI MANUAL & VERIFIKASI FOTO */}
      {/* ========================================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Absensi Manual & Verifikasi Foto</h3>
                  <p className="text-xs text-slate-400">Foto snapshot diambil dari kamera saat tombol ditekan</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Snapshot Preview & AI Status */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center">
                  {capturedSnapshot ? (
                    <img src={capturedSnapshot} alt="Snapshot" className="w-full h-full object-cover transform scale-x-[-1]" />
                  ) : (
                    <CameraOff className="w-8 h-8 text-slate-500" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5 text-center sm:text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Hasil Pemindaian Snapshot:
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {manualAiMessage || 'Foto berhasil diambil. Pilih nama siswa di bawah untuk konfirmasi.'}
                  </div>
                  {selectedManualStudent && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Siswa Dipilih: {selectedManualStudent.full_name} ({selectedManualStudent.nickname})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Search & Student List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Pilih Nama Siswa ({filteredStudents.length} siswa):
                  </label>
                  <span className="text-xs text-slate-500">Klik siswa yang sesuai</span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    placeholder="Cari nama siswa atau NIS..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {filteredStudents.map(student => {
                    const isSelected = selectedManualStudent?.id === student.id;
                    return (
                      <div
                        key={student.id}
                        onClick={() => setSelectedManualStudent(student)}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-950'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                            {student.latest_photo ? (
                              <img src={student.latest_photo} alt={student.nickname} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{student.full_name}</div>
                            <div className="text-[11px] text-emerald-400 font-medium">
                              {student.nickname} • <span className="text-slate-400">{student.class_name}</span>
                            </div>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500">
                      Tidak ada siswa yang sesuai pencarian.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Batal
              </button>

              <button
                onClick={handleConfirmManualAttendance}
                disabled={!selectedManualStudent || isVerifyingManual}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isVerifyingManual
                    ? 'Memproses Presensi...'
                    : selectedManualStudent
                    ? `Konfirmasi Hadir (${selectedManualStudent.nickname})`
                    : 'Pilih Siswa Terlebih Dahulu'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
