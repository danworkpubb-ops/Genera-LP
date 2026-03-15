import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  ShoppingCart, 
  Package, 
  Plus, 
  ExternalLink, 
  TrendingUp,
  Users,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  Copy,
  Pencil,
  Check,
  X,
  Mail,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { DomainManager } from './components/DomainManager';

import { supabase } from './lib/supabase';
import { vercelService } from './services/automation';
import { Auth } from './components/Auth';
import { User } from '@supabase/supabase-js';

// Mock data for the dashboard
const SALES_DATA = [
  { name: 'Lun', sales: 4000 },
  { name: 'Mar', sales: 3000 },
  { name: 'Mer', sales: 2000 },
  { name: 'Gio', sales: 2780 },
  { name: 'Ven', sales: 1890 },
  { name: 'Sab', sales: 2390 },
  { name: 'Dom', sales: 3490 },
];

const RECENT_ORDERS = [
  { id: '1', customer: 'Mario Rossi', product: 'Scarpe Running Pro', amount: '€89.00', status: 'In attesa', date: '10 min fa' },
  { id: '2', customer: 'Luigi Bianchi', product: 'Zaino Tech', amount: '€120.00', status: 'Spedito', date: '1 ora fa' },
  { id: '3', customer: 'Anna Verdi', product: 'Orologio Smart', amount: '€199.00', status: 'Consegnato', date: '3 ore fa' },
];

const SITES = [
  { id: '1', name: 'Store Sportivo', domain: 'sport-store.vercel.app', status: 'Ready' },
  { id: '2', name: 'Tech Gadgets', domain: 'tech-gadgets.vercel.app', status: 'Deploying' },
];

// Tipi per i dati
interface Site {
  id: string;
  site_name: string;
  domain: string;
  status: string;
  vercel_project_id?: string;
  admin_user?: string;
  admin_password?: string;
}

