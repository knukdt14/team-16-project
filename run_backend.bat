@echo off
call .\.venv\Scripts\activate.bat
cd backend
python -m uvicorn main:app --reload --port 8000
