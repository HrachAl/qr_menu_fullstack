@echo off
echo =========================================
echo     Power on
echo =========================================

echo [1/2] Check...
python -m pip install -r requirements.txt -q

echo [2/2] Power on...
echo Open http://127.0.0.1:8000
echo (To power off press Ctrl+C)

python -m uvicorn main:app --host 127.0.0.1 --port 8000
pause