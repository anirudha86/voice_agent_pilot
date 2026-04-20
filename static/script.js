class AuraApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.timerInterval = null;
        this.seconds = 0;
        this.speechRecognition = null;
        this.completedText = '';
        this.lastTranscript = '';
        this.isProcessingLive = false;

        // State
        this.patients = [];
        this.doctors = [];
        this.consultations = [];

        // DOM - Views
        this.views = document.querySelectorAll('.view');
        this.navItems = document.querySelectorAll('.nav-item');

        // DOM - Consultation
        this.btnRecord = document.getElementById('btn-record');
        this.btnProcess = document.getElementById('btn-process');
        this.btnClear = document.getElementById('btn-clear');
        this.btnGeneratePdf = document.getElementById('btn-generate-pdf');
        this.timerDisplay = document.getElementById('recording-timer');
        this.statusDisplay = document.getElementById('dictation-status');
        this.liveTranscript = document.getElementById('live-transcript');
        this.visualizer = document.getElementById('audio-visualizer');
        this.canvasCtx = this.visualizer.getContext('2d');
        this.selectDoctor = document.getElementById('select-doctor');
        this.selectPatient = document.getElementById('select-patient');

        // DOM - History
        this.historyTableBody = document.querySelector('#history-table tbody');
        this.filterDoctor = document.getElementById('filter-doctor');

        // DOM - Forms
        this.formDoctor = document.getElementById('form-doctor');
        this.formPatient = document.getElementById('form-patient');

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

    async init() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });

        // Consultation Events
        this.btnRecord.addEventListener('click', () => this.toggleRecording());
        this.btnProcess.addEventListener('click', () => this.processTranscription());
        this.btnClear.addEventListener('click', () => this.clearTranscript());
        this.btnGeneratePdf.addEventListener('click', () => this.generatePdf());
        
        // Registration Events
        this.formDoctor.addEventListener('submit', (e) => this.handleDoctorRegistration(e));
        this.formPatient.addEventListener('submit', (e) => this.handlePatientRegistration(e));

        // Filtering
        this.filterDoctor.addEventListener('change', () => this.renderHistory());

        // Initial Data Fetch
        await this.loadInitialData();
        
        // Activate initial view
        this.switchView('view-consultation');
        
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    switchView(viewId) {
        if (!viewId) return;
        this.views.forEach(v => v.classList.toggle('active', v.id === viewId));
        this.navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewId));

        if (viewId === 'view-history') {
            this.loadHistory();
        }
    }
    
    getSelectedEngine() {
        const checked = document.querySelector('input[name="asr-engine"]:checked');
        return checked ? checked.value : 'whisper';
    }

    async loadInitialData() {
        try {
            const [docs, pats] = await Promise.all([
                fetch('/api/doctors').then(r => r.json()),
                fetch('/api/patients').then(r => r.json())
            ]);
            this.doctors = docs;
            this.patients = pats;
            this.updateDropdowns();
        } catch (err) {
            this.notify('Failed to load initial data', 'danger');
        }
    }

    updateDropdowns() {
        const docOptions = '<option value="">Select a Doctor...</option>' + 
            this.doctors.map(d => `<option value="${d.id}">${d.name} (${d.speciality})</option>`).join('');
        this.selectDoctor.innerHTML = docOptions;
        this.filterDoctor.innerHTML = '<option value="">All Doctors</option>' + 
            this.doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

        const patOptions = '<option value="">Select a Patient...</option>' + 
            this.patients.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        this.selectPatient.innerHTML = patOptions;

        // Enable record button if both selected
        const checkSelection = () => {
            this.btnRecord.disabled = !(this.selectDoctor.value && this.selectPatient.value);
            this.statusDisplay.textContent = this.btnRecord.disabled ? 'Select doctor & patient to start...' : 'Ready to record';
        };
        this.selectDoctor.addEventListener('change', checkSelection);
        this.selectPatient.addEventListener('change', checkSelection);
    }

    async handleDoctorRegistration(e) {
        e.preventDefault();
        const formData = new FormData(this.formDoctor);
        const response = await fetch('/api/doctors', { method: 'POST', body: formData });
        if (response.ok) {
            this.notify('Doctor registered!', 'success');
            this.formDoctor.reset();
            await this.loadInitialData();
        }
    }

    async handlePatientRegistration(e) {
        e.preventDefault();
        const formData = new FormData(this.formPatient);
        const response = await fetch('/api/patients', { method: 'POST', body: formData });
        if (response.ok) {
            this.notify('Patient registered!', 'success');
            this.formPatient.reset();
            await this.loadInitialData();
        }
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/consultations');
            this.consultations = await response.json();
            this.renderHistory();
        } catch (err) {
            this.notify('Failed to load history', 'danger');
        }
    }

    renderHistory() {
        const filterId = this.filterDoctor.value;
        const filtered = filterId ? this.consultations.filter(c => c.doctor_id == filterId) : this.consultations;

        this.historyTableBody.innerHTML = filtered.map(c => `
            <tr>
                <td>${new Date(c.timestamp).toLocaleString()}</td>
                <td>${c.patient_name}</td>
                <td>${c.doctor_name}</td>
                <td>
                    <textarea class="history-transcript" readonly>${c.transcript}</textarea>
                </td>
                <td>
                    <audio controls src="/${c.audio_path}" class="history-audio"></audio>
                </td>
            </tr>
        `).join('');
    }

    // --- Core Voice Interaction (Modified) ---

    async startRecording() {
        this.completedText = this.liveTranscript.textContent.trim();
        this.lastTranscript = '';
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => this.audioChunks.push(event.data);
            this.mediaRecorder.onstop = () => this.handleRecordingStop();

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.btnRecord.classList.add('recording');
            this.statusDisplay.textContent = 'Recording...';
            this.startTimer();
            this.startVisualizer(stream);
            this.startWebSpeech();
            this.notify('Recording started...', 'info');
        } catch (err) {
            this.notify('Microphone access denied', 'danger');
        }
    }

    async handleRecordingStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('engine', this.getSelectedEngine());
        formData.append('patient_id', this.selectPatient.value);
        formData.append('doctor_id', this.selectDoctor.value);

        this.statusDisplay.textContent = 'Saving Consultation...';

        try {
            const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.text) {
                const separator = this.completedText ? ' ' : '';
                this.liveTranscript.textContent = this.completedText + separator + data.text;
                this.statusDisplay.textContent = 'Ready for next dictation';
                this.btnProcess.disabled = false;
            }
        } catch (err) {
            this.notify('Failed to save consultation', 'danger');
        }
    }

    // --- Existing Utilities (Timer, Visualizer, LLM, PDF) ---

    startWebSpeech() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) this.lastTranscript += event.results[i][0].transcript + ' ';
                else interim += event.results[i][0].transcript;
            }
            const separator = this.completedText ? ' ' : '';
            this.liveTranscript.textContent = this.completedText + separator + this.lastTranscript + interim;
        };
        this.speechRecognition.start();
    }

    async toggleRecording() {
        if (!this.isRecording) await this.startRecording();
        else this.stopRecording();
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.btnRecord.classList.remove('recording');
            this.stopTimer();
            if (this.speechRecognition) this.speechRecognition.stop();
        }
    }

    async processTranscription() {
        const text = this.liveTranscript.textContent.trim();
        if (!text) return;
        this.statusDisplay.textContent = 'Structuring Report...';
        const response = await fetch('/api/structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const sections = await response.json();
        for (const [key, value] of Object.entries(sections)) {
            if (this.reportFields[key]) this.reportFields[key].value = value;
        }
        this.btnGeneratePdf.disabled = false;
        this.statusDisplay.textContent = 'Report ready';
    }

    async generatePdf() {
        const data = {};
        for (const [k, v] of Object.entries(this.reportFields)) data[k] = v.value;
        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'Medical_Report.pdf'; a.click();
        }
    }

    clearTranscript() {
        this.liveTranscript.textContent = '';
        this.lastTranscript = '';
        this.completedText = '';
        Object.values(this.reportFields).forEach(f => f.value = '');
    }

    startTimer() {
        this.seconds = 0;
        this.timerInterval = setInterval(() => {
            this.seconds++;
            const m = Math.floor(this.seconds / 60).toString().padStart(2, '0');
            const s = (this.seconds % 60).toString().padStart(2, '0');
            this.timerDisplay.textContent = `${m}:${s}`;
        }, 1000);
    }

    stopTimer() { clearInterval(this.timerInterval); }

    startVisualizer(stream) {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
            if (!this.isRecording) return;
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(data);
            this.canvasCtx.fillStyle = '#0f172a';
            this.canvasCtx.fillRect(0, 0, this.visualizer.width, this.visualizer.height);
            const w = (this.visualizer.width / data.length) * 2.5;
            let x = 0;
            for (let i = 0; i < data.length; i++) {
                const h = (data[i] / 255) * this.visualizer.height;
                this.canvasCtx.fillStyle = `rgb(45, 90, 247)`;
                this.canvasCtx.fillRect(x, this.visualizer.height - h, w, h);
                x += w + 1;
            }
        };
        draw();
    }

    resizeCanvas() {
        this.visualizer.width = this.visualizer.offsetWidth;
        this.visualizer.height = this.visualizer.offsetHeight;
    }

    notify(m, t) {
        const c = document.getElementById('notification-container');
        const n = document.createElement('div');
        n.className = `notification ${t}`;
        n.textContent = m;
        c.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new AuraApp());
