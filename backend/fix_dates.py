"""
Script para corrigir data_inicial, data_final e status dos arquivos ja importados.
Busca min/max da data_transacao de cada arquivo nos lancamentos ja armazenados.
"""
import calendar
from datetime import date
from supabase_client import supabase

def main():
    # 1. Buscar todos os arquivos
    arq_resp = supabase.table("ceu_arquivos_importados").select("id_codigo, nome_arquivo, mes_ano").execute()
    arquivos = arq_resp.data if arq_resp.data else []
    print(f"Total de arquivos no banco: {len(arquivos)}")
    
    for arq in arquivos:
        id_arq = arq["id_codigo"]
        nome = arq["nome_arquivo"]
        mes_ano = arq["mes_ano"]
        
        # 2. Buscar lancamentos deste arquivo
        lanc_resp = supabase.table("ceu_lancamentos") \
            .select("data_transacao") \
            .eq("id_arquivo_origem", id_arq) \
            .order("data_transacao") \
            .execute()
        
        lancamentos = lanc_resp.data if lanc_resp.data else []
        
        if not lancamentos:
            print(f"  [{nome}] Sem lancamentos. Pulando.")
            continue
        
        datas = [l["data_transacao"] for l in lancamentos if l["data_transacao"]]
        if not datas:
            print(f"  [{nome}] Lancamentos sem data. Pulando.")
            continue
            
        data_inicial = min(datas)
        data_final = max(datas)
        
        # 3. Calcular status (C ou P)
        parts_mes = mes_ano.split("/")
        status_arquivo = "P"
        if len(parts_mes) == 2:
            try:
                m = int(parts_mes[0])
                y = int(parts_mes[1])
                ultimo_dia = calendar.monthrange(y, m)[1]
                data_fim_iso = date(y, m, ultimo_dia).isoformat()
                status_arquivo = "C" if data_final >= data_fim_iso else "P"
            except:
                status_arquivo = "P"
        
        # 4. Atualizar no banco
        supabase.table("ceu_arquivos_importados").update({
            "data_inicial": data_inicial,
            "data_final": data_final,
            "status": status_arquivo
        }).eq("id_codigo", id_arq).execute()
        
        status_label = "Completo" if status_arquivo == "C" else "Pendente"
        print(f"  [{nome}] {data_inicial} -> {data_final} | {status_label}")
    
    print("\nCorrecao concluida!")

if __name__ == "__main__":
    main()
