from sqlalchemy.orm import Session
from . import models
from typing import Dict, Any
from datetime import datetime
import json


def _json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value

def create_imported_request(db: Session, data: Dict[str, Any], batch_id: str, file_name: str, file_type: str):
    payload = dict(data)
    payload['import_batch'] = batch_id
    payload['file_name'] = file_name
    payload['file_type'] = file_type

    obj = models.ImportedRequest(**payload)
    db.add(obj)
    db.flush()
    create_history(db, action="IMPORT", entity="ImportedRequest", entity_id=obj.id, details=payload)
    return obj

def create_payment_registry_item(db: Session, data: Dict[str, Any], batch_id: str):
    payload = dict(data)
    payload['imported_batch'] = batch_id
    obj = models.PaymentRegistry(**payload)
    db.add(obj)
    db.flush()
    create_history(db, action="CREATE", entity="PaymentRegistry", entity_id=obj.id, details=payload)
    return obj

def create_history(db: Session, action: str, entity: str, entity_id: int = None, user: str = None, details: Any = None):
    safe_details = _json_safe(details)
    entry = models.HistoryLog(
        action=action,
        entity=entity,
        entity_id=entity_id,
        user=user,
        details=safe_details
    )
    db.add(entry)
    return entry

def build_registry_from_batch(db: Session, batch_id: str):
    registry_items = (
        db.query(models.PaymentRegistry)
        .filter(models.PaymentRegistry.imported_batch == batch_id)
        .all()
    )

    preview = []

    for item in registry_items:
        invoice = item.invoice_details

        # 🔥 НОРМАЛИЗАЦИЯ
        if isinstance(invoice, str):
            try:
                invoice = json.loads(invoice)
            except Exception:
                invoice = {}

        invoice = invoice or {}

        status = "WAITING_INVOICE"
        if invoice:
            status = "MATCHED"

        preview.append({
            "id": item.id,
            "supplier": item.supplier,
            "vehicle": item.vehicle,
            "license_plate": item.license_plate,
            "amount": item.amount,
            "vat_amount": item.vat_amount,
            "comment": item.comment,
            "status": status,
            "invoice_confidence": invoice.get("confidence"),
            "invoice_details": invoice,          # ← ВАЖНО ДЛЯ ФРОНТА
            "source": {
                "request": bool(item.matched_request_id),
                "invoice": bool(invoice),
            },
        })

    return preview


def apply_invoice_ocr_to_registry(db: Session, registry_id: int, invoice_data: Dict[str, Any]):
    """
    Применяет данные OCR счета к элементу реестра
    """
    registry = db.query(models.PaymentRegistry).get(registry_id)
    if not registry:
        raise ValueError("PaymentRegistry not found")

    data = invoice_data.get("data", {})
    confidence = invoice_data.get("confidence")

    registry.invoice_details = invoice_data

    if data.get("supplier"):
        registry.supplier = data["supplier"]
        
    from .crud import parse_number

    total = parse_number(data.get("total"))
    vat = parse_number(data.get("vat"))

    if total is not None:
       registry.amount = total
    if vat is not None:
       registry.vat_amount = vat


    create_history(
        db,
        action="OCR_APPLY",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "confidence": confidence,
            "applied_fields": list(data.keys())
        }
    )

    db.flush()
    return registry
 
def parse_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        value = value.replace(" ", "").replace(",", ".")
        try:
            return float(value)
        except ValueError:
            return None
    return None
