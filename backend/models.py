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
        UniqueConstraint(
            "imported_batch",
            "license_plate",
            "amount",
            name="uq_payment_registry_batch_plate_amount",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    position = Column(Integer, nullable=False, default=0, index=True)
    
    invoice_id = Column(String, index=True, nullable=True)
    number = Column(String, index=True, nullable=True)
    supplier = Column(String, nullable=True)
    contractor = Column(String, nullable=True)
    payer = Column(String, nullable=True)

    amount = Column(Numeric(12, 2), nullable=False)
    vat_amount = Column(Numeric(12, 2), nullable=True)

    included_in_plan = Column(Boolean, nullable=True)
    payment_system = Column(String, nullable=True)
    comment = Column(Text, nullable=True)

    vehicle = Column(String, nullable=True)
    license_plate = Column(String, index=True, nullable=True)

    invoice_details = Column(JSON, nullable=True)
    invoice_confidence = Column(Numeric(4, 3), nullable=True)
    invoice_full_text = Column(Text, nullable=True)

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
    action = Column(String, index=True)
    entity = Column(String, index=True)
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

    invoice_id = Column(String, index=True, nullable=False)
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
    batch_id = Column(String, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    
    status = Column(String, default="draft", nullable=False)
    
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    
    total_items = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_comment = Column(Text, nullable=True)
    
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    version = Column(Integer, default=1)
    previous_version_id = Column(Integer, ForeignKey("defect_sheets.id"), nullable=True)

    # Связи
    items = relationship("DefectSheetItem", back_populates="sheet", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    submitter = relationship("User", foreign_keys=[submitted_by])
    approver_user = relationship("User", foreign_keys=[approved_by])
    rejecter = relationship("User", foreign_keys=[rejected_by])


class DefectSheetItem(Base):
    __tablename__ = "defect_sheet_items"
    __table_args__ = (
        UniqueConstraint("sheet_id", "position", name="uq_defect_sheet_position"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sheet_id = Column(Integer, ForeignKey("defect_sheets.id", ondelete="CASCADE"), nullable=False)
    
    position = Column(Integer, nullable=False)
    
    excel_position = Column(Integer, nullable=True)
    subposition = Column(Integer, default=1)
    
    address = Column(String, nullable=True)
    material_name = Column(String, nullable=True)
    requested_quantity = Column(Numeric(12, 3), nullable=True)
    
    requirement_number = Column(String, nullable=True)
    requirement_date = Column(DateTime, nullable=True)
    car_brand = Column(String, nullable=True)
    license_plate = Column(String, nullable=True)
    recipient = Column(String, nullable=True)
    article = Column(String, nullable=True)
    
    profile_type = Column(String, nullable=True)
    profile_params = Column(JSON, nullable=True)
    weight_tons = Column(Numeric(12, 3), nullable=True)
    calculated_meters = Column(Numeric(12, 2), nullable=True)
    formula_used = Column(String, nullable=True)
    is_calculated = Column(Boolean, default=False)
    
    selected_for_calculation = Column(Boolean, default=False)
    calculated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Связи - ИСПРАВЛЕНО
    sheet = relationship("DefectSheet", back_populates="items")


class ApprovalNotification(Base):
    __tablename__ = "approval_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    sheet_id = Column(Integer, ForeignKey("defect_sheets.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    message = Column(String, nullable=False)
    status = Column(String, default="unread")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Связи
    sheet = relationship("DefectSheet", backref="approval_notifications")
    approver = relationship("User", foreign_keys=[approver_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи - ИСПРАВЛЕНО!
    created_sheets = relationship("DefectSheet", foreign_keys="DefectSheet.created_by", back_populates="creator")
    approved_sheets = relationship("DefectSheet", foreign_keys="DefectSheet.approved_by", back_populates="approver_user")
