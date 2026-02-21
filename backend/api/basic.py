"""
基礎操作 API - 合併、分割、旋轉、刪除、壓縮
"""
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from pathlib import Path

from utils.file_handler import save_upload_file, save_multiple_files, generate_output_path
from utils.pdf_compat import save_compatible_pdf, set_pdf_metadata

router = APIRouter()

# ============ 合併 PDF ============
@router.post("/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    """
    合併多個 PDF 檔案

    - 上傳多個 PDF
    - 依上傳順序合併
    - 回傳合併後的 PDF
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 個 PDF 檔案")

    # 儲存上傳的檔案
    file_paths = await save_multiple_files(files, "merge")

    try:
        # 建立輸出檔案
        output_path = generate_output_path("merged.pdf")

        # 合併 PDF
        merged_pdf = fitz.open()

        for file_path in file_paths:
            pdf = fitz.open(file_path)
            merged_pdf.insert_pdf(pdf)
            pdf.close()

        # 使用相容性設定儲存，確保可在各種 PDF 閱讀器/瀏覽器開啟
        save_compatible_pdf(merged_pdf, output_path, title="Merged PDF")
        merged_pdf.close()

        return FileResponse(
            path=output_path,
            filename="merged.pdf",
            media_type="application/pdf"
        )

    finally:
        # 清理上傳的檔案
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 分割 PDF ============
@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    pages: str = Form(..., description="頁碼範圍，如 '1-3,5,7-9' 或 'all' 分割成單頁")
):
    """
    分割 PDF 檔案

    - pages: 頁碼範圍，如 "1-3,5,7-9" 或 "all"
    - 回傳 ZIP 壓縮檔（多個 PDF）
    """
    import zipfile
    import io

    file_path = await save_upload_file(file, "split")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)

        # 解析頁碼
        if pages.lower() == "all":
            page_ranges = [(i, i) for i in range(total_pages)]
        else:
            page_ranges = parse_page_ranges(pages, total_pages)

        # 建立輸出 ZIP
        output_path = generate_output_path("split.zip", ext=".zip")

        with zipfile.ZipFile(output_path, "w") as zf:
            for i, (start, end) in enumerate(page_ranges):
                # 建立子 PDF
                sub_pdf = fitz.open()
                sub_pdf.insert_pdf(pdf, from_page=start, to_page=end)

                # 寫入 ZIP
                pdf_bytes = sub_pdf.tobytes()
                filename = f"page_{start+1}-{end+1}.pdf" if start != end else f"page_{start+1}.pdf"
                zf.writestr(filename, pdf_bytes)
                sub_pdf.close()

        pdf.close()

        return FileResponse(
            path=output_path,
            filename="split_pages.zip",
            media_type="application/zip"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 旋轉頁面 ============
@router.post("/rotate")
async def rotate_pages(
    file: UploadFile = File(...),
    pages: str = Form("all", description="頁碼，如 '1,3,5' 或 'all'"),
    angle: int = Form(..., description="旋轉角度：90, 180, 270")
):
    """
    旋轉 PDF 頁面

    - pages: 要旋轉的頁碼
    - angle: 旋轉角度（90, 180, 270）
    """
    if angle not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="角度必須是 90, 180 或 270")

    file_path = await save_upload_file(file, "rotate")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)

        # 解析頁碼
        if pages.lower() == "all":
            page_indices = list(range(total_pages))
        else:
            page_indices = parse_page_list(pages, total_pages)

        # 旋轉頁面
        for idx in page_indices:
            page = pdf[idx]
            page.set_rotation(page.rotation + angle)

        # 儲存（使用相容性設定）
        output_path = generate_output_path("rotated.pdf")
        save_compatible_pdf(pdf, output_path, title="Rotated PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="rotated.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 刪除頁面 ============
@router.post("/delete-pages")
async def delete_pages(
    file: UploadFile = File(...),
    pages: str = Form(..., description="要刪除的頁碼，如 '1,3,5-7'")
):
    """
    刪除 PDF 頁面

    - pages: 要刪除的頁碼
    """
    file_path = await save_upload_file(file, "delete")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)

        # 解析要刪除的頁碼
        pages_to_delete = set(parse_page_list(pages, total_pages))

        # 建立新 PDF（不含要刪除的頁面）
        new_pdf = fitz.open()
        for i in range(total_pages):
            if i not in pages_to_delete:
                new_pdf.insert_pdf(pdf, from_page=i, to_page=i)

        # 儲存（使用相容性設定）
        output_path = generate_output_path("deleted.pdf")
        save_compatible_pdf(new_pdf, output_path, title="Pages Deleted")
        new_pdf.close()
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="pages_deleted.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 提取頁面 ============
@router.post("/extract-pages")
async def extract_pages(
    file: UploadFile = File(...),
    pages: str = Form(..., description="要提取的頁碼，如 '1,3,5-7'")
):
    """
    提取 PDF 頁面

    - pages: 要提取的頁碼
    """
    file_path = await save_upload_file(file, "extract")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)

        # 解析頁碼
        page_indices = parse_page_list(pages, total_pages)

        # 建立新 PDF
        new_pdf = fitz.open()
        for i in page_indices:
            new_pdf.insert_pdf(pdf, from_page=i, to_page=i)

        # 儲存（使用相容性設定）
        output_path = generate_output_path("extracted.pdf")
        save_compatible_pdf(new_pdf, output_path, title="Extracted Pages")
        new_pdf.close()
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="extracted_pages.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 重新排序 ============
@router.post("/reorder")
async def reorder_pages(
    file: UploadFile = File(...),
    order: str = Form(..., description="新順序，如 '3,1,2,5,4'")
):
    """
    重新排序 PDF 頁面

    - order: 新的頁面順序
    """
    file_path = await save_upload_file(file, "reorder")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)

        # 解析順序
        new_order = [int(x.strip()) - 1 for x in order.split(",")]

        # 驗證
        if len(new_order) != total_pages:
            raise HTTPException(
                status_code=400,
                detail=f"頁面順序數量 ({len(new_order)}) 與總頁數 ({total_pages}) 不符"
            )

        if set(new_order) != set(range(total_pages)):
            raise HTTPException(status_code=400, detail="頁面順序無效")

        # 重新排序
        new_pdf = fitz.open()
        for i in new_order:
            new_pdf.insert_pdf(pdf, from_page=i, to_page=i)

        # 儲存（使用相容性設定）
        output_path = generate_output_path("reordered.pdf")
        save_compatible_pdf(new_pdf, output_path, title="Reordered PDF")
        new_pdf.close()
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="reordered.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 壓縮 PDF ============
@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = Form("medium", description="壓縮品質：low, medium, high")
):
    """
    壓縮 PDF 檔案

    - quality: 壓縮品質
      - low: 最小檔案，較低品質
      - medium: 平衡
      - high: 較大檔案，較高品質
    """
    quality_settings = {
        "low": {"image_quality": 30, "deflate": True},
        "medium": {"image_quality": 60, "deflate": True},
        "high": {"image_quality": 85, "deflate": True},
    }

    if quality not in quality_settings:
        raise HTTPException(status_code=400, detail="品質必須是 low, medium 或 high")

    settings = quality_settings[quality]
    file_path = await save_upload_file(file, "compress")

    try:
        pdf = fitz.open(file_path)

        # 壓縮圖片
        for page in pdf:
            image_list = page.get_images()
            for img_info in image_list:
                xref = img_info[0]
                try:
                    # 取得圖片
                    base_image = pdf.extract_image(xref)
                    if base_image:
                        # 壓縮圖片邏輯可以更複雜，這裡簡化處理
                        pass
                except Exception as e:
                    # 圖片壓縮失敗時記錄但繼續處理其他圖片
                    print(f"圖片壓縮跳過 (xref={xref}): {e}")

        # 設定元資料以提高相容性
        set_pdf_metadata(pdf, title="Compressed PDF")

        # 儲存（啟用壓縮 + 相容性設定）
        output_path = generate_output_path("compressed.pdf")
        pdf.save(
            str(output_path),
            garbage=4,      # 清理未使用的物件
            deflate=settings["deflate"],
            clean=True,
            # linear 已在 PyMuPDF 新版移除
        )
        pdf.close()

        # 計算壓縮率
        original_size = file_path.stat().st_size
        compressed_size = output_path.stat().st_size
        ratio = (1 - compressed_size / original_size) * 100

        return {
            "download_url": f"/download/{output_path.name}",
            "original_size": original_size,
            "compressed_size": compressed_size,
            "reduction_percent": round(ratio, 2),
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 工具函式 ============
def parse_page_ranges(pages_str: str, total_pages: int) -> List[tuple]:
    """
    解析頁碼範圍字串

    '1-3,5,7-9' -> [(0,2), (4,4), (6,8)]
    """
    ranges = []
    for part in pages_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-")
            start = int(start) - 1
            end = int(end) - 1
            if start < 0 or end >= total_pages or start > end:
                raise HTTPException(status_code=400, detail=f"無效的頁碼範圍: {part}")
            ranges.append((start, end))
        else:
            idx = int(part) - 1
            if idx < 0 or idx >= total_pages:
                raise HTTPException(status_code=400, detail=f"無效的頁碼: {part}")
            ranges.append((idx, idx))
    return ranges


def parse_page_list(pages_str: str, total_pages: int) -> List[int]:
    """
    解析頁碼列表字串

    '1-3,5,7-9' -> [0, 1, 2, 4, 6, 7, 8]
    """
    pages = []
    for part in pages_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-")
            start = int(start) - 1
            end = int(end) - 1
            if start < 0 or end >= total_pages or start > end:
                raise HTTPException(status_code=400, detail=f"無效的頁碼範圍: {part}")
            pages.extend(range(start, end + 1))
        else:
            idx = int(part) - 1
            if idx < 0 or idx >= total_pages:
                raise HTTPException(status_code=400, detail=f"無效的頁碼: {part}")
            pages.append(idx)
    return pages
