import os
import cv2
import numpy as np
import base64
import io
from PIL import Image
from typing import Tuple, Optional, Dict, Any
from backend.app.core.config import settings

class FaceDetector:
    def __init__(self):
        self.yunet_detector = None
        self.face_cascade = None
        
        # 1. Initialize YuNet Deep Learning Detector
        if os.path.exists(settings.YUNET_MODEL_PATH):
            try:
                self.yunet_detector = cv2.FaceDetectorYN.create(
                    model=str(settings.YUNET_MODEL_PATH),
                    config="",
                    input_size=(640, 480),
                    score_threshold=0.55,
                    nms_threshold=0.3,
                    top_k=5000
                )
                print("[INFO] YuNet Deep Face Detector initialized.")
            except Exception as e:
                print(f"[WARNING] YuNet initialization error: {e}")

        # 2. Fallback Haar cascade
        try:
            if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                self.face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception as e:
            print(f"[INFO] Haar cascade fallback notice: {e}")

    def decode_base64_image(self, base64_str: str) -> Optional[np.ndarray]:
        """Decode base64 image data into OpenCV BGR numpy array."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            img_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img_np = np.array(img)
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
            return img_bgr
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return None

    def detect_face(self, img_bgr: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[Dict[str, int]], Optional[np.ndarray]]:
        """
        Detect face using YuNet (Deep Learning) or Haar Cascade fallback.
        Returns: (cropped_face, bbox_dict, raw_face_meta)
        """
        if img_bgr is None:
            return None, None, None

        img_h, img_w = img_bgr.shape[:2]

        # 1. Primary: YuNet Deep Learning Detection
        if self.yunet_detector is not None:
            try:
                self.yunet_detector.setInputSize((img_w, img_h))
                _, faces = self.yunet_detector.detect(img_bgr)
                if faces is not None and len(faces) > 0:
                    # Pick largest face
                    best_face = max(faces, key=lambda f: f[2] * f[3])
                    x, y, w, h = int(best_face[0]), int(best_face[1]), int(best_face[2]), int(best_face[3])
                    
                    # Ensure within bounds
                    x = max(0, x)
                    y = max(0, y)
                    w = min(w, img_w - x)
                    h = min(h, img_h - y)
                    
                    face_roi = img_bgr[y:y+h, x:x+w]
                    cropped = cv2.resize(face_roi, (160, 160)) if (w > 0 and h > 0) else img_bgr
                    bbox = {"x": x, "y": y, "w": w, "h": h}
                    return cropped, bbox, best_face
            except Exception as e:
                print(f"[WARNING] YuNet detection error, falling back: {e}")

        # 2. Secondary Fallback: Haar Cascade
        if self.face_cascade is not None and not self.face_cascade.empty():
            try:
                gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                gray = cv2.equalizeHist(gray)
                faces = self.face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=3,
                    minSize=(40, 40)
                )
                if len(faces) > 0:
                    largest = max(faces, key=lambda r: r[2] * r[3])
                    x, y, w, h = int(largest[0]), int(largest[1]), int(largest[2]), int(largest[3])
                    face_roi = img_bgr[y:y+h, x:x+w]
                    cropped = cv2.resize(face_roi, (160, 160))
                    bbox = {"x": x, "y": y, "w": w, "h": h}
                    return cropped, bbox, None
            except Exception as e:
                print(f"[WARNING] Haar error: {e}")

        # 3. Adaptive Center Fallback
        box_w = int(img_w * 0.45)
        box_h = int(img_h * 0.55)
        x = (img_w - box_w) // 2
        y = int(img_h * 0.15)
        face_roi = img_bgr[y:y+box_h, x:x+box_w]
        cropped = cv2.resize(face_roi, (160, 160))
        bbox = {"x": x, "y": y, "w": box_w, "h": box_h}
        return cropped, bbox, None

face_detector = FaceDetector()
