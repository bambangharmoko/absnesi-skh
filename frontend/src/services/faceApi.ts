import * as faceapi from '@vladmandic/face-api';

export interface FaceDetectionResult {
  descriptor: Float32Array;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score: number;
}

export interface MatchResult {
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
  distance: number;
}

class FaceApiService {
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  async loadModels(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const MODEL_URL = '/models';
      try {
        console.log('[FaceAPI] Loading neural network models from:', MODEL_URL);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        this.isLoaded = true;
        console.log('[FaceAPI] ✅ Models loaded successfully.');
      } catch (err) {
        console.error('[FaceAPI] Failed to load models:', err);
        throw err;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Detect single face with landmarks and 128-dimensional descriptor
   */
  async detectFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult | null> {
    await this.loadModels();

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const detection = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    return {
      descriptor: detection.descriptor,
      box: { x, y, width, height },
      score: detection.detection.score,
    };
  }

  /**
   * Extract descriptor from an image (HTMLImageElement or Data URL)
   */
  async extractDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
    await this.loadModels();

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const res = await this.detectFace(img);
          resolve(res ? res.descriptor : null);
        } catch (e) {
          console.warn('[FaceAPI] Extract descriptor error:', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /**
   * Compute average centroid descriptor from multiple pose vectors
   */
  computeCentroid(descriptors: Float32Array[]): Float32Array {
    if (descriptors.length === 0) return new Float32Array(128);
    const length = descriptors[0].length;
    const centroid = new Float32Array(length);

    for (const desc of descriptors) {
      for (let i = 0; i < length; i++) {
        centroid[i] += desc[i];
      }
    }

    for (let i = 0; i < length; i++) {
      centroid[i] /= descriptors.length;
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < length; i++) {
      norm += centroid[i] * centroid[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 1e-6) {
      for (let i = 0; i < length; i++) {
        centroid[i] /= norm;
      }
    }

    return centroid;
  }

  /**
   * Match a query descriptor against enrolled student descriptors
   * Default Euclidean distance threshold is 0.55 (standard for face-api 128-d vectors)
   */
  matchFace(
    queryDescriptor: Float32Array,
    enrolledList: Array<{
      student: {
        id: string;
        nis: string;
        name: string;
        nickname: string;
        class_name: string;
        category: string;
        photo_url?: string | null;
      };
      embeddings: Float32Array[];
    }>,
    threshold = 0.52
  ): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    let minDistance = Number.MAX_VALUE;

    for (const item of enrolledList) {
      for (const enrolledVec of item.embeddings) {
        if (!enrolledVec || enrolledVec.length === 0) continue;
        const distance = faceapi.euclideanDistance(queryDescriptor, enrolledVec);

        if (distance < minDistance) {
          minDistance = distance;
          // Calculate confidence score (0.0 to 1.0)
          const confidence = Math.max(0, Math.min(1.0, 1.0 - (distance / 0.8)));
          bestMatch = {
            student: item.student,
            confidence: Math.round(confidence * 100) / 100,
            distance: Math.round(distance * 1000) / 1000,
          };
        }
      }
    }

    if (bestMatch && minDistance <= threshold) {
      return bestMatch;
    }

    return null;
  }
}

export const faceApi = new FaceApiService();
