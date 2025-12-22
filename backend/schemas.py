# # backend/schemas.py
# from pydantic import BaseModel
# from typing import Optional, List, Any
# from datetime import datetime

# class ImportedRequestBase(BaseModel):
#     request_number: Optional[str] = None
#     request_date: Optional[datetime] = None

#     car_brand: Optional[str] = None
#     license_plate: Optional[str] = None

#     item_name: Optional[str] = None
#     article: Optional[str] = None

#     quantity: Optional[int] = None
#     approved: Optional[bool] = None

#     completion_date: Optional[datetime] = None

#     import_batch: Optional[str] = None
#     file_name: Optional[str] = None
#     file_type: Optional[str] = None

# class ImportedRequestCreate(ImportedRequestBase):
#     pass

# class ImportedRequest(ImportedRequestBase):
#     id: int
#     created_at: Optional[datetime]

#     class Config:
#         from_attributes = True


# class PaymentRegistryBase(BaseModel):
#     number: Optional[str] = None
#     supplier: Optional[str] = None
#     invoice_details: Optional[str] = None
#     contractor: Optional[str] = None
#     payer: Optional[str] = None

#     amount: Optional[float] = None
#     vat_amount: Optional[float] = None
#     included_in_plan: Optional[bool] = None
#     payment_system: Optional[str] = None
#     comment: Optional[str] = None

#     vehicle: Optional[str] = None
#     license_plate: Optional[str] = None

# class PaymentRegistryCreate(PaymentRegistryBase):
#     pass

# class PaymentRegistry(PaymentRegistryBase):
#     id: int
#     matched_request_id: Optional[int] = None
#     imported_batch: Optional[str] = None
#     created_at: Optional[datetime]

#     class Config:
#         from_attributes = True


# class HistoryLogItem(BaseModel):
#     id: int
#     action: str
#     entity: str
#     entity_id: Optional[int]
#     timestamp: datetime
#     user: Optional[str]
#     details: Optional[Any]

#     class Config:
#         from_attributes = True


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
