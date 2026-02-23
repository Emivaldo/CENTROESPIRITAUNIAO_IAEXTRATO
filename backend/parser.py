import os
import re
from PyPDF2 import PdfReader

def get_arquivos_dir():
    # Caminho base, para garantir que encontra a pasta '../Arquivos' ou '/Arquivos' 
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'Arquivos')

def extract_data():
    arquivos_dir = get_arquivos_dir()
    if not os.path.exists(arquivos_dir):
        return {"transactions": [], "files_summary": []}

    pdfs = [f for f in os.listdir(arquivos_dir) if f.endswith('.pdf')]
    if not pdfs:
        return {"transactions": [], "files_summary": []}

    all_transactions = []
    files_summary = []
    
    date_pattern = re.compile(r'^(\d{2}/\d{2})\s+(.*?)([\d\.,]+)([CD]?)$')
    date_pattern_no_value = re.compile(r'^(\d{2}/\d{2})\s+(.*)$')
    value_pattern = re.compile(r'^([\d\.,]+)([CD]?)$')
    type_cd_pattern = re.compile(r'^([CD])$')

    for pdf_file in pdfs:
        filepath = os.path.join(arquivos_dir, pdf_file)
        
        parts = pdf_file.split('.')
        if len(parts) >= 4:
            month = parts[1]
            year = parts[2]
        else:
            month = '01'
            year = '2024'
            
        reader = PdfReader(filepath)
        text = ""
        for page in reader.pages:
            try:
                text += page.extract_text() + "\n"
            except:
                pass

        lines = text.split('\n')
        transactions = []
        current_tx = None
        
        conta = "Desconhecida"
        saldo_inicial = 0.0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith("CONTA:"):
                conta = line.replace("CONTA:", "").strip()
                continue
                
            if "SALDO ANTERIOR" in line:
                parts_sa = line.split("SALDO ANTERIOR")
                if len(parts_sa) > 1:
                    val_str = parts_sa[1].strip()
                    if val_str:
                        val_match = re.search(r'([\d\.]*,\d{2})([CD]?)', val_str)
                        if val_match:
                            v, cd = val_match.groups()
                            f_v = float(v.replace('.', '').replace(',', '.'))
                            if cd == 'D':
                                f_v = -f_v
                            saldo_inicial = f_v
                continue
                
            if "SALDO DO DIA" in line or "SALDO BLOQ" in line or "SICOOB" in line or "PLATAFORMA" in line or "EXTRATO CONTA CORRENTE" in line or line.startswith("COOP.:") or line.startswith("PERODO") or line.startswith("PERÍODO") or "HIST" in line or "DATA " in line:
                continue
                
            m = date_pattern.match(line)
            m2 = date_pattern_no_value.match(line)
            
            if m:
                if current_tx:
                    transactions.append(current_tx)
                
                date, desc, value_str, cd = m.groups()
                current_tx = {
                    'data_dia_mes': date,
                    'ano': year,
                    'historico': desc.strip(),
                    'valor_str': value_str,
                    'tipo': cd,
                    'detalhes': []
                }
            elif m2:
                date, rest = m2.groups()
                val_match = re.search(r'([\d\.]*,\d{2})([CD]?)$', rest)
                
                if val_match:
                    if current_tx:
                        transactions.append(current_tx)
                    
                    value_str = val_match.group(1)
                    cd = val_match.group(2)
                    desc = rest[:val_match.start()].strip()
                    current_tx = {
                        'data_dia_mes': date,
                        'ano': year,
                        'historico': desc,
                        'valor_str': value_str,
                        'tipo': cd,
                        'detalhes': []
                    }
                else:
                    if current_tx:
                        transactions.append(current_tx)
                    
                    current_tx = {
                        'data_dia_mes': date,
                        'ano': year,
                        'historico': rest.strip(),
                        'valor_str': '',
                        'tipo': '',
                        'detalhes': []
                    }
            else:
                if current_tx:
                    if not current_tx['tipo'] and type_cd_pattern.match(line):
                        current_tx['tipo'] = line
                    elif not current_tx['valor_str'] and value_pattern.match(line):
                        v_m = value_pattern.match(line)
                        current_tx['valor_str'] = v_m.group(1)
                        if v_m.group(2):
                            current_tx['tipo'] = v_m.group(2)
                    else:
                        current_tx['detalhes'].append(line)
                        
        if current_tx:
            transactions.append(current_tx)
            
        total_debitos = 0.0
        total_creditos = 0.0
            
        for tx in transactions:
            if not tx['valor_str']:
                continue
                
            float_val = float(tx['valor_str'].replace('.', '').replace(',', '.'))
            if tx['tipo'] == 'D':
                float_val = -float_val
                
            detalhes = " | ".join(tx['detalhes'])
            data_completa = f"{tx['data_dia_mes']}/{tx['ano']}"
            
            tipo_mov = 'Receita' if float_val >= 0 else 'Despesa'
            if tipo_mov == 'Receita':
                total_creditos += float_val
            else:
                total_debitos += abs(float_val)
                
            all_transactions.append({
                'data': data_completa,
                'historico': tx['historico'],
                'tipo_movimento': tipo_mov,
                'valor': float_val,
                'detalhes': detalhes,
                'arquivo': pdf_file
            })
            
        saldo_final = saldo_inicial + total_creditos - total_debitos
            
        files_summary.append({
            'arquivo': pdf_file,
            'conta': conta,
            'mes_ano': f"{month}/{year}",
            'saldo_inicial': saldo_inicial,
            'saldo_final': saldo_final,
            'total_debitos': total_debitos,
            'total_creditos': total_creditos
        })

    return {"transactions": all_transactions, "files_summary": files_summary}
