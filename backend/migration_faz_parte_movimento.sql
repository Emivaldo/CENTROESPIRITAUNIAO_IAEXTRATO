-- Adiciona campo faz_parte_movimento na tabela ceu_departamentos
-- Departamentos com faz_parte_movimento = false não aparecem no Dashboard
ALTER TABLE ceu_departamentos
ADD COLUMN IF NOT EXISTS faz_parte_movimento BOOLEAN DEFAULT true;

-- Atualiza todos os departamentos existentes para true
UPDATE ceu_departamentos SET faz_parte_movimento = true WHERE faz_parte_movimento IS NULL;
