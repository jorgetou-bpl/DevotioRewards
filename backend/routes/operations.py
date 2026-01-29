# Operations routes - Transaction history and reporting

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone
import io
import csv
import logging
from utils.auth import get_current_user
from utils.config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/operations", tags=["operations"])

@router.get("")
async def get_operations(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    gerente: Optional[str] = None,
    operation_type: Optional[str] = None,
    card_type: Optional[str] = None,
    card_id: Optional[str] = None,
    page: int = 1,
    items_per_page: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get operations history with filtering."""
    query_filter = {}
    
    if start_date:
        query_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query_filter:
            query_filter["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query_filter["created_at"] = {"$lte": end_date + "T23:59:59"}
    if gerente:
        query_filter["gerente"] = gerente
    if operation_type:
        query_filter["operation_type"] = operation_type
    if card_type:
        query_filter["card_type"] = card_type
    if card_id:
        query_filter["card_id"] = card_id
    
    skip = (page - 1) * items_per_page
    total_count = await db.operations.count_documents(query_filter)
    
    operations_cursor = db.operations.find(
        query_filter,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(items_per_page)
    
    operations = await operations_cursor.to_list(length=items_per_page)
    gerentes = await db.operations.distinct("gerente")
    operation_types = await db.operations.distinct("operation_type")
    card_types = await db.operations.distinct("card_type")
    
    return {
        "success": True,
        "operations": operations,
        "meta": {
            "total": total_count,
            "page": page,
            "items_per_page": items_per_page,
            "total_pages": (total_count + items_per_page - 1) // items_per_page
        },
        "filters": {
            "gerentes": gerentes,
            "operation_types": operation_types,
            "card_types": card_types
        }
    }

@router.get("/export")
async def export_operations(
    format: str = "csv",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    gerente: Optional[str] = None,
    operation_type: Optional[str] = None,
    card_type: Optional[str] = None,
    card_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export operations to CSV or XLSX format."""
    query_filter = {}
    
    if start_date:
        query_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query_filter:
            query_filter["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query_filter["created_at"] = {"$lte": end_date + "T23:59:59"}
    if gerente:
        query_filter["gerente"] = gerente
    if operation_type:
        query_filter["operation_type"] = operation_type
    if card_type:
        query_filter["card_type"] = card_type
    if card_id:
        query_filter["card_id"] = card_id
    
    operations_cursor = db.operations.find(
        query_filter,
        {"_id": 0}
    ).sort("created_at", -1)
    
    operations = await operations_cursor.to_list(length=10000)
    
    headers = [
        "Fecha",
        "Cliente",
        "Teléfono",
        "Dispositivo",
        "Tarjeta ID",
        "Tipo de Tarjeta",
        "Operación",
        "Nota",
        "Monto",
        "Saldo",
        "Monto de compra",
        "Valor del Canje",
        "Gerente",
        "Email Gerente",
        "Fuente"
    ]
    
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        
        for op in operations:
            writer.writerow([
                op.get("created_at", ""),
                op.get("customer_name", ""),
                op.get("customer_phone", ""),
                op.get("device", ""),
                op.get("card_id", ""),
                op.get("card_type_label", op.get("card_type", "")),
                op.get("operation_label", op.get("operation_type", "")),
                op.get("note", ""),
                op.get("amount", ""),
                op.get("balance", ""),
                op.get("purchase_sum", ""),
                op.get("redeemed_value", ""),
                op.get("gerente", ""),
                op.get("gerente_email", ""),
                op.get("source", "scanner")
            ])
        
        output.seek(0)
        filename = f"operaciones_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
    
    elif format.lower() == "xlsx":
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, Alignment, PatternFill
            
            wb = Workbook()
            ws = wb.active
            ws.title = "Operaciones"
            
            header_font = Font(bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="120627", end_color="120627", fill_type="solid")
            
            for col, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal="center")
            
            for row_idx, op in enumerate(operations, 2):
                ws.cell(row=row_idx, column=1, value=op.get("created_at", ""))
                ws.cell(row=row_idx, column=2, value=op.get("customer_name", ""))
                ws.cell(row=row_idx, column=3, value=op.get("customer_phone", ""))
                ws.cell(row=row_idx, column=4, value=op.get("device", ""))
                ws.cell(row=row_idx, column=5, value=op.get("card_id", ""))
                ws.cell(row=row_idx, column=6, value=op.get("card_type_label", op.get("card_type", "")))
                ws.cell(row=row_idx, column=7, value=op.get("operation_label", op.get("operation_type", "")))
                ws.cell(row=row_idx, column=8, value=op.get("note", ""))
                ws.cell(row=row_idx, column=9, value=op.get("amount", ""))
                ws.cell(row=row_idx, column=10, value=op.get("balance", ""))
                ws.cell(row=row_idx, column=11, value=op.get("purchase_sum", ""))
                ws.cell(row=row_idx, column=12, value=op.get("redeemed_value", ""))
                ws.cell(row=row_idx, column=13, value=op.get("gerente", ""))
                ws.cell(row=row_idx, column=14, value=op.get("gerente_email", ""))
                ws.cell(row=row_idx, column=15, value=op.get("source", "scanner"))
            
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                ws.column_dimensions[column].width = adjusted_width
            
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            
            filename = f"operaciones_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.xlsx"
            
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        except ImportError:
            logger.warning("openpyxl not installed, falling back to CSV")
            raise HTTPException(status_code=400, detail="Formato XLSX no disponible. Use CSV.")
    
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Use 'csv' o 'xlsx'.")

@router.get("/summary")
async def get_operations_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    card_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics for operations."""
    query_filter = {}
    
    if start_date:
        query_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query_filter:
            query_filter["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query_filter["created_at"] = {"$lte": end_date + "T23:59:59"}
    if card_type:
        query_filter["card_type"] = card_type
    
    total_operations = await db.operations.count_documents(query_filter)
    
    pipeline = [
        {"$match": query_filter},
        {"$group": {
            "_id": "$gerente",
            "count": {"$sum": 1},
            "total_purchase_sum": {"$sum": {"$ifNull": ["$purchase_sum", 0]}},
            "total_redeemed_value": {"$sum": {"$ifNull": ["$redeemed_value", 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    
    by_gerente = await db.operations.aggregate(pipeline).to_list(length=100)
    
    pipeline_type = [
        {"$match": query_filter},
        {"$group": {
            "_id": "$operation_label",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    by_type = await db.operations.aggregate(pipeline_type).to_list(length=100)
    
    # Group by card type
    pipeline_card_type = [
        {"$match": query_filter},
        {"$group": {
            "_id": "$card_type_label",
            "count": {"$sum": 1},
            "card_type_key": {"$first": "$card_type"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    by_card_type = await db.operations.aggregate(pipeline_card_type).to_list(length=100)
    
    # Get available card types for filter dropdown
    card_types = await db.operations.distinct("card_type")
    
    return {
        "success": True,
        "summary": {
            "total_operations": total_operations,
            "by_gerente": by_gerente,
            "by_type": by_type,
            "by_card_type": by_card_type
        },
        "filters": {
            "card_types": card_types
        }
    }
