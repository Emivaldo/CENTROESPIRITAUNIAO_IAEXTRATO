import os
import re
from PyPDF2 import PdfReader
import pandas as pd

def parse_pdf(filepath):
    # Filename format: 2050-8.MM.YYYY.pdf
    filename = os.path.basename(filepath)
    parts = filename.split('.')
    if len(parts) >= 4:
        month = parts[1]
        year = parts[2]
    else:
        month = '01'
        year = '2024'

    reader = PdfReader(filepath)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"

    lines = text.split('\n')
    
    transactions = []
    current_tx = None
    
    date_pattern = re.compile(r'^(\d{2}/\d{2})\s+(.*?)([\d\.,]+)([CD]?)$')
    date_pattern_no_value = re.compile(r'^(\d{2}/\d{2})\s+(.*)$')
    value_pattern = re.compile(r'^([\d\.,]+)([CD]?)$')
    type_cd_pattern = re.compile(r'^([CD])$')
    
    # Let's iterate over lines to find transactions
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Ignore structural lines
        if line.startswith("SALDO ANTERIOR") or "SALDO DO DIA" in line or "SALDO BLOQ" in line or "SICOOB" in line or "PLATAFORMA" in line or "EXTRATO CONTA CORRENTE" in line or line.startswith("COOP.:") or line.startswith("CONTA:") or line.startswith("PERODO") or line.startswith("PERÍODO") or "HIST" in line or "DATA " in line:
            continue
            
        # Try to match a new transaction
        m = date_pattern.match(line)
        m2 = date_pattern_no_value.match(line)
        
        if m: # Matched date, description, value directly
            if current_tx:
                transactions.append(current_tx)
            
            date, desc, value_str, cd = m.groups()
            current_tx = {
                'data': f"{date}/{year}",
                'historico': desc.strip(),
                'valor_str': value_str,
                'tipo': cd,
                'detalhes': []
            }
        elif m2:
            # We found a date but maybe no value on the same line, or value is glued to description
            # E.g. "04/01 PIX EMIT.OUTRA IF3.200,00"
            date, rest = m2.groups()
            
            # extract value from the end of rest
            # Regex for finding value at the end of a string
            val_match = re.search(r'([\d\.]*,\d{2})([CD]?)$', rest)
            if val_match:
                if current_tx:
                    transactions.append(current_tx)
                
                value_str = val_match.group(1)
                cd = val_match.group(2)
                desc = rest[:val_match.start()].strip()
                current_tx = {
                    'data': f"{date}/{year}",
                    'historico': desc,
                    'valor_str': value_str,
                    'tipo': cd,
                    'detalhes': []
                }
            else:
                if current_tx:
                    transactions.append(current_tx)
                
                current_tx = {
                    'data': f"{date}/{year}",
                    'historico': rest.strip(),
                    'valor_str': '',
                    'tipo': '',
                    'detalhes': []
                }
        else:
            if current_tx:
                # Could be the type (C or D) on its own line
                if not current_tx['tipo'] and type_cd_pattern.match(line):
                    current_tx['tipo'] = line
                # Could be the value on its own line
                elif not current_tx['valor_str'] and value_pattern.match(line):
                    v_m = value_pattern.match(line)
                    current_tx['valor_str'] = v_m.group(1)
                    if v_m.group(2):
                        current_tx['tipo'] = v_m.group(2)
                else:
                    current_tx['detalhes'].append(line)
                    
    if current_tx:
        transactions.append(current_tx)
        
    # Clean up and normalize transactions
    cleaned = []
    for tx in transactions:
        if not tx['valor_str']:
            continue
            
        float_val = float(tx['valor_str'].replace('.', '').replace(',', '.'))
        if tx['tipo'] == 'D':
            float_val = -float_val
            
        detalhes = " | ".join(tx['detalhes'])
        cleaned.append({
            'Data': tx['data'],
            'Histórico': tx['historico'],
            'Valor': float_val,
            'Tipo': 'Receita' if float_val >= 0 else 'Despesa',
            'Detalhes': detalhes
        })
        
    return cleaned

arquivo = os.path.join("Arquivos", "2050-8.01.2024.pdf")
res = parse_pdf(arquivo)
for r in res:
    print(r)