export default function App() {
  const [session, setSession] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [createdSiteCredentials, setCreatedSiteCredentials] = useState<{user: string, pass: string, name: string, domain: string} | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Gestione sessione iniziale
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user ?? null);
      if (session?.user) fetchSites();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user ?? null);
      if (session?.user) fetchSites();
      else setSites([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSites = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (err) {
      console.error('Errore nel caricamento siti:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSiteName = async (siteId: string) => {
    if (!editNameValue.trim()) return;

    try {
      const { error } = await supabase
        .from('user_sites')
        .update({ site_name: editNameValue })
        .eq('id', siteId);

      if (error) throw error;

      setSites(prev => prev.map(s => s.id === siteId ? { ...s, site_name: editNameValue } : s));
      setEditingSiteId(null);
      setNotification({ type: 'success', message: 'Nome del sito aggiornato con successo!' });
    } catch (err: any) {
      console.error('Errore aggiornamento nome:', err);
      setNotification({ type: 'error', message: 'Errore durante l\'aggiornamento del nome.' });
    }
  };

  const startEditing = (site: Site) => {
    setEditingSiteId(site.id);
    setEditNameValue(site.site_name);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    setIsCreating(true);
    setNotification(null);
    try {
      if (!session) throw new Error('Utente non autenticato');

      // Genera credenziali automatiche
      const adminUser = 'admin@' + newSiteName.toLowerCase().replace(/\s+/g, '') + '.com';
      const adminPassword = Math.random().toString(36).slice(-10) + 'A1!';

      // 2. Crea il record nel database (stato iniziale)
      const { data: newSite, error: dbError } = await supabase
        .from('user_sites')
        .insert([
          { 
            user_id: session.id, 
            site_name: newSiteName, 
            status: 'deploying',
            domain: `${newSiteName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`,
            admin_user: adminUser,
            admin_password: adminPassword
          }
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Mostra subito le credenziali all'utente
      const domain = `${newSiteName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`;
      setCreatedSiteCredentials({
        user: adminUser,
        pass: adminPassword,
        name: newSiteName,
        domain: domain
      });

      // 3. Chiamata al nostro backend per creare il progetto reale su Vercel
      try {
        const response = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteName: newSiteName,
            siteId: newSite.id,
            adminUser: adminUser,
            adminPassword: adminPassword,
            ownerId: session.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Errore durante il deploy su Vercel');
        }

        const vercelData = await response.json();

        // Aggiorna anche lo stato locale per il modal se è ancora aperto
        setCreatedSiteCredentials(prev => prev ? { ...prev, domain: vercelData.url } : null);

        // 4. Aggiorna il record con l'ID di Vercel e il dominio reale
        await supabase
          .from('user_sites')
          .update({ 
            vercel_project_id: vercelData.id, 
            domain: vercelData.url,
            status: 'ready' 
          })
          .eq('id', newSite.id);
      } catch (vercelErr: any) {
        console.error('Errore Deploy:', vercelErr);
        
        let customMessage = vercelErr.message || 'Errore di connessione';
        
        if (customMessage.includes('GitHub integration')) {
          customMessage = "⚠️ Errore Integrazione GitHub: Vercel non ha i permessi per accedere al repository. \n\nSoluzione: Vai su Vercel -> Settings -> Integrations -> GitHub e clicca su 'Configure' per autorizzare il repository del progetto cuore.";
        }

        setNotification({ 
          type: 'error', 
          message: customMessage 
        });
      }

      // Ricarica la lista
      fetchSites();
      setNotification({ type: 'success', message: 'Sito creato! Salva le credenziali qui sotto.' });
      setShowCreateModal(false);
      setNewSiteName('');
    } catch (err: any) {
      console.error('Errore creazione sito:', err);
      setNotification({ type: 'error', message: `Errore: ${err.message || 'Errore sconosciuto'}` });
    } finally {
      setIsCreating(false);
    }
  };

  if (!session) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  const renderContent = () => {
    if (selectedSite) {
      const currentSite = sites.find(s => s.id === selectedSite);
      return (
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => setSelectedSite(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors"
          >
            <ArrowLeft size={20} /> Torna ai siti
          </button>
          
          <div className="mb-12">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Configurazione Sito</h1>
            <p className="text-gray-500">Gestisci il dominio e le impostazioni tecniche per il tuo sito.</p>
          </div>

          {currentSite && (
            <DomainManager 
              site={currentSite} 
              onUpdate={fetchSites} 
            />
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-gray-500 mt-1">Benvenuto nel tuo centro di controllo SaaS.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
              >
                <Plus size={20} />
                Crea Nuovo Sito
              </button>
            </div>

            {notification && (
              <div className={`mb-6 p-4 rounded-xl border ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                {notification.message}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Vendite Totali" value="€0" change="0%" icon={<TrendingUp className="text-emerald-600" />} />
              <StatCard title="Ordini Ricevuti" value="0" change="0%" icon={<ShoppingCart className="text-indigo-600" />} />
              <StatCard title="Siti Attivi" value={sites.length.toString()} change="0%" icon={<Globe className="text-blue-600" />} />
              <StatCard title="Clienti Unici" value="0" change="0%" icon={<Users className="text-orange-600" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart Section */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Andamento Vendite</h3>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none">
                    <option>Ultimi 7 giorni</option>
                    <option>Ultimo mese</option>
                  </select>
                </div>
                <div className="h-[300px] w-full flex items-center justify-center text-gray-400 italic">
                  Nessun dato di vendita disponibile
                </div>
              </div>

              {/* Sites List */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg mb-6">I tuoi Siti</h3>
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  ) : sites.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm italic">Nessun sito creato</p>
                  ) : (
                    sites.slice(0, 3).map(site => (
                      <div key={site.id} className="p-4 border border-gray-100 rounded-xl hover:border-indigo-100 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                          {editingSiteId === site.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input 
                                type="text"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateSiteName(site.id)} className="text-emerald-600 hover:text-emerald-700">
                                <Check size={16} />
                              </button>
                              <button onClick={() => setEditingSiteId(null)} className="text-red-600 hover:text-red-700">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/title">
                              <p className="font-semibold">{site.site_name}</p>
                              <button 
                                onClick={() => startEditing(site)}
                                className="opacity-0 group-hover/title:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-all"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )}
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${site.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {site.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-3 truncate">{site.domain}</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedSite(site.id)}
                            className="flex-1 text-xs font-semibold py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Settings size={14} /> Configura
                          </button>
                          <button 
                            onClick={() => window.open(`https://${site.domain}`, '_blank')}
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Apri sito"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab('sites')}
                  className="w-full mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1"
                >
                  Vedi tutti <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">Ordini Recenti</h3>
                <button className="text-sm font-semibold text-indigo-600">Esporta CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Cliente</th>
                      <th className="px-6 py-4 font-semibold">Prodotto</th>
                      <th className="px-6 py-4 font-semibold">Importo</th>
                      <th className="px-6 py-4 font-semibold">Stato</th>
                      <th className="px-6 py-4 font-semibold">Data</th>
                      <th className="px-6 py-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {RECENT_ORDERS.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-medium">{order.customer}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{order.product}</td>
                        <td className="px-6 py-4 font-semibold">{order.amount}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            order.status === 'Consegnato' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'Spedito' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{order.date}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'sites':
        return (
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight">I miei Siti</h1>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
              >
                <Plus size={20} />
                Crea Sito
              </button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
              </div>
            ) : sites.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Nessun sito trovato</h3>
                <p className="text-gray-500 mb-6">Inizia creando il tuo primo store online.</p>
                <button 
                  onClick={handleCreateSite}
                  className="text-indigo-600 font-semibold hover:text-indigo-700"
                >
                  Crea il tuo primo sito &rarr;
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sites.map(site => (
                  <div key={site.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-50 rounded-xl">
                        <Globe className="text-indigo-600 w-6 h-6" />
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${site.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {site.status}
                      </span>
                    </div>
                    {editingSiteId === site.id ? (
                      <div className="flex items-center gap-2 mb-4">
                        <input 
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button onClick={() => handleUpdateSiteName(site.id)} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
                          <Check size={20} />
                        </button>
                        <button onClick={() => setEditingSiteId(null)} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1 group/title">
                        <h3 className="text-xl font-bold">{site.site_name}</h3>
                        <button 
                          onClick={() => startEditing(site)}
                          className="opacity-0 group-hover/title:opacity-100 p-1.5 text-gray-400 hover:text-indigo-600 transition-all"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    )}
                    <p className="text-gray-500 text-sm mb-6">{site.domain}</p>
                    
                    {site.admin_user && site.admin_password && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-6 space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1.5 text-gray-400 font-semibold uppercase tracking-wider">
                            <Mail size={10} />
                            <span>Admin</span>
                          </div>
                          <span className="font-mono text-indigo-600 font-bold">{site.admin_user}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1.5 text-gray-400 font-semibold uppercase tracking-wider">
                            <Lock size={10} />
                            <span>Pass</span>
                          </div>
                          <span className="font-mono text-indigo-600 font-bold">{site.admin_password}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setSelectedSite(site.id)}
                        className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-900 font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings size={18} /> Configura
                      </button>
                      <button 
                        onClick={() => window.open(`https://${site.domain}`, '_blank')}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                        title="Apri sito"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return <div className="flex items-center justify-center h-full text-gray-400">Sezione in fase di sviluppo</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans text-[#1A1A1A]">
      {/* Modal Credenziali */}
      {createdSiteCredentials && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">Sito in Creazione!</h3>
            <p className="text-gray-500 text-center mb-6">Abbiamo avviato la costruzione del tuo store <strong>{createdSiteCredentials.name}</strong>.</p>
            
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-6 flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Nota:</strong> Il sito è in fase di deploy su Vercel. Sarà raggiungibile tra circa 1-2 minuti. Nel frattempo, salva le tue credenziali.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Admin</label>
                <div className="flex items-center justify-between">
                  <code className="text-indigo-600 font-mono font-bold">{createdSiteCredentials.user}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(createdSiteCredentials.user)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
                <div className="flex items-center justify-between">
                  <code className="text-indigo-600 font-mono font-bold">{createdSiteCredentials.pass}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(createdSiteCredentials.pass)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setCreatedSiteCredentials(null)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              Ho salvato le credenziali
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`bg-white border-r border-[#E5E7EB] transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">SaaSGen</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard' && !selectedSite} 
            onClick={() => { setActiveTab('dashboard'); setSelectedSite(null); }}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Globe size={20} />} 
            label="I miei Siti" 
            active={activeTab === 'sites' || selectedSite !== null} 
            onClick={() => { setActiveTab('sites'); setSelectedSite(null); }}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Package size={20} />} 
            label="Prodotti" 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<ShoppingCart size={20} />} 
            label="Ordini" 
            active={activeTab === 'orders'} 
            onClick={() => setActiveTab('orders')}
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Impostazioni" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<LogOut size={20} />} 
            label="Logout" 
            active={false} 
            onClick={handleLogout}
            collapsed={!isSidebarOpen}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cerca..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-semibold truncate max-w-[150px]">{session.email?.split('@')[0]}</p>
                <p className="text-xs text-gray-500">Pro Plan</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold uppercase">
                {session.email?.[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </div>
        
        {/* WebSocket Note */}
        <div className="max-w-7xl mx-auto px-8 pb-8">
          <p className="text-[10px] text-gray-400 flex items-center gap-1.5 opacity-50">
            <RefreshCw className="w-2.5 h-2.5" />
            Nota tecnica: Gli errori "WebSocket" in console sono normali in questo ambiente e possono essere ignorati.
          </p>
        </div>
      </main>

      {/* Modal Creazione Sito */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Nuovo Store</h2>
            <p className="text-gray-500 mb-6 text-sm">Inserisci un nome per il tuo nuovo negozio online.</p>
            
            <form onSubmit={handleCreateSite}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Store</label>
                <input 
                  type="text"
                  autoFocus
                  required
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="Esempio: Il Mio Fantastico Shop"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Costruendo...</span>
                    </>
                  ) : 'Crea Ora'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-indigo-50 text-indigo-600 font-semibold' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className={active ? 'text-indigo-600' : 'text-gray-400'}>{icon}</span>
      {!collapsed && <span>{label}</span>}
      {active && !collapsed && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
    </button>
  );
}

function StatCard({ title, value, change, icon }: { title: string, value: string, change: string, icon: React.ReactNode }) {
  const isPositive = change.startsWith('+');
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-gray-50 rounded-xl">
          {icon}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {change}
        </span>
      </div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
