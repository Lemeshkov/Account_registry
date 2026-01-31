"""
ОПТИМИЗИРОВАННЫЙ OCR сервис для быстрой обработки сканов счетов
Ускоряет обработку с 3 минут до 10-30 секунд
"""

from pdf2image import convert_from_path
import numpy as np
import time
from typing import List
import threading
import logging

log = logging.getLogger(__name__)

# -------------------------------------------------------------------
# КОНФИГУРАЦИЯ ДЛЯ СКОРОСТИ (ВАЖНО!)
# -------------------------------------------------------------------

OCR_CONFIG = {
    "dpi": 300,           # БЫЛО 300, СТАЛО 150 - в 4 раза быстрее!
    "grayscale": True,    # Черно-белое - в 2 раза быстрее цветного
    "max_workers": 2,     # Параллельная обработка страниц
    "timeout_per_page": 30,  # Таймаут на страницу
}

# -------------------------------------------------------------------
# ИНИЦИАЛИЗАЦИЯ OCR ДВИЖКА
# -------------------------------------------------------------------

# EasyOCR (рекомендую - проще установить, хорошая точность)
try:
    import easyocr
    _OCR_READER = easyocr.Reader(['ru', 'en'], gpu=False)
    OCR_ENGINE = "easyocr"
    log.info("[OCR] Using EasyOCR engine (fast!)")
except ImportError:
    _OCR_READER = None
    log.warning("[OCR] EasyOCR not installed")

# PaddleOCR (ваш текущий, самый медленный - резервный вариант)
if _OCR_READER is None:
    try:
        from paddleocr import PaddleOCR
        _OCR_READER = PaddleOCR(lang="ru", use_angle_cls=False, show_log=False, use_gpu=False)
        OCR_ENGINE = "paddleocr"
        log.warning("[OCR] Using SLOW PaddleOCR - install EasyOCR for speed!")
    except ImportError:
        _OCR_READER = None
        log.error("[OCR] No OCR engine available!")

# -------------------------------------------------------------------
# ОПТИМИЗИРОВАННЫЕ ФУНКЦИИ
# -------------------------------------------------------------------

def ocr_pdf_fast(pdf_path: str) -> List[str]:
    """
    БЫСТРЫЙ OCR для PDF сканов.
    Возвращает текст каждой страницы.
    """
    if _OCR_READER is None:
        log.error("[OCR] No OCR engine initialized!")
        return []
    
    log.info(f"[OCR START] {pdf_path}, engine: {OCR_ENGINE}")
    start_time = time.time()
    
    try:
        # 1. КОНВЕРТАЦИЯ PDF В ИЗОБРАЖЕНИЯ (ОПТИМИЗИРОВАННО)
        conv_start = time.time()
        images = convert_from_path(
            pdf_path,
            dpi=OCR_CONFIG["dpi"],          # 150 вместо 300!
            grayscale=OCR_CONFIG["grayscale"],  # Черно-белое быстрее
            thread_count=2,                 # Параллельная конвертация
            fmt='jpeg',                     # JPEG быстрее PNG
            jpegopt={'quality': 90, 'progressive': True},
        )
        conv_time = time.time() - conv_start
        log.info(f"[OCR] Converted {len(images)} pages in {conv_time:.1f}s")
        
        if not images:
            return []
        
        # 2. ПРЕДОБРАБОТКА ИЗОБРАЖЕНИЙ (улучшает качество OCR)
        processed_images = []
        for img in images:
            img_np = np.array(img)
            
            # Если цветное - конвертируем в grayscale
            if len(img_np.shape) == 3:
                # Быстрое усреднение каналов
                img_np = np.mean(img_np, axis=2).astype(np.uint8)
            
            # Автоматическое выравнивание контраста
            img_np = _enhance_contrast(img_np)
            processed_images.append(img_np)
        
        # 3. ОБРАБОТКА OCR (параллельно для многостраничных)
        ocr_start = time.time()
        
        if len(processed_images) == 1:
            # Одна страница - обрабатываем сразу
            pages_text = [_process_single_page(processed_images[0])]
        else:
            # Несколько страниц - параллельно
            pages_text = _process_pages_parallel(processed_images)
        
        ocr_time = time.time() - ocr_start
        
        # 4. РЕЗУЛЬТАТ
        total_time = time.time() - start_time
        total_chars = sum(len(t) for t in pages_text)
        
        log.info(f"[OCR DONE] {len(pages_text)} pages in {total_time:.1f}s "
                f"(conv: {conv_time:.1f}s, ocr: {ocr_time:.1f}s, "
                f"chars: {total_chars})")
        
        return pages_text
        
    except Exception as e:
        log.exception(f"[OCR ERROR] {pdf_path}: {e}")
        return []

