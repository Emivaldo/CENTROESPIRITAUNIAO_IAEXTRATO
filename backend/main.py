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
    
    lanc_resp = supabase.table("ceu_lancamentos").select("*, ceu_arquivos_importados!inner(nome_arquivo), ceu_departamentos(nome)").order("data_transacao", desc=True).limit(5000).execute()
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
            
        dep_nome = None
        if l.get("ceu_departamentos") and l["ceu_departamentos"].get("nome"):
            dep_nome = l["ceu_departamentos"]["nome"]
        
        transactions.append({
            "id_codigo": l["id_codigo"],
            "data": format_date_br(l["data_transacao"]),
            "historico": l["historico_banco"],
            "detalhes": l["detalhes_complementares"],
            "tipo_movimento": tipo,
            "valor": val_signed,
            "status": l["status"],
            "arquivo": l["ceu_arquivos_importados"]["nome_arquivo"] if "ceu_arquivos_importados" in l else "Desconhecido",
            "departamento_destino": dep_nome
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

@app.get("/api/lancamentos/sem-departamento")
def get_lancamentos_sem_departamento():
    resp = supabase.table("ceu_lancamentos").select("*, ceu_arquivos_importados!inner(nome_arquivo)").is_("id_departamento", "null").order("data_transacao", desc=True).limit(500).execute()
    raw_lanc = resp.data if resp.data else []
    transactions = []
    
    for l in raw_lanc:
        val = l["valor_absoluto"]
        tipo = l["tipo_movimento"]
        val_signed = val if tipo == "Receita" else -val
            
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
    return transactions


# ─── DEPARTAMENTOS ─────────────────────────────────────────

@app.get("/api/departamentos")
def get_departamentos():
    resp = supabase.table("ceu_departamentos").select("*").order("nome", desc=False).execute()
    return resp.data if resp.data else []

@app.post("/api/departamentos")
def create_departamento(departamento: Dict[str, Any]):
    insert = {
        "nome": departamento.get("nome", ""),
        "tipo": departamento.get("tipo", "misto"),
        "ativo": departamento.get("ativo", True)
    }
    resp = supabase.table("ceu_departamentos").insert(insert).execute()
    if resp.data:
        return resp.data[0]
    raise HTTPException(status_code=500, detail="Erro ao criar departamento.")

@app.put("/api/departamentos/{departamento_id}")
def update_departamento(departamento_id: int, departamento: Dict[str, Any]):
    update = {}
    if "nome" in departamento:
        update["nome"] = departamento["nome"]
    if "tipo" in departamento:
        update["tipo"] = departamento["tipo"]
    if "ativo" in departamento:
        update["ativo"] = departamento["ativo"]
    
    resp = supabase.table("ceu_departamentos").update(update).eq("id_codigo", departamento_id).execute()
    if resp.data:
        return resp.data[0]
    raise HTTPException(status_code=404, detail="Departamento não encontrado.")

@app.delete("/api/departamentos/{departamento_id}")
def delete_departamento(departamento_id: int):
    resp = supabase.table("ceu_departamentos").delete().eq("id_codigo", departamento_id).execute()
    return {"ok": True}

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

@app.post("/api/regras/{regra_id}/executar")
def executar_regra(regra_id: int):
    regra_resp = supabase.table("ceu_regras_extrato").select("*").eq("id_codigo", regra_id).execute()
    if not regra_resp.data:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    regra = regra_resp.data[0]
    
    if not regra.get("ativo", True):
        raise HTTPException(status_code=400, detail="A regra está inativa")
        
    dep_nome = regra.get("departamento_destino")
    if not dep_nome:
        raise HTTPException(status_code=400, detail="Regra sem departamento de destino")
        
    dep_resp = supabase.table("ceu_departamentos").select("id_codigo").eq("nome", dep_nome).execute()
    if not dep_resp.data:
        raise HTTPException(status_code=404, detail=f"Departamento '{dep_nome}' não encontrado")
    id_dep = dep_resp.data[0]["id_codigo"]
    
    lanc_resp = supabase.table("ceu_lancamentos").select("*").is_("id_departamento", "null").execute()
    lancamentos = lanc_resp.data if lanc_resp.data else []
    
    ids_to_update = []
    
    for l in lancamentos:
        match = True
        if regra.get("contem_historico"):
            if regra["contem_historico"].lower() not in l["historico_banco"].lower():
                match = False
        if match and regra.get("contem_detalhes"):
            detalhes = l.get("detalhes_complementares") or ""
            if regra["contem_detalhes"].lower() not in detalhes.lower():
                match = False
        if match and regra.get("tipo_movimento"):
            if regra["tipo_movimento"] != l["tipo_movimento"]:
                match = False
        if match and regra.get("valores_exatos"):
            v_exatos = [float(v.strip().replace(',', '.')) for v in regra["valores_exatos"].split(",")]
            if l["valor_absoluto"] not in v_exatos:
                match = False
                
        if match:
            ids_to_update.append(l["id_codigo"])
            
    if ids_to_update:
        # Supabase allows updating with .in_()
        supabase.table("ceu_lancamentos").update({"id_departamento": id_dep, "status": "conciliado"}).in_("id_codigo", ids_to_update).execute()
        
    return {"ok": True, "updated": len(ids_to_update)}

@app.post("/api/regras/executar-multiplas")
def executar_multiplas_regras(payload: Dict[str, Any]):
    regra_ids = payload.get("regra_ids", [])
    if not regra_ids:
        raise HTTPException(status_code=400, detail="Missing regra_ids")
        
    # Pick all active rules from the requested list, order by priority
    regras_resp = supabase.table("ceu_regras_extrato").select("*").in_("id_codigo", regra_ids).eq("ativo", True).order("prioridade", desc=False).execute()
    regras = regras_resp.data if regras_resp.data else []
    
    if not regras:
        return {"ok": True, "updated": 0, "message": "Nenhuma regra ativa selecionada."}
        
    total_atualizados = 0
    
    # Processa cada regra, uma a uma
    for regra in regras:
        dep_nome = regra.get("departamento_destino")
        if not dep_nome:
            continue
            
        dep_resp = supabase.table("ceu_departamentos").select("id_codigo").eq("nome", dep_nome).execute()
        if not dep_resp.data:
            continue
        id_dep = dep_resp.data[0]["id_codigo"]
        
        # O banco de dados vai mudar, pegamos os PENDENTES (que ainda tem null) NOVAMENTE
        # Assim garantimos uma hierarquia real onde regras mais prioritárias "roubam" os registros primeiro
        lanc_resp = supabase.table("ceu_lancamentos").select("*").is_("id_departamento", "null").execute()
        lancamentos = lanc_resp.data if lanc_resp.data else []
        
        if not lancamentos:
            break # Não há mais nada pendente!
            
        ids_to_update = []
        for l in lancamentos:
            match = True
            if regra.get("contem_historico"):
                if regra["contem_historico"].lower() not in l["historico_banco"].lower():
                    match = False
            if match and regra.get("contem_detalhes"):
                detalhes = l.get("detalhes_complementares") or ""
                if regra["contem_detalhes"].lower() not in detalhes.lower():
                    match = False
            if match and regra.get("tipo_movimento"):
                if regra["tipo_movimento"] != l["tipo_movimento"]:
                    match = False
            if match and regra.get("valores_exatos"):
                try:
                    v_exatos = [float(v.strip().replace(',', '.')) for v in regra["valores_exatos"].split(",")]
                    if l["valor_absoluto"] not in v_exatos:
                        match = False
                except:
                    match = False # Prevenindo erros de parse em virgulas quebradas no JSON/DB
                    
            if match:
                ids_to_update.append(l["id_codigo"])
                
        if ids_to_update:
            supabase.table("ceu_lancamentos").update({"id_departamento": id_dep, "status": "conciliado"}).in_("id_codigo", ids_to_update).execute()
            total_atualizados += len(ids_to_update)
            
    return {"ok": True, "updated": total_atualizados}

@app.post("/api/lancamentos/bulk-departamento")
def bulk_update_departamento(payload: Dict[str, Any]):
    lanc_ids = payload.get("lancamento_ids", [])
    dep_id = payload.get("departamento_id")
    if not lanc_ids or not dep_id:
        raise HTTPException(status_code=400, detail="Missing lancamento_ids or departamento_id")
        
    resp = supabase.table("ceu_lancamentos").update({"id_departamento": dep_id, "status": "conciliado"}).in_("id_codigo", lanc_ids).execute()
    
    # Após aplicar para todos selecionados, vamos varrer os lançamentos buscar CNPJ/CPF
    # e criar as regras genéricas.
    lanc_docs_resp = supabase.table("ceu_lancamentos").select("detalhes_complementares, tipo_movimento").in_("id_codigo", lanc_ids).execute()
    dep_nome_resp = supabase.table("ceu_departamentos").select("nome").eq("id_codigo", dep_id).execute()
    
    regras_criadas = 0
    if lanc_docs_resp.data and dep_nome_resp.data:
        dep_nome = dep_nome_resp.data[0]["nome"]
        
        # Guardaremos os documentos associados a qual tipo_movimento encontraram primeiro
        docs_info = {}
        
        # Regex básico para CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx) - formatos padronizados de banco
        doc_pattern = re.compile(r'(\d{2,3}\.\d{3}\.\d{3}\/?\d{0,4}-\d{2})')
        
        for l in lanc_docs_resp.data:
            detalhes = l.get("detalhes_complementares") or ""
            tipo = l.get("tipo_movimento")
            matches = doc_pattern.findall(detalhes)
            for m in matches:
                # Armazena o CPF/CNPJ. Se já tiver, mantém (poderíamos ter múltiplos tipos, mas usualmente é o mesmo pernecente)
                if m not in docs_info:
                    docs_info[m] = tipo
                
        # Para cada documento único, criar regra se já não existir
        for doc, tipo_mov in docs_info.items():
            check_regra = supabase.table("ceu_regras_extrato").select("id_codigo").eq("contem_detalhes", doc).execute()
            if not check_regra.data:
                insert_regra = {
                    "nome_regra": dep_nome,
                    "contem_historico": None,
                    "contem_detalhes": doc,
                    "tipo_movimento": tipo_mov,
                    "valores_exatos": None,
                    "departamento_destino": dep_nome,
                    "ativo": True,
                    "prioridade": 10 # Prioridade baixa pra Regra Automatica de Massa
                }
                supabase.table("ceu_regras_extrato").insert(insert_regra).execute()
                regras_criadas += 1

    return {"ok": True, "updated": len(lanc_ids), "regras_criadas": regras_criadas}

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
