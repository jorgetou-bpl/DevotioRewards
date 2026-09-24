# Operations routes - Transaction history and reporting

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import io
import csv
import logging
from utils.auth import get_current_user, require_super_admin
from utils.config import db
from utils.boomerang import OPERATION_TYPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/operations", tags=["operations"])

# Same assumption as utils/geo_scheduler.py: Devotio's whole current book of
# business is Costa Rica. Needed here specifically for hourly "Hoy" bucketing
# — created_at is stored as UTC, and CR is UTC-6, so a raw UTC-hour slice
# would show a customer's 8am visit as "14:00".
APP_TIMEZONE = ZoneInfo("America/Costa_Rica")

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

@router.get("/rewards-summary")
async def get_rewards_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Emitted-vs-redeemed rewards, from db.rewards_earned (written in
    routes/cards.py: one doc per reward tier reached, status flips
    pending->redeemed with a captured redeemed_value). That field was
    already being recorded on every redemption but never aggregated
    anywhere until now. Same start_date/end_date convention as /summary,
    matched against earned_at (when the reward was reached, not redeemed) so
    this stays on the same filter as the rest of the dashboard."""
    ws_id = current_user.get("workspace_id")
    query_filter = {"workspace_id": ws_id} if ws_id else {}

    if start_date:
        query_filter["earned_at"] = {"$gte": start_date}
    if end_date:
        if "earned_at" in query_filter:
            query_filter["earned_at"]["$lte"] = end_date + "T23:59:59"
        else:
            query_filter["earned_at"] = {"$lte": end_date + "T23:59:59"}

    issued_count = await db.rewards_earned.count_documents(query_filter)
    redeemed_pipeline = [
        {"$match": {**query_filter, "status": "redeemed"}},
        {"$group": {
            "_id": None,
            "redeemed_count": {"$sum": 1},
            "redeemed_value_total": {"$sum": {"$ifNull": ["$redeemed_value", 0]}}
        }}
    ]
    redeemed_result = await db.rewards_earned.aggregate(redeemed_pipeline).to_list(length=1)
    redeemed = redeemed_result[0] if redeemed_result else {"redeemed_count": 0, "redeemed_value_total": 0}

    redeemed_count = redeemed.get("redeemed_count", 0)
    return {
        "success": True,
        "rewards": {
            "issued_count": issued_count,
            "redeemed_count": redeemed_count,
            "redemption_rate": (redeemed_count / issued_count) if issued_count else 0,
            "redeemed_value_total": redeemed.get("redeemed_value_total", 0)
        }
    }


async def _get_hourly_trend(ws_id: Optional[str], card_type: Optional[str], template_id: Optional[str]):
    """Today, bucketed by hour in Costa Rica local time — not the UTC hour
    created_at is stored in, which would shift every bucket by 6 hours.
    Compares against the same hour range yesterday. Reads matching docs and
    buckets in Python (small dataset — bounded to ~1-2 days of one
    workspace's operations) rather than a Mongo $dateTrunc pipeline, since
    Mongo has no built-in "convert to this IANA zone" aggregation stage."""
    now_cr = datetime.now(APP_TIMEZONE)
    today_start_cr = now_cr.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_cr = today_start_cr - timedelta(days=1)

    base_filter = {}
    if ws_id:
        base_filter["workspace_id"] = ws_id
    if card_type:
        base_filter["card_type"] = card_type
    if template_id:
        base_filter["template_id"] = template_id

    async def _bucket_by_hour(range_start_cr):
        range_end_cr = range_start_cr + timedelta(days=1)
        query_filter = {
            **base_filter,
            "created_at": {
                "$gte": range_start_cr.astimezone(timezone.utc).isoformat(),
                "$lt": range_end_cr.astimezone(timezone.utc).isoformat()
            }
        }
        buckets = {h: {"operations_count": 0, "sales_total": 0, "customers": set(), "purchase_sum_total": 0, "purchase_count": 0} for h in range(24)}
        cursor = db.operations.find(query_filter, {"created_at": 1, "purchase_sum": 1, "customer_phone": 1})
        async for doc in cursor:
            try:
                local_dt = datetime.fromisoformat(doc["created_at"]).astimezone(APP_TIMEZONE)
            except (ValueError, TypeError, KeyError):
                continue
            if local_dt.date() != range_start_cr.date():
                continue  # guards against any stray cross-boundary doc
            bucket = buckets[local_dt.hour]
            bucket["operations_count"] += 1
            purchase_sum = doc.get("purchase_sum") or 0
            bucket["sales_total"] += purchase_sum
            if doc.get("customer_phone"):
                bucket["customers"].add(doc["customer_phone"])
            if purchase_sum > 0:
                bucket["purchase_sum_total"] += purchase_sum
                bucket["purchase_count"] += 1
        return buckets

    today_buckets = await _bucket_by_hour(today_start_cr)
    yesterday_buckets = await _bucket_by_hour(yesterday_start_cr)

    series = [
        {
            "date": f"{h:02d}:00",
            "operations_count": today_buckets[h]["operations_count"],
            "sales_total": today_buckets[h]["sales_total"],
            "active_customers": len(today_buckets[h]["customers"]),
            "avg_spend": (today_buckets[h]["purchase_sum_total"] / today_buckets[h]["purchase_count"]) if today_buckets[h]["purchase_count"] else 0
        }
        for h in range(24)
    ]
    current_totals = {
        "operations_count": sum(b["operations_count"] for b in today_buckets.values()),
        "sales_total": sum(b["sales_total"] for b in today_buckets.values())
    }
    previous_totals = {
        "operations_count": sum(b["operations_count"] for b in yesterday_buckets.values()),
        "sales_total": sum(b["sales_total"] for b in yesterday_buckets.values())
    }

    return {
        "success": True,
        "granularity": "hour",
        "series": series,
        "current_period": current_totals,
        "previous_period": previous_totals
    }


@router.get("/trend")
async def get_operations_trend(
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    granularity: str = "day",
    card_type: Optional[str] = None,
    template_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Operations count + sales bucketed by day, plus the prior period's
    totals for a delta comparison — powers the dashboard's trend chart (and,
    via the same payload, Active Customers / Avg Spend, which reuse this
    series rather than fetching separately).

    start_date/end_date (same convention as /summary) take precedence when
    given — this is what the single page-level date filter now drives,
    instead of this chart having its own separate period selector. `days`
    (last N days ending today) is kept as a fallback for any caller that
    doesn't pass explicit dates.

    granularity="hour" switches to today-only, bucketed by hour in Costa
    Rica local time (see _get_hourly_trend) — everything else is ignored in
    that mode. The frontend triggers it when start_date == end_date == today."""
    ws_id = current_user.get("workspace_id")

    if granularity == "hour":
        return await _get_hourly_trend(ws_id, card_type, template_id)

    today = datetime.now(timezone.utc).date()
    if start_date and end_date:
        current_start = datetime.fromisoformat(start_date).date()
        current_end = datetime.fromisoformat(end_date).date()
        days = (current_end - current_start).days + 1
    else:
        days = max(7, min(days, 90))
        current_start = today - timedelta(days=days - 1)
        current_end = today
    previous_start = current_start - timedelta(days=days)
    previous_end = current_start - timedelta(days=1)

    base_filter = {}
    if ws_id:
        base_filter["workspace_id"] = ws_id
    if card_type:
        base_filter["card_type"] = card_type
    if template_id:
        base_filter["template_id"] = template_id

    current_filter = {**base_filter, "created_at": {"$gte": current_start.isoformat(), "$lte": current_end.isoformat() + "T23:59:59"}}
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
            "sales_total": {"$sum": {"$ifNull": ["$purchase_sum", 0]}},
            "customers": {"$addToSet": "$customer_phone"},
            # Same "average of purchases that had revenue" definition as
            # /summary's avg_purchase — not sales_total/operations_count,
            # which would be diluted by non-purchase ops (e.g. redemptions).
            "purchase_sum_total": {"$sum": {"$cond": [{"$gt": ["$purchase_sum", 0]}, "$purchase_sum", 0]}},
            "purchase_count": {"$sum": {"$cond": [{"$gt": ["$purchase_sum", 0]}, 1, 0]}}
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
        purchase_count = row.get("purchase_count", 0)
        active_customers = len({c for c in row.get("customers", []) if c})
        series.append({
            "date": d,
            "operations_count": row.get("operations_count", 0),
            "sales_total": row.get("sales_total", 0),
            "active_customers": active_customers,
            "avg_spend": (row.get("purchase_sum_total", 0) / purchase_count) if purchase_count else 0
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
        "granularity": "day",
        "days": days,
        "series": series,
        "current_period": current_totals,
        "previous_period": {
            "operations_count": previous_totals.get("operations_count", 0),
            "sales_total": previous_totals.get("sales_total", 0)
        }
    }


@router.get("/enrollment-trend")
async def get_enrollment_trend(
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Tasa de Inscripción per día: qué % de las visitas de ese día fueron de
    un cliente nuevo (customer_stats.first_seen_at cayendo ese día) frente al
    total de visitas del día. Same start_date/end_date-takes-precedence
    convention as /trend, driven by the same page-level filter — no separate
    period selector on this chart either. Endpoint stays separate from
    /trend itself since it crosses a different collection (customer_stats)
    and lives in a different dashboard pillar (Desempeño, not Visitas)."""
    ws_id = current_user.get("workspace_id")
    today = datetime.now(timezone.utc).date()
    if start_date and end_date:
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date()
        days = (end - start).days + 1
    else:
        days = max(7, min(days, 90))
        start = today - timedelta(days=days - 1)
        end = today

    ops_filter = {"created_at": {"$gte": start.isoformat(), "$lte": end.isoformat() + "T23:59:59"}}
    if ws_id:
        ops_filter["workspace_id"] = ws_id
    visits_pipeline = [
        {"$match": ops_filter},
        {"$group": {"_id": {"$substrCP": ["$created_at", 0, 10]}, "total_visits": {"$sum": 1}}}
    ]
    visits_by_day = {r["_id"]: r["total_visits"] for r in await db.operations.aggregate(visits_pipeline).to_list(length=100)}

    new_filter = {"first_seen_at": {"$gte": start.isoformat(), "$lte": end.isoformat() + "T23:59:59"}}
    if ws_id:
        new_filter["workspace_id"] = ws_id
    new_pipeline = [
        {"$match": new_filter},
        {"$group": {"_id": {"$substrCP": ["$first_seen_at", 0, 10]}, "new_customers": {"$sum": 1}}}
    ]
    new_by_day = {r["_id"]: r["new_customers"] for r in await db.customer_stats.aggregate(new_pipeline).to_list(length=100)}

    series = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        total_visits = visits_by_day.get(d, 0)
        new_customers = new_by_day.get(d, 0)
        series.append({
            "date": d,
            "new_customers": new_customers,
            "total_visits": total_visits,
            "enrollment_rate": (new_customers / total_visits) if total_visits else 0
        })

    return {"success": True, "days": days, "series": series}


@router.get("/weekly-performance-trend")
async def get_weekly_performance_trend(
    weeks: int = 8,
    current_user: dict = Depends(get_current_user)
):
    """Engagement y Retención — a diferencia de /trend y /enrollment-trend,
    esto se calcula en semanas fijas, no días: con ventanas de un día,
    'clientes con 2+ visitas' o 'retención' casi no tiene señal (la mayoría
    de negocios no ven al mismo cliente dos veces en 24h). Cada semana corre
    lunes-domingo.

    - Tasa de Interacción (engagement_rate) = % de clientes activos esa
      semana que tuvieron 2+ visitas esa misma semana.
    - Tasa de Retención (retention_rate) = % de los clientes activos la
      semana anterior que también estuvieron activos esta semana — retención
      período a período, no cohortes (decisión confirmada con el cliente)."""
    ws_id = current_user.get("workspace_id")
    weeks = max(4, min(weeks, 26))

    today = datetime.now(timezone.utc).date()
    this_monday = today - timedelta(days=today.weekday())
    # +1 extra week so the oldest requested week has a "previous week" to
    # compare against for its own retention_rate.
    earliest_monday = this_monday - timedelta(weeks=weeks)

    base_filter = {"workspace_id": ws_id} if ws_id else {}
    query_filter = {
        **base_filter,
        "created_at": {"$gte": earliest_monday.isoformat(), "$lte": today.isoformat() + "T23:59:59"}
    }

    # customers_by_week[monday_iso] = {customer_phone: visit_count_that_week}
    customers_by_week = {}
    cursor = db.operations.find(query_filter, {"created_at": 1, "customer_phone": 1})
    async for doc in cursor:
        phone = doc.get("customer_phone")
        if not phone:
            continue
        try:
            doc_date = datetime.fromisoformat(doc["created_at"]).date()
        except (ValueError, TypeError):
            continue
        monday = (doc_date - timedelta(days=doc_date.weekday())).isoformat()
        week_map = customers_by_week.setdefault(monday, {})
        week_map[phone] = week_map.get(phone, 0) + 1

    series = []
    for i in range(weeks):
        week_start = earliest_monday + timedelta(weeks=i + 1)  # skip the extra lookback week
        prev_week_start = week_start - timedelta(weeks=1)
        week_customers = customers_by_week.get(week_start.isoformat(), {})
        prev_customers = customers_by_week.get(prev_week_start.isoformat(), {})

        active_count = len(week_customers)
        engaged_count = sum(1 for v in week_customers.values() if v >= 2)
        retained_count = len(set(week_customers.keys()) & set(prev_customers.keys()))

        series.append({
            "week_start": week_start.isoformat(),
            "active_customers": active_count,
            "engagement_rate": (engaged_count / active_count) if active_count else 0,
            "retention_rate": (retained_count / len(prev_customers)) if prev_customers else 0
        })

    return {"success": True, "weeks": weeks, "series": series}


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
