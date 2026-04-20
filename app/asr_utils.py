import os
from faster_whisper import WhisperModel
import tempfile

class ASRManager:
    def __init__(self, model_size="medium"):
        print(f"Loading Pretrained Faster-Whisper Model: {model_size}")
        self.whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
        self.parakeet_model = None  # Lazy load

    def transcribe(self, audio_path, engine="whisper"):
        if engine == "parakeet":
            return self.transcribe_parakeet(audio_path)
        return self.transcribe_whisper(audio_path)

    def transcribe_whisper(self, audio_path):
        segments, info = self.whisper_model.transcribe(
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

    def transcribe_parakeet(self, audio_path):
        """Separate method for Parakeet-TDT-0.6b-v3 inference."""
        if self.parakeet_model is None:
            print("Initializing NeMo Parakeet-RNNT-0.6b...")
            try:
                import nemo.collections.asr as nemo_asr
                # Parakeet-RNNT-0.6b is fully compatible with NeMo 1.21.x (Parakeet-TDT has weight bias mismatches on this version)
                self.parakeet_model = nemo_asr.models.ASRModel.from_pretrained(model_name="nvidia/parakeet-rnnt-0.6b", strict=False)
                # Move to GPU if available, though CPU is fine for 0.6b
                import torch
                if torch.cuda.is_available():
                    self.parakeet_model = self.parakeet_model.cuda()
                elif torch.backends.mps.is_available():
                    self.parakeet_model = self.parakeet_model.to("mps")
            except Exception as e:
                print(f"Error loading Parakeet model: {e}")
                return "Error: NeMo toolkit not available or model failed to load."

        # Preprocessing: NeMo is strict about formats. 
        # Browser-captured "WAVs" are often WEBM/OGG containers.
        import subprocess
        from static_ffmpeg import run
        
        processed_path = None
        try:
            # Get bundled ffmpeg path
            ffmpeg_exe, _ = run.get_or_fetch_platform_executables_else_raise()
            
            # Create a verified 16kHz mono PCM WAV
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
                processed_path = tmp_wav.name
            
            # Convert using ffmpeg - works with almost any container/codec
            cmd = [
                ffmpeg_exe, "-y", "-i", audio_path,
                "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", processed_path
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            
            # Transcribe the verified file
            transcriptions = self.parakeet_model.transcribe([processed_path])
            
            # NeMo RNNT/TDT models return (list_of_texts, list_of_raw_texts) or (list_of_texts,)
            if isinstance(transcriptions, tuple):
                texts = transcriptions[0]
            else:
                texts = transcriptions
                
            return texts[0] if texts else ""
            
        except Exception as e:
            print(f"Parakeet Preprocessing Error: {e}")
            return f"Error: Parakeet could not process audio format. {e}"
        finally:
            if processed_path and os.path.exists(processed_path):
                os.remove(processed_path)

# Singleton instance
asr_manager = ASRManager()
