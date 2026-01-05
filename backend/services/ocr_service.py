from pdf2image import convert_from_path
from paddleocr import PaddleOCR
import numpy as np

ocr = PaddleOCR(lang="ru")

def ocr_pdf(pdf_path: str) -> list[str]:
    images = convert_from_path(pdf_path, dpi=300)
    pages_text = []

    print(f">>> OCR PAGES: {len(images)}")

    for i, image in enumerate(images):
        img = np.array(image)

        print(f">>> OCR STARTED PAGE {i+1}")

        result = ocr.predict(img)

        if not result or not result[0]["rec_texts"]:
            print(f"[OCR WARNING] No text on page {i+1}")
            pages_text.append("")
            continue

        texts = result[0]["rec_texts"]
        scores = result[0]["rec_scores"]

        page_text = " ".join(
            text for text, score in zip(texts, scores) if score > 0.5
        )

        print(f"[OCR OK] Page {i+1}, chars: {len(page_text)}")

        pages_text.append(page_text)

    return pages_text
