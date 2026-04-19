import os
from faster_whisper import WhisperModel
import tempfile

class ASRManager:
    def __init__(self, model_size="medium"):
        # Using faster-whisper for maximum performance and speed
        # This uses the official pretrained 'medium' model
        print(f"Loading Pretrained Faster-Whisper Model: {model_size}")
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")

    def transcribe(self, audio_path):
        # Optimized for medical dictation with VAD and context conditioning
        segments, info = self.model.transcribe(
            audio_path, 
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            condition_on_previous_text=True
        )
        
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)
            
        return "".join(text_parts).strip()

# Singleton instance
asr_manager = ASRManager()
