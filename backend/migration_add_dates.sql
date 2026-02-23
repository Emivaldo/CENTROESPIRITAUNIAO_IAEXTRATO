-- Adiciona colunas de data inicial e final na tabela de arquivos importados
ALTER TABLE ceu_arquivos_importados 
ADD COLUMN IF NOT EXISTS data_inicial DATE,
ADD COLUMN IF NOT EXISTS data_final DATE;
