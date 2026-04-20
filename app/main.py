from fastapi import FastAPI, UploadFile, File, Body, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import shutil
import os
import uuid
import warnings
import subprocess
from typing import Dict
from static_ffmpeg import run

# Suppress SSL/urllib3 warnings on macOS
warnings.simplefilter('ignore') 
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")

try:
    from app.asr_utils import asr_manager
    from app.llm_utils import llm_manager
    from app.pdf_utils import generate_medical_report
    from app.database import init_db, add_doctor, get_doctors, add_patient, get_patients, add_consultation, get_consultations
except (ImportError, ModuleNotFoundError):
    from asr_utils import asr_manager
    from llm_utils import llm_manager
    from pdf_utils import generate_medical_report
    from database import init_db, add_doctor, get_doctors, add_patient, get_patients, add_consultation, get_consultations

app = FastAPI()

# Initialize DB on startup
init_db()

# Ensure directories exist
os.makedirs("temp_audio", exist_ok=True)
os.makedirs("reports", exist_ok=True)

# Patient Endpoints
@app.get("/api/patients")
async def fetch_patients():
    return get_patients()

@app.post("/api/patients")
async def register_patient(name: str = Form(...), address: str = Form(""), contact: str = Form("")):
    pat_id = add_patient(name, address, contact)
    return {"id": pat_id, "message": "Patient registered successfully"}

# Doctor Endpoints
@app.get("/api/doctors")
async def fetch_doctors():
    return get_doctors()

@app.post("/api/doctors")
async def register_doctor(name: str = Form(...), speciality: str = Form(...)):
    doc_id = add_doctor(name, speciality)
    return {"id": doc_id, "message": "Doctor registered successfully"}

# Consultation History
@app.get("/api/consultations")
async def fetch_consultations(doctor_id: int = None):
    return get_consultations(doctor_id)

@app.post("/api/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...), 
    engine: str = Form("whisper"),
    patient_id: int = Form(...),
    doctor_id: int = Form(...)
):
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = uuid.uuid4().hex[:4]
    
    # We'll save the raw upload first
    raw_path = f"temp_audio/raw_{timestamp}_{uid}"
    final_path = f"temp_audio/dictation_{timestamp}_{uid}.wav"
    
    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
    
    try:
        # Convert to standard WAV (16kHz Mono PCM) for reliable playback and ASR
        ffmpeg_exe, _ = run.get_or_fetch_platform_executables_else_raise()
        cmd = [
            ffmpeg_exe, "-y", "-i", raw_path,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", final_path
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        if os.path.exists(raw_path): 
            os.remove(raw_path)
        
        # Transcribe using the converted file
        text = asr_manager.transcribe(final_path, engine=engine)
        
        # Store consultation record
        add_consultation(patient_id, doctor_id, final_path, text)
        return {"text": text, "saved_at": final_path}
    except Exception as e:
        if os.path.exists(raw_path): os.remove(raw_path)
        print(f"Transcription/Conversion error: {e}")
        return {"error": str(e)}

@app.post("/api/structure")
async def structure_content(payload: Dict = Body(...)):
    text = payload.get("text", "")
    sections = llm_manager.structure_report(text)
    return sections

@app.post("/api/generate-pdf")
async def create_pdf(data: Dict = Body(...)):
    report_id = str(uuid.uuid4())
    pdf_path = f"reports/report_{report_id}.pdf"
    generate_medical_report(data, pdf_path)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"Medical_Report_{report_id}.pdf")

# Serve Directories & Frontend
app.mount("/temp_audio", StaticFiles(directory="temp_audio"), name="temp_audio")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
