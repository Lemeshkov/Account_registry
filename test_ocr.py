from paddleocr import PaddleOCR
from pdf2image import convert_from_path
import numpy as np

PDF_PATH = "invoice_test.pdf"

images = convert_from_path(PDF_PATH, dpi=300)
print("Страниц:", len(images))

# берём страницу со счётом (обычно 2-я)
img = np.array(images[1])

ocr = PaddleOCR(lang="ru")

result = ocr.predict(img)

print("\n===== OCR RESULT =====\n")

for page in result:
    texts = page["rec_texts"]
    scores = page["rec_scores"]

    for text, score in zip(texts, scores):
        if score > 0.6:
            print(text)
