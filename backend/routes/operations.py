# Operations routes - Transaction history and reporting

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone, timedelta
import io
import csv
import logging
from utils.auth import get_current_user, require_super_admin
from utils.config import db
from utils.boomerang import OPERATION_TYPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/operations", tags=["operations"])

def _resolve_workspace_id(current_user: dict, workspace_id: Optional[str] = None) -> Optional[str]:
    """Only super_admin may target a workspace other than their own."""
    if workspace_id and current_user.get("role") == "super_admin":
        return workspace_id
    return current_user.get("workspace_id")

@router.get("")
async def get_operations(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    gerente: Optional[str] = None,
    operation_type: Optional[str] = None,
    card_type: Optional[str] = None,
    template_id: Optional[str] = None,
    card_id: Optional[str] = None,
    customer_phone: Optional[str] = None,
    page: int = 1,
    items_per_page: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get operations history with filtering."""
    query_filter = {}
    ws_id = current_user.get("workspace_id")
    if ws_id:
        query_filter["workspace_id"] = ws_id

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
    if template_id:
        query_filter["template_id"] = template_id
    if card_id:
        query_filter["card_id"] = card_id
    if customer_phone:
        query_filter["customer_phone"] = customer_phone

    skip = (page - 1) * items_per_page
    total_count = await db.operations.count_documents(query_filter)
    
    operations_cursor = db.operations.find(
        query_filter,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(items_per_page)
    
    operations = await operations_cursor.to_list(length=items_per_page)
    gerentes = await db.operations.distinct("gerente")
    operation_type_values = await db.operations.distinct("operation_type")
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
            # {value, label} so the filter dropdown can show the Spanish label
            # while still filtering by the raw operation_type stored on each
            # record — same OPERATION_TYPES dict already used to label rows.
            "operation_types": [
                {"value": t, "label": OPERATION_TYPES.get(t, t)} for t in operation_type_values
            ],
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
    template_id: Optional[str] = None,
    card_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export operations to CSV or XLSX format."""
    query_filter = {}
    ws_id = current_user.get("workspace_id")
    if ws_id:
        query_filter["workspace_id"] = ws_id

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
    if template_id:
        query_filter["template_id"] = template_id
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
                ws.cell(row=row_idx, column=12, value=op.get("gerente", ""))
                ws.cell(row=row_idx, column=13, value=op.get("gerente_email", ""))
                ws.cell(row=row_idx, column=14, value=op.get("source", "scanner"))
            
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except Exception:
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
    template_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics for operations."""
    query_filter = {}
    ws_id = current_user.get("workspace_id")
    if ws_id:
        query_filter["workspace_id"] = ws_id

    if start_date:
        query_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query_filter:
            query_filter["created_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query_filter["created_at"] = {"$lte": end_date + "T23:59:59"}
    if card_type:
        query_filter["card_type"] = card_type
    if template_id:
        query_filter["template_id"] = template_id
    
    total_operations = await db.operations.count_documents(query_filter)
    
    pipeline = [
        {"$match": query_filter},
        {"$group": {
            "_id": "$gerente",
            "count": {"$sum": 1},
            "total_purchase_sum": {"$sum": {"$ifNull": ["$purchase_sum", 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    
    by_gerente = await db.operations.aggregate(pipeline).to_list(length=100)

    # Get available card types for filter dropdown
    card_types = await db.operations.distinct("card_type")

    # --- Client-facing insights (same query_filter, so the whole dashboard
    # stays under one consistent date/card-type filter with no extra round trip) ---
    pipeline_totals = [
        {"$match": {**query_filter, "purchase_sum": {"$gt": 0}}},
        {"$group": {
            "_id": None,
            "total_facturacion": {"$sum": "$purchase_sum"},
            "avg_purchase": {"$avg": "$purchase_sum"}
        }}
    ]
    totals_result = await db.operations.aggregate(pipeline_totals).to_list(length=1)
    totals = totals_result[0] if totals_result else {"total_facturacion": 0, "avg_purchase": 0}

    pipeline_top_customers = [
        {"$match": {**query_filter, "customer_phone": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": "$customer_phone",
            "customer_name": {"$last": "$customer_name"},
            "visit_count": {"$sum": 1},
            "total_purchase": {"$sum": {"$ifNull": ["$purchase_sum", 0]}}
        }},
        {"$facet": {
            "by_visits": [{"$sort": {"visit_count": -1}}, {"$limit": 10}],
            "by_purchase": [{"$sort": {"total_purchase": -1}}, {"$limit": 10}]
        }}
    ]
    top_result = await db.operations.aggregate(pipeline_top_customers).to_list(length=1)
    top_customers = top_result[0] if top_result else {"by_visits": [], "by_purchase": []}

    # "Nuevos miembros" — first-ever operation (customer_stats.first_seen_at,
    # cheap indexed read) falling within this same filtered date range.
    new_members_filter = {"workspace_id": ws_id}
    if "created_at" in query_filter:
        new_members_filter["first_seen_at"] = query_filter["created_at"]
    nuevos_miembros = await db.customer_stats.count_documents(new_members_filter)

    # "Clientes habituales" — active in this filtered window AND >=2 visits ever.
    active_phones = await db.operations.distinct(
        "customer_phone", {**query_filter, "customer_phone": {"$nin": [None, ""]}}
    )
    clientes_habituales = 0
    if active_phones:
        clientes_habituales = await db.customer_stats.count_documents({
            "workspace_id": ws_id,
            "customer_phone": {"$in": active_phones},
            "total_visits": {"$gte": 2}
        })

    return {
        "success": True,
        "summary": {
            "total_operations": total_operations,
            "by_gerente": by_gerente,
            "customer_insights": {
                "total_visitas": total_operations,
                "nuevos_miembros": nuevos_miembros,
                "clientes_habituales": clientes_habituales,
                "total_facturacion": totals.get("total_facturacion", 0),
                "avg_purchase": totals.get("avg_purchase", 0),
                "top_customers_by_visits": top_customers.get("by_visits", []),
                "top_customers_by_purchase": top_customers.get("by_purchase", [])
            }
        },
        "filters": {
            "card_types": card_types
        }
    }

@router.get("/trend")
async def get_operations_trend(
    days: int = 30,
    card_type: Optional[str] = None,
    template_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Daily operations count + sales for the last N days, plus the prior
    N-day period's totals for a delta comparison — powers the dashboard's
    trend chart. Always bounded by `days` (unlike /summary, which is
    all-time by default) since an unbounded daily series isn't useful to
    chart and would mean scanning the full collection."""
    ws_id = current_user.get("workspace_id")
    days = max(7, min(days, 90))

    today = datetime.now(timezone.utc).date()
    current_start = today - timedelta(days=days - 1)
    previous_start = current_start - timedelta(days=days)
    previous_end = current_start - timedelta(days=1)

    base_filter = {}
    if ws_id:
        base_filter["workspace_id"] = ws_id
    if card_type:
        base_filter["card_type"] = card_type
    if template_id:
        base_filter["template_id"] = template_id

    current_filter = {**base_filter, "created_at": {"$gte": current_start.isoformat(), "$lte": today.isoformat() + "T23:59:59"}}
    previous_filter = {**base_filter, "created_at": {"$gte": previous_start.isoformat(), "$lte": previous_end.isoformat() + "T23:59:59"}}

    # Bucket by day using the first 10 chars of the ISO-string created_at
    # ("YYYY-MM-DD...") — same string-comparison approach already used for
    # date-range filtering everywhere else in this file, no $dateFromString
    # cast needed.
    pipeline_series = [
        {"$match": current_filter},
        {"$group": {
            "_id": {"$substrCP": ["$created_at", 0, 10]},
            "operations_count": {"$sum": 1},
            "sales_total": {"$sum": {"$ifNull": ["$purchase_sum", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    raw_series = await db.operations.aggregate(pipeline_series).to_list(length=100)
    by_date = {row["_id"]: row for row in raw_series}

    # Fill days with no activity as zeros so the chart's x-axis is continuous.
    series = []
    for i in range(days):
        d = (current_start + timedelta(days=i)).isoformat()
        row = by_date.get(d, {})
        series.append({
            "date": d,
            "operations_count": row.get("operations_count", 0),
            "sales_total": row.get("sales_total", 0)
        })

    pipeline_previous = [
        {"$match": previous_filter},
        {"$group": {
            "_id": None,
            "operations_count": {"$sum": 1},
            "sales_total": {"$sum": {"$ifNull": ["$purchase_sum", 0]}}
        }}
    ]
    prev_result = await db.operations.aggregate(pipeline_previous).to_list(length=1)
    previous_totals = prev_result[0] if prev_result else {"operations_count": 0, "sales_total": 0}

    current_totals = {
        "operations_count": sum(d["operations_count"] for d in series),
        "sales_total": sum(d["sales_total"] for d in series)
    }

    return {
        "success": True,
        "days": days,
        "series": series,
        "current_period": current_totals,
        "previous_period": {
            "operations_count": previous_totals.get("operations_count", 0),
            "sales_total": previous_totals.get("sales_total", 0)
        }
    }

@router.delete("/reset")
async def reset_operations(
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """Permanently delete all operation history for a workspace. Devotio-only,
    destructive and irreversible — used when a business wants a clean slate
    for its statistics (e.g. after a testing period)."""
    ws_id = _resolve_workspace_id(current_user, workspace_id)
    if not ws_id:
        raise HTTPException(status_code=400, detail="Debe especificar un workspace")
    result = await db.operations.delete_many({"workspace_id": ws_id})
    return {"success": True, "deleted_count": result.deleted_count}
