from fastapi import FastAPI, UploadFile, File, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import shutil
import os
import uuid
import warnings
from typing import Dict

# Suppress SSL/urllib3 warnings on macOS
warnings.simplefilter('ignore') 

# Suppress SSL/urllib3 warnings on macOS
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")

from app.asr_utils import asr_manager
from app.llm_utils import llm_manager
from app.pdf_utils import generate_medical_report

app = FastAPI()

# Ensure directories exist
os.makedirs("temp_audio", exist_ok=True)
os.makedirs("reports", exist_ok=True)

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    temp_path = f"temp_audio/{uuid.uuid4()}.wav"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
    
    try:
        text = asr_manager.transcribe(temp_path)
        return {"text": text}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

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

# Serve Frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
