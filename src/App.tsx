import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { LoadingBlock } from './lib/useApi';

// Login fica eager — é o primeiro hit do usuário, evitamos qualquer flicker.
import Login from './pages/Login';

// Demais páginas: lazy. Cada uma vira chunk separado, carregado só quando navega.
// Bundle inicial cai de ~787KB pra ~150KB; cada página posterior baixa só seu chunk
// (10-40KB) e fica em cache. Effect: navegação fica quase instantânea.
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Leads           = lazy(() => import('./pages/Leads'));
const Pipeline        = lazy(() => import('./pages/Pipeline'));
const Empreendimentos = lazy(() => import('./pages/Empreendimentos'));
const Vendas          = lazy(() => import('./pages/Vendas'));
const Corretores      = lazy(() => import('./pages/Corretores'));
const Equipes         = lazy(() => import('./pages/Equipes'));
const Roletas         = lazy(() => import('./pages/Roletas'));
const Trafego         = lazy(() => import('./pages/Trafego'));
const Tarefas         = lazy(() => import('./pages/Tarefas'));
const Relatorios      = lazy(() => import('./pages/Relatorios'));
const Financeiro      = lazy(() => import('./pages/Financeiro'));
const Executivo       = lazy(() => import('./pages/Executivo'));
const Avisos          = lazy(() => import('./pages/Avisos'));
const Videos          = lazy(() => import('./pages/Videos'));
const Chat            = lazy(() => import('./pages/Chat'));
const Formularios     = lazy(() => import('./pages/Formularios'));
const PainelTV        = lazy(() => import('./pages/PainelTV'));
const Configuracoes   = lazy(() => import('./pages/Configuracoes'));
const Perfil          = lazy(() => import('./pages/Perfil'));
const Ranking         = lazy(() => import('./pages/Ranking'));
const BM              = lazy(() => import('./pages/BM'));
const Distribuicao    = lazy(() => import('./pages/Distribuicao'));
const Remarketing     = lazy(() => import('./pages/Remarketing'));
const MetaCustos      = lazy(() => import('./pages/MetaCustos'));
const PainelExecutivo = lazy(() => import('./pages/PainelExecutivo'));
const ImportarLeads   = lazy(() => import('./pages/ImportarLeads'));
const LPPublica       = lazy(() => import('./pages/LPPublica'));
const Transferencias  = lazy(() => import('./pages/Transferencias'));
const Auditoria       = lazy(() => import('./pages/Auditoria'));
const Bolsoes         = lazy(() => import('./pages/Bolsoes'));
const FinanceiroPons  = lazy(() => import('./pages/FinanceiroPons'));
const AgenteIA        = lazy(() => import('./pages/AgenteIA'));
const Equipe          = lazy(() => import('./pages/Equipe'));
// DEV panel
const DevMensagens    = lazy(() => import('./pages/DevMensagens'));
const DevFeedback     = lazy(() => import('./pages/DevFeedback'));
const DevLogs         = lazy(() => import('./pages/DevLogs'));
const DevMetrics      = lazy(() => import('./pages/DevMetrics'));
// Páginas públicas (Google/Facebook OAuth verification)
const Privacidade     = lazy(() => import('./pages/Privacidade'));
const Termos          = lazy(() => import('./pages/Termos'));
const FbCallback      = lazy(() => import('./pages/FbCallback'));

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/painel-tv" element={<PainelTV />} />
        <Route path="/lp/:slug" element={<LPPublica />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/integracoes/fb-callback" element={<FbCallback />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/empreendimentos" element={<Empreendimentos />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/corretores" element={<Corretores />} />
          <Route path="/equipes" element={<Equipes />} />
          <Route path="/roletas" element={<Roletas />} />
          <Route path="/trafego" element={<Trafego />} />
          <Route path="/tarefas" element={<Tarefas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/executivo" element={<Executivo />} />
          <Route path="/avisos" element={<Avisos />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/formularios" element={<Formularios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/bm" element={<BM />} />
          <Route path="/distribuicao" element={<Distribuicao />} />
          <Route path="/remarketing" element={<Remarketing />} />
          <Route path="/meta-custos" element={<MetaCustos />} />
          <Route path="/painel-executivo" element={<PainelExecutivo />} />
          <Route path="/importar" element={<ImportarLeads />} />
          <Route path="/transferencias" element={<Transferencias />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/bolsoes" element={<Bolsoes />} />
          <Route path="/financeiro-pons" element={<FinanceiroPons />} />
          <Route path="/agente-ia" element={<AgenteIA />} />
          <Route path="/equipe" element={<Equipe />} />
          {/* DEV panel — CEO + DEV */}
          <Route path="/dev/mensagens" element={<DevMensagens />} />
          <Route path="/dev/feedback" element={<DevFeedback />} />
          <Route path="/dev/logs" element={<DevLogs />} />
          <Route path="/dev/metrics" element={<DevMetrics />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
