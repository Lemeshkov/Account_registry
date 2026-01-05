from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from .database import Base


# -------------------------------------------------------------------
# IMPORTED REQUESTS (из Excel)
# -------------------------------------------------------------------

class ImportedRequest(Base):
    __tablename__ = "imported_requests"

    id = Column(Integer, primary_key=True, index=True)

    request_number = Column(String, index=True, nullable=True)
    request_date = Column(DateTime, nullable=True)

    car_brand = Column(String, nullable=True)
    license_plate = Column(String, nullable=True)

    item_name = Column(String, nullable=True)
    article = Column(String, nullable=True)

    quantity = Column(Integer, nullable=True)
    approved = Column(Boolean, nullable=True)

    completion_date = Column(DateTime, nullable=True)

    import_batch = Column(String, index=True, nullable=False)
    file_name = Column(String, nullable=True)
    file_type = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# -------------------------------------------------------------------
# PAYMENT REGISTRY
# -------------------------------------------------------------------

class PaymentRegistry(Base):
    __tablename__ = "payment_registry"
    __table_args__ = (
        # 🔒 Защита от дублей Excel в рамках одного batch
        UniqueConstraint(
            "imported_batch",
            "license_plate",
            "amount",
            name="uq_payment_registry_batch_plate_amount",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    number = Column(String, index=True, nullable=True)      # № строки реестра
    supplier = Column(String, nullable=True)                # Поставщик
    contractor = Column(String, nullable=True)              # Контрагент
    payer = Column(String, nullable=True)                   # Плательщик

    # 💰 Деньги — ТОЛЬКО Numeric (PostgreSQL-safe)
    amount = Column(Numeric(12, 2), nullable=False)
    vat_amount = Column(Numeric(12, 2), nullable=True)

    included_in_plan = Column(Boolean, nullable=True)
    payment_system = Column(String, nullable=True)
    comment = Column(Text, nullable=True)

    vehicle = Column(String, nullable=True)
    license_plate = Column(String, index=True, nullable=True)

    # 📄 OCR / PDF
    invoice_details = Column(JSON, nullable=True)            # данные OCR (data)
    invoice_confidence = Column(Numeric(4, 3), nullable=True)  # 0.000 – 1.000

    matched_request_id = Column(
        Integer,
        ForeignKey("imported_requests.id"),
        nullable=True,
    )

    imported_batch = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# -------------------------------------------------------------------
# HISTORY LOG
# -------------------------------------------------------------------

class HistoryLog(Base):
    __tablename__ = "history_log"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, index=True)          # CREATE / UPDATE / MATCH / OCR
    entity = Column(String, index=True)          # PaymentRegistry / ImportedRequest
    entity_id = Column(Integer, index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user = Column(String, nullable=True)
    details = Column(JSON)
