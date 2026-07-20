import { Topbar, PageHeader } from '../components/PageHeader';
import { GestoresEquipes } from '../components/GestoresEquipes';

// Página da sidebar (grupo Equipe): quais equipes cada gestor enxerga.
// Mesmo painel da aba Gestores em Configurações.
export default function Gestores() {
 return (
 <>
 <Topbar title="Gestores" />
 <div className="main__content">
 <PageHeader
 breadcrumb="Gestão · Equipe"
 title="Gestores das Equipes"
 subtitle="Clique num gestor e marque quais equipes ele pode ver — entre as marcadas ele também transfere corretores direto"
 />
 <GestoresEquipes />
 </div>
 </>
 );
}
