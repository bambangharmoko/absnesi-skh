/**
 * Audio feedback module using Web Audio API (Synthesizer Chime)
 * and 100% Native Indonesian Text-to-Speech (Indonesian Voice Engine & Audio Fallback)
 */

class AudioFeedbackManager {
  private audioCtx: AudioContext | null = null;
  private indonesianVoice: SpeechSynthesisVoice | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const findVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Look for pure Indonesian voices (id-ID, in-ID, Gadis, Ardi, Andika, Indonesian)
      const found = voices.find(
        v =>
          v.lang.toLowerCase().startsWith('id') ||
          v.lang.toLowerCase().startsWith('in') ||
          v.name.toLowerCase().includes('indonesia') ||
          v.name.toLowerCase().includes('gadis') ||
          v.name.toLowerCase().includes('ardi')
      );
      if (found) {
        this.indonesianVoice = found;
      }
    };

    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Play a harmonious, child-friendly 4-note celebration chime
   */
  playCelebrationChime() {
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.35 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.4 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.65 }, // G5
        { freq: 1046.5, time: 0.36, dur: 0.85 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  /**
   * Speak friendly text with 100% Native Indonesian Voice
   */
  speakText(text: string) {
    if (!text || !text.trim()) return;

    // Stop any previous speech / audio playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Clean formatting for natural speech
    const cleanText = text
      .replace(/[•*#_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Primary Method: Native Indonesian Web Speech Synthesis with id-ID
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'id-ID';
        utterance.rate = 0.95; // Gentle, easy to comprehend for special needs students
        utterance.pitch = 1.05; // Friendly and warm tone

        if (this.indonesianVoice) {
          utterance.voice = this.indonesianVoice;
        } else {
          // Re-search voices in case loaded asynchronously
          const voices = window.speechSynthesis.getVoices();
          const idV = voices.find(
            v =>
              v.lang.toLowerCase().startsWith('id') ||
              v.lang.toLowerCase().startsWith('in') ||
              v.name.toLowerCase().includes('indonesia')
          );
          if (idV) {
            this.indonesianVoice = idV;
            utterance.voice = idV;
          }
        }

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('SpeechSynthesis speak notice:', e);
      }
    }

    // 2. High-Quality Fallback: Online Indonesian Voice Audio Stream
    try {
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(
        cleanText
      )}`;
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      audio.play().catch(() => {});
    } catch (err) {
      console.warn('TTS Audio fallback notice:', err);
    }
  }
}

export const audioFeedback = new AudioFeedbackManager();
