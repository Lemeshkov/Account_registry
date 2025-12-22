import os

def create_project():
    """Создает структуру проекта"""
    
    # Создаем директории
    directories = [
        "app",
        "app/parsers", 
        "app/uploads"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Создана папка: {directory}")
    
    # Создаем файлы
    files = {
        "requirements.txt": """fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
sqlalchemy==2.0.23
pandas==2.1.3
openpyxl==3.1.2
pdfplumber==0.10.3
python-dotenv==1.0.0""",

        ".env": "DATABASE_URL=sqlite:///./test.db",

        "app/__init__.py": "",

        "app/main.py": """from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
import os
import uuid

from .database import get_db, engine
from .models import Base
from .parsers.excel_parser import ExcelParser
from .parsers.pdf_parser import PDFParser

# Создаем таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Uploader API", version="1.0.0")

# Создаем папку для загрузок
os.makedirs("app/uploads", exist_ok=True)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    \"\"\"Загрузка Excel или PDF файла с заявками\"\"\"
    
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ['xlsx', 'xls', 'pdf']:
        raise HTTPException(status_code=400, detail="Поддерживаются только Excel и PDF файлы")
    
    batch_id = str(uuid.uuid4())
    
    try:
        # Сохраняем файл временно
        file_path = f"app/uploads/{batch_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Парсим файл
        if file_ext in ['xlsx', 'xls']:
            parser = ExcelParser()
            file_type = "excel"
        else:
            parser = PDFParser()
            file_type = "pdf"
        
        parsed_requests = parser.parse_file(file_path)
        
        # TODO: Сохранить в базу данных
        print(f"Парсинг успешен! Найдено {len(parsed_requests)} записей")
        
        # Удаляем временный файл
        os.remove(file_path)
        
        return {
            "message": "Файл успешно обработан",
            "imported_count": len(parsed_requests),
            "batch_id": batch_id,
            "file_type": file_type
        }
        
    except Exception as e:
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Uploader API работает"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
""",

        "app/database.py": """from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
""",

        "app/models.py": """from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from .database import Base

class ImportedRequest(Base):
    __tablename__ = "imported_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String)
    request_date = Column(DateTime)
    car_brand = Column(String)
    license_plate = Column(String)
    item_name = Column(String)
    article = Column(String)
    quantity = Column(Integer)
    approved = Column(Boolean)
    completion_date = Column(DateTime)
    import_batch = Column(String)
    file_name = Column(String)
    file_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
""",

        "app/parsers/__init__.py": "",

        "app/parsers/excel_parser.py": """import pandas as pd
from datetime import datetime
from typing import List, Dict, Any

class ExcelParser:
    def __init__(self):
        self.required_columns = [
            '№', 'Дата заявки', 'Марка', 'Гос.номер', 
            'Наименование', 'Артикул', 'Кол-во', 'Согласовано', 'Дата заполнения'
        ]
    
    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        \"\"\"Парсинг Excel файла\"\"\"
        try:
            df = pd.read_excel(file_path)
            print(f"Загружен Excel с {len(df)} строками")
            
            # Проверяем колонки
            missing_columns = [col for col in self.required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Отсутствуют колонки: {missing_columns}")
            
            requests = []
            for _, row in df.iterrows():
                request = self._parse_row(row)
                if request:
                    requests.append(request)
            
            return requests
            
        except Exception as e:
            print(f"Ошибка парсинга Excel: {e}")
            raise
    
    def _parse_row(self, row: pd.Series) -> Dict[str, Any]:
        \"\"\"Парсинг одной строки\"\"\"
        try:
            approved = self._parse_boolean(row['Согласовано'])
            
            return {
                'request_number': str(row['№']),
                'request_date': self._parse_date(row['Дата заявки']),
                'car_brand': str(row['Марка']),
                'license_plate': str(row['Гос.номер']),
                'item_name': str(row['Наименование']),
                'article': str(row['Артикул']),
                'quantity': int(row['Кол-во']),
                'approved': approved,
                'completion_date': self._parse_date(row['Дата заполнения'])
            }
        except Exception as e:
            print(f"Ошибка парсинга строки: {e}")
            return None
    
    def _parse_boolean(self, value) -> bool:
        \"\"\"Парсинг булевых значений\"\"\"
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ['да', 'true', '1', 'yes', 'согласовано']
        return bool(value)
    
    def _parse_date(self, value):
        \"\"\"Парсинг дат\"\"\"
        if pd.isna(value):
            return None
        try:
            return pd.to_datetime(value)
        except:
            return None
""",

        "app/parsers/pdf_parser.py": """import pdfplumber
import re
from datetime import datetime
from typing import List, Dict, Any

class PDFParser:
    def __init__(self):
        self.patterns = {
            'request_number': r'№\\s*(\\S+)',
            'request_date': r'Дата заявки\\s*(\\d{2}\\.\\d{2}\\.\\d{4})',
            'car_brand': r'Марка\\s*([^\\n]+)',
            'license_plate': r'Гос\\.номер\\s*([^\\n]+)',
            'item_name': r'Наименование\\s*([^\\n]+)',
            'article': r'Артикул\\s*([^\\n]+)',
            'quantity': r'Кол-во\\s*(\\d+)',
            'approved': r'Согласовано\\s*(Да|Нет)',
        }
    
    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        \"\"\"Парсинг PDF файла\"\"\"
        try:
            requests = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        request = self._parse_page(text)
                        if request:
                            requests.append(request)
            
            print(f"Загружен PDF с {len(requests)} страницами")
            return requests
            
        except Exception as e:
            print(f"Ошибка парсинга PDF: {e}")
            raise
    
    def _parse_page(self, text: str) -> Dict[str, Any]:
        \"\"\"Парсинг текста страницы\"\"\"
        try:
            request = {}
            
            for field, pattern in self.patterns.items():
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    request[field] = match.group(1).strip()
            
            return self._convert_types(request)
            
        except Exception as e:
            print(f"Ошибка парсинга страницы: {e}")
            return None
    
    def _convert_types(self, request: Dict) -> Dict[str, Any]:
        \"\"\"Преобразование типов данных\"\"\"
        if not request:
            return None
            
        try:
            # Преобразуем даты
            if 'request_date' in request:
                request['request_date'] = datetime.strptime(request['request_date'], '%d.%m.%Y')
            
            # Преобразуем числа
            if 'quantity' in request:
                request['quantity'] = int(request['quantity'])
            
            # Преобразуем булево
            if 'approved' in request:
                request['approved'] = request['approved'].lower() == 'да'
            
            return request
            
        except Exception as e:
            print(f"Ошибка преобразования типов: {e}")
            return None
"""
    }
    
    # Создаем файлы
    for file_path, content in files.items():
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Создан файл: {file_path}")
    
    print("\\n🎉 Проект успешно создан!")
    print("\\nСледующие шаги:")
    print("1. pip install -r requirements.txt")
    print("2. uvicorn app.main:app --reload")
    print("3. Открой http://localhost:8000/docs")

if __name__ == "__main__":
    create_project()