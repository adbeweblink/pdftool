"""
工作流引擎 API - N8N 風格視覺化流程
"""
import json
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from enum import Enum

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

from utils.file_handler import save_upload_file, generate_output_path
from config import settings

router = APIRouter()


# ============ 資料模型 ============

class NodeType(str, Enum):
    """節點類型"""
    # 輸入節點
    INPUT_FILE = "input_file"
    INPUT_FOLDER = "input_folder"

    # PDF 基礎操作
    PDF_MERGE = "pdf_merge"
    PDF_SPLIT = "pdf_split"
    PDF_ROTATE = "pdf_rotate"
    PDF_COMPRESS = "pdf_compress"
    PDF_WATERMARK = "pdf_watermark"
    PDF_ENCRYPT = "pdf_encrypt"
    PDF_DECRYPT = "pdf_decrypt"

    # 轉換節點
    CONVERT_TO_IMAGE = "convert_to_image"
    CONVERT_TO_WORD = "convert_to_word"
    CONVERT_TO_EXCEL = "convert_to_excel"
    IMAGE_TO_PDF = "image_to_pdf"

    # AI 節點
    AI_COMPARE = "ai_compare"
    AI_PII_DETECT = "ai_pii_detect"
    AI_EXTRACT_TABLE = "ai_extract_table"
    AI_SMART_RENAME = "ai_smart_rename"
    AI_SUMMARIZE = "ai_summarize"
    AI_TRANSLATE = "ai_translate"
    AI_ANALYZE = "ai_analyze"

    # OCR 節點
    OCR_EXTRACT = "ocr_extract"
    OCR_SEARCHABLE = "ocr_searchable"

    # 邏輯節點
    LOGIC_CONDITION = "logic_condition"
    LOGIC_LOOP = "logic_loop"
    LOGIC_DELAY = "logic_delay"

    # 輸出節點
    OUTPUT_SAVE = "output_save"
    OUTPUT_EMAIL = "output_email"
    OUTPUT_WEBHOOK = "output_webhook"


class NodePosition(BaseModel):
    """節點位置"""
    x: float
    y: float


class NodeConfig(BaseModel):
    """節點配置"""
    # 通用配置
    label: str = ""
    description: str = ""

    # 節點特定配置（使用 dict 存儲）
    params: Dict[str, Any] = {}


class WorkflowNode(BaseModel):
    """工作流節點"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: NodeType
    position: NodePosition
    config: NodeConfig = NodeConfig()
    inputs: List[str] = []  # 輸入連接的節點 ID
    outputs: List[str] = []  # 輸出連接的節點 ID


class WorkflowConnection(BaseModel):
    """節點連接"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_node: str
    source_handle: str = "output"
    target_node: str
    target_handle: str = "input"


class WorkflowDefinition(BaseModel):
    """工作流定義"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    nodes: List[WorkflowNode] = []
    connections: List[WorkflowConnection] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ExecutionStatus(str, Enum):
    """執行狀態"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeExecutionResult(BaseModel):
    """節點執行結果"""
    node_id: str
    status: ExecutionStatus
    output: Any = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WorkflowExecution(BaseModel):
    """工作流執行記錄"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    node_results: Dict[str, NodeExecutionResult] = {}
    input_files: List[str] = []
    output_files: List[str] = []
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# ============ 工作流儲存 ============

WORKFLOWS_DIR = Path(settings.OUTPUT_DIR) / "workflows"
WORKFLOWS_DIR.mkdir(exist_ok=True)

EXECUTIONS_DIR = Path(settings.OUTPUT_DIR) / "executions"
EXECUTIONS_DIR.mkdir(exist_ok=True)


def save_workflow(workflow: WorkflowDefinition) -> Path:
    """儲存工作流定義"""
    file_path = WORKFLOWS_DIR / f"{workflow.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(workflow.model_dump(mode="json"), f, ensure_ascii=False, indent=2, default=str)
    return file_path


def load_workflow(workflow_id: str) -> Optional[WorkflowDefinition]:
    """載入工作流定義"""
    file_path = WORKFLOWS_DIR / f"{workflow_id}.json"
    if not file_path.exists():
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return WorkflowDefinition(**data)


def save_execution(execution: WorkflowExecution) -> Path:
    """儲存執行記錄"""
    file_path = EXECUTIONS_DIR / f"{execution.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(execution.model_dump(mode="json"), f, ensure_ascii=False, indent=2, default=str)
    return file_path


def load_execution(execution_id: str) -> Optional[WorkflowExecution]:
    """載入執行記錄"""
    file_path = EXECUTIONS_DIR / f"{execution_id}.json"
    if not file_path.exists():
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return WorkflowExecution(**data)


# ============ 節點執行器 ============

class NodeExecutor:
    """節點執行器"""

    def __init__(self):
        self.handlers = {
            # 輸入節點
            NodeType.INPUT_FILE: self._execute_input_file,
            NodeType.INPUT_FOLDER: self._execute_input_folder,

            # PDF 操作
            NodeType.PDF_MERGE: self._execute_pdf_merge,
            NodeType.PDF_SPLIT: self._execute_pdf_split,
            NodeType.PDF_COMPRESS: self._execute_pdf_compress,
            NodeType.PDF_WATERMARK: self._execute_pdf_watermark,

            # AI 節點
            NodeType.AI_COMPARE: self._execute_ai_compare,
            NodeType.AI_PII_DETECT: self._execute_ai_pii_detect,
            NodeType.AI_EXTRACT_TABLE: self._execute_ai_extract_table,
            NodeType.AI_SMART_RENAME: self._execute_ai_smart_rename,
            NodeType.AI_SUMMARIZE: self._execute_ai_summarize,

            # 轉換節點
            NodeType.CONVERT_TO_IMAGE: self._execute_convert_to_image,

            # 輸出節點
            NodeType.OUTPUT_SAVE: self._execute_output_save,
        }

    async def execute(
        self,
        node: WorkflowNode,
        inputs: Dict[str, Any],
        execution: WorkflowExecution
    ) -> NodeExecutionResult:
        """執行單個節點"""
        result = NodeExecutionResult(
            node_id=node.id,
            status=ExecutionStatus.RUNNING,
            started_at=datetime.now()
        )

        try:
            handler = self.handlers.get(node.type)
            if not handler:
                raise ValueError(f"不支援的節點類型：{node.type}")

            output = await handler(node, inputs, execution)

            result.status = ExecutionStatus.COMPLETED
            result.output = output
            result.completed_at = datetime.now()

        except Exception as e:
            result.status = ExecutionStatus.FAILED
            result.error = str(e)
            result.completed_at = datetime.now()

        return result

    # ============ 輸入節點處理器 ============

    async def _execute_input_file(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """處理檔案輸入節點"""
        # 從執行記錄中取得輸入檔案
        files = execution.input_files
        return {"files": files, "count": len(files)}

    async def _execute_input_folder(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """處理資料夾輸入節點"""
        folder_path = node.config.params.get("folder_path", "")
        if not folder_path:
            raise ValueError("未指定資料夾路徑")

        folder = Path(folder_path)
        if not folder.exists():
            raise ValueError(f"資料夾不存在：{folder_path}")

        # 取得所有 PDF 檔案
        pdf_files = list(folder.glob("*.pdf"))
        return {"files": [str(f) for f in pdf_files], "count": len(pdf_files)}

    # ============ PDF 操作處理器 ============

    async def _execute_pdf_merge(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """合併 PDF"""
        import fitz

        files = inputs.get("files", [])
        if len(files) < 2:
            raise ValueError("合併需要至少 2 個 PDF 檔案")

        output_pdf = fitz.open()
        for file_path in files:
            pdf = fitz.open(file_path)
            output_pdf.insert_pdf(pdf)
            pdf.close()

        output_path = generate_output_path("merged.pdf")
        output_pdf.save(str(output_path))
        output_pdf.close()

        execution.output_files.append(str(output_path))
        return {"file": str(output_path), "page_count": len(fitz.open(output_path))}

    async def _execute_pdf_split(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """分割 PDF"""
        import fitz

        files = inputs.get("files", [])
        if not files:
            raise ValueError("沒有輸入檔案")

        split_mode = node.config.params.get("mode", "each_page")
        output_files = []

        for file_path in files:
            pdf = fitz.open(file_path)

            if split_mode == "each_page":
                for i in range(len(pdf)):
                    new_pdf = fitz.open()
                    new_pdf.insert_pdf(pdf, from_page=i, to_page=i)
                    output_path = generate_output_path(f"page_{i + 1}.pdf")
                    new_pdf.save(str(output_path))
                    new_pdf.close()
                    output_files.append(str(output_path))
                    execution.output_files.append(str(output_path))

            pdf.close()

        return {"files": output_files, "count": len(output_files)}

    async def _execute_pdf_compress(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """壓縮 PDF"""
        import fitz

        files = inputs.get("files", [])
        quality = node.config.params.get("quality", "medium")
        output_files = []

        for file_path in files:
            pdf = fitz.open(file_path)

            # 設定壓縮參數
            if quality == "low":
                garbage = 4
                deflate = True
            elif quality == "high":
                garbage = 1
                deflate = False
            else:  # medium
                garbage = 3
                deflate = True

            output_path = generate_output_path("compressed.pdf")
            pdf.save(str(output_path), garbage=garbage, deflate=deflate)
            pdf.close()

            output_files.append(str(output_path))
            execution.output_files.append(str(output_path))

        return {"files": output_files, "count": len(output_files)}

    async def _execute_pdf_watermark(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """加浮水印"""
        import fitz

        files = inputs.get("files", [])
        watermark_text = node.config.params.get("text", "CONFIDENTIAL")
        opacity = node.config.params.get("opacity", 0.3)
        output_files = []

        for file_path in files:
            pdf = fitz.open(file_path)

            for page in pdf:
                rect = page.rect
                # 在頁面中央加入浮水印
                page.insert_text(
                    (rect.width / 2 - 100, rect.height / 2),
                    watermark_text,
                    fontsize=40,
                    color=(0.5, 0.5, 0.5),
                    rotate=45
                )

            output_path = generate_output_path("watermarked.pdf")
            pdf.save(str(output_path))
            pdf.close()

            output_files.append(str(output_path))
            execution.output_files.append(str(output_path))

        return {"files": output_files, "count": len(output_files)}

    # ============ AI 節點處理器 ============

    async def _execute_ai_compare(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """AI 合約比對"""
        from api.ai_advanced import compare_contracts, extract_pdf_text, call_gemini_advanced

        files = inputs.get("files", [])
        if len(files) < 2:
            raise ValueError("比對需要至少 2 個 PDF 檔案")

        # 比對前兩個檔案
        text1 = extract_pdf_text(files[0])
        text2 = extract_pdf_text(files[1])

        prompt = f"""比對以下兩份文件的差異：

文件 A：
{text1[:10000]}

文件 B：
{text2[:10000]}

請列出所有差異，標示重要變更。用繁體中文回答。
"""
        result = await call_gemini_advanced(prompt)

        return {
            "comparison": result,
            "file1": files[0],
            "file2": files[1]
        }

    async def _execute_ai_pii_detect(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """AI 個資偵測"""
        from api.ai_advanced import extract_pdf_text, call_gemini_advanced
        import re

        files = inputs.get("files", [])
        action = node.config.params.get("action", "detect")
        results = []

        for file_path in files:
            text = extract_pdf_text(file_path)

            # 使用 AI 偵測
            prompt = f"""分析以下文件，找出所有個人資料（PII）：

{text[:8000]}

請以 JSON 格式回傳：
{{"pii_items": [{{"type": "類型", "value": "值"}}], "risk_level": "high/medium/low"}}
"""
            ai_result = await call_gemini_advanced(prompt)

            results.append({
                "file": file_path,
                "analysis": ai_result
            })

        return {"results": results, "count": len(results)}

    async def _execute_ai_extract_table(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """AI 表格提取"""
        from api.ai_advanced import extract_pdf_tables

        files = inputs.get("files", [])
        all_tables = []

        for file_path in files:
            tables = extract_pdf_tables(file_path)
            all_tables.extend(tables)

        return {"tables": all_tables, "count": len(all_tables)}

    async def _execute_ai_smart_rename(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """AI 智能重命名"""
        from api.ai_advanced import extract_pdf_text, call_gemini_advanced
        import re

        files = inputs.get("files", [])
        rename_suggestions = []

        for file_path in files:
            text = extract_pdf_text(file_path, max_pages=3)

            prompt = f"""分析文件並建議檔名：

