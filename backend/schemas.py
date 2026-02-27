
# backend/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ImportedRequest(BaseModel):
    id: int
    request_number: Optional[str]
    request_date: Optional[datetime]
    car_brand: Optional[str]
    license_plate: Optional[str]
    item_name: Optional[str]
    article: Optional[str]
    quantity: Optional[int]
    approved: Optional[bool]
    completion_date: Optional[datetime]
    import_batch: Optional[str]
    file_name: Optional[str]
    file_type: Optional[str]
    created_at: Optional[datetime]

    model_config = {
    "from_attributes": True
}

class PaymentRegistry(BaseModel):
    id: int
    number: Optional[str]
    supplier: Optional[str]
    invoice_details: Optional[str]
    contractor: Optional[str]
    payer: Optional[str]
    amount: Optional[float]
    vat_amount: Optional[float]
    included_in_plan: Optional[bool]
    payment_system: Optional[str]
    comment: Optional[str]
    vehicle: Optional[str]
    license_plate: Optional[str]
    matched_request_id: Optional[int]
    imported_batch: Optional[str]
    created_at: Optional[datetime]

    model_config = {
    "from_attributes": True
}

class PaymentRegistryCreate(BaseModel):
    number: Optional[str]
    supplier: Optional[str]
    invoice_details: Optional[str]
    contractor: Optional[str]
    payer: Optional[str]
    amount: Optional[float]
    vat_amount: Optional[float]
    included_in_plan: Optional[bool] = False
    payment_system: Optional[str]
    comment: Optional[str]
    vehicle: Optional[str]
    license_plate: Optional[str]

class HistoryLogItem(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: Optional[int]
    timestamp: datetime
    user: Optional[str]
    details: Optional[dict]

    model_config = {
    "from_attributes": True
}

# Схемы для дефектной ведомости
class DefectSheetBase(BaseModel):
    batch_id: str
    file_name: str
    status: str = "pending"
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

class DefectSheetCreate(DefectSheetBase):
    pass

class DefectSheet(DefectSheetBase):
    id: int
    upload_date: datetime
    created_at: datetime
    
    model_config = {
        "from_attributes": True
    }

class DefectSheetItemBase(BaseModel):
    position: int
    address: Optional[str] = None
    material_name: Optional[str] = None
    requested_quantity: Optional[float] = None
    requirement_number: Optional[str] = None
    requirement_date: Optional[datetime] = None
    car_brand: Optional[str] = None
    license_plate: Optional[str] = None
    recipient: Optional[str] = None

class DefectSheetItemCreate(DefectSheetItemBase):
    sheet_id: int

class DefectSheetItem(DefectSheetItemBase):
    id: int
    sheet_id: int
    profile_type: Optional[str] = None
    profile_params: Optional[dict] = None
    weight_tons: Optional[float] = None
    calculated_meters: Optional[float] = None
    formula_used: Optional[str] = None
    is_calculated: bool = False
    selected_for_calculation: bool = False
    calculated_at: Optional[datetime] = None
    
    model_config = {
        "from_attributes": True
    }

# Для предпросмотра после загрузки
class DefectSheetPreview(BaseModel):
    sheet_id: int
    batch_id: str
    file_name: str
    total_items: int
    items: List[DefectSheetItem]

# Добавьте в schemas.py

class DefectSheetBase(BaseModel):
    """Базовая схема дефектной ведомости"""
    file_name: str
    batch_id: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    status: str = "pending"

class DefectSheet(DefectSheetBase):
    """Полная схема дефектной ведомости"""
    id: int
    upload_date: datetime
    created_at: datetime
    
    model_config = {
        "from_attributes": True
    }

class DefectSheetPreviewResponse(BaseModel):
    """Ответ для предпросмотра после загрузки"""
    sheet_id: int
    batch_id: str
    file_name: str
    upload_date: datetime
    status: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_items: int
    items: List[DefectSheetItem]  # используем существующую схему DefectSheetItem
    
    model_config = {
        "from_attributes": True
    }    

# Для запроса на пересчет
class CalculationRequest(BaseModel):
    sheet_id: int
    item_ids: List[int]  # если пусто - пересчитать все
    profile_type: str  # тип профиля для пересчета
    profile_params: dict  # параметры профиля

# Для результата пересчета
class CalculationResult(BaseModel):
    item_id: int
    original_weight: float
    calculated_meters: float
    formula_used: str
    success: bool
    error: Optional[str] = None

# Для экспорта
class ExportRequest(BaseModel):
    sheet_id: int
    format: str = "excel"  # только excel пока
    include_calculated: bool = True
