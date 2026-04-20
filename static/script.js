class VoiceAgent {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.timerInterval = null;
        this.seconds = 0;
        this.liveInterval = null;
        this.lastTranscript = '';
        this.isProcessingLive = false;
        this.speechRecognition = null;
        this.completedText = '';
        
        // DOM Elements
        this.btnRecord = document.getElementById('btn-record');
        this.btnProcess = document.getElementById('btn-process');
        this.btnClear = document.getElementById('btn-clear');
        this.btnGeneratePdf = document.getElementById('btn-generate-pdf');
        this.timerDisplay = document.getElementById('recording-timer');
        this.statusDisplay = document.getElementById('dictation-status');
        this.liveTranscript = document.getElementById('live-transcript');
        this.visualizer = document.getElementById('audio-visualizer');
        this.canvasCtx = this.visualizer.getContext('2d');
        
        // Report Fields
        this.reportFields = {
            history: document.getElementById('history'),
            symptoms: document.getElementById('symptoms'),
            remedies: document.getElementById('remedies'),
            medications: document.getElementById('medications'),
            outcome: document.getElementById('outcome'),
            next_steps: document.getElementById('next_steps')
        };

        this.init();
    }

    init() {
        this.btnRecord.addEventListener('click', () => this.toggleRecording());
        this.btnProcess.addEventListener('click', () => this.processTranscription());
        this.btnClear.addEventListener('click', () => this.clearTranscript());
        this.btnGeneratePdf.addEventListener('click', () => this.generatePdf());
        
        const audioUpload = document.getElementById('audio-upload');
        audioUpload.addEventListener('change', (e) => this.handleFileUpload(e));

        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    getSelectedEngine() {
        const selected = document.querySelector('input[name="asr-engine"]:checked');
        return selected ? selected.value : 'whisper';
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.statusDisplay.textContent = 'Uploading and transcribing...';
        this.notify('Processing long-form audio...', 'info');

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('engine', this.getSelectedEngine());

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.text) {
                this.liveTranscript.textContent += (this.liveTranscript.textContent ? '\n\n' : '') + data.text;
                this.statusDisplay.textContent = 'Upload complete';
                this.btnProcess.disabled = false;
                this.notify('Transcription complete', 'success');
            }
        } catch (err) {
            console.error('Upload error:', err);
            this.notify('Failed to process file', 'danger');
        }
    }

    resizeCanvas() {
        this.visualizer.width = this.visualizer.offsetWidth;
        this.visualizer.height = this.visualizer.offsetHeight;
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        this.completedText = this.liveTranscript.textContent.trim();
        this.lastTranscript = '';
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
                // In a real app, we would stream chunks to backend here
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.btnRecord.classList.add('recording');
            this.statusDisplay.textContent = 'Recording...';
            this.startTimer();
            this.startVisualizer(stream);
            this.startWebSpeech();
            this.notify('Recording started...', 'info');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            this.notify('Microphone access denied', 'danger');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.btnRecord.classList.remove('recording');
            this.statusDisplay.textContent = 'Paused';
            this.stopTimer();
            if (this.speechRecognition) this.speechRecognition.stop();
            this.btnProcess.disabled = false;
        }
    }

    startWebSpeech() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';

        this.speechRecognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    this.lastTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Update UI instantly with rough draft, maintaining previous session text
            const separator = this.completedText ? ' ' : '';
            this.liveTranscript.textContent = this.completedText + separator + this.lastTranscript + interimTranscript;
        };

        this.speechRecognition.start();
    }


    async handleRecordingStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.statusDisplay.textContent = 'Processing audio...';
        
        // Send to backend for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('engine', this.getSelectedEngine());

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.text) {
                const separator = this.completedText ? ' ' : '';
                this.liveTranscript.textContent = this.completedText + separator + data.text;
                this.statusDisplay.textContent = 'Ready for next dictation';
                this.notify('Transcription complete', 'success');
            }
        } catch (err) {
            console.error('Transcription error:', err);
            this.notify('Transcription failed', 'danger');
            this.statusDisplay.textContent = 'Error processing audio';
        }
    }

    async processTranscription() {
        const text = this.liveTranscript.textContent.trim();
        if (!text) return;

        this.statusDisplay.textContent = 'Analyzing and structuring...';
        this.btnProcess.disabled = true;

        try {
            const response = await fetch('/api/structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            const sections = await response.json();
            
            // Populate report fields
            for (const [key, value] of Object.entries(sections)) {
                if (this.reportFields[key]) {
                    this.reportFields[key].value = value;
                }
            }
            
            this.btnGeneratePdf.disabled = false;
            this.statusDisplay.textContent = 'Report ready';
            this.notify('Report structured successfully', 'success');
        } catch (err) {
            console.error('Structuring error:', err);
            this.notify('Failed to structure report', 'danger');
        } finally {
            this.btnProcess.disabled = false;
        }
    }

    async generatePdf() {
        const reportData = {};
        for (const [key, element] of Object.entries(this.reportFields)) {
            reportData[key] = element.value;
        }

        try {
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Medical_Report_${new Date().getTime()}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                this.notify('PDF generated successfully', 'success');
            }
        } catch (err) {
            console.error('PDF error:', err);
            this.notify('Failed to generate PDF', 'danger');
        }
    }

    clearTranscript() {
        this.liveTranscript.textContent = '';
        this.lastTranscript = '';
        this.completedText = '';
        this.btnProcess.disabled = true;
        this.btnGeneratePdf.disabled = true;
        for (let key in this.reportFields) {
            this.reportFields[key].value = '';
        }
        this.notify('Cleared session', 'info');
    }

    startTimer() {
        this.seconds = 0;
        this.timerDisplay.textContent = '00:00';
        this.timerInterval = setInterval(() => {
            this.seconds++;
            const mins = Math.floor(this.seconds / 60).toString().padStart(2, '0');
            const secs = (this.seconds % 60).toString().padStart(2, '0');
            this.timerDisplay.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }

    startVisualizer(stream) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isRecording) return;
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            this.canvasCtx.fillStyle = '#0f172a';
            this.canvasCtx.fillRect(0, 0, this.visualizer.width, this.visualizer.height);

            const barWidth = (this.visualizer.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * this.visualizer.height;
                const r = 45 + (i * 2);
                const g = 90 + (i * 1);
                const b = 247;
                
                this.canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
                this.canvasCtx.fillRect(x, this.visualizer.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    }

    notify(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        
        container.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VoiceAgent();
});
