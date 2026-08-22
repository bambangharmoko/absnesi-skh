import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, ArrowRight, ArrowLeft, Upload, RefreshCw, Sparkles, User, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

interface RegisterStudentPageProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const POSES = [
  { id: 0, label: 'Pose 1: Wajah Lurus / Netral', tip: 'Tatap lurus ke arah lensa kamera dengan ekspresi rileks' },
  { id: 1, label: 'Pose 2: Tersenyum Ceria', tip: 'Tersenyum ramah menghadap kamera' },
  { id: 2, label: 'Pose 3: Sedikit Miring Kiri', tip: 'Putar wajah sekitar 15-20 derajat ke sisi kiri' },
  { id: 3, label: 'Pose 4: Sedikit Miring Kanan', tip: 'Putar wajah sekitar 15-20 derajat ke sisi kanan' },
  { id: 4, label: 'Pose 5: Sedikit Menunduk', tip: 'Tundukkan kepala sedikit ke bawah' },
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

  const [currentPoseIdx, setCurrentPoseIdx] = useState<number>(0);
  const [capturedPhotos, setCapturedPhotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Webcam references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step]);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
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
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };


  const handleCaptureCurrentPose = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const newPhotos = [...capturedPhotos];
    newPhotos[currentPoseIdx] = dataUrl;
    setCapturedPhotos(newPhotos);

    // Auto advance to next pose if not finished
    if (currentPoseIdx < 4) {
      setCurrentPoseIdx(prev => prev + 1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newPhotos = [...capturedPhotos];
      newPhotos[idx] = reader.result as string;
      setCapturedPhotos(newPhotos);
    };
    reader.readAsDataURL(file);
  };

  // Safe convert base64 DataURL to Blob for multipart upload
  const dataURLtoBlob = (dataurl: string): Blob | null => {
    try {
      const arr = dataurl.split(',');
      if (arr.length < 2 || !arr[1]) return null;
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(arr[1].trim());
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.warn('Error converting dataURL to blob:', e);
      return null;
    }
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

    const validPhotos = capturedPhotos.filter((p): p is string => Boolean(p && p.length > 50));
    if (validPhotos.length === 0) {
      setErrorMsg('Harap ambil minimal 1 foto wajah siswa pada Langkah 2.');
      setStep(2);
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

      let appendedCount = 0;
      validPhotos.forEach((dataUrl, idx) => {
        const blob = dataURLtoBlob(dataUrl);
        if (blob) {
          data.append('photos', blob, `pose_${idx + 1}.jpg`);
          appendedCount++;
        }
      });

      if (appendedCount === 0) {
        throw new Error('Gagal memproses file foto. Silakan ambil ulang foto wajah.');
      }

      await api.enrollStudentFace(data);
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Gagal mendaftarkan data siswa.';
      setErrorMsg(msg);
      console.error('Enroll error detail:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Pendaftaran Siswa Baru</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Pendaftaran & Pengambilan 5 Pose Wajah
          </h2>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
        >
          Kembali
        </button>
      </div>

      {/* Stepper Wizard Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
          <span>1. Biodata Siswa</span>
        </div>
        <div className="w-8 h-0.5 bg-slate-800" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
          <span>2. Ambil 5 Pose Wajah</span>
        </div>
        <div className="w-8 h-0.5 bg-slate-800" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
          <span>3. Konfirmasi & Ekstraksi</span>
        </div>
      </div>

      {/* STEP 1: Biodata Form */}
      {step === 1 && (
        <div className="rounded-3xl glass-panel p-6 sm:p-8 space-y-5">
          <h3 className="text-lg font-bold text-white mb-4">Informasi Siswa SKH</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nomor Induk Siswa / NISN *
              </label>
              <input
                type="text"
                required
                value={formData.nis}
                onChange={e => setFormData({ ...formData, nis: e.target.value })}
                placeholder="Contoh: SKH-2026-006"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nama Lengkap Siswa *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Contoh: Jonathan Edward"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nama Panggilan (Digunakan untuk Suara TTS Kiosk) *
              </label>
              <input
                type="text"
                required
                value={formData.nickname}
                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Contoh: Nathan"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-emerald-400 mt-1">
                Kiosk akan mengucapkan: "Selamat Pagi, [Nama Panggilan]!"
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Kelas SKH *
              </label>
              <select
                value={formData.class_name}
                onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Kelas 1 Autis">Kelas 1 Autis</option>
                <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
                <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
                <option value="Kelas 4 Autis">Kelas 4 Autis</option>
                <option value="Kelas 5 Transisi">Kelas 5 Transisi</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Kategori Kebutuhan Khusus / Diagnosis *
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="Contoh: Autism Spectrum Disorder, Down Syndrome, Hearing Impairment"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                if (!formData.nis || !formData.full_name || !formData.nickname) {
                  alert('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan.');
                  return;
                }
                setStep(2);
              }}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <span>Lanjut: Ambil Foto Wajah</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: 5-Pose Face Capture */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Camera View (7 cols) */}
          <div className="lg:col-span-7 flex flex-col rounded-3xl glass-panel p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-400">
                {POSES[currentPoseIdx].label}
              </span>
              <span className="text-xs text-slate-400">
                Pose {currentPoseIdx + 1} dari 5
              </span>
            </div>

            <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Target Guidance Oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 rounded-full border-2 border-dashed border-emerald-400/60 shadow-inner" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 mb-4">
              💡 <span className="font-semibold text-emerald-400">Tips:</span> {POSES[currentPoseIdx].tip}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCaptureCurrentPose}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto Pose Ini</span>
              </button>

              <label className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition border border-slate-700">
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handleFileUpload(e, currentPoseIdx)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 5 Pose Thumbnail Previews (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl glass-panel p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Daftar 5 Sampel Wajah
            </h4>

            <div className="space-y-2.5">
              {POSES.map((pose, idx) => (
                <div
                  key={pose.id}
                  onClick={() => setCurrentPoseIdx(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                    currentPoseIdx === idx
                      ? 'bg-emerald-950/40 border-emerald-500/60'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-400">
                      {capturedPhotos[idx] ? (
                        <img
                          src={capturedPhotos[idx]!}
                          alt={pose.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{pose.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {capturedPhotos[idx] ? 'Foto Tersimpan ✓' : 'Belum diambil'}
                      </div>
                    </div>
                  </div>

                  {capturedPhotos[idx] && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                Biodata
              </button>

              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <span>Lanjut: Konfirmasi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation & Centroid Extraction */}
      {step === 3 && (
        <div className="rounded-3xl glass-panel p-6 sm:p-8 space-y-6">
          <h3 className="text-lg font-bold text-white mb-2">Konfirmasi & Ekstraksi Fitur Vektor Wajah</h3>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Nama Siswa:</span>
              <div className="font-bold text-white text-sm mt-0.5">{formData.full_name}</div>
            </div>
            <div>
              <span className="text-slate-400">Panggilan:</span>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">{formData.nickname}</div>
            </div>
            <div>
              <span className="text-slate-400">NIS:</span>
              <div className="font-bold text-white text-sm mt-0.5">{formData.nis}</div>
            </div>
            <div>
              <span className="text-slate-400">Kelas:</span>
              <div className="font-bold text-white text-sm mt-0.5">{formData.class_name}</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Foto Sampel yang Akan Diekstrak (Vektor 512-dimensi):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {POSES.map((pose, idx) => (
                <div
                  key={pose.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-2 text-center"
                >
                  <div className="w-full h-28 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center mb-2">
                    {capturedPhotos[idx] ? (
                      <img
                        src={capturedPhotos[idx]!}
                        alt={pose.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Tidak ada foto</span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-300 truncate">
                    Pose {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              Ubah Foto
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Memproses Ekstraksi AI...' : 'Simpan & Daftarkan Wajah'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
