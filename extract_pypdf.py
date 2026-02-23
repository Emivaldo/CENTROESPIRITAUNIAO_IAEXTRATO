import os
from PyPDF2 import PdfReader

arquivos_dir = 'Arquivos'
sample_file = os.path.join(arquivos_dir, '2050-8.01.2024.pdf')

print(f"Lendo primeiro pdf com PyPDF2: {sample_file}")

reader = PdfReader(sample_file)
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"--- Pagina {i+1} ---")
    print(text)
    print("-" * 40)
