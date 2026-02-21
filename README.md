# PDFTool - 免費線上 PDF 工具

> 100% 開源的 PDF 處理服務，功能完整的線上 PDF 工具

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-14-black.svg)

## 功能特色

### 📄 基礎操作
- **合併 PDF** - 將多個 PDF 合併成一個
- **分割 PDF** - 將 PDF 分割成多個檔案
- **旋轉頁面** - 旋轉 PDF 頁面方向
- **刪除頁面** - 刪除 PDF 中的特定頁面
- **壓縮 PDF** - 減少 PDF 檔案大小

### 🔄 格式轉換
- **PDF ↔ Word** - PDF 與 Word 互轉
- **PDF ↔ Excel** - PDF 與 Excel 互轉
- **PDF ↔ PPT** - PDF 與 PowerPoint 互轉
- **PDF ↔ 圖片** - PDF 與圖片互轉
- **PDF → HTML** - PDF 轉 HTML

### 👁️ OCR 文字辨識
- **文字辨識** - 從掃描件或圖片辨識文字
- **可搜尋 PDF** - 將掃描 PDF 轉為可搜尋
- 支援中文、英文、日文、韓文

### ✏️ 編輯功能
- **編輯文字** - 修改 PDF 中的文字內容
- **插入圖片** - 在 PDF 中加入圖片
- **新增連結** - 在 PDF 中加入超連結
- **取代文字** - 批次取代 PDF 中的文字

### ✍️ 簽名表單
- **電子簽名** - 在 PDF 上加入電子簽名
- **表單欄位** - 建立可填寫的表單欄位
- **填寫表單** - 填寫 PDF 表單

### 🔒 安全保護
- **加密 PDF** - 為 PDF 設定密碼保護
- **解密 PDF** - 移除 PDF 密碼保護
- **浮水印** - 在 PDF 上加入浮水印
- **遮蔽資訊** - 永久移除敏感內容

### 🚀 進階功能
- **PDF/A 轉換** - 轉為長期保存格式
- **比較文件** - 比較兩個 PDF 的差異
- **Bates 編號** - 新增法律文件編號
- **頁首頁尾** - 新增頁首頁尾和頁碼
- **註解管理** - 新增或移除註解

## 技術棧

### 後端
- **FastAPI** - 高效能 Python Web 框架
- **PyMuPDF** - PDF 處理核心
- **PaddleOCR** - 文字辨識引擎
- **LibreOffice** - 文件格式轉換
- **pyHanko** - PDF 簽名

### 前端
- **Next.js 14** - React 框架
- **Tailwind CSS** - 樣式框架
- **Lucide Icons** - 圖示庫
- **React Dropzone** - 拖放上傳

## 快速開始

### 使用 Docker（推薦）

```bash
# 複製專案
git clone https://github.com/your-username/pdftool.git
cd pdftool

# 啟動服務
docker-compose up -d

# 開啟瀏覽器訪問
# 前端：http://localhost:3000
# 後端 API：http://localhost:8001
```

### 手動安裝

#### 後端

```bash
cd backend

# 建立虛擬環境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 安裝系統依賴
# Ubuntu/Debian:
sudo apt install libreoffice ghostscript

# macOS:
brew install libreoffice ghostscript

# 啟動服務
uvicorn main:app --reload
```

#### 前端

```bash
cd frontend

# 安裝依賴
npm install

# 設定環境變數
echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local

# 啟動開發服務器
npm run dev
```

## 部署

### Zeabur（後端）

1. 在 Zeabur 建立新專案
2. 連接 GitHub 倉庫
3. 選擇 `backend` 目錄
4. Zeabur 會自動偵測 Dockerfile 並部署

### Netlify（前端）

1. 在 Netlify 建立新專案
2. 連接 GitHub 倉庫
3. 設定：
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/.next`
4. 設定環境變數 `NEXT_PUBLIC_API_URL`

## API 文件

啟動後端後，訪問：
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## 開源授權

### 本專案
MIT License

### 使用的開源套件

| 套件 | 授權 | 用途 |
|------|------|------|
| PyMuPDF | AGPL-3.0 | PDF 處理核心 |
| PaddleOCR | Apache-2.0 | OCR 文字辨識 |
| LibreOffice | MPL-2.0 | 文件格式轉換 |
| Ghostscript | AGPL-3.0 | PDF/A 轉換 |
| pyHanko | MIT | PDF 簽名 |
| Next.js | MIT | 前端框架 |

⚠️ **注意**：PyMuPDF 和 Ghostscript 使用 AGPL-3.0 授權，商業使用時請注意授權要求。

## 隱私說明

- 所有上傳的檔案會在處理完成後 1 小時內自動刪除
- 不會儲存任何使用者個人資訊
- 所有處理都在伺服器端進行，不會傳送到第三方

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 致謝

靈感來自 SmallPDF、iLovePDF 等優秀的 PDF 工具服務。

---

Made with ❤️ in Taiwan
