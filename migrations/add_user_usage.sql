-- Tabella per il monitoraggio dei consumi e limiti del piano
CREATE TABLE IF NOT EXISTS user_usage (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    sites_created_this_month INTEGER DEFAULT 0,
    generations_this_month INTEGER DEFAULT 0,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Abilita RLS
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo il proprio consumo
CREATE POLICY "Users can view own usage" ON user_usage
    FOR SELECT USING (auth.uid() = user_id);

-- Nota: Gli aggiornamenti dovrebbero essere fatti solo dal server (Service Role) 
-- o tramite una funzione sicura se necessario, ma qui lo faremo dal backend Express.
