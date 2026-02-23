from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import uvicorn
import io
import re
import calendar
from datetime import date

from supabase_client import supabase
from PyPDF2 import PdfReader

app = FastAPI(title="Fluxo de Caixa API API (Supabase)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_date_br(date_str):
    if not date_str: return ""
    parts = date_str.split('-')
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return date_str

def convert_to_date_str(date_str, year):
    # Receives DD/MM from PDF and year, output YYYY-MM-DD
    parts = date_str.split('/')
    if len(parts) >= 2:
        return f"{year}-{parts[1]}-{parts[0]}"
    return f"{year}-01-01"

@app.get("/api/transactions")
def get_transactions() -> Dict[str, Any]:
    arq_resp = supabase.table("ceu_arquivos_importados").select("*").order("data_importacao", desc=True).execute()
    files_summary = arq_resp.data if arq_resp.data else []
    
    lanc_resp = supabase.table("ceu_lancamentos").select("*, ceu_arquivos_importados!inner(nome_arquivo)").order("data_transacao", desc=True).limit(1000).execute()
    raw_lanc = lanc_resp.data if lanc_resp.data else []
    
    transactions = []
    total_receitas = 0.0
    total_despesas = 0.0
    
    for l in raw_lanc:
        val = l["valor_absoluto"]
        tipo = l["tipo_movimento"]
        if tipo == "Despesa":
            val_signed = -val
            total_despesas += val_signed
        else:
            val_signed = val
            total_receitas += val
            
        transactions.append({
            "id_codigo": l["id_codigo"],
            "data": format_date_br(l["data_transacao"]),
            "historico": l["historico_banco"],
            "detalhes": l["detalhes_complementares"],
            "tipo_movimento": tipo,
            "valor": val_signed,
            "status": l["status"],
            "arquivo": l["ceu_arquivos_importados"]["nome_arquivo"] if "ceu_arquivos_importados" in l else "Desconhecido"
        })
        
    saldo_geral = total_receitas + total_despesas
    
    formatted_files = []
    for f in files_summary:
        formatted_files.append({
            "arquivo": f["nome_arquivo"],
            "conta": f["conta"],
            "mes_ano": f["mes_ano"],
            "data_inicial": format_date_br(f.get("data_inicial", "")),
            "data_final": format_date_br(f.get("data_final", "")),
            "status": f.get("status", "pendente"),
            "saldo_inicial": f["saldo_inicial"],
            "saldo_final": f["saldo_final"],
            "total_debitos": f["total_debitos"],
            "total_creditos": f["total_creditos"]
        })
    
    resumo = {
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "saldo_geral": saldo_geral,
        "qtd_transacoes": len(transactions),
        "arquivos_lidos": len(files_summary)
    }
    
    return {
        "resumo": resumo,
        "transactions": transactions,
        "files_summary": formatted_files
    }

# ─── REGRAS DO EXTRATO ─────────────────────────────────────

@app.get("/api/regras")
def get_regras():
    resp = supabase.table("ceu_regras_extrato").select("*").order("prioridade", desc=False).execute()
    return resp.data if resp.data else []

@app.post("/api/regras")
def create_regra(regra: Dict[str, Any]):
    insert = {
        "nome_regra": regra.get("nome_regra", ""),
        "contem_historico": regra.get("contem_historico", "") or None,
        "contem_detalhes": regra.get("contem_detalhes", "") or None,
        "tipo_movimento": regra.get("tipo_movimento", "") or None,
        "valores_exatos": regra.get("valores_exatos", "") or None,
        "departamento_destino": regra.get("departamento_destino", ""),
        "ativo": regra.get("ativo", True),
        "prioridade": regra.get("prioridade", 0)
    }
    resp = supabase.table("ceu_regras_extrato").insert(insert).execute()
    if resp.data:
        return resp.data[0]
    raise HTTPException(status_code=500, detail="Erro ao criar regra.")

@app.put("/api/regras/{regra_id}")
def update_regra(regra_id: int, regra: Dict[str, Any]):
    update = {}
    for key in ["nome_regra", "contem_historico", "contem_detalhes", "tipo_movimento", "valores_exatos", "departamento_destino", "ativo", "prioridade"]:
        if key in regra:
            update[key] = regra[key] if regra[key] != "" else None
    update["atualizado_em"] = "now()"
    resp = supabase.table("ceu_regras_extrato").update(update).eq("id_codigo", regra_id).execute()
    if resp.data:
        return resp.data[0]
    raise HTTPException(status_code=404, detail="Regra não encontrada.")

@app.delete("/api/regras/{regra_id}")
def delete_regra(regra_id: int):
    resp = supabase.table("ceu_regras_extrato").delete().eq("id_codigo", regra_id).execute()
    return {"ok": True}

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    
    # 1. Fetch arquivos já presentes no BD (nome + mes_ano + status) para evitar duplicidade
    existing_files_resp = supabase.table("ceu_arquivos_importados").select("nome_arquivo, mes_ano, status").execute()
    existing_records = existing_files_resp.data if existing_files_resp.data else []
    existing_files = [f["nome_arquivo"] for f in existing_records]
    # Meses já completos: {mes_ano: nome_arquivo}
    meses_completos = {f["mes_ano"]: f["nome_arquivo"] for f in existing_records if f.get("status") == "C"}
    
    date_pattern = re.compile(r'^(\d{2}/\d{2})\s+(.*?)([\d\.,]+)([CD]?)$')
    date_pattern_no_value = re.compile(r'^(\d{2}/\d{2})\s+(.*)$')
    value_pattern = re.compile(r'^([\d\.,]+)([CD]?)$')
    type_cd_pattern = re.compile(r'^([CD])$')
    
    for file in files:
        if not file.filename.endswith('.pdf'):
            results.append({"filename": file.filename, "status": "error", "message": "Apenas arquivos PDF permitidos."})
            continue

        if file.filename in existing_files:
            results.append({"filename": file.filename, "status": "error", "message": "Arquivo já importado anteriormente."})
            continue
            
        parts = file.filename.split('.')
        if len(parts) >= 4:
            month = parts[1]
            year = parts[2]
        else:
            month = '01'
            year = '2024'

        mes_ano_arquivo = f"{month}/{year}"

        # NOVA VALIDAÇÃO: bloqueia se o mês já está completo no banco
        if mes_ano_arquivo in meses_completos:
            arq_existente = meses_completos[mes_ano_arquivo]
            results.append({
                "filename": file.filename,
                "status": "error",
                "message": f"O mês {mes_ano_arquivo} já está COMPLETO (arquivo: '{arq_existente}'). Exclua o arquivo existente antes de reimportar."
            })
            continue
            
        content = await file.read()
        reader = PdfReader(io.BytesIO(content))
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
        parsed_lancs = []
        all_dates = []
            
        for tx in transactions:
            if not tx['valor_str']:
                continue
                
            float_val = float(tx['valor_str'].replace('.', '').replace(',', '.'))
            if tx['tipo'] == 'D':
                float_val = -float_val
                
            detalhes = " | ".join(tx['detalhes'])
            
            tipo_mov = 'Receita' if float_val >= 0 else 'Despesa'
            if tipo_mov == 'Receita':
                total_creditos += float_val
            else:
                total_debitos += abs(float_val)
                
            data_iso = convert_to_date_str(tx['data_dia_mes'], tx['ano'])
            all_dates.append(data_iso)
                
            parsed_lancs.append({
                "data_transacao": data_iso,
                "historico_banco": tx['historico'],
                "detalhes_complementares": detalhes[:1000] if len(detalhes) > 1000 else detalhes,
                "tipo_movimento": tipo_mov,
                "valor_absoluto": abs(float_val)
            })
            
        saldo_final = saldo_inicial + total_creditos - total_debitos
        
        # Calcula datas min e max do arquivo
        data_inicial = min(all_dates) if all_dates else None
        data_final = max(all_dates) if all_dates else None
        
        # Determina automaticamente se o mes esta completo
        # Compara data_final com o ultimo dia do mes extraido do arquivo
        status_arquivo = 'P'
        if data_final:
            try:
                ultimo_dia_mes = calendar.monthrange(int(year), int(month))[1]
                data_fim_iso = date(int(year), int(month), ultimo_dia_mes).isoformat()
                status_arquivo = 'C' if data_final >= data_fim_iso else 'P'
            except:
                status_arquivo = 'P'
        
        # Inserindo no Banco
        insert_arq = {
            "nome_arquivo": file.filename,
            "conta": conta,
            "mes_ano": f"{month}/{year}",
            "saldo_inicial": saldo_inicial,
            "saldo_final": saldo_final,
            "total_debitos": total_debitos,
            "total_creditos": total_creditos,
            "data_inicial": data_inicial,
            "data_final": data_final,
            "status": status_arquivo
        }
        
        try:
            arq_resp = supabase.table("ceu_arquivos_importados").insert(insert_arq).execute()
            if not arq_resp.data:
                results.append({"filename": file.filename, "status": "error", "message": "Falha de BD ao importar."})
                continue
                
            id_arquivo = arq_resp.data[0]["id_codigo"]
            
            # Adicionando FK nos lançamentos
            for l in parsed_lancs:
                l["id_arquivo_origem"] = id_arquivo
                l["status"] = "pendente"
                
            if parsed_lancs:
                # Insert in chunks of 100
                batch_size = 100
                for i in range(0, len(parsed_lancs), batch_size):
                    supabase.table("ceu_lancamentos").insert(parsed_lancs[i:i + batch_size]).execute()
            
            # Update cache of existing files
            existing_files.append(file.filename)
            results.append({"filename": file.filename, "status": "success", "message": f"Importado com sucesso. ({len(parsed_lancs)} txs)"})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "message": str(e)})

    return {"results": results}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
