import sqlite3
import os
from datetime import datetime

DB_PATH = "voice_agent.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Doctors Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        speciality TEXT NOT NULL
    )
    ''')
    
    # Patients Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        registered_on TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Consultations Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        doctor_id INTEGER,
        timestamp TEXT,
        audio_path TEXT,
        transcript TEXT,
        pdf_path TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Doctor Operations
def add_doctor(name, speciality):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO doctors (name, speciality) VALUES (?, ?)", (name, speciality))
    conn.commit()
    doc_id = cursor.lastrowid
    conn.close()
    return doc_id

def get_doctors():
    conn = get_db_connection()
    doctors = conn.execute("SELECT * FROM doctors").fetchall()
    conn.close()
    return [dict(doc) for doc in doctors]

# Patient Operations
def add_patient(name, address, contact):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO patients (name, address, contact) VALUES (?, ?, ?)", 
                   (name, address, contact))
    conn.commit()
    pat_id = cursor.lastrowid
    conn.close()
    return pat_id

def get_patients():
    conn = get_db_connection()
    patients = conn.execute("SELECT * FROM patients").fetchall()
    conn.close()
    return [dict(p) for p in patients]

# Consultation Operations
def add_consultation(patient_id, doctor_id, audio_path, transcript, pdf_path=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute('''
        INSERT INTO consultations (patient_id, doctor_id, timestamp, audio_path, transcript, pdf_path)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (patient_id, doctor_id, timestamp, audio_path, transcript, pdf_path))
    conn.commit()
    conn.close()

def get_consultations(doctor_id=None):
    conn = get_db_connection()
    query = '''
        SELECT c.*, p.name as patient_name, d.name as doctor_name 
        FROM consultations c
        JOIN patients p ON c.patient_id = p.id
        JOIN doctors d ON c.doctor_id = d.id
    '''
    if doctor_id:
        consultations = conn.execute(query + " WHERE c.doctor_id = ?", (doctor_id,)).fetchall()
    else:
        consultations = conn.execute(query).fetchall()
    conn.close()
    return [dict(c) for c in consultations]
