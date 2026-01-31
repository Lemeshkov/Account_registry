from sqlalchemy.orm import Session
from . import models
from typing import Dict, Any
from datetime import datetime
import json
import re                       
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
        if item.vehicle:
            supplier_display = item.vehicle.strip().split()[0]
        if item.license_plate:
            m = re.search(r"\d+", item.license_plate)
            if m:
                digits = m.group(0)
                supplier_display = (
                    f"{supplier_display} №{digits}"
                    if supplier_display
                    else f"№{digits}"
                )

        # ==== КОНТРАГЕНТ ====
        contractor = (
           item.contractor.strip()
           if item.contractor and item.contractor.strip()
           else invoice.get("contractor")
        )
        
        # ==== invoice_full_text - создаем если нет ====
        invoice_full_text = invoice.get("invoice_full_text")
        if not invoice_full_text:
            invoice_number = invoice.get("invoice_number")
            invoice_date = invoice.get("invoice_date")
            if invoice_number and invoice_date:
                invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                invoice_full_text = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                invoice_full_text = f"Счет от {invoice_date}"
            else:
                invoice_full_text = ""

        preview.append({
            "id": item.id,
            "batch_id": batch_id,  # ВАЖНО: добавляем batch_id!
            "imported_batch": item.imported_batch,  # На всякий случай тоже добавляем
            "supplier": supplier_display,
            "contractor": contractor,
            "invoice_full_text": invoice_full_text,
            "vehicle": item.vehicle,
            "license_plate": item.license_plate,
            "amount": item.amount,
            "vat_amount": item.vat_amount,
            "comment": item.comment,
            "status": status,
            "invoice_confidence": item.invoice_confidence,
            "invoice_id": item.invoice_id,
            "invoice_details": invoice,  # Содержит contractor, invoice_number, invoice_date и т.д.
            "payer": item.payer,  # Добавляем тоже
            "payment_system": item.payment_system,  # Добавляем тоже
            "source": {
                "request": bool(item.matched_request_id),
                "invoice": bool(invoice),
            },
        })
    
    print(f"\n=== DEBUG build_registry_from_batch ===")
    print(f"Batch ID: {batch_id}")
    print(f"Found {len(preview)} registry items")
    if preview:
        print(f"First item batch_id: {preview[0].get('batch_id')}")
        print(f"First item imported_batch: {preview[0].get('imported_batch')}")

    return preview


def apply_invoice_ocr_to_registry(
    db: Session, 
    registry_id: int, 
    invoice_data: dict,
    apply_full_metadata: bool = True,  # Новый параметр
    line_no: int = None  # Номер строки счета для частичного применения
):
    """
    Применить данные счета к строке реестра.
    
    Args:
        apply_full_metadata: Если True - применяет все метаданные счета
                            Если False - применяет только выбранные поля
        line_no: Номер строки счета (для частичного применения суммы)
    """
    registry = db.query(models.PaymentRegistry).get(registry_id)
    if not registry:
        raise ValueError("PaymentRegistry not found")

    data = invoice_data.get("data") or {}
    confidence = invoice_data.get("confidence")
    applied_fields = []

    # --- Основные поля, которые применяются всегда ---
    if invoice_data.get("id"):
        registry.invoice_id = invoice_data["id"]
        applied_fields.append("invoice_id")
    
    # Сохраняем полные данные счета в details
    registry.invoice_details = data
    applied_fields.append("invoice_details")

    if confidence is not None:
        registry.invoice_confidence = confidence
        applied_fields.append("invoice_confidence")

    # --- Метаданные применяются ТОЛЬКО если apply_full_metadata = True ---
    if apply_full_metadata:
        # Contractor / контрагент
        contractor = data.get("contractor")
        if contractor:
            registry.contractor = contractor
            applied_fields.append("contractor")

        # Invoice full text / реквизиты счета
        invoice_full_text = data.get("invoice_full_text")
        if not invoice_full_text:
            # Собираем из invoice_number и invoice_date
            invoice_number = data.get("invoice_number")
            invoice_date = data.get("invoice_date")
            if invoice_number and invoice_date:
                invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                invoice_full_text = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                invoice_full_text = f"Счет от {invoice_date}"
        
        if invoice_full_text:
            registry.invoice_full_text = invoice_full_text
            applied_fields.append("invoice_full_text")

    # --- Amounts: логика для частичного применения ---
    total = parse_number(data.get("total"))
    vat = parse_number(data.get("vat"))
    
    if line_no is not None:
        # Если указан номер строки, ищем конкретную строку в счете
        invoice_lines = invoice_data.get("lines", [])
        if line_no < len(invoice_lines):
            line_data = invoice_lines[line_no]
            line_total = parse_number(line_data.get("total") or line_data.get("amount"))
            if line_total and line_total > 0:
                registry.amount = line_total
                applied_fields.append("amount (from line)")
    elif total and total > 0:
        # Если не указана строка, применяем общую сумму
        registry.amount = total
        applied_fields.append("amount")
    
    if vat is not None and vat >= 0:
        registry.vat_amount = vat
        applied_fields.append("vat_amount")

    create_history(
        db,
        action="OCR_APPLY",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "confidence": confidence,
            "applied_fields": applied_fields,
            "apply_full_metadata": apply_full_metadata,
            "line_no": line_no,
            "data_preview": {
                "contractor": data.get("contractor"),
                "invoice_number": data.get("invoice_number"),
                "invoice_date": data.get("invoice_date"),
                "total": data.get("total"),
            }
        },
    )

    db.flush()
    return registry





