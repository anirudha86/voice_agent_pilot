import ollama
import json

class LLMManager:
    def __init__(self, model_name="qwen2.5:3b"):
        self.model_name = model_name

    def structure_report(self, transcript):
        prompt = f"""
        You are an expert medical scribe. I will provide a long-form patient dictation (it may contain repetitions or pauses). 
        Your task is to extract and structure the clinical information into a professional JSON report.
        
        Dictation: "{transcript}"

        Extract the following precisely into JSON format:
        - history: Medical history, allergies, or past procedures.
        - symptoms: Use clinical terminology where possible.
        - remedies: Diagnosis, procedures, or immediate care.
        - medications: Include dosages and frequency if mentioned.
        - outcome: Expected prognosis or progress notes.
        - next_steps: Follow-ups, referrals, or lifestyle changes.

        Return ONLY raw JSON. If details are missing, use an empty string. Be concise but medical-grade.
        """
        
        try:
            response = ollama.chat(model=self.model_name, messages=[
                {'role': 'system', 'content': 'You are a medical transcription assistant. Output only JSON.'},
                {'role': 'user', 'content': prompt}
            ])
            
            content = response['message']['content']
            # Basic JSON cleanup in case the model adds backticks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            return json.loads(content)
        except Exception as e:
            print(f"LLM Error: {e}")
            # Fallback for demo if Ollama is not running or model missing
            return {
                "history": "Error structuring report. Is Ollama running?",
                "symptoms": "",
                "remedies": "",
                "medications": "",
                "outcome": "",
                "next_steps": ""
            }

llm_manager = LLMManager()
