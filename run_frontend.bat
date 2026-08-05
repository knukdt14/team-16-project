@echo off
call .\.venv\Scripts\activate.bat
cd frontend
python -m streamlit run app.py
