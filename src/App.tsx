import { lazy, Suspense, ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { LoadingBlock } from './lib/useApi';

// Login fica eager — é o primeiro hit do usuário, evitamos qualquer flicker.
import Login from './pages/Login';

// Wrapper de lazy() com retry + force-reload em erro de chunk.
// Quando o frontend é redeployado, os hashes dos chunks mudam. Browsers com
// abas abertas tentam baixar um chunk antigo que não existe mais — Vercel SPA
// fallback responde index.html, daí React explode com "Failed to fetch
// dynamically imported module" / "'text/html' is not a valid JavaScript MIME
// type". A correção certa é dar `location.reload()` pra pegar o novo asset map.
function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const looksLikeStaleChunk =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Loading chunk') ||
        msg.includes('MIME') ||
        msg.includes('text/html');
      if (looksLikeStaleChunk) {
        // Tenta uma vez de novo (rede instável), aí recarrega de fato
        try { return await factory(); } catch {
          // Flag pra não cair em loop infinito de reload
          const key = 'pons.chunkReloadAt';
          const last = Number(sessionStorage.getItem(key) || '0');
          if (Date.now() - last > 30_000) {
            sessionStorage.setItem(key, String(Date.now()));
            window.location.reload();
            return new Promise(() => ({ default: (() => null) as any })); // never resolves
          }
        }
      }
      throw err;
    }
  });
}

// Demais páginas: lazy. Cada uma vira chunk separado, carregado só quando navega.
// Bundle inicial cai de ~787KB pra ~150KB; cada página posterior baixa só seu chunk
// (10-40KB) e fica em cache. Effect: navegação fica quase instantânea.
const CadastroColaborador = lazyRetry(() => import('./pages/CadastroColaborador'));
const NovaContratacao = lazyRetry(() => import('./pages/NovaContratacao'));
const OnboardingDocumentos = lazyRetry(() => import('./pages/OnboardingDocumentos'));
const OnboardingAprovacoes = lazyRetry(() => import('./pages/OnboardingAprovacoes'));
const Dashboard       = lazyRetry(() => import('./pages/Dashboard'));
const Leads           = lazyRetry(() => import('./pages/Leads'));
const Pipeline        = lazyRetry(() => import('./pages/Pipeline'));
const Empreendimentos = lazyRetry(() => import('./pages/Empreendimentos'));
const Vendas          = lazyRetry(() => import('./pages/Vendas'));
const Corretores      = lazyRetry(() => import('./pages/Corretores'));
const Equipes         = lazyRetry(() => import('./pages/Equipes'));
const Roletas         = lazyRetry(() => import('./pages/Roletas'));
const Trafego         = lazyRetry(() => import('./pages/Trafego'));
const Tarefas         = lazyRetry(() => import('./pages/Tarefas'));
const Relatorios      = lazyRetry(() => import('./pages/Relatorios'));
const Financeiro      = lazyRetry(() => import('./pages/Financeiro'));
const Executivo       = lazyRetry(() => import('./pages/Executivo'));
const Avisos          = lazyRetry(() => import('./pages/Avisos'));
const Videos          = lazyRetry(() => import('./pages/Videos'));
const Chat            = lazyRetry(() => import('./pages/Chat'));
const Formularios     = lazyRetry(() => import('./pages/Formularios'));
const PainelTV        = lazyRetry(() => import('./pages/PainelTV'));
const Configuracoes   = lazyRetry(() => import('./pages/Configuracoes'));
const Perfil          = lazyRetry(() => import('./pages/Perfil'));
const Ranking         = lazyRetry(() => import('./pages/Ranking'));
const BM              = lazyRetry(() => import('./pages/BM'));
const Distribuicao    = lazyRetry(() => import('./pages/Distribuicao'));
const InteligenciaLeads = lazyRetry(() => import('./pages/InteligenciaLeads'));
const Remarketing     = lazyRetry(() => import('./pages/Remarketing'));
const MetaCustos      = lazyRetry(() => import('./pages/MetaCustos'));
const PainelExecutivo = lazyRetry(() => import('./pages/PainelExecutivo'));
const ImportarLeads   = lazyRetry(() => import('./pages/ImportarLeads'));
const LPPublica       = lazyRetry(() => import('./pages/LPPublica'));
const Transferencias  = lazyRetry(() => import('./pages/Transferencias'));
const Auditoria       = lazyRetry(() => import('./pages/Auditoria'));
const Bolsoes         = lazyRetry(() => import('./pages/Bolsoes'));
const FinanceiroPons  = lazyRetry(() => import('./pages/FinanceiroPons'));
const AgenteIA        = lazyRetry(() => import('./pages/AgenteIA'));
const Reuniao         = lazyRetry(() => import('./pages/Reuniao'));
const Equipe          = lazyRetry(() => import('./pages/Equipe'));
const Pessoal         = lazyRetry(() => import('./pages/Pessoal'));
// DEV panel
const DevMensagens    = lazyRetry(() => import('./pages/DevMensagens'));
const DevFeedback     = lazyRetry(() => import('./pages/DevFeedback'));
const DevLogs         = lazyRetry(() => import('./pages/DevLogs'));
const DevMetrics      = lazyRetry(() => import('./pages/DevMetrics'));
// Páginas públicas (Google/Facebook OAuth verification)
const Privacidade     = lazyRetry(() => import('./pages/Privacidade'));
const Termos          = lazyRetry(() => import('./pages/Termos'));
const ExcluirConta    = lazyRetry(() => import('./pages/ExcluirConta'));
const ExcluirDados    = lazyRetry(() => import('./pages/ExcluirDados'));
const FbCallback      = lazyRetry(() => import('./pages/FbCallback'));

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/painel-tv" element={<PainelTV />} />
        <Route path="/lp/:slug" element={<LPPublica />} />
        <Route path="/atualizacao-cadastral" element={<CadastroColaborador />} />
        <Route path="/cadastro-grupo-pons" element={<CadastroColaborador />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/politica-de-seguranca" element={<Privacidade />} />
        <Route path="/excluir-conta" element={<ExcluirConta />} />
        <Route path="/excluir-dados" element={<ExcluirDados />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/integracoes/fb-callback" element={<FbCallback />} />
        <Route path="/contratacao" element={<NovaContratacao />} />
        <Route path="/nova-contratacao" element={<NovaContratacao />} />
        <Route path="/onboarding" element={<OnboardingDocumentos />} />

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
          <Route path="/inteligencia-leads" element={<InteligenciaLeads />} />
          <Route path="/remarketing" element={<Remarketing />} />
          <Route path="/meta-custos" element={<MetaCustos />} />
          <Route path="/painel-executivo" element={<PainelExecutivo />} />
          <Route path="/importar" element={<ImportarLeads />} />
          <Route path="/transferencias" element={<Transferencias />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/bolsoes" element={<Bolsoes />} />
          <Route path="/financeiro-pons" element={<FinanceiroPons />} />
          <Route path="/onboarding-aprovacoes" element={<OnboardingAprovacoes />} />
          <Route path="/agente-ia" element={<AgenteIA />} />
          <Route path="/reuniao" element={<Reuniao />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/pessoal" element={<Pessoal />} />
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
