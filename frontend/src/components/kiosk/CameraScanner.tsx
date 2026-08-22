import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Sparkles, UserCheck, ShieldAlert, MonitorPlay, CheckCircle2 } from 'lucide-react';
import { api, VerifyFrameResponse, Student } from '../../services/api';
import { audioFeedback } from './AudioFeedback';

interface CameraScannerProps {
  onVerified: (response: VerifyFrameResponse) => void;
  selectedClass?: string;
  isPaused?: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onVerified,
  selectedClass,
  isPaused = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hudStatus, setHudStatus] = useState<'SEARCHING' | 'MATCHED' | 'UNKNOWN'>('SEARCHING');
  const [hudLabel, setHudLabel] = useState<string>('Mencari wajah siswa...');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [lastVerifiedId, setLastVerifiedId] = useState<string | null>(null);

  // Load enrolled students for simulator fallback
  useEffect(() => {
    api.getStudents().then(setEnrolledStudents).catch(() => {});
  }, []);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

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
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
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
        // Draw searching target brackets in center
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const size = Math.min(canvas.width, canvas.height) * 0.45;

        ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'; // Amber yellow pulse
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      // Draw bounding box
      let strokeColor = '#eab308'; // Yellow for searching
      let bgColor = 'rgba(234, 179, 8, 0.2)';

      if (status === 'MATCHED') {
        strokeColor = '#22c55e'; // Green
        bgColor = 'rgba(34, 197, 94, 0.25)';
      } else if (status === 'UNKNOWN') {
        strokeColor = '#ef4444'; // Red
        bgColor = 'rgba(239, 68, 68, 0.2)';
      }

      const { x, y, w, h } = bbox;

      // Draw corner brackets
      const cornerLen = Math.min(w, h) * 0.25;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, w, h);

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // Label Banner (un-mirror text)
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

  // Continuous Frame Capture & Recognition Loop
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(async () => {
      if (isProcessing || isPaused) return;

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
          setHudLabel(`Terverifikasi: ${res.student.name} (${Math.round(res.confidence * 100)}%)`);
          drawHud(res.bounding_box || null, 'MATCHED', res.student.name);

          // Trigger feedback if new or cooled down
          if (lastVerifiedId !== res.student.id) {
            setLastVerifiedId(res.student.id);
            audioFeedback.playCelebrationChime();
            audioFeedback.speakText(res.message);
            onVerified(res);
            // Reset lastVerifiedId after cooldown
            setTimeout(() => setLastVerifiedId(null), 5000);
          }
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
    }, 400); // 400ms interval for smooth continuous scanning

    return () => clearInterval(interval);
  }, [isPaused, isProcessing, selectedClass, onVerified, drawHud, lastVerifiedId]);

  // Simulator Test Action
  const triggerSimulatedStudent = async (student: Student) => {
    try {
      setIsProcessing(true);
      setHudStatus('MATCHED');
      setHudLabel(`Simulasi: ${student.full_name}`);

      const mockResponse: VerifyFrameResponse = {
        status: 'MATCHED',
        student: {
          id: student.id,
          nis: student.nis,
          name: student.full_name,
          nickname: student.nickname,
          class_name: student.class_name,
          category: student.category,
          photo_url: student.latest_photo || null,
        },
        confidence: 0.98,
        attendance_status: 'RECORDED_SUCCESS',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message: `Selamat Pagi, ${student.nickname}! Presensi kamu berhasil dicatat.`,
        bounding_box: { x: 120, y: 80, w: 220, h: 220 },
      };

      await api.manualOverride({
        student_id: student.id,
        status: 'HADIR',
        notes: 'Presensi via Kiosk Face Recognition Simulator',
      });

      audioFeedback.playCelebrationChime();
      audioFeedback.speakText(mockResponse.message);
      onVerified(mockResponse);
    } catch (err) {
      console.warn('Simulator error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
      {/* Video Stream Container - ALWAYS RENDERS VIDEO IN DOM */}
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

        {/* Laser Scan Line when streaming */}
        {isStreaming && <div className="scanner-laser z-10" />}

        {/* Fallback Display when Camera is not yet streaming or error */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md z-20">
            <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
              <CameraOff className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-200 mb-2">
              {cameraError ? 'Izin Kamera Diperlukan' : 'Memulai Kamera...'}
            </h4>
            <p className="text-sm text-slate-400 mb-6">
              {cameraError || 'Mohon izinkan akses webcam pada browser atau klik tombol coba kamera di bawah.'}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={startCamera}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
              >
                <Camera className="w-4 h-4" />
                Aktifkan Kamera
              </button>
              <button
                onClick={() => setShowSimulator(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition"
              >
                <MonitorPlay className="w-4 h-4" />
                Uji Coba Simulator Siswa
              </button>
            </div>
          </div>
        )}

        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Top Floating Status Indicator */}
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
              onClick={() => setShowSimulator(!showSimulator)}
              className="px-3 py-1.5 rounded-full bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>Simulasi Siswa</span>
            </button>
          </div>
        </div>

        {/* Bottom Instruction Bar */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none z-30 text-center">
          <div className="inline-block px-5 py-2 rounded-2xl glass-panel text-xs sm:text-sm text-slate-300 shadow-xl border border-slate-700/50">
            Arahkan wajah ke kamera • Sistem AI memindai otomatis tanpa sentuh
          </div>
        </div>
      </div>

      {/* Simulator Drawer for testing */}
      {showSimulator && (
        <div className="w-full bg-slate-900 border-t border-slate-800 p-4 transition-all z-40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h5 className="text-sm font-bold text-slate-200">
                Pilih Profil Siswa Terdaftar untuk Simulasi Presensi Instan:
              </h5>
            </div>
            <button
              onClick={() => setShowSimulator(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Tutup
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {enrolledStudents.map(student => (
              <button
                key={student.id}
                onClick={() => triggerSimulatedStudent(student)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-500/50 text-left transition group"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 flex items-center justify-center">
                  {student.latest_photo ? (
                    <img src={student.latest_photo} alt={student.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-emerald-400">{student.nickname.charAt(0)}</span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 truncate">
                    {student.nickname}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{student.class_name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
