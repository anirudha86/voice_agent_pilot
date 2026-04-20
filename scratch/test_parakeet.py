import os
import sys

# Ensure app is in path
sys.path.append(os.getcwd())

with open("scratch/test_result.txt", "w") as f:
    f.write("Starting test...\n")
    try:
        from app.asr_utils import asr_manager
        f.write("ASRManager imported successfully.\n")
        
        # This will trigger the lazy load
        print("Trying to initialize Parakeet model only...")
        import nemo.collections.asr as nemo_asr
        model = nemo_asr.models.ASRModel.from_pretrained(model_name="nvidia/parakeet-tdt-0.6b-v3", strict=False)
        f.write("Parakeet model loaded successfully!\n")
        
        test_file = "temp_audio/dictation_20260420_093928_ed18.wav"
        if os.path.exists(test_file):
            f.write(f"Testing transcription with file: {test_file}\n")
            # We'll use the model directly to see raw output
            import nemo.collections.asr as nemo_asr
            # We need to preprocess it manually here since we are using model directly for debug
            import subprocess
            from static_ffmpeg import run
            ffmpeg_exe, _ = run.get_or_fetch_platform_executables_else_raise()
            processed_file = "scratch/debug_processed.wav"
            cmd = [ffmpeg_exe, "-y", "-i", test_file, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", processed_file]
            subprocess.run(cmd, check=True, capture_output=True)
            
            result = model.transcribe([processed_file])
            f.write(f"Raw transcription result type: {type(result)}\n")
            f.write(f"Raw transcription result: {result}\n")
            
            if isinstance(result, tuple):
                f.write(f"Result is a tuple of length {len(result)}\n")
                f.write(f"First element: {result[0]}\n")
        else:
            f.write("Test file not found!\n")
            
    except Exception as e:
        f.write(f"Test failed: {e}\n")
        import traceback
        f.write(traceback.format_exc())
