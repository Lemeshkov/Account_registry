from sqlalchemy.orm import Session
from backend.models import PaymentRegistry
from sqlalchemy import func

def try_match_invoice(
    db: Session,
    invoice_data: dict,
    batch_id: str | None = None
) -> PaymentRegistry | None:

    total = invoice_data.get("total")
    license_plate = invoice_data.get("license_plate")

    query = db.query(PaymentRegistry).filter(
        PaymentRegistry.invoice_details.is_(None)
    )

    if batch_id:
        query = query.filter(PaymentRegistry.imported_batch == batch_id)

    # 1️⃣ По госномеру
    if license_plate:
        match = query.filter(
            PaymentRegistry.license_plate.ilike(f"%{license_plate}%")
        ).first()
        if match:
            return match

    # 2️⃣ По сумме (±1)
    if total:
        try:
            total = float(str(total).replace(",", "."))
            match = query.filter(
                PaymentRegistry.amount.between(total - 1, total + 1)
            ).first()
            if match:
                return match
        except Exception:
            pass

    # 3️⃣ Если осталась одна строка
    candidates = query.all()
    if len(candidates) == 1:
        return candidates[0]

    return None