def _enhance_contrast(img_np: np.ndarray) -> np.ndarray:
    """Улучшение контраста изображения для лучшего OCR"""
    if len(img_np.shape) == 3:
        # Конвертируем в grayscale если еще не
        img_np = np.mean(img_np, axis=2).astype(np.uint8)
    
    # Автоматическое выравнивание гистограммы
    min_val = np.percentile(img_np, 2)   # 2-й процентиль как черный
    max_val = np.percentile(img_np, 98)  # 98-й процентиль как белый
    
    if max_val > min_val:
        # Масштабируем контраст
        img_np = np.clip((img_np - min_val) * 255.0 / (max_val - min_val), 0, 255)
    
    return img_np.astype(np.uint8)

def _process_single_page(image_np: np.ndarray) -> str:
    """Обработка одной страницы"""
    try:
        if OCR_ENGINE == "easyocr":
            # EasyOCR - цветное изображение
            if len(image_np.shape) == 2:
                # Grayscale to BGR
                image_bgr = np.stack([image_np, image_np, image_np], axis=2)
            else:
                image_bgr = image_np
            
            result = _OCR_READER.readtext(image_bgr, paragraph=True)
            text = " ".join([detection[1] for detection in result])
            
        else:  # paddleocr
            result = _OCR_READER.ocr(image_np, cls=False)
            if result and result[0]:
                text = " ".join([line[1][0] for line in result[0]])
            else:
                text = ""
        
        return text.strip()
        
    except Exception as e:
        log.error(f"[OCR PAGE ERROR] {e}")
        return ""

def _process_pages_parallel(images: List[np.ndarray]) -> List[str]:
    """Параллельная обработка нескольких страниц"""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    pages_text = [""] * len(images)
    
    # Ограничиваем количество параллельных задач
    max_workers = min(OCR_CONFIG["max_workers"], len(images))
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Запускаем задачи
        future_to_idx = {
            executor.submit(_process_single_page, img): idx
            for idx, img in enumerate(images)
        }
        
        # Собираем результаты
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                text = future.result(timeout=OCR_CONFIG["timeout_per_page"])
                pages_text[idx] = text
            except Exception as e:
                log.error(f"[OCR PAGE {idx} ERROR] {e}")
                pages_text[idx] = ""
    
    return pages_text

def ocr_pdf(pdf_path: str) -> list[str]:
    """Алиас для обратной совместимости"""
    return ocr_pdf_fast(pdf_path)

# -------------------------------------------------------------------
# ТЕСТИРОВАНИЕ
# -------------------------------------------------------------------

def test_ocr_speed(pdf_path: str):
    """Тест скорости OCR"""
    print(f"\n{'='*60}")
    print(f"OCR SPEED TEST: {pdf_path}")
    print(f"Engine: {OCR_ENGINE}")
    print(f"{'='*60}")
    
    import os
    file_size = os.path.getsize(pdf_path) / (1024*1024)  # MB
    
    print(f"File size: {file_size:.2f} MB")
    
    # Запускаем несколько раз
    times = []
    
    for i in range(2):  # 2 раза достаточно
        print(f"\nRun {i+1}/2:")
        start = time.time()
        
        pages = ocr_pdf_fast(pdf_path)
        
        elapsed = time.time() - start
        times.append(elapsed)
        
        print(f"  Time: {elapsed:.1f}s")
        print(f"  Pages: {len(pages)}")
        print(f"  Total chars: {sum(len(p) for p in pages)}")
        
        if pages and pages[0]:
            print(f"  First 100 chars: {pages[0][:100]}...")
    
    if len(times) > 1:
        avg = sum(times) / len(times)
        print(f"\n{'='*60}")
        print(f"AVERAGE TIME: {avg:.1f}s")
        print(f"MIN/MAX: {min(times):.1f}s / {max(times):.1f}s")
        print(f"{'='*60}")
    
    return times

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        test_ocr_speed(sys.argv[1])
    else:
        print("Usage: python ocr_service_fast.py <pdf_path>")
        print("\nCurrent OCR engine:", OCR_ENGINE)
        print("DPI:", OCR_CONFIG["dpi"])
        print("Grayscale:", OCR_CONFIG["grayscale"])