import { useState, type FormEvent } from "react";
import { Modal, ModalFechar } from "../modal/Modal";
import { RankingPodium } from "../ranking/RankingPodium";
import { avisoRepository, salaRepository } from "../../data/repositories";
import { Abas, type Aba } from "./Abas";
import { Icone } from "./Icone";
import { useSalaModal } from "./useSalaModal";
import {
  OPCOES_PAC,
  formatarData,
  traduzirErro,
  type Sala,
} from "./tipos";

// ---------------------------------------------------------------------------
// Pop-up da sala para o educador.
//
// Layout em abas: identidade e código de acesso ficam fixos no topo; 
// o resto é dividido em Visão geral, Alunos, Conteúdo, Ranking e Mural.
//
// Este componente é a CASCA: monta as abas e realoca o
// que já existe (código de acesso, ranking e mural). As métricas de Visão
// geral/Alunos/Conteúdo entram em seguida, preenchidas pela RPC `room_stats`
// (trabalho de backend, ainda não existe) — por isso aparecem como placeholder.
// A trilha de aprendizagem saiu do educador: ele não é membro e não faz aulas
// aqui; o lugar dela na aba Conteúdo é a estatística de conclusão.
// ---------------------------------------------------------------------------

export type SalaModalEducadorProps = {
  sala: Sala;
  usuarioId: string;
  aulaAberta: boolean;
  onFechar: () => void;
  onAtualizar: () => Promise<void>;
};

export function SalaModalEducador({ sala, usuarioId, aulaAberta, onFechar, onAtualizar }: SalaModalEducadorProps) {
  const { avisos, jogadores, recarregarAvisos } = useSalaModal(sala, usuarioId);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [tituloAviso, setTituloAviso] = useState("");
  const [textoAviso, setTextoAviso] = useState("");

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(sala.codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setErro("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  async function alternarCodigo() {
    setOcupado(true);
    setErro("");
    try {
      await salaRepository.atualizarCodigoAtivo(sala.id, !sala.codigoAtivo);
      await onAtualizar();
    } catch (error) {
      setErro(traduzirErro(error));
    } finally {
      setOcupado(false);
    }
  }

  async function publicarAviso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const titulo = tituloAviso.trim();
    if (!titulo) return;

    setOcupado(true);
    setErro("");
    try {
      await avisoRepository.criar({ room_id: sala.id, author_id: usuarioId, title: titulo, content: textoAviso.trim() || null });
      setTituloAviso("");
      setTextoAviso("");
      recarregarAvisos();
    } catch (error) {
      setErro(traduzirErro(error));
    } finally {
      setOcupado(false);
    }
  }

  const abas: Aba[] = [
    {
      id: "visao-geral",
      rotulo: "Visão geral",
      painel: (
        // PLACEHOLDER (depende de room_stats): cartões de métrica e alertas.
        // Valores fictícios só para mostrar o layout; nada vem do banco.
        // Coerentes com a tabela fictícia da aba Alunos (5 alunos): média de
        // progresso 49%, acerto de primeira médio 64%, 2 em atenção (parado
        // 7+ dias ou acerto < 50%).
        <div className="salas__painel-aba">
          <p className="salas__preview-aviso" role="note">
            <Icone nome="people" tamanho={15} />
            Pré-visualização — dados de exemplo, ainda não vêm do banco.
          </p>
          <div className="salas__cartoes">
            <div className="salas__cartao"><span className="salas__cartao-valor">5</span><span className="salas__cartao-rotulo">Membros ativos</span></div>
            <div className="salas__cartao"><span className="salas__cartao-valor">49%</span><span className="salas__cartao-rotulo">Média de progresso</span></div>
            <div className="salas__cartao"><span className="salas__cartao-valor">64%</span><span className="salas__cartao-rotulo">Acerto de primeira</span></div>
            <div className="salas__cartao"><span className="salas__cartao-valor">2</span><span className="salas__cartao-rotulo">Precisam de atenção</span></div>
          </div>
          <p className="salas__rotulo">PRECISAM DE ATENÇÃO</p>
          <ul className="salas__atencao">
            <li className="salas__atencao-item"><strong>Bruno Lima</strong><span>Parado há 7 dias · progresso 15%</span></li>
            <li className="salas__atencao-item"><strong>Aluno</strong><span>Parado há 12 dias · acerto 45%</span></li>
          </ul>
        </div>
      ),
    },
    {
      id: "alunos",
      rotulo: "Alunos",
      painel: (
        // PLACEHOLDER (depende de room_stats): tabela de alunos.
        // Linhas fictícias só para mostrar o layout; nada vem do banco.
        <div className="salas__painel-aba">
          <p className="salas__preview-aviso" role="note">
            <Icone nome="people" tamanho={15} />
            Pré-visualização — dados de exemplo, ainda não vêm do banco.
          </p>
          <div className="salas__filtros-alunos" aria-hidden="true">
            <span className="salas__chip salas__chip--ativo">Todos</span>
            <span className="salas__chip">Parados 7+ dias</span>
          </div>
          <table className="salas__tabela">
            <thead>
              <tr>
                <th scope="col">Aluno</th>
                <th scope="col">XP</th>
                <th scope="col">Progresso</th>
                <th scope="col">Acerto de primeira</th>
                <th scope="col">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Ana Souza</td><td>420</td><td>78%</td><td>71%</td><td>Hoje</td></tr>
              <tr><td>Bruno Lima</td><td>310</td><td>15%</td><td>52%</td><td>Há 7 dias</td></tr>
              <tr><td>Carla Dias</td><td>560</td><td>92%</td><td>88%</td><td>Ontem</td></tr>
              <tr><td>Diego Reis</td><td>240</td><td>40%</td><td>63%</td><td>Há 2 dias</td></tr>
              <tr><td>Aluno</td><td>180</td><td>22%</td><td>45%</td><td>Há 12 dias</td></tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "conteudo",
      rotulo: "Conteúdo",
      painel: (
        // PLACEHOLDER (depende de room_stats): conclusão por módulo/aula e questões difíceis.
        // Valores fictícios só para mostrar o layout; nada vem do banco.
        <div className="salas__painel-aba">
          <p className="salas__preview-aviso" role="note">
            <Icone nome="people" tamanho={15} />
            Pré-visualização — dados de exemplo, ainda não vêm do banco.
          </p>
          <p className="salas__rotulo">CONCLUSÃO POR MÓDULO</p>
          <ul className="salas__conclusao">
            <li className="salas__conclusao-item">
              <div className="salas__conclusao-linha"><span>Módulo 1 · Fundamentos</span><strong>72%</strong></div>
              <div className="salas__barra-progresso" role="presentation"><span style={{ width: "72%" }} /></div>
            </li>
            <li className="salas__conclusao-item">
              <div className="salas__conclusao-linha"><span>Módulo 2 · Prática</span><strong>48%</strong></div>
              <div className="salas__barra-progresso" role="presentation"><span style={{ width: "48%" }} /></div>
            </li>
            <li className="salas__conclusao-item">
              <div className="salas__conclusao-linha"><span>Módulo 3 · Avançado</span><strong>28%</strong></div>
              <div className="salas__barra-progresso" role="presentation"><span style={{ width: "28%" }} /></div>
            </li>
          </ul>
          <p className="salas__rotulo">QUESTÕES COM MAIS ERROS</p>
          <ul className="salas__atencao">
            <li className="salas__atencao-item"><strong>Q7 — Laços de repetição</strong><span>Acerto de primeira: 31%</span></li>
            <li className="salas__atencao-item"><strong>Q12 — Recursão</strong><span>Acerto de primeira: 38%</span></li>
            <li className="salas__atencao-item"><strong>Q4 — Escopo de variáveis</strong><span>Acerto de primeira: 44%</span></li>
          </ul>
        </div>
      ),
    },
    {
      id: "ranking",
      rotulo: "Ranking",
      painel: (
        // REAL: ranking top 5 montado em useSalaModal.
        <div className="salas__painel-aba">
          <p className="salas__rotulo">RANKING DA SALA</p>
          <h3 className="salas__ranking-titulo">Top 5 da sala</h3>
          {jogadores.length > 0
            ? <RankingPodium players={jogadores} compact width="compact" ariaLabel="Top 5 da sala" />
            : <p className="salas__vazio-painel">Ainda não há alunos no ranking.</p>}
        </div>
      ),
    },
    {
      id: "mural",
      rotulo: "Mural",
      painel: (
        // REAL: avisos + form de novo aviso, realocados do pop-up antigo.
        <div className="salas__painel-aba">
          <div className="salas__mural-cabecalho">
            <div>
              <p className="salas__rotulo">MURAL DA SALA</p>
              <strong className="salas__mural-titulo">Avisos recentes</strong>
            </div>
            {avisos && avisos.length > 0 && <span className="salas__mural-novos">{avisos.length}</span>}
          </div>

          {avisos === null && <p className="salas__vazio-painel">Carregando avisos...</p>}
          {avisos?.length === 0 && <p className="salas__vazio-painel">Nenhum aviso por enquanto.</p>}
          {avisos?.map((aviso, indice) => (
            <div className={`salas__aviso${indice === 0 ? " salas__aviso--destaque" : ""}`} key={aviso.id}>
              <div className="salas__aviso-topo">
                <span className="salas__aviso-tipo">{indice === 0 ? "DESTAQUE" : "AVISO"}</span>
                <small className="salas__aviso-data">{formatarData(aviso.created_at)}</small>
              </div>
              <strong className="salas__aviso-titulo">{aviso.title}</strong>
              {aviso.content && <p className="salas__aviso-texto">{aviso.content}</p>}
            </div>
          ))}

          <form className="salas__form-aviso" onSubmit={(evento) => void publicarAviso(evento)}>
            <p className="salas__rotulo">NOVO AVISO</p>
            <input required maxLength={120} placeholder="Título do aviso" value={tituloAviso} onChange={(e) => setTituloAviso(e.target.value)} />
            <textarea rows={3} maxLength={500} placeholder="Mensagem (opcional)" value={textoAviso} onChange={(e) => setTextoAviso(e.target.value)} />
            <button className="salas__botao-primario salas__botao-pequeno" type="submit" disabled={ocupado || !tituloAviso.trim()}>
              Publicar aviso
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <Modal
      onFechar={onFechar}
      rotuladoPor="salas-modal-titulo"
      /* Com uma aula aberta por cima, o Esc fecha só a aula (o LessonModal cuida
         do fechamento); o modal da sala ignora o Esc nesse momento. */
      fecharComEsc={!aulaAberta}
    >
        <div className="modal__rolagem">
          <div className="modal__banner">
            <span className="modal__categoria">{sala.categoria.toUpperCase()}</span>
            <div className="modal__forma modal__forma--a" />
            <div className="modal__forma modal__forma--b" />
            <div className="modal__brilho">✦</div>
            <ModalFechar onFechar={onFechar} rotulo="Fechar informações da sala">
              <Icone nome="close" tamanho={22} />
            </ModalFechar>
          </div>

          <div className="modal__corpo">
            {/* Topo fixo: identidade + código de acesso + ranking */}
            <div className="salas__identidade">
              <div className="salas__modal-icone">{sala.simbolo}</div>
              <div>
                <p className="salas__rotulo">SALA DE APRENDIZAGEM</p>
                <h2 className="salas__modal-titulo" id="salas-modal-titulo">{sala.nome}</h2>
                <p className="salas__modal-slug">Educador: {sala.educador}</p>
              </div>
              <div className="salas__meta">
                <div><span>Curso:</span><strong>{sala.cursoTitulo || "Nenhum"}</strong></div>
                <div><span>Membros:</span><strong>{sala.membros}</strong></div>
                <div>
                  <span>PAC visível para:</span>
                  <strong>{OPCOES_PAC.find((opcao) => opcao.valor === sala.pacVisibilidade)?.rotulo ?? sala.pacVisibilidade}</strong>
                </div>
              </div>
            </div>

            <article className="salas__sobre">
              <div>
                <p className="salas__rotulo">CÓDIGO DE ACESSO</p>
                <h3 className="salas__sobre-titulo">Compartilhe com os alunos</h3>
              </div>
              <div className="salas__codigo-linha">
                <code className="salas__codigo">{sala.codigo}</code>
                <button className="salas__botao-secundario" type="button" onClick={() => void copiarCodigo()}>
                  {copiado ? "Copiado!" : "Copiar"}
                </button>
                <button className="salas__botao-secundario" type="button" disabled={ocupado} onClick={() => void alternarCodigo()}>
                  {sala.codigoAtivo ? "Desativar código" : "Reativar código"}
                </button>
              </div>
              <p className="salas__sobre-texto">
                {sala.codigoAtivo
                  ? "Quem tiver o código pode entrar na sala."
                  : "O código está desativado: ninguém novo consegue entrar até você reativá-lo."}
              </p>
            </article>

            {erro && <p className="salas__erro-inline" role="alert">{erro}</p>}

            {/* Abas com o restante */}
            <Abas abas={abas} inicial="visao-geral" ariaLabel="Seções da sala" />
          </div>
        </div>

        <footer className="modal__rodape">
          <p>
            <Icone nome="people" tamanho={17} />
            <strong>{sala.membros} {sala.membros === 1 ? "pessoa" : "pessoas"}</strong> {sala.membros === 1 ? "está aprendendo" : "estão aprendendo"} nesta sala
          </p>
          <div className="modal__acoes">
            <button className="salas__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
          </div>
        </footer>
    </Modal>
  );
}
