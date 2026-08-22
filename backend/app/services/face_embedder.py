import os
import numpy as np
from PIL import Image, ImageOps
from typing import List, Optional
from backend.app.core.config import settings

try:
    import cv2
    HAS_CV2 = True
except Exception as e:
    cv2 = None
    HAS_CV2 = False
    print(f"[WARNING] OpenCV unavailable in embedder: {e}")

class FaceEmbedder:
    """
    Extracts L2-normalized Deep Face Representation (128-dimensional embedding vector)
    using OpenCV's official SFace Deep Neural Network model or Pure-Python fallback.
    """
    def __init__(self):
        self.sface_recognizer = None
        if HAS_CV2 and hasattr(cv2, 'FaceRecognizerSF') and os.path.exists(settings.SFACE_MODEL_PATH):
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
        """
        if img_bgr is None:
            return np.zeros(128, dtype=np.float32)

        # 1. Primary: SFace Deep Neural Feature Extractor
        if HAS_CV2 and self.sface_recognizer is not None:
            try:
                if face_meta is not None:
                    aligned = self.sface_recognizer.alignCrop(img_bgr, face_meta)
                    feat = self.sface_recognizer.feature(aligned)
                else:
                    face_input = cv2.resize(img_bgr, (112, 112))
                    feat = self.sface_recognizer.feature(face_input)

                emb = feat.flatten().astype(np.float32)
                norm = np.linalg.norm(emb)
                if norm > 1e-6:
                    return emb / norm
                return emb
            except Exception as e:
                print(f"[WARNING] SFace feature extraction error, using fallback: {e}")

        # 2. Resilient Pure-Python / Pillow / Numpy Feature Extractor (128-dimensional)
        try:
            if HAS_CV2:
                gray = cv2.cvtColor(cv2.resize(img_bgr, (160, 160)), cv2.COLOR_BGR2GRAY)
                gray = cv2.equalizeHist(gray)
                vec = cv2.resize(gray, (16, 8)).flatten().astype(np.float32) / 255.0
            else:
                pil_img = Image.fromarray(img_bgr).convert("L")
                pil_img = ImageOps.equalize(pil_img).resize((16, 8), Image.Resampling.BILINEAR)
                vec = np.array(pil_img, dtype=np.float32).flatten() / 255.0
            norm = np.linalg.norm(vec)
            if norm > 1e-6:
                return (vec / norm).astype(np.float32)
            return vec
        except Exception as fallback_err:
            print(f"[ERROR] Embedding fallback: {fallback_err}")
            return np.zeros(128, dtype=np.float32)

    def compute_centroid(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """
        Compute mean centroid embedding from multiple enrollment poses and re-normalize.
        """
        if not embeddings:
            return np.zeros(128, dtype=np.float32)
        valid = [e for e in embeddings if np.linalg.norm(e) > 1e-6]
        if not valid:
            return np.zeros(128, dtype=np.float32)
        mean_vec = np.mean(valid, axis=0).astype(np.float32)
        norm = np.linalg.norm(mean_vec)
        if norm > 1e-6:
            return mean_vec / norm
        return mean_vec

face_embedder = FaceEmbedder()
