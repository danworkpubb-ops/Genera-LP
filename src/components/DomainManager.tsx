import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle2, AlertCircle, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: 'valid' | 'invalid' | 'pending';
}

export const DomainManager: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [config, setConfig] = useState<{
    status: 'pending' | 'verified' | 'error';
    records: DnsRecord[];
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    // Simulazione chiamata API a Vercel tramite il nostro backend
    setTimeout(() => {
      setConfig({
        status: 'pending',
        records: [
          { type: 'A', name: '@', value: '76.76.21.21', status: 'pending' },
          { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', status: 'pending' }
        ]
      });
      setIsAdding(false);
    }, 1500);
  };

  const verifyStatus = () => {
    setIsVerifying(true);
    // Simulazione verifica
    setTimeout(() => {
      setIsVerifying(false);
      // Qui aggiorneremmo lo stato reale
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Potresti aggiungere un toast qui
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Globe className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dominio Personalizzato</h2>
          <p className="text-sm text-gray-500">Collega il tuo dominio per pubblicare la tua landing page</p>
        </div>
      </div>

      {!config ? (
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Indirizzo Dominio
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="es. www.miosito.it"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                required
              />
              <button
                type="submit"
                disabled={isAdding}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Collega'}
              </button>
            </div>
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
                <p className="text-sm font-medium text-amber-900">Configurazione DNS richiesta</p>
                <p className="text-xs text-amber-700">Il tuo dominio {domain} non è ancora puntato correttamente.</p>
              </div>
            </div>
            <button
              onClick={verifyStatus}
              disabled={isVerifying}
              className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors flex items-center gap-2"
            >
              {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verifica ora'}
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">Imposta i seguenti record nel tuo pannello DNS:</p>
            <div className="overflow-hidden border border-gray-100 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Valore</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {config.records.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-mono text-indigo-600 font-bold">{record.type}</td>
                      <td className="px-4 py-4 text-gray-600">{record.name}</td>
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
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Rimuovi dominio
            </button>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              Apri sito <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
};
