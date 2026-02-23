import os
from supabase_client import supabase
from parser import extract_data
import datetime

def convert_to_date_str(date_str):
    # Receives DD/MM/YYYY, output YYYY-MM-DD
    parts = date_str.split('/')
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return "2024-01-01"

def run_import():
    print("Iniciando importação para o Supabase...")
    data = extract_data()
    arquivos_summary = data.get("files_summary", [])
    transacoes = data.get("transactions", [])
    
    # 1. Fetch arquivos já presentes no BD para evitar duplicidade
    existing_files_resp = supabase.table("ceu_arquivos_importados").select("nome_arquivo").execute()
    existing_files = [f["nome_arquivo"] for f in existing_files_resp.data] if existing_files_resp.data else []
    
    novos_arquivos = 0
    lancamentos_novos = 0
    
    for arquivo_meta in arquivos_summary:
        nome_arquivo = arquivo_meta["arquivo"]
        if nome_arquivo in existing_files:
            print(f"[PULANDO] {nome_arquivo} já importado.")
            continue
            
        print(f"[PROCESSANDO] Importando {nome_arquivo}...")
        
        # Insert Arquivo
        insert_arq = {
            "nome_arquivo": nome_arquivo,
            "conta": arquivo_meta["conta"],
            "mes_ano": arquivo_meta["mes_ano"],
            "saldo_inicial": arquivo_meta["saldo_inicial"],
            "saldo_final": arquivo_meta["saldo_final"],
            "total_debitos": arquivo_meta["total_debitos"],
            "total_creditos": arquivo_meta["total_creditos"]
        }
        
        arq_resp = supabase.table("ceu_arquivos_importados").insert(insert_arq).execute()
        if not arq_resp.data:
            print(f"Erro ao inserir {nome_arquivo}. Ignorando lançamentos.")
            continue
            
        id_arquivo = arq_resp.data[0]["id_codigo"]
        novos_arquivos += 1
        
        # Filtra os lançamentos referentes a este arquivo
        lancs_arquivo = [t for t in transacoes if t["arquivo"] == nome_arquivo]
        
        insert_lancs = []
        for t in lancs_arquivo:
            # valor vem do backend (negativo ou positivo). No banco é absoluto!
            valor_abs = abs(t["valor"])
            
            insert_lancs.append({
                "id_arquivo_origem": id_arquivo,
                "status": "pendente",
                "data_transacao": convert_to_date_str(t["data"]),
                "historico_banco": t["historico"],
                "detalhes_complementares": t["detalhes"][:1000] if len(t["detalhes"]) > 1000 else t["detalhes"],
                "tipo_movimento": t["tipo_movimento"],
                "valor_absoluto": valor_abs
            })
            
        # Inserção em batch (lote) para ficar mais rápido
        if insert_lancs:
            # Pela API, grandes listas podem dar erro no request, quebraremos em pedaços de 100
            batch_size = 100
            for i in range(0, len(insert_lancs), batch_size):
                supabase.table("ceu_lancamentos").insert(insert_lancs[i:i + batch_size]).execute()
            lancamentos_novos += len(insert_lancs)
            
    print(f"\n✅ Importação Concluída: {novos_arquivos} novos extratos, {lancamentos_novos} lançamentos gravados no Supabase.")

if __name__ == "__main__":
    run_import()
