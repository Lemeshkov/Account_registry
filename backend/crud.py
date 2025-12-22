from sqlalchemy.orm import Session
from . import models
from typing import Dict, Any
from datetime import datetime

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
    imported_requests = (
        db.query(models.ImportedRequest)
        .filter_by(import_batch=batch_id)
        .all()
    )

    registry_preview = []

    for req in imported_requests:
        data = {
            "number": None,
            "supplier": req.car_brand,          #  МАРКА → ПОСТАВЩИК
            "invoice_details": None,
            "contractor": None,
            "payer": None,
            "amount": None,
            "vat_amount": None,
            "included_in_plan": None,
            "payment_system": None,
            "comment": req.item_name,            #  НАИМЕНОВАНИЕ → КОММЕНТАРИЙ
            "vehicle": req.car_brand,            #  МАРКА → ТЕХНИКА
            "license_plate": req.license_plate,  #  ГОС НОМЕР
            "imported_batch": batch_id,
            "matched_request_id": req.id,
        }

        obj = create_payment_registry_item(db, data, batch_id)

        registry_preview.append({
            "id": obj.id,
            "supplier": obj.supplier,
            "invoice_details": obj.invoice_details,
            "contractor": obj.contractor,
            "payer": obj.payer,
            "amount": obj.amount,
            "vat_amount": obj.vat_amount,
            "included_in_plan": obj.included_in_plan,
            "payment_system": obj.payment_system,
            "comment": obj.comment,
            "vehicle": obj.vehicle,
            "license_plate": obj.license_plate,
        })

    db.commit()
    return registry_preview
