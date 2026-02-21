"""
Microsoft Office 轉換工具 - 使用 COM 接口控制 Office 應用程式
支援 Word/Excel/PowerPoint 轉 PDF
"""
import os
import sys
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# 檢查是否為 Windows
IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    try:
        import win32com.client
        import pythoncom
        HAS_WIN32COM = True
    except ImportError:
        HAS_WIN32COM = False
        logger.warning("pywin32 未安裝，將使用 LibreOffice 作為後備方案")
else:
    HAS_WIN32COM = False


def word_to_pdf(input_path: Path, output_path: Path) -> bool:
    """
    使用 Microsoft Word 將 .doc/.docx 轉為 PDF

    Args:
        input_path: 輸入檔案路徑
        output_path: 輸出 PDF 路徑

    Returns:
        是否成功
    """
    if not IS_WINDOWS or not HAS_WIN32COM:
        return False

    word = None
    doc = None

    try:
        pythoncom.CoInitialize()
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False

        # 開啟文件
        doc = word.Documents.Open(str(input_path.absolute()))

        # 另存為 PDF (wdFormatPDF = 17)
        doc.SaveAs2(str(output_path.absolute()), FileFormat=17)

        return True

    except Exception as e:
        logger.error(f"Word 轉 PDF 失敗: {e}")
        return False

    finally:
        if doc:
            try:
                doc.Close(SaveChanges=False)
            except:
                pass
        if word:
            try:
                word.Quit()
            except:
                pass
        pythoncom.CoUninitialize()


def excel_to_pdf(input_path: Path, output_path: Path) -> bool:
    """
    使用 Microsoft Excel 將 .xls/.xlsx 轉為 PDF

    Args:
        input_path: 輸入檔案路徑
        output_path: 輸出 PDF 路徑

    Returns:
        是否成功
    """
    if not IS_WINDOWS or not HAS_WIN32COM:
        return False

    excel = None
    workbook = None

    try:
        pythoncom.CoInitialize()
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        # 開啟工作簿
        workbook = excel.Workbooks.Open(str(input_path.absolute()))

        # 匯出為 PDF (xlTypePDF = 0)
        workbook.ExportAsFixedFormat(
            Type=0,
            Filename=str(output_path.absolute()),
            Quality=0,  # xlQualityStandard
            IncludeDocProperties=True,
            IgnorePrintAreas=False
        )

        return True

    except Exception as e:
        logger.error(f"Excel 轉 PDF 失敗: {e}")
        return False

    finally:
        if workbook:
            try:
                workbook.Close(SaveChanges=False)
            except:
                pass
        if excel:
            try:
                excel.Quit()
            except:
                pass
        pythoncom.CoUninitialize()


def ppt_to_pdf(input_path: Path, output_path: Path) -> bool:
    """
    使用 Microsoft PowerPoint 將 .ppt/.pptx 轉為 PDF

    Args:
        input_path: 輸入檔案路徑
        output_path: 輸出 PDF 路徑

    Returns:
        是否成功
    """
    if not IS_WINDOWS or not HAS_WIN32COM:
        return False

    ppt = None
    presentation = None

    try:
        pythoncom.CoInitialize()
        ppt = win32com.client.Dispatch("PowerPoint.Application")
        # PowerPoint 需要設為可見才能正常運作
        ppt.Visible = True

        # 開啟簡報
        presentation = ppt.Presentations.Open(
            str(input_path.absolute()),
            ReadOnly=True,
            Untitled=False,
            WithWindow=False
        )

        # 另存為 PDF (ppSaveAsPDF = 32)
        presentation.SaveAs(str(output_path.absolute()), FileFormat=32)

        return True

    except Exception as e:
        logger.error(f"PowerPoint 轉 PDF 失敗: {e}")
        return False

    finally:
        if presentation:
            try:
                presentation.Close()
            except:
                pass
        if ppt:
            try:
                ppt.Quit()
            except:
                pass
        pythoncom.CoUninitialize()


def convert_office_to_pdf(input_path: Path, output_path: Path) -> bool:
    """
    根據檔案類型自動選擇轉換器

    Args:
        input_path: 輸入檔案路徑
        output_path: 輸出 PDF 路徑

    Returns:
        是否成功
    """
    ext = input_path.suffix.lower()

    if ext in ['.doc', '.docx', '.rtf', '.odt']:
        return word_to_pdf(input_path, output_path)
    elif ext in ['.xls', '.xlsx', '.ods']:
        return excel_to_pdf(input_path, output_path)
    elif ext in ['.ppt', '.pptx', '.odp']:
        return ppt_to_pdf(input_path, output_path)
    else:
        logger.warning(f"不支援的檔案格式: {ext}")
        return False


def is_office_available() -> dict:
    """
    檢查哪些 Office 應用程式可用

    Returns:
        各應用程式的可用狀態
    """
    result = {
        "word": False,
        "excel": False,
        "powerpoint": False,
        "available": False
    }

    if not IS_WINDOWS or not HAS_WIN32COM:
        return result

    try:
        pythoncom.CoInitialize()

        # 檢查 Word
        try:
            word = win32com.client.Dispatch("Word.Application")
            word.Quit()
            result["word"] = True
        except:
            pass

        # 檢查 Excel
        try:
            excel = win32com.client.Dispatch("Excel.Application")
            excel.Quit()
            result["excel"] = True
        except:
            pass

        # 檢查 PowerPoint
        try:
            ppt = win32com.client.Dispatch("PowerPoint.Application")
            ppt.Quit()
            result["powerpoint"] = True
        except:
            pass

        result["available"] = any([result["word"], result["excel"], result["powerpoint"]])

    except Exception as e:
        logger.error(f"檢查 Office 失敗: {e}")
    finally:
        pythoncom.CoUninitialize()

    return result


# 匯出
__all__ = [
    'word_to_pdf',
    'excel_to_pdf',
    'ppt_to_pdf',
    'convert_office_to_pdf',
    'is_office_available',
    'IS_WINDOWS',
    'HAS_WIN32COM'
]
