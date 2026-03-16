
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
from sqlalchemy.orm import relationship 
from sqlalchemy.sql import func
from database import Base


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
        # Защита от дублей Excel в рамках одного batch
        UniqueConstraint(
            "imported_batch",
            "license_plate",
            "amount",
            name="uq_payment_registry_batch_plate_amount",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # ⭐⭐ ВАЖНО: Добавляем поле для сохранения порядка строк ⭐⭐
    position = Column(Integer, nullable=False, default=0, index=True)
    
    invoice_id = Column(String, index=True, nullable=True)
    number = Column(String, index=True, nullable=True)      # № строки реестра
    supplier = Column(String, nullable=True)                # Поставщик
    contractor = Column(String, nullable=True)              # Контрагент
    payer = Column(String, nullable=True)                   # Плательщик

    # Деньги — ТОЛЬКО Numeric (PostgreSQL-safe)
    amount = Column(Numeric(12, 2), nullable=False)
    vat_amount = Column(Numeric(12, 2), nullable=True)

    included_in_plan = Column(Boolean, nullable=True)
    payment_system = Column(String, nullable=True)
    comment = Column(Text, nullable=True)

    vehicle = Column(String, nullable=True)
    license_plate = Column(String, index=True, nullable=True)

    # OCR / PDF
    invoice_details = Column(JSON, nullable=True)            # данные OCR (data)
    invoice_confidence = Column(Numeric(4, 3), nullable=True)  # 0.000 – 1.000
    invoice_full_text = Column(Text, nullable=True)           # текстовое представление счета

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


# -------------------------------------------------------------------
# INVOICE LINES
# -------------------------------------------------------------------

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = Column(Integer, primary_key=True, index=True)

    invoice_id = Column(String, index=True, nullable=False)   # UUID из buffer
    batch_id = Column(String, index=True, nullable=False)

    line_no = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)

    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)

    used = Column(Boolean, default=False)

    raw = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "invoice_id",
            "line_no",
            name="uq_invoice_line_invoice_line_no",
        ),
    )

    # -------------------------------------------------------------------
# DEFECT SHEET (Дефектная ведомость)
# -------------------------------------------------------------------

class DefectSheet(Base):
    __tablename__ = "defect_sheets"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True, nullable=False)  # для группировки загрузок
    file_name = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pending")  # pending, processed, calculated, exported
    
    # Метаданные из шапки документа
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

     #  поля для согласования
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    status = Column(String, default="draft")  # "draft", "pending", "approved", "rejected"
    
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_comment = Column(Text, nullable=True)
    
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Для версионности
    version = Column(Integer, default=1)
    previous_version_id = Column(Integer, ForeignKey("defect_sheets.id"), nullable=True)


class ApprovalNotification(Base):
    __tablename__ = "approval_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    sheet_id = Column(Integer, ForeignKey("defect_sheets.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    message = Column(String, nullable=False)
    status = Column(String, default="unread")  # "unread", "read", "processed"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Связи
    sheet = relationship("DefectSheet", backref="approval_notifications")
    approver = relationship("User", foreign_keys=[approver_id])
    created_by = relationship("User", foreign_keys=[created_by_id])   


class DefectSheetItem(Base):
    __tablename__ = "defect_sheet_items"
    __table_args__ = (
        UniqueConstraint("sheet_id", "position", name="uq_defect_sheet_position"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sheet_id = Column(Integer, ForeignKey("defect_sheets.id", ondelete="CASCADE"), nullable=False)
    
    # Позиция в исходном документе
    position = Column(Integer, nullable=False)
    
    # ДОБАВЛЯЕМ эти поля - их не хватает!
    excel_position = Column(Integer, nullable=True)  # оригинальный номер из Excel
    subposition = Column(Integer, default=1)  # для множественных запчастей
    
    # Данные из Excel (маппинг согласно ТЗ)
    address = Column(String, nullable=True)  # из поля "Марка"
    material_name = Column(String, nullable=True)  # из поля "Наименование зап.части"
    requested_quantity = Column(Numeric(12, 3), nullable=True)  # из поля "Затреб" (в тоннах)
    
    # Дополнительные поля для контекста
    requirement_number = Column(String, nullable=True)  # номер требования
    requirement_date = Column(DateTime, nullable=True)
    car_brand = Column(String, nullable=True)
    license_plate = Column(String, nullable=True)
    recipient = Column(String, nullable=True)  # получатель
    article = Column(String, nullable=True)  # номенкл. номер (добавьте, если нужно)
    
    # Поля для калькулятора металлопроката
    profile_type = Column(String, nullable=True)  # тип профиля (труба, и т.д.)
    profile_params = Column(JSON, nullable=True)  # параметры профиля {d: 100, t: 5} для трубы
    weight_tons = Column(Numeric(12, 3), nullable=True)  # исходный вес в тоннах (дублирует requested_quantity для ясности)
    calculated_meters = Column(Numeric(12, 2), nullable=True)  # пересчитанные метры
    formula_used = Column(String, nullable=True)  # использованная формула
    is_calculated = Column(Boolean, default=False)
    
    # Статус
    selected_for_calculation = Column(Boolean, default=False)  # выбрана для пересчета
    calculated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Связи
    sheet = relationship("DefectSheet", backref="items")

#  модели юзеров
    
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String, default="user")  # "user", "approver", "admin"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    created_sheets = relationship("DefectSheet", foreign_keys="DefectSheet.created_by", backref="creator")
    approved_sheets = relationship("DefectSheet", foreign_keys="DefectSheet.approved_by", backref="approver")
