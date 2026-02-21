@echo off
echo ====================================
echo PDF Tool 功能驗證
echo ====================================
echo.

echo [1] 啟動後端 API 測試
echo [2] 啟動前端開發伺服器
echo [3] 同時啟動前後端
echo [4] 執行自動化測試
echo.

set /p choice="請選擇 (1-4): "

if "%choice%"=="1" (
    echo.
    echo 啟動後端測試...
    cd backend
    python test_apis.py
    pause
)

if "%choice%"=="2" (
    echo.
    echo 啟動前端 (http://localhost:4000)...
    cd frontend
    npm run dev
)

if "%choice%"=="3" (
    echo.
    echo 啟動後端 (http://localhost:8001)...
    start cmd /k "cd backend && python main.py"
    timeout /t 3
    echo 啟動前端 (http://localhost:4000)...
    start cmd /k "cd frontend && npm run dev"
    echo.
    echo 前後端已啟動！
    echo - 後端 API: http://localhost:8001/docs
    echo - 前端介面: http://localhost:4000
    echo.
    pause
)

if "%choice%"=="4" (
    echo.
    echo 執行自動化 API 測試...
    echo 請確保後端已啟動 (http://localhost:8001)
    echo.
    cd backend
    python test_apis.py
    pause
)
