import io, re
from PyPDF2 import PdfReader

def convert_to_date_str(date_str, year):
    parts = date_str.split('/')
    if len(parts) >= 2:
        return f"{year}-{parts[1]}-{parts[0]}"
    return f"{year}-01-01"

filename = "2050-8.01.2024.pdf"
filepath = f"../Arquivos/{filename}"

parts = filename.split('.')
month = parts[1]
year = parts[2]
print(f"Arquivo: {filename}")
print(f"Mes extraido: {month}, Ano extraido: {year}")

reader = PdfReader(filepath)
text = ""
for page in reader.pages:
    try:
        text += page.extract_text() + "\n"
    except:
        pass

lines = text.split('\n')
print(f"\nTotal linhas extraidas do PDF: {len(lines)}")
print(f"\nPrimeiras 30 linhas do PDF:")
for i, line in enumerate(lines[:30]):
    print(f"  [{i}] '{line.strip()}'")

date_pattern = re.compile(r'^(\d{2}/\d{2})\s+(.*?)([\d\.,]+)([CD]?)$')
date_pattern_no_value = re.compile(r'^(\d{2}/\d{2})\s+(.*)$')

all_dates = []
tx_count = 0
for line in lines:
    line = line.strip()
    m = date_pattern.match(line)
    m2 = date_pattern_no_value.match(line)
    if m:
        date_str = m.group(1)
        data_iso = convert_to_date_str(date_str, year)
        all_dates.append(data_iso)
        tx_count += 1
        if tx_count <= 5:
            print(f"\n  TX {tx_count}: raw='{date_str}' -> iso='{data_iso}' | line='{line[:60]}'")
    elif m2:
        date_str = m2.group(1)
        data_iso = convert_to_date_str(date_str, year)
        all_dates.append(data_iso)
        tx_count += 1
        if tx_count <= 5:
            print(f"\n  TX {tx_count} (m2): raw='{date_str}' -> iso='{data_iso}' | line='{line[:60]}'")

print(f"\n\n=== RESULTADO ===")
print(f"Total transacoes com data: {len(all_dates)}")
if all_dates:
    print(f"Data INICIAL (min): {min(all_dates)}")
    print(f"Data FINAL   (max): {max(all_dates)}")
else:
    print("NENHUMA DATA ENCONTRADA!")
    print("\nExemplo de linhas que comecam com numeros:")
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and '/' in line[:6]:
            print(f"  '{line[:80]}'")
