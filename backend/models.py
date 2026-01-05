              # JSON с деталями (old/new/row)
# backend/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base

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

    import_batch = Column(String, index=True, nullable=True)
    file_name = Column(String, nullable=True)
    file_type = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PaymentRegistry(Base):
    __tablename__ = "payment_registry"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, index=True, nullable=True)          # поле "№" реестра
    supplier = Column(String, nullable=True)                    # Поставщик
    invoice_details = Column(JSON, nullable=True)               # Реквизиты счета
    contractor = Column(String, nullable=True)                  # Контрагент
    payer = Column(String, nullable=True)                       # Плательщик

    amount = Column(Float, nullable=True)                       # Сумма
    vat_amount = Column(Float, nullable=True)                   # в т.ч. НДС
    included_in_plan = Column(Boolean, nullable=True)           # Учтено в фин.плане
    payment_system = Column(String, nullable=True)              # Система расчетов
    comment = Column(Text, nullable=True)                       # Комментарий

    vehicle = Column(String, nullable=True)                     # Техника
    license_plate = Column(String, nullable=True)               # Гос номер

    matched_request_id = Column(Integer, ForeignKey("imported_requests.id"), nullable=True)
    imported_batch = Column(String, index=True, nullable=True)  # батч/сессия создания реестра
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class HistoryLog(Base):
    __tablename__ = "history_log"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, index=True)      # CREATE / UPDATE / DELETE / IMPORT / MATCH
    entity = Column(String, index=True)      # ImportedRequest / PaymentRegistry / User
    entity_id = Column(Integer, index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user = Column(String, nullable=True)     # опционально: кто сделал действие
    details = Column(JSON)                   # JSON с деталями (old/new/row)
