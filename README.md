# Aura Medical Voice Agent 🩺🎙️

A premium, local-first Voice Agent for doctors, powered by **Local Qwen Intelligence**. Built for privacy, speed, and precision.

## Features
- **Voice Dictation**: Continuously record or pause as needed.
- **Real-time Visualization**: Audio waveform for visual feedback.
- **Full Precision Medical AI**: Powered by the original `Johnyquest7/whisper-small-finetuned-medical3` (Original weights, No quantization for maximum accuracy).
- **AI Structuring**: Uses `Qwen 2.5` (via Ollama) to automatically categorize dictation.
- **Professional PDF**: One-click generation of branded medical reports.

## Prerequisites
1. **Python 3.9+**
2. **Ollama**: [Download Ollama](https://ollama.com/) and run:
   ```bash
   ollama pull qwen2.5:3b
   ```

## Setup & Run
1. **Create and Activate Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Agent**:
   ```bash
   python3 -m app.main
   ```

3. **Access the App**:
   Open [http://localhost:8001](http://localhost:8001) in your browser.

## Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (Premium Design), JS.
- **Backend**: FastAPI (Python).
- **AI Model**: Qwen 2.5 (Local LLM) & Whisper (ASR).
- **PDF Engine**: FPDF2.

---
*Note: This application process everything locally on your machine. No data leaves your workstation.*
