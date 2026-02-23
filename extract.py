import os
import pdfplumber

arquivos_dir = 'Arquivos'
sample_file = os.path.join(arquivos_dir, '2050-8.01.2024.pdf')

print(f"Lendo primeiro pdf: {sample_file}")

with pdfplumber.open(sample_file) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        print(f"--- Pagina {i+1} ---")
        print(text)
        print("-" * 40)
