"""
API 功能驗證腳本
執行方式：python test_apis.py
"""
import requests
import io
import os
from pathlib import Path

API_URL = "http://localhost:8001/api"

# 建立測試用 PDF（使用 PyMuPDF，3 頁以便測試刪除頁面功能）
def create_test_pdf():
    import fitz
    doc = fitz.open()
    # 建立 3 頁測試 PDF
    for i in range(3):
        page = doc.new_page()
        page.insert_text((100, 100), f"Test PDF Content 測試內容 - 第 {i+1} 頁", fontsize=20)
        page.insert_text((100, 150), "This is a test document.", fontsize=14)

    # 儲存到記憶體
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

# 建立測試用圖片
def create_test_image():
    from PIL import Image
    img = Image.new('RGB', (200, 100), color='red')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()


class APITester:
    def __init__(self):
        self.results = []
        self.pdf_bytes = create_test_pdf()
        self.image_bytes = create_test_image()

    def test(self, name, endpoint, method="POST", files=None, data=None, expect_file=True):
        """執行單一測試"""
        url = f"{API_URL}{endpoint}"
        try:
            if method == "POST":
                response = requests.post(url, files=files, data=data, timeout=30)
            else:
                response = requests.get(url, params=data, timeout=30)

            success = response.status_code == 200
            if expect_file and success:
                # 檢查是否回傳有效檔案
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type or 'application/zip' in content_type or 'image/' in content_type:
                    success = len(response.content) > 0
                elif 'application/json' in content_type:
                    success = True

            status = "✅ 通過" if success else f"❌ 失敗 ({response.status_code})"
            self.results.append((name, status, response.status_code))
            print(f"{status} - {name}")
            return success
        except Exception as e:
            self.results.append((name, f"❌ 錯誤: {str(e)[:50]}", 0))
            print(f"❌ 錯誤 - {name}: {e}")
            return False

    def get_pdf_file(self):
        return ("file", ("test.pdf", io.BytesIO(self.pdf_bytes), "application/pdf"))

    def get_pdf_files(self, count=2):
        return [("files", (f"test{i}.pdf", io.BytesIO(self.pdf_bytes), "application/pdf")) for i in range(count)]

    def run_all_tests(self):
        print("\n" + "="*60)
        print("PDF Tool API 功能驗證")
        print("="*60 + "\n")

        # ========== 基礎操作 ==========
        print("📁 基礎操作")
        print("-" * 40)

        self.test("合併 PDF", "/basic/merge",
            files=self.get_pdf_files(2))

        self.test("分割 PDF", "/basic/split",
            files=[self.get_pdf_file()],
            data={"pages": "all"})

        self.test("旋轉頁面", "/basic/rotate",
            files=[self.get_pdf_file()],
            data={"angle": 90, "pages": "all"})

        self.test("刪除頁面", "/basic/delete-pages",
            files=[self.get_pdf_file()],
            data={"pages": "1"})

        self.test("壓縮 PDF", "/basic/compress",
            files=[self.get_pdf_file()],
            data={"quality": "medium"})

        # ========== 格式轉換 ==========
        print("\n📄 格式轉換")
        print("-" * 40)

        self.test("PDF 轉圖片", "/convert/pdf-to-images",
            files=[self.get_pdf_file()],
            data={"format": "png", "dpi": 150})

        self.test("圖片轉 PDF", "/convert/images-to-pdf",
            files=[("files", ("test.png", io.BytesIO(self.image_bytes), "image/png"))])

        # ========== OCR ==========
        print("\n🔍 OCR 文字辨識")
        print("-" * 40)

        self.test("文字辨識", "/ocr/recognize",
            files=[self.get_pdf_file()],
            data={"lang": "ch"},
            expect_file=False)

        # ========== 編輯功能 ==========
        print("\n✏️ 編輯功能")
        print("-" * 40)

        self.test("取得 PDF 資訊", "/edit/info",
            files=[self.get_pdf_file()],
            expect_file=False)

        self.test("新增文字", "/edit/add-text",
            files=[self.get_pdf_file()],
            data={"page": 1, "x": 200, "y": 200, "text": "測試文字", "font_size": 16})

        self.test("套用編輯", "/edit/apply-edits",
            files=[self.get_pdf_file()],
            data={"edits": '{"1": [{"type": "text", "x": 100, "y": 100, "text": "Hello", "color": "#000000", "fontSize": 14}]}', "scale": 1.0})

        # ========== 安全保護 ==========
        print("\n🔒 安全保護")
        print("-" * 40)

        self.test("加密 PDF", "/security/encrypt",
            files=[self.get_pdf_file()],
            data={"user_password": "test123"})

        self.test("新增浮水印", "/security/watermark",
            files=[self.get_pdf_file()],
            data={"text": "CONFIDENTIAL", "opacity": 0.3, "angle": 45})

        # ========== AI 助手 ==========
        print("\n🤖 AI 助手")
        print("-" * 40)

        self.test("AI 分析", "/ai/analyze",
            files=[self.get_pdf_file()],
            expect_file=False)

        self.test("AI 摘要", "/ai/summarize",
            files=[self.get_pdf_file()],
            expect_file=False)

        # ========== 批次處理 ==========
        print("\n📦 批次處理")
        print("-" * 40)

        self.test("批次壓縮", "/batch/compress",
            files=self.get_pdf_files(2),
            data={"quality": "medium"})

        self.test("批次合併", "/batch/merge-all",
            files=self.get_pdf_files(2))

        self.test("批次浮水印", "/batch/watermark",
            files=self.get_pdf_files(2),
            data={"text": "SAMPLE", "opacity": 0.3, "angle": 45})

        # ========== 多媒體嵌入 ==========
        print("\n🎬 多媒體嵌入")
        print("-" * 40)

        self.test("嵌入 YouTube", "/multimedia/embed-youtube",
            files=[("pdf_file", ("test.pdf", io.BytesIO(self.pdf_bytes), "application/pdf"))],
            data={"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                  "page": 1, "x": 100, "y": 100, "width": 400, "height": 300})

        # ========== 結果統計 ==========
        print("\n" + "="*60)
        print("測試結果統計")
        print("="*60)

        passed = sum(1 for _, status, _ in self.results if "通過" in status)
        failed = len(self.results) - passed

        print(f"\n✅ 通過: {passed}")
        print(f"❌ 失敗: {failed}")
        print(f"📊 成功率: {passed}/{len(self.results)} ({100*passed/len(self.results):.1f}%)")

        if failed > 0:
            print("\n失敗的測試:")
            for name, status, code in self.results:
                if "通過" not in status:
                    print(f"  - {name}: {status}")

        return passed, failed


if __name__ == "__main__":
    print("確保後端服務已啟動 (python main.py)")
    print("按 Enter 開始測試，或 Ctrl+C 取消...")

    try:
        input()
    except KeyboardInterrupt:
        print("\n已取消")
        exit()

    tester = APITester()
    passed, failed = tester.run_all_tests()

    exit(0 if failed == 0 else 1)
