import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle2, AlertCircle, Copy, RefreshCw, ExternalLink, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: 'valid' | 'invalid' | 'pending';
}

interface DomainManagerProps {
  site: {
    id: string;
    site_name: string;
    domain: string;
    vercel_project_id?: string;
  };
  onUpdate: () => void;
}

export const DomainManager: React.FC<DomainManagerProps> = ({ site, onUpdate }) => {
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [config, setConfig] = useState<{
    status: 'pending' | 'verified' | 'error';
    records: DnsRecord[];
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || newDomain === site.domain) return;

    setIsAdding(true);
    setNotification(null);

    try {
      // 1. Aggiorna il database con il nuovo dominio
      const { error } = await supabase
        .from('user_sites')
        .update({ domain: newDomain.toLowerCase().trim() })
        .eq('id', site.id);

      if (error) throw error;

      // 2. Simulazione configurazione DNS (in un caso reale chiameremmo l'API di Vercel qui)
      setTimeout(() => {
        setConfig({
          status: 'pending',
          records: [
            { type: 'A', name: '@', value: '76.76.21.21', status: 'pending' },
            { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', status: 'pending' }
          ]
        });
        setIsAdding(false);
        onUpdate(); // Ricarica i dati nel genitore
        setNotification({ type: 'success', message: 'Dominio collegato! Ora configura i DNS.' });
      }, 1000);

    } catch (err: any) {
      console.error('Errore collegamento dominio:', err);
      setNotification({ type: 'error', message: 'Errore durante il collegamento del dominio.' });
      setIsAdding(false);
    }
  };

  const handleDeleteSite = async () => {
    if (window.confirm("Sei sicuro di voler eliminare questo sito? Questa operazione è irreversibile.")) {
      try {
        const response = await fetch('/api/delete-site', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: site.vercel_project_id })
        });
        if (!response.ok) throw new Error('Errore durante l\'eliminazione');
        window.location.reload(); // Ricarica la pagina dopo l'eliminazione
      } catch (err) {
        setNotification({ type: 'error', message: 'Errore durante l\'eliminazione del sito.' });
      }
    }
  };

  const handleManageDomain = async (action: 'add' | 'remove', domain: string) => {
    try {
      const response = await fetch('/api/manage-domain', {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: site.vercel_project_id, domain, action })
      });
      if (!response.ok) throw new Error('Errore gestione dominio');
      onUpdate();
      setNotification({ type: 'success', message: `Dominio ${action === 'add' ? 'aggiunto' : 'rimosso'} con successo.` });
    } catch (err) {
      setNotification({ type: 'error', message: 'Errore gestione dominio.' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isVercelDomain = site.domain.endsWith('.vercel.app');

  return (
    <div className="space-y-6">
      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
        >
          {notification.message}
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-black/5 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Dominio Personalizzato</h2>
            <p className="text-sm text-gray-500">Gestisci l'indirizzo web del tuo store</p>
          </div>
        </div>

        <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Dominio Vercel (Default)</p>
              <p className="text-lg font-mono font-bold text-indigo-600">{site.domain}</p>
            </div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">Scorta</span>
          </div>
          
          {/* Qui andrebbe la logica per mostrare/gestire il custom_domain se esistesse nel sito */}
          {/* Per ora aggiungiamo solo il bottone elimina */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleDeleteSite}
              className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
            >
              Elimina Sito
            </button>
          </div>
        </div>

        {!config ? (
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {isVercelDomain ? 'Collega un dominio personalizzato' : 'Cambia dominio personalizzato'}
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="es. www.miosito.it"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={isAdding || !newDomain || newDomain === site.domain}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Collega'}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-400 italic">
                Inserendo un nuovo dominio, questo sostituirà automaticamente quello attuale di Vercel.
              </p>
            </div>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Configurazione DNS richiesta</p>
                  <p className="text-xs text-amber-700">Il tuo dominio <strong>{site.domain}</strong> non è ancora puntato correttamente.</p>
                </div>
              </div>
              <button
                onClick={verifyStatus}
                disabled={isVerifying}
                className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors flex items-center gap-2"
              >
                {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verifica ora'}
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-700">Imposta i seguenti record nel tuo pannello DNS:</p>
              <div className="overflow-hidden border border-gray-100 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-bold">Tipo</th>
                      <th className="px-4 py-3 font-bold">Nome</th>
                      <th className="px-4 py-3 font-bold">Valore</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {config.records.map((record, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 font-mono text-indigo-600 font-bold">{record.type}</td>
                        <td className="px-4 py-4 text-gray-600 font-medium">{record.name}</td>
                        <td className="px-4 py-4 text-gray-900 font-mono text-xs truncate max-w-[200px]">
                          {record.value}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => copyToClipboard(record.value)}
                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Copia valore"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button
                onClick={() => setConfig(null)}
                className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors"
              >
                Annulla configurazione
              </button>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
              >
                Apri sito <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
