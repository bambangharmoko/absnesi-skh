import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  RefreshCw,
  Sparkles,
  User,
  ShieldAlert,
  Scan,
  Compass,
  Check,
  Zap,
  Play,
  RotateCcw,
  Eye,
  Sliders,
  Activity,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { faceApi, DetailedFaceResult, HeadPose } from '../services/faceApi';
import { audioFeedback } from '../components/kiosk/AudioFeedback';
import { Face3DScannerCanvas } from '../components/kiosk/Face3DScannerCanvas';
import confetti from 'canvas-confetti';

interface RegisterStudentPageProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface PoseTarget {
  id: 'CENTER' | 'RIGHT' | 'LEFT' | 'UP';
  label: string;
  instruction: string;
  tip: string;
  icon: string;
  deg: number;
}

// 4 Sudut Perekaman: Depan, Kanan, Kiri, dan Atas (Tanpa Bawah)
const POSE_TARGETS: PoseTarget[] = [
  {
    id: 'CENTER',
    label: 'Depan (Lurus)',
    instruction: 'Tatap lurus ke depan ke arah kamera ya',
    tip: 'Wajah sejajar dengan lingkaran kamera',
    icon: '🎯',
    deg: 90,
  },
  {
    id: 'RIGHT',
    label: 'Hadap Kanan',
    instruction: 'Bagus! Sekarang tolehkan kepala ke kanan perlahan',
    tip: 'Putar kepala ke kanan sekitar 15 derajat',
    icon: '👉',
    deg: 0,
  },
  {
    id: 'LEFT',
    label: 'Hadap Kiri',
    instruction: 'Hebat! Sekarang tolehkan kepala ke kiri perlahan',
    tip: 'Putar kepala ke kiri sekitar 15 derajat',
    icon: '👈',
    deg: 180,
  },
  {
    id: 'UP',
    label: 'Hadap Atas',
    instruction: 'Bagus! Terakhir, dongakkan kepala sedikit ke atas ya',
    tip: 'Angkat dagu sedikit ke atas',
    icon: '👆',
    deg: 270,
  },
];

