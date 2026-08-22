import os
import base64
import io
import numpy as np
from PIL import Image
from typing import Tuple, Optional, Dict, Any
from backend.app.core.config import settings

try:
    import cv2
    HAS_CV2 = True
except Exception as e:
    cv2 = None
    HAS_CV2 = False
    print(f"[WARNING] OpenCV unavailable in environment: {e}")

class FaceDetector:
    def __init__(self):
        self.yunet_detector = None
        self.face_cascade = None
        
        if HAS_CV2 and hasattr(cv2, 'FaceDetectorYN') and os.path.exists(settings.YUNET_MODEL_PATH):
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

        if HAS_CV2 and hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            try:
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                self.face_cascade = cv2.CascadeClassifier(cascade_path)
            except Exception as e:
                print(f"[INFO] Haar cascade fallback notice: {e}")

    def decode_base64_image(self, base64_str: str) -> Optional[np.ndarray]:
        """Decode base64 image data into BGR numpy array."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            img_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img_np = np.array(img)
            if HAS_CV2:
                img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
            else:
                # Swap RGB to BGR in numpy
                img_bgr = img_np[:, :, ::-1]
            return img_bgr
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return None

    def detect_face(self, img_bgr: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[Dict[str, int]], Optional[np.ndarray]]:
        """
        Detect face using YuNet (Deep Learning) or Haar Cascade / Center Crop fallback.
        Returns: (cropped_face, bbox_dict, raw_face_meta)
        """
        if img_bgr is None:
            return None, None, None

        img_h, img_w = img_bgr.shape[:2]

        # 1. Primary: YuNet Deep Learning Detector
        if self.yunet_detector is not None:
            try:
                self.yunet_detector.setInputSize((img_w, img_h))
                _, faces = self.yunet_detector.detect(img_bgr)
                if faces is not None and len(faces) > 0:
                    best_face = max(faces, key=lambda f: f[2] * f[3])
                    x, y, w, h = map(int, best_face[0:4])
                    x = max(0, x)
                    y = max(0, y)
                    w = min(img_w - x, w)
                    h = min(img_h - y, h)
                    
                    if w >= settings.MIN_FACE_SIZE and h >= settings.MIN_FACE_SIZE:
                        face_crop = img_bgr[y:y+h, x:x+w]
                        if HAS_CV2:
                            face_resized = cv2.resize(face_crop, (160, 160))
                        else:
                            pil_crop = Image.fromarray(face_crop).resize((160, 160))
                            face_resized = np.array(pil_crop)
                        bbox = {"x": x, "y": y, "w": w, "h": h}
                        return face_resized, bbox, best_face
            except Exception as e:
                print(f"[WARNING] YuNet runtime error, fallback to Haar: {e}")

        # 2. Secondary: Haar Cascade
        if HAS_CV2 and self.face_cascade is not None:
            try:
                gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(settings.MIN_FACE_SIZE, settings.MIN_FACE_SIZE)
                )
                if len(faces) > 0:
                    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                    x, y, w, h = faces[0]
                    padding = int(0.15 * max(w, h))
                    x1 = max(0, x - padding)
                    y1 = max(0, y - padding)
                    x2 = min(img_w, x + w + padding)
                    y2 = min(img_h, y + h + padding)
                    face_crop = img_bgr[y1:y2, x1:x2]
                    face_resized = cv2.resize(face_crop, (160, 160))
                    bbox = {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
                    return face_resized, bbox, None
            except Exception as e:
                print(f"[WARNING] Haar cascade error: {e}")

        # 3. Fallback: Center Crop
        min_dim = min(img_h, img_w)
        crop_y = max(0, (img_h - min_dim) // 2)
        crop_x = max(0, (img_w - min_dim) // 2)
        face_crop = img_bgr[crop_y:crop_y+min_dim, crop_x:crop_x+min_dim]
        if HAS_CV2:
            face_resized = cv2.resize(face_crop, (160, 160))
        else:
            pil_crop = Image.fromarray(face_crop).resize((160, 160))
            face_resized = np.array(pil_crop)
        bbox = {"x": int(crop_x), "y": int(crop_y), "w": int(min_dim), "h": int(min_dim)}
        return face_resized, bbox, None

face_detector = FaceDetector()
