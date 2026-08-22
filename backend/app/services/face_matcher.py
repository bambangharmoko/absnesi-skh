import numpy as np
import json
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.app.db.models import Student, FaceEmbedding
from backend.app.core.config import settings

class FaceMatcher:
    def __init__(self, threshold: float = settings.SIMILARITY_THRESHOLD):
        self.threshold = threshold

    def cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Calculate cosine similarity between two L2-normalized vectors."""
        dot = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a < 1e-6 or norm_b < 1e-6:
            return 0.0
        similarity = dot / (norm_a * norm_b)
        return float(np.clip(similarity, -1.0, 1.0))

    def map_confidence_percentage(self, raw_score: float) -> float:
        """
        Map SFace cosine score (typically 0.35 to 0.85) to an intuitive confidence percentage (0.70 to 0.99).
        """
        if raw_score <= 0:
            return 0.0
        # Normalize: 0.35 -> 0.70, 0.50 -> 0.85, 0.70+ -> 0.96+
        mapped = 0.70 + (raw_score - self.threshold) * 0.75
        return float(np.clip(mapped, 0.0, 0.99))

    def match_face(self, face_embedding: np.ndarray, db: Session, class_filter: Optional[str] = None) -> Tuple[Optional[Student], float]:
        """
        Match a face embedding against all active students in the database.
        Returns: (matched_student, confidence_score) or (None, best_score)
        """
        query = db.query(Student).filter(Student.is_active == True)
        if class_filter and class_filter.lower() != "all":
            query = query.filter(Student.class_name == class_filter)
        
        students = query.all()
        if not students:
            return None, 0.0

        best_raw_score = -1.0
        best_student = None

        for student in students:
            if not student.embeddings:
                continue
            
            # Check against all student embeddings (multi-pose + centroid)
            for emb_record in student.embeddings:
                try:
                    stored_vector = np.array(json.loads(emb_record.embedding_vector), dtype=np.float32)
                    sim = self.cosine_similarity(face_embedding, stored_vector)
                    if sim > best_raw_score:
                        best_raw_score = sim
                        best_student = student
                except Exception as e:
                    print(f"Error parsing embedding for student {student.id}: {e}")
                    continue

        if best_student and best_raw_score >= self.threshold:
            conf_pct = self.map_confidence_percentage(best_raw_score)
            return best_student, conf_pct
        else:
            return None, max(0.0, self.map_confidence_percentage(best_raw_score))

face_matcher = FaceMatcher()