{text[:3000]}

回傳 JSON：{{"suggested_name": "建議的檔名.pdf", "document_type": "文件類型"}}
"""
            ai_result = await call_gemini_advanced(prompt)

            try:
                json_match = re.search(r'\{.*\}', ai_result, re.DOTALL)
                if json_match:
                    suggestion = json.loads(json_match.group())
                else:
                    suggestion = {"suggested_name": Path(file_path).name}
            except:
                suggestion = {"suggested_name": Path(file_path).name}

            rename_suggestions.append({
                "original": file_path,
                "suggested": suggestion.get("suggested_name", ""),
                "type": suggestion.get("document_type", "")
            })

        return {"suggestions": rename_suggestions}

    async def _execute_ai_summarize(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """AI 摘要"""
        from api.ai_advanced import extract_pdf_text, call_gemini_advanced

        files = inputs.get("files", [])
        summaries = []

        for file_path in files:
            text = extract_pdf_text(file_path)

            prompt = f"""請總結以下文件的主要內容：

{text[:10000]}

請用繁體中文回答，包含：
1. 文件類型
2. 主要主題
3. 關鍵要點（條列式）
4. 結論或建議
"""
            summary = await call_gemini_advanced(prompt)

            summaries.append({
                "file": file_path,
                "summary": summary
            })

        return {"summaries": summaries, "count": len(summaries)}

    # ============ 轉換節點處理器 ============

    async def _execute_convert_to_image(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """PDF 轉圖片"""
        import fitz

        files = inputs.get("files", [])
        image_format = node.config.params.get("format", "png")
        dpi = node.config.params.get("dpi", 150)
        output_files = []

        for file_path in files:
            pdf = fitz.open(file_path)

            for i, page in enumerate(pdf):
                zoom = dpi / 72
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)

                output_path = generate_output_path(f"page_{i + 1}.{image_format}")
                pix.save(str(output_path))

                output_files.append(str(output_path))
                execution.output_files.append(str(output_path))

            pdf.close()

        return {"files": output_files, "count": len(output_files)}

    # ============ 輸出節點處理器 ============

    async def _execute_output_save(
        self, node: WorkflowNode, inputs: Dict, execution: WorkflowExecution
    ) -> Dict:
        """儲存輸出"""
        files = inputs.get("files", [])
        output_folder = node.config.params.get("folder", str(settings.OUTPUT_DIR))

        saved_files = []
        for file_path in files:
            # 檔案已在執行過程中儲存
            saved_files.append(file_path)

        return {
            "saved_files": saved_files,
            "output_folder": output_folder,
            "count": len(saved_files)
        }


# ============ 工作流執行引擎 ============

class WorkflowEngine:
    """工作流執行引擎"""

    def __init__(self):
        self.executor = NodeExecutor()

    def _build_execution_order(self, workflow: WorkflowDefinition) -> List[str]:
        """建立節點執行順序（拓撲排序）"""
        # 建立鄰接表
        graph = {node.id: [] for node in workflow.nodes}
        in_degree = {node.id: 0 for node in workflow.nodes}

        for conn in workflow.connections:
            graph[conn.source_node].append(conn.target_node)
            in_degree[conn.target_node] += 1

        # 拓撲排序
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        order = []

        while queue:
            node_id = queue.pop(0)
            order.append(node_id)

            for next_node in graph[node_id]:
                in_degree[next_node] -= 1
                if in_degree[next_node] == 0:
                    queue.append(next_node)

        if len(order) != len(workflow.nodes):
            raise ValueError("工作流存在循環依賴")

        return order

    async def execute(
        self,
        workflow: WorkflowDefinition,
        input_files: List[str]
    ) -> WorkflowExecution:
        """執行工作流"""
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=ExecutionStatus.RUNNING,
            input_files=input_files,
            started_at=datetime.now()
        )

        try:
            # 建立執行順序
            order = self._build_execution_order(workflow)

            # 建立節點查找表
            nodes_map = {node.id: node for node in workflow.nodes}

            # 儲存每個節點的輸出
            outputs = {}

            # 依序執行節點
            for node_id in order:
                node = nodes_map[node_id]

                # 收集輸入（從上游節點的輸出）
                inputs = {"files": input_files}

                for conn in workflow.connections:
                    if conn.target_node == node_id and conn.source_node in outputs:
                        # 合併上游節點的輸出
                        upstream_output = outputs[conn.source_node]
                        if "files" in upstream_output:
                            inputs["files"] = upstream_output["files"]
                        if "file" in upstream_output:
                            inputs["files"] = [upstream_output["file"]]

                # 執行節點
                result = await self.executor.execute(node, inputs, execution)
                execution.node_results[node_id] = result

                # 如果節點失敗，停止執行
                if result.status == ExecutionStatus.FAILED:
                    execution.status = ExecutionStatus.FAILED
                    execution.error = f"節點 {node.config.label or node_id} 執行失敗：{result.error}"
                    break

                # 儲存輸出
                outputs[node_id] = result.output

            else:
                # 所有節點執行成功
                execution.status = ExecutionStatus.COMPLETED

            execution.completed_at = datetime.now()

        except Exception as e:
            execution.status = ExecutionStatus.FAILED
            execution.error = str(e)
            execution.completed_at = datetime.now()

        # 儲存執行記錄
        save_execution(execution)

        return execution


# 建立全域引擎實例
engine = WorkflowEngine()


# ============ API 端點 ============

@router.post("/create")
async def create_workflow(workflow: WorkflowDefinition):
    """建立新工作流"""
    workflow.created_at = datetime.now()
    workflow.updated_at = datetime.now()
    save_workflow(workflow)

    return {
        "success": True,
        "workflow_id": workflow.id,
        "message": "工作流已建立"
    }


@router.get("/list")
async def list_workflows():
    """列出所有工作流"""
    workflows = []
    for file_path in WORKFLOWS_DIR.glob("*.json"):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            workflows.append({
                "id": data["id"],
                "name": data["name"],
                "description": data.get("description", ""),
                "node_count": len(data.get("nodes", [])),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at")
            })

    return {"workflows": workflows, "count": len(workflows)}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str):
    """取得工作流詳情"""
    workflow = load_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="找不到工作流")

    return workflow.model_dump(mode="json")


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, workflow: WorkflowDefinition):
    """更新工作流"""
    existing = load_workflow(workflow_id)
    if not existing:
        raise HTTPException(status_code=404, detail="找不到工作流")

    workflow.id = workflow_id
    workflow.created_at = existing.created_at
    workflow.updated_at = datetime.now()
    save_workflow(workflow)

    return {
        "success": True,
        "workflow_id": workflow_id,
        "message": "工作流已更新"
    }


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """刪除工作流"""
    file_path = WORKFLOWS_DIR / f"{workflow_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="找不到工作流")

    file_path.unlink()

    return {
        "success": True,
        "message": "工作流已刪除"
    }


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None
):
    """執行工作流"""
    workflow = load_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="找不到工作流")

    # 儲存上傳的檔案
    input_files = []
    for file in files:
        file_path = await save_upload_file(file, "workflow")
        input_files.append(str(file_path))

    # 執行工作流
    execution = await engine.execute(workflow, input_files)

    return {
        "success": execution.status == ExecutionStatus.COMPLETED,
        "execution_id": execution.id,
        "status": execution.status,
        "output_files": execution.output_files,
        "error": execution.error,
        "node_results": {
            node_id: {
                "status": result.status,
                "error": result.error
            }
            for node_id, result in execution.node_results.items()
        }
    }


@router.get("/execution/{execution_id}")
async def get_execution(execution_id: str):
    """取得執行記錄"""
    execution = load_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="找不到執行記錄")

    return execution.model_dump(mode="json")


@router.get("/node-types/list")
async def list_node_types():
    """列出所有可用的節點類型"""
    node_types = [
        # 輸入節點
        {"type": "input_file", "category": "input", "label": "檔案輸入", "description": "上傳 PDF 檔案"},
        {"type": "input_folder", "category": "input", "label": "資料夾輸入", "description": "選擇資料夾中的所有 PDF"},

        # PDF 操作
        {"type": "pdf_merge", "category": "pdf", "label": "合併 PDF", "description": "將多個 PDF 合併為一個"},
        {"type": "pdf_split", "category": "pdf", "label": "分割 PDF", "description": "將 PDF 分割為多個檔案"},
        {"type": "pdf_compress", "category": "pdf", "label": "壓縮 PDF", "description": "減少 PDF 檔案大小"},
        {"type": "pdf_watermark", "category": "pdf", "label": "加浮水印", "description": "在 PDF 上加入浮水印"},
        {"type": "pdf_encrypt", "category": "pdf", "label": "加密 PDF", "description": "為 PDF 設定密碼"},
        {"type": "pdf_decrypt", "category": "pdf", "label": "解密 PDF", "description": "移除 PDF 密碼"},

        # 轉換
        {"type": "convert_to_image", "category": "convert", "label": "轉為圖片", "description": "將 PDF 頁面轉為圖片"},
        {"type": "convert_to_word", "category": "convert", "label": "轉為 Word", "description": "將 PDF 轉為 Word 文件"},
        {"type": "image_to_pdf", "category": "convert", "label": "圖片轉 PDF", "description": "將圖片轉為 PDF"},

        # AI
        {"type": "ai_compare", "category": "ai", "label": "AI 合約比對", "description": "比對兩份文件的差異"},
        {"type": "ai_pii_detect", "category": "ai", "label": "AI 個資偵測", "description": "偵測並遮蔽個人資料"},
        {"type": "ai_extract_table", "category": "ai", "label": "AI 表格提取", "description": "從 PDF 提取表格"},
        {"type": "ai_smart_rename", "category": "ai", "label": "AI 智能重命名", "description": "根據內容建議檔名"},
        {"type": "ai_summarize", "category": "ai", "label": "AI 摘要", "description": "自動生成文件摘要"},
        {"type": "ai_translate", "category": "ai", "label": "AI 翻譯", "description": "翻譯文件內容"},

        # OCR
        {"type": "ocr_extract", "category": "ocr", "label": "OCR 文字辨識", "description": "從掃描件提取文字"},
        {"type": "ocr_searchable", "category": "ocr", "label": "轉可搜尋 PDF", "description": "將掃描 PDF 轉為可搜尋"},

        # 邏輯
        {"type": "logic_condition", "category": "logic", "label": "條件判斷", "description": "根據條件分流"},
        {"type": "logic_loop", "category": "logic", "label": "迴圈", "description": "重複處理"},

        # 輸出
        {"type": "output_save", "category": "output", "label": "儲存檔案", "description": "儲存處理結果"},
        {"type": "output_email", "category": "output", "label": "發送郵件", "description": "將結果發送到郵箱"},
    ]

    # 按類別分組
    categories = {}
    for node in node_types:
        cat = node["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(node)

    return {
        "node_types": node_types,
        "categories": categories,
        "total": len(node_types)
    }


@router.get("/download")
async def download_output_file(filepath: str):
    """下載工作流輸出檔案"""
    try:
        file_path = Path(filepath)

        # 安全檢查：確保檔案在允許的輸出目錄內
        output_dir = Path(settings.OUTPUT_DIR).resolve()
        resolved_path = file_path.resolve()

        if not str(resolved_path).startswith(str(output_dir)):
            raise HTTPException(
                status_code=403,
                detail="無法存取此路徑的檔案"
            )

        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail="找不到檔案"
            )

        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/octet-stream"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"下載失敗：{str(e)}"
        )
