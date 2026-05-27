import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';

import Gate from './pages/Gate';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Empreendimentos from './pages/Empreendimentos';
import Vendas from './pages/Vendas';
import Corretores from './pages/Corretores';
import Equipes from './pages/Equipes';
import Roletas from './pages/Roletas';
import Trafego from './pages/Trafego';
import Tarefas from './pages/Tarefas';
import Relatorios from './pages/Relatorios';
import Financeiro from './pages/Financeiro';
import Executivo from './pages/Executivo';
import Avisos from './pages/Avisos';
import Videos from './pages/Videos';
import Chat from './pages/Chat';
import Formularios from './pages/Formularios';
import PainelTV from './pages/PainelTV';
import Configuracoes from './pages/Configuracoes';
import Perfil from './pages/Perfil';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Gate />} />
      <Route path="/login" element={<Login />} />
      <Route path="/painel-tv" element={<PainelTV />} />

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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
