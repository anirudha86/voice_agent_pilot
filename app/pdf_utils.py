from fpdf import FPDF
from datetime import datetime

class MedicalPDF(FPDF):
    def header(self):
        # Logo placeholder or icon
        self.set_fill_color(15, 23, 42) # Sidebar color
        self.rect(0, 0, 210, 30, 'F')
        
        self.set_font('Helvetica', 'B', 20)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, 'Aura Medical - Clinical Note', ln=True, align='L')
        
        self.set_font('Helvetica', '', 10)
        self.cell(0, 5, f'Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M")}', ln=True, align='L')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Page {self.page_no()} - Confidential Medical Document', align='C')

def generate_medical_report(data, output_path):
    pdf = MedicalPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    sections = [
        ("Patient History", "history"),
        ("Symptoms", "symptoms"),
        ("Diagnosis & Remedies", "remedies"),
        ("Medications", "medications"),
        ("Outcome", "outcome"),
        ("Next Steps / Follow-up", "next_steps"),
    ]
    
    for title, key in sections:
        content = data.get(key, "").strip()
        if not content:
            content = "Non-contributory / Not specified"
            
        pdf.set_font('Helvetica', 'B', 14)
        pdf.set_text_color(45, 90, 247) # Primary blue
        pdf.cell(0, 10, title, ln=True)
        
        pdf.set_font('Helvetica', '', 11)
        pdf.set_text_color(30, 41, 59) # Slate text
        pdf.multi_cell(0, 8, content)
        pdf.ln(5)
        
        # Draw a subtle line
        pdf.set_draw_color(226, 232, 240)
        pdf.line(pdf.get_x(), pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)

    pdf.output(output_path)
    return output_path
