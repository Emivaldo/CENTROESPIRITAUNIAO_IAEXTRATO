import os
import re
import pandas as pd
import streamlit as st
import plotly.express as px
from PyPDF2 import PdfReader

# Configurações iniciais da página Streamlit
st.set_page_config(page_title="Fluxo de Caixa - Extratos", layout="wide")

st.title("💸 Dashboard de Fluxo de Caixa")
st.markdown("Extração automática dos extratos bancários da pasta `Arquivos`.")

@st.cache_data
def load_data():
    arquivos_dir = 'Arquivos'
    if not os.path.exists(arquivos_dir):
        return pd.DataFrame()
        
    pdfs = [f for f in os.listdir(arquivos_dir) if f.endswith('.pdf')]
    if not pdfs:
        return pd.DataFrame()

    all_transactions = []
    
    date_pattern = re.compile(r'^(\d{2}/\d{2})\s+(.*?)([\d\.,]+)([CD]?)$')
    date_pattern_no_value = re.compile(r'^(\d{2}/\d{2})\s+(.*)$')
    value_pattern = re.compile(r'^([\d\.,]+)([CD]?)$')
    type_cd_pattern = re.compile(r'^([CD])$')

    for pdf_file in pdfs:
        filepath = os.path.join(arquivos_dir, pdf_file)
        
        # Extrair o Mês e Ano do nome do arquivo (ex: 2050-8.01.2024.pdf)
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
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith("SALDO ANTERIOR") or "SALDO DO DIA" in line or "SALDO BLOQ" in line or "SICOOB" in line or "PLATAFORMA" in line or "EXTRATO CONTA CORRENTE" in line or line.startswith("COOP.:") or line.startswith("CONTA:") or line.startswith("PERODO") or line.startswith("PERÍODO") or "HIST" in line or "DATA " in line:
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
            
        for tx in transactions:
            if not tx['valor_str']:
                continue
                
            float_val = float(tx['valor_str'].replace('.', '').replace(',', '.'))
            if tx['tipo'] == 'D':
                float_val = -float_val
                
            detalhes = " | ".join(tx['detalhes'])
            
            # format data to DD/MM/YYYY
            data_completa = f"{tx['data_dia_mes']}/{tx['ano']}"
            
            all_transactions.append({
                'Data': data_completa,
                'Histórico': tx['historico'],
                'Receita/Despesa': 'Receita' if float_val >= 0 else 'Despesa',
                'Valor': float_val,
                'Detalhes': detalhes,
                'ArquivoOrigem': pdf_file
            })
            
    if not all_transactions:
        return pd.DataFrame()
        
    df = pd.DataFrame(all_transactions)
    df['Data'] = pd.to_datetime(df['Data'], format='%d/%m/%Y')
    df = df.sort_values(by='Data')
    return df

df = load_data()

if df.empty:
    st.warning("Nenhuma transação encontrada. Verifique se a pasta `Arquivos` contém PDFs válidos.")
else:
    # --- MÉTTRICAS ---
    st.subheader("Resumo de Entradas e Saídas")
    col1, col2, col3 = st.columns(3)
    
    total_receitas = df[df['Receita/Despesa'] == 'Receita']['Valor'].sum()
    total_despesas = df[df['Receita/Despesa'] == 'Despesa']['Valor'].sum()  # É negativo
    saldo_geral = total_receitas + total_despesas
    
    col1.metric("Total de Receitas", f"R$ {total_receitas:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    col2.metric("Total de Despesas", f"R$ {abs(total_despesas):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    col3.metric("Saldo Líquido", f"R$ {saldo_geral:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))

    # --- GRÁFICOS ---
    st.subheader("Análise Mensal")
    df['Mês_Ano'] = df['Data'].dt.strftime('%Y-%m')
    
    # Agrupar por Mês_Ano e Receita/Despesa
    df_group = df.groupby(['Mês_Ano', 'Receita/Despesa'])['Valor'].sum().reset_index()
    
    # Fazer despesas positivas no gráfico para melhor visualização (opcional)
    df_group['ValorAbs'] = df_group['Valor'].abs()
    
    fig = px.bar(
        df_group, 
        x='Mês_Ano', 
        y='ValorAbs', 
        color='Receita/Despesa', 
        barmode='group',
        title='Receitas vs Despesas por Mês',
        color_discrete_map={'Receita': 'green', 'Despesa': 'red'},
        labels={'ValorAbs': 'Valor (R$)', 'Mês_Ano': 'Mês'}
    )
    st.plotly_chart(fig, use_container_width=True)

    # --- TABELA DE DADOS ---
    st.subheader("Todas as Transações")
    
    # Formatando para exibição
    df_display = df.copy()
    df_display['Data'] = df_display['Data'].dt.strftime('%d/%m/%Y')
    df_display['Valor'] = df_display['Valor'].apply(lambda x: f"R$ {x:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    
    st.dataframe(df_display, use_container_width=True)
