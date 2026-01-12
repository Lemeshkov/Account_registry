from sqlalchemy.orm import Session
from . import models
from typing import Dict, Any
from datetime import datetime
import json
import re                          # ✅ НУЖНЫЙ ИМПОРТ
from .utils.numbers import parse_number


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

        # НОРМАЛИЗАЦИЯ
        if isinstance(invoice, str):
            try:
                invoice = json.loads(invoice)
            except Exception:
                invoice = {}

        invoice = invoice or {}
        status = "MATCHED" if invoice else "WAITING_INVOICE"

        # ===== 🏷 ФОРМИРОВАНИЕ "ПОСТАВЩИК" =====
        supplier_display = None

        # 1️⃣ первое слово из техники
        if item.vehicle:
            supplier_display = item.vehicle.strip().split()[0]

        # 2️⃣ цифры из гос. номера
        if item.license_plate:
            m = re.search(r"\d+", item.license_plate)
            if m:
                digits = m.group(0)
                supplier_display = (
                    f"{supplier_display} №{digits}"
                    if supplier_display
                    else f"№{digits}"
        )

        preview.append({
            "id": item.id,
            "supplier": supplier_display,     # ← КОЛОНКА "ПОСТАВЩИК"
            "contractor": item.contractor,
            "vehicle": item.vehicle,
            "license_plate": item.license_plate,
            "amount": item.amount,
            "vat_amount": item.vat_amount,
            "comment": item.comment,
            "status": status,
            "invoice_confidence": item.invoice_confidence,
            "invoice_id": item.invoice_id,
            "invoice_details": invoice,
            "source": {
                "request": bool(item.matched_request_id),
                "invoice": bool(invoice),
            },
        })

    return preview


def apply_invoice_ocr_to_registry(
    db: Session,
    registry_id: int,
    invoice_data: Dict[str, Any],
):
    """
    Применяет OCR-инвойс к существующей строке реестра.
    PDF НИКОГДА не создаёт новые строки.
    """
    registry = db.query(models.PaymentRegistry).get(registry_id)
    if not registry:
        raise ValueError("PaymentRegistry not found")

    data = invoice_data.get("data") or {}
    confidence = invoice_data.get("confidence")

    applied_fields: list[str] = []

    #  OCR данные
    registry.invoice_id = invoice_data["id"]
    registry.invoice_details = data
    applied_fields.append("invoice_details")
    applied_fields.append("invoice_id")

    #  Confidence
    if confidence is not None:
        registry.invoice_confidence = confidence
        applied_fields.append("invoice_confidence")

    #  Суммы
    total = parse_number(data.get("total"))
    vat = parse_number(data.get("vat"))

    if total is not None and total > 0:
        registry.amount = total
        applied_fields.append("amount")

    if vat is not None and vat >= 0:
        registry.vat_amount = vat
        applied_fields.append("vat_amount")

    # 🏷 Контрагент
    supplier_raw = data.get("supplier")
    if supplier_raw:
        text = supplier_raw.upper()
        text = text.replace("О00", "ООО").replace("ОО0", "ООО")

        m = re.search(r'ООО\s*[«"]([^»"]+)[»"]', text)
        if m:
            registry.contractor = f'ООО "{m.group(1).title()}"'
            applied_fields.append("contractor")

    #  Номер и дата счета
        registry.invoice_details = data
        applied_fields.append("invoice_details")

    create_history(
        db,
        action="OCR_APPLY",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "confidence": confidence,
            "applied_fields": applied_fields,
        },
    )

    db.flush()
    return registry
