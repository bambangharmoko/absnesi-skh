import os
import cv2
import numpy as np
from typing import List, Optional
from backend.app.core.config import settings

class FaceEmbedder:
    """
    Extracts L2-normalized Deep Face Representation (128-dimensional embedding vector)
    using OpenCV's official SFace Deep Neural Network model.
    """
    def __init__(self):
        self.sface_recognizer = None
        if os.path.exists(settings.SFACE_MODEL_PATH):
            try:
                self.sface_recognizer = cv2.FaceRecognizerSF.create(
                    model=str(settings.SFACE_MODEL_PATH),
                    config=""
                )
                print("[INFO] SFace Deep Learning Face Recognizer initialized.")
            except Exception as e:
                print(f"[WARNING] SFace initialization error: {e}")

    def extract_embedding(self, img_bgr: np.ndarray, face_meta: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Extract 128-d L2 normalized deep feature vector.
        Uses landmark-aligned crop if face_meta is provided, or processes the cropped face directly.
        """
        if img_bgr is None:
            return np.zeros(128, dtype=np.float32)

        # 1. Primary: SFace Deep Neural Feature Extractor
        if self.sface_recognizer is not None:
            try:
                if face_meta is not None:
                    # Mathematical 5-point landmark alignment (eyes, nose, mouth corners)
                    aligned = self.sface_recognizer.alignCrop(img_bgr, face_meta)
                    feat = self.sface_recognizer.feature(aligned)
                else:
                    # Direct extraction from face image (ensure 112x112 standard input for SFace)
                    face_input = cv2.resize(img_bgr, (112, 112))
                    feat = self.sface_recognizer.feature(face_input)

                # SFace outputs (1, 128) array
                emb = feat.flatten().astype(np.float32)
                # L2 normalize
                norm = np.linalg.norm(emb)
                if norm > 1e-6:
                    return emb / norm
                return emb
            except Exception as e:
                print(f"[WARNING] SFace feature extraction error, using fallback: {e}")

        # 2. Fallback Feature Vector
        gray = cv2.cvtColor(cv2.resize(img_bgr, (160, 160)), cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        vec = cv2.resize(gray, (16, 8)).flatten().astype(np.float32) / 255.0
        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            return (vec / norm).astype(np.float32)
        return vec

    def compute_centroid(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """
        Compute mean centroid embedding from multiple enrollment poses and re-normalize.
        """
        if not embeddings:
            return np.zeros(128, dtype=np.float32)

        arr = np.array(embeddings, dtype=np.float32)
        mean_vec = np.mean(arr, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 1e-6:
            return (mean_vec / norm).astype(np.float32)
        return mean_vec

face_embedder = FaceEmbedder()
