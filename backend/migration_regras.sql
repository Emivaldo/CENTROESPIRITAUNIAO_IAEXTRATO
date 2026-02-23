-- Tabela para armazenar regras de categorização automática de lançamentos
CREATE TABLE IF NOT EXISTS ceu_regras_extrato (
    id_codigo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    nome_regra TEXT NOT NULL,
    
    -- Condições de match (todos opcionais, combina com AND)
    contem_historico TEXT,           -- busca no histórico do banco (case insensitive)
    contem_detalhes TEXT,            -- busca nos detalhes complementares (case insensitive)
    tipo_movimento TEXT,             -- 'Receita', 'Despesa' ou NULL = qualquer
    valores_exatos TEXT,             -- valores exatos separados por vírgula: "50.00,60.00"
    
    -- Ação: departamento a ser atribuído
    departamento_destino TEXT NOT NULL,
    
    -- Meta
    ativo BOOLEAN DEFAULT true NOT NULL,
    prioridade INT DEFAULT 0 NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ceu_regras_extrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON ceu_regras_extrato FOR ALL USING (true) WITH CHECK (true);
