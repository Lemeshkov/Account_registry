
# backend/schemas.py
from pydantic import BaseModel
from typing import Optional
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
