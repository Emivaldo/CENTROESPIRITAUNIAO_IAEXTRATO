-- Adiciona coluna de status na tabela de arquivos importados
ALTER TABLE ceu_arquivos_importados 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('completo', 'pendente')) DEFAULT 'pendente' NOT NULL;
