/**
 * Audio feedback module using Web Audio API (Synthesizer Chime)
 * and Web Speech API (Indonesian SpeechSynthesis)
 */

class AudioFeedbackManager {
  private audioCtx: AudioContext | null = null;
  private isSpeaking: boolean = false;

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Play a harmonious, child-friendly 3-note celebration chime (C5 -> E5 -> G5)
   */
  playCelebrationChime() {
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.35 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.40 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.65 }, // G5
        { freq: 1046.50, time: 0.36, dur: 0.85 } // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        // Soft bell envelope
        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio chime playback error:', e);
    }
  }

  /**
   * Speak friendly text with Indonesian TTS
   */
  speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    
    try {
      // Cancel previous speech if any
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95; // Gentle, clear speed for SKH students
      utterance.pitch = 1.1; // Friendly and cheerful tone

      // Try to find an Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID') || v.name.toLowerCase().includes('indonesia'));
      if (idVoice) {
        utterance.voice = idVoice;
      }

      this.isSpeaking = true;
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  }
}

export const audioFeedback = new AudioFeedbackManager();
