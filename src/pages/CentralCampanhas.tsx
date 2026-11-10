// Central de Campanhas de WhatsApp (Pons, 10/11/2026): uma tela só, com abas.
// Painel · Campanhas · Público e bases · Follow-up · Treinar IA · Kanban · Relatório.
import { useState } from 'react';
import { Topbar } from '../components/PageHeader';
import Campanhas from './Campanhas';
import { PainelTab } from './central/PainelTab';
import { PublicoTab } from './central/PublicoTab';
import { FollowUpTab } from './central/FollowUpTab';
import { KanbanTab } from './central/KanbanTab';
import { RelatorioTab } from './central/RelatorioTab';
import { IATab } from './central/IATab';
import './central/central.css';

const ABAS = [
  { k: 'painel', l: 'Painel' },
  { k: 'campanhas', l: 'Campanhas' },
  { k: 'publico', l: 'Público e bases' },
  { k: 'followup', l: 'Follow-up' },
  { k: 'ia', l: 'Treinar IA' },
  { k: 'kanban', l: 'Kanban' },
  { k: 'relatorio', l: 'Relatório' },
] as const;
type Aba = (typeof ABAS)[number]['k'];

function abaInicial(): Aba {
  try {
    const q = new URLSearchParams(window.location.search).get('aba');
    if (q && ABAS.some((a) => a.k === q)) return q as Aba;
    const s = localStorage.getItem('central.aba');
    if (s && ABAS.some((a) => a.k === s)) return s as Aba;
  } catch { /* sem storage */ }
  return 'painel';
}

export default function CentralCampanhas() {
  const [aba, setAbaSt] = useState<Aba>(abaInicial);
  const setAba = (a: Aba) => {
    setAbaSt(a);
    try { localStorage.setItem('central.aba', a); } catch { /* ignora */ }
  };
  return (
    <>
      <Topbar title="Central de Campanhas" />
      <div className="main__content">
        <nav className="cc-tabs" role="tablist" aria-label="Central de Campanhas">
          {ABAS.map((a) => (
            <button key={a.k} type="button" role="tab" aria-selected={aba === a.k} className={'cc-tab' + (aba === a.k ? ' is-on' : '')} onClick={() => setAba(a.k)}>{a.l}</button>
          ))}
        </nav>
        {aba === 'painel' && <PainelTab irPara={setAba} />}
        {aba === 'campanhas' && <Campanhas embutido />}
        {aba === 'publico' && <PublicoTab />}
        {aba === 'followup' && <FollowUpTab />}
        {aba === 'ia' && <IATab />}
        {aba === 'kanban' && <KanbanTab />}
        {aba === 'relatorio' && <RelatorioTab />}
      </div>
    </>
  );
}
