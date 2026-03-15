-- Aggiungi la colonna per il dominio personalizzato
ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain TEXT;