export const RegisterStudentPage: React.FC<RegisterStudentPageProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState({
    nis: '',
    full_name: '',
    nickname: '',
    class_name: 'Kelas 1 Autis',
    category: 'Autism Spectrum',
  });

  // Face ID 3D Scanning States
  const [isFaceIdMode, setIsFaceIdMode] = useState<boolean>(true);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0);
  const [capturedSamples, setCapturedSamples] = useState<
    Record<string, { photo: string; descriptor: Float32Array; pose: string }>
  >({});
  const [liveHeadPose, setLiveHeadPose] = useState<HeadPose | null>(null);

  // Manual fallback photos (4 angles)
  const [manualPhotos, setManualPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Webcam references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
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
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log('Video play:', playErr);
        }
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera error in registration:', err);
      setIsCameraActive(false);
      setErrorMsg('Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan atau gunakan tombol Upload File.');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, startCamera, stopCamera]);

  // =========================================================================
  // 3D FACE ID AUTOMATIC GUIDED SCANNING LOOP (4 ANGLES: FRONT, RIGHT, LEFT, UP)
  // =========================================================================

  const handleStart3dScan = () => {
    setCapturedSamples({});
    setScanProgress(0);
    setCurrentPromptIndex(0);
    setIsScanningActive(true);
    audioFeedback.speakText(
      `Halo ${formData.nickname || 'Siswa'}, mari kita mulai pemindaian wajah. Tatap lurus ke arah lingkaran kamera ya.`
    );
  };

  const handleResetScan = () => {
    setCapturedSamples({});
    setScanProgress(0);
    setCurrentPromptIndex(0);
    setIsScanningActive(false);
    setLiveHeadPose(null);
  };

  useEffect(() => {
    if (step !== 2 || !isScanningActive || !isCameraActive) return;

    let isProcessingFrame = false;

    const interval = setInterval(async () => {
      if (isProcessingFrame) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const hudCanvas = hudCanvasRef.current;

      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

      isProcessingFrame = true;

      try {
        const detection = await faceApi.detectFaceWithPose(video);

        if (detection) {
          const { headPose, landmarks, descriptor } = detection;
          setLiveHeadPose(headPose);

          // Draw landmark dots on HUD
          if (hudCanvas) {
            hudCanvas.width = video.videoWidth;
            hudCanvas.height = video.videoHeight;
            const ctx = hudCanvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
              ctx.fillStyle = 'rgba(52, 211, 153, 0.85)'; // Emerald green points
              landmarks.positions.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          }

          // Check if current target pose matches
          const currentTarget = POSE_TARGETS[currentPromptIndex];
          if (currentTarget) {
            let isPoseMatched = false;

            if (currentTarget.id === 'CENTER' && headPose.poseCategory === 'CENTER') {
              isPoseMatched = true;
            } else if (currentTarget.id === 'RIGHT' && (headPose.poseCategory === 'RIGHT' || headPose.yaw > 10)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'LEFT' && (headPose.poseCategory === 'LEFT' || headPose.yaw < -10)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'UP' && (headPose.poseCategory === 'UP' || headPose.pitch > 8)) {
              isPoseMatched = true;
            }

            if (isPoseMatched && !capturedSamples[currentTarget.id]) {
              // Capture high-res snapshot
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const cctx = canvas.getContext('2d');
              let photoData = '';
              if (cctx) {
                cctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                photoData = canvas.toDataURL('image/jpeg', 0.9);
              }

              const newSamples = {
                ...capturedSamples,
                [currentTarget.id]: {
                  photo: photoData,
                  descriptor: descriptor,
                  pose: currentTarget.label,
                },
              };

              setCapturedSamples(newSamples);
              audioFeedback.playCelebrationChime();

              const completedCount = Object.keys(newSamples).length;
              const newProgress = Math.round((completedCount / POSE_TARGETS.length) * 100);
              setScanProgress(newProgress);

              if (completedCount < POSE_TARGETS.length) {
                const nextIdx = currentPromptIndex + 1;
                setCurrentPromptIndex(nextIdx);
                const nextTarget = POSE_TARGETS[nextIdx];
                audioFeedback.speakText(nextTarget.instruction);
              } else {
                // All 4 3D poses captured!
                setIsScanningActive(false);
                confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
                audioFeedback.speakText(
                  `Hebat sekali! Pemindaian wajah telah selesai. Data wajah ${formData.nickname || 'siswa'} siap didaftarkan.`
                );
                // Auto proceed to review after 1.2s
                setTimeout(() => setStep(3), 1200);
              }
            }
          }
        }
      } catch (err) {
        console.warn('3D Scan frame error:', err);
      } finally {
        isProcessingFrame = false;
      }
    }, 140);

    return () => clearInterval(interval);
  }, [step, isScanningActive, isCameraActive, currentPromptIndex, capturedSamples, formData.nickname]);

  // Fallback Single Manual Capture
  const handleManualCapture = (idx: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const updated = [...manualPhotos];
    updated[idx] = dataUrl;
    setManualPhotos(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const updated = [...manualPhotos];
      updated[idx] = reader.result as string;
      setManualPhotos(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    if (!formData.nis.trim() || !formData.full_name.trim() || !formData.nickname.trim()) {
      setErrorMsg('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan pada Langkah 1.');
      setStep(1);
      setIsSubmitting(false);
      return;
    }

    try {
      const data = new FormData();
      data.append('nis', formData.nis.trim());
      data.append('full_name', formData.full_name.trim());
      data.append('nickname', formData.nickname.trim());
      data.append('class_name', formData.class_name);
      data.append('category', formData.category.trim() || 'Umum');

      const validPhotos: string[] = [];

      if (isFaceIdMode) {
        Object.values(capturedSamples).forEach(s => {
          if (s.photo) validPhotos.push(s.photo);
        });
      } else {
        manualPhotos.forEach(p => {
          if (p) validPhotos.push(p);
        });
      }

      if (validPhotos.length === 0) {
        setErrorMsg('Harap lakukan pemindaian wajah 3D atau ambil foto minimal 1 sampel.');
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      validPhotos.forEach((dataUrl, idx) => {
        // Create Blob from dataURL
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        data.append('photos', blob, `pose_${idx + 1}.jpg`);
      });

      await api.enrollStudentFace(data);
      onSuccess();
    } catch (err: unknown) {
      console.error('Submit enrollment error:', err);
      const message = err instanceof Error ? err.message : 'Gagal mendaftarkan siswa. Silakan periksa kembali data.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTarget = POSE_TARGETS[currentPromptIndex];

  const completedAnglesMap: Record<string, boolean> = {
    CENTER: Boolean(capturedSamples['CENTER']),
    RIGHT: Boolean(capturedSamples['RIGHT']),
    LEFT: Boolean(capturedSamples['LEFT']),
    UP: Boolean(capturedSamples['UP']),
  };

  return (
    <div className="flex flex-col flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Pendaftaran Siswa & Face ID</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Three.js 3D Hologram
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Perekaman biometrik 3D interaktif 4 sudut (Depan, Kanan, Kiri, Atas) dengan visual hologram real-time
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
        >
          Batal
        </button>
      </div>

      {/* Step Stepper Progress */}
      <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 1 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            1
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 1</div>
            <div className="text-[11px] text-slate-400">Biodata Siswa</div>
          </div>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            2
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 2</div>
            <div className="text-[11px] text-slate-400">Pemindaian 3D Face ID</div>
          </div>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 3 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            3
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 3</div>
            <div className="text-[11px] text-slate-400">Konfirmasi & Simpan</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-3 animate-fadeIn">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: BIODATA FORM */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5 animate-fadeIn">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Informasi Pribadi & Identitas Siswa</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nomor Induk Siswa (NIS) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nis}
                onChange={e => setFormData({ ...formData, nis: e.target.value })}
                placeholder="Contoh: SKH-2026-001"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nama Panggilan / Sapaan <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Contoh: Jonathan / Jo"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Nama ini yang akan disapa dengan ramah oleh suara AI</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nama Lengkap Siswa <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nama lengkap sesuai dokumen pendaftaran"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Kelas SKH
              </label>
              <select
                value={formData.class_name}
                onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="Kelas 1 Autis">Kelas 1 Autis</option>
                <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
                <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
                <option value="Kelas Transisi">Kelas Transisi</option>
                <option value="Kelas Khusus">Kelas Khusus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Kebutuhan Khusus / Kategori
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="Contoh: Autism Spectrum / Tunarungu"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                if (!formData.nis.trim() || !formData.full_name.trim() || !formData.nickname.trim()) {
                  setErrorMsg('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan terlebih dahulu.');
                  return;
                }
                setErrorMsg(null);
                setStep(2);
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
            >
              <span>Lanjut ke Pemindaian Wajah 3D</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: HIGH-END 3D HOLOGRAPHIC WEBGL SCANNER (4 ANGLES) */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-6 animate-fadeIn">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-400" />
                <span>Pemindaian Wajah 3D Hologram (Depan, Kanan, Kiri, Atas)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Perekaman mesh 3D real-time dengan rotasi kepala visual dan sensor sudut
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFaceIdMode(!isFaceIdMode)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isFaceIdMode ? 'Beralih ke Foto Manual' : 'Gunakan Face ID 3D Otomatis'}</span>
              </button>
            </div>
          </div>

          {/* ======================= */}
          {/* 3D FACE ID MODE */}
          {/* ======================= */}
          {isFaceIdMode ? (
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
              {/* Left Side: Dual-Layer 3D Holographic Viewport */}
              <div className="relative w-72 h-72 sm:w-84 sm:h-84 flex items-center justify-center">
                {/* Layer 1: Three.js 3D Holographic WebGL Canvas with Rotating Head & Radial Ticks */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <Face3DScannerCanvas
                    headPose={liveHeadPose}
                    scanProgress={scanProgress}
                    completedAngles={completedAnglesMap}
                    isScanningActive={isScanningActive}
                    currentAngleId={currentTarget?.id}
                  />
                </div>

                {/* Layer 2: Circular Live Camera Viewport with Subtle Dark Backing */}
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden border-2 border-emerald-500/40 bg-slate-950/80 shadow-2xl flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-75"
                  />

                  {/* 68 Landmarks HUD Canvas */}
                  <canvas
                    ref={hudCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none z-20"
                  />

                  {/* Dynamic Glowing Sci-Fi Grid Line */}
                  {isScanningActive && (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#06b6d4] animate-bounce z-20" />
                  )}

                  {/* Center Guidance Reticle */}
                  <div
                    className={`w-32 h-32 rounded-full border border-dashed pointer-events-none transition-all duration-300 z-20 ${
                      isScanningActive ? 'border-emerald-400/80 scale-105' : 'border-slate-600/50'
                    }`}
                  />

                  {/* Prompt Text Overlay Inside Viewport */}
                  {isScanningActive && currentTarget && (
                    <div className="absolute bottom-3 inset-x-3 px-2.5 py-1 rounded-full bg-slate-950/90 backdrop-blur-md border border-emerald-500/50 text-center pointer-events-none z-30 animate-fadeIn">
                      <span className="text-[11px] font-black text-emerald-300">
                        {currentTarget.icon} {currentTarget.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: 3D Telemetry, Angle Cards & Progress Panel */}
              <div className="flex-1 max-w-md w-full space-y-4">
                {/* 4 Interactive Target Angle Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  {POSE_TARGETS.map((t, idx) => {
                    const isDone = Boolean(capturedSamples[t.id]);
                    const isCurrent = isScanningActive && currentPromptIndex === idx;
                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                          isDone
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/50'
                            : isCurrent
                            ? 'bg-amber-950/40 border-amber-400 text-amber-200 animate-pulse scale-[1.02]'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{t.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-white">{t.label}</div>
                            <div className="text-[10px] text-slate-400">{isDone ? 'Terekam ✓' : 'Menunggu'}</div>
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Real-time Angle Telemetry Sensor */}
                {liveHeadPose && isScanningActive && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5 text-cyan-300 font-mono">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      Yaw: {Math.round(liveHeadPose.yaw)}°
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="font-mono text-emerald-300">Pitch: {Math.round(liveHeadPose.pitch)}°</span>
                    <span className="text-slate-600">|</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase text-[10px] border border-emerald-500/30">
                      {liveHeadPose.poseCategory}
                    </span>
                  </div>
                )}

                {/* Progress Bar & Instructions */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">Progres Pemindaian 3D:</span>
                    <span className="text-emerald-400">
                      {scanProgress}% ({Object.keys(capturedSamples).length}/4 Sudut)
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-teal-400 transition-all duration-500 shadow-lg shadow-emerald-500/50"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  <div className="text-xs font-bold text-white pt-1">
                    {isScanningActive && currentTarget
                      ? currentTarget.instruction
                      : scanProgress === 100
                      ? '✅ Keempat sudut wajah 3D berhasil direkam!'
                      : 'Klik tombol Mulai Pemindaian di bawah untuk memulai perekaman'}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-3 pt-1">
                  {!isScanningActive ? (
                    <button
                      onClick={handleStart3dScan}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/40 transition transform active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>{scanProgress > 0 ? 'Ulangi Pemindaian 3D' : 'Mulai Pemindaian Wajah 3D'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetScan}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Hentikan / Ulangi</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ======================= */
            /* MANUAL PHOTO FALLBACK */
            /* ======================= */
            <div className="space-y-4">
              <div className="relative w-full h-72 rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {POSE_TARGETS.map((t, idx) => (
                  <div key={t.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
                      {manualPhotos[idx] ? (
                        <img src={manualPhotos[idx]!} alt={t.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{t.icon}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 text-center truncate w-full">{t.label}</span>
                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        onClick={() => handleManualCapture(idx)}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                      >
                        Foto
                      </button>
                      <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleFileUpload(e, idx)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                stopCamera();
                setStep(1);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Biodata</span>
            </button>

            <button
              onClick={() => {
                const sampleCount = isFaceIdMode
                  ? Object.keys(capturedSamples).length
                  : manualPhotos.filter(Boolean).length;
                if (sampleCount === 0) {
                  setErrorMsg('Harap lakukan pemindaian wajah 3D atau ambil foto minimal 1 pose.');
                  return;
                }
                setErrorMsg(null);
                setStep(3);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <span>Lanjut ke Konfirmasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW & FINAL ENROLLMENT SUBMISSION */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-6 animate-fadeIn">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">Konfirmasi Data Siswa & Sampel Wajah 3D</h3>
            <p className="text-xs text-slate-400">Pastikan biodata dan 4 sampel biometrik wajah sudah sesuai</p>
          </div>

          {/* Student Info Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">NIS Siswa</div>
              <div className="font-bold text-white mt-0.5">{formData.nis}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Nama Panggilan</div>
              <div className="font-bold text-emerald-400 mt-0.5">{formData.nickname}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Nama Lengkap</div>
              <div className="font-bold text-white mt-0.5">{formData.full_name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Kelas & Kategori</div>
              <div className="font-bold text-slate-300 mt-0.5">
                {formData.class_name} • <span className="text-slate-400">{formData.category}</span>
              </div>
            </div>
          </div>

          {/* Captured 3D Angle Thumbnails (4 Angles) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Sampel Biometrik Wajah yang Direkam (4 Sudut):
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {isFaceIdMode
                ? POSE_TARGETS.map(t => {
                    const sample = capturedSamples[t.id];
                    return (
                      <div key={t.id} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                          {sample ? (
                            <img src={sample.photo} alt={t.label} className="w-full h-full object-cover transform scale-x-[-1]" />
                          ) : (
                            <span className="text-slate-500 text-xs">Kosong</span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400">{t.label}</span>
                      </div>
                    );
                  })
                : manualPhotos.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                        {p ? <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" /> : null}
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">Sampel {idx + 1}</span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ubah Foto / Pindai Ulang</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/40 transition transform active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Mendaftarkan Wajah 3D...' : 'Simpan & Daftarkan Siswa'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
