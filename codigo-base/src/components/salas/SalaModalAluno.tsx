import { useState } from "react";
import { Modal, ModalFechar } from "../modal/Modal";
import { RankingPodium } from "../ranking/RankingPodium";
import { Icone } from "./Icone";
import { useSalaModal } from "./useSalaModal";
import {
  OPCOES_PAC,
  formatarData,
  type AulaView,
  type ModuloView,
  type Sala,
} from "./tipos";

// ---------------------------------------------------------------------------
// Pop-up da sala para o aluno.
//
// Identidade da sala, trilha de aprendizagem (com onAbrirAula), "Seu
// desempenho" na sala, ranking top 5 e mural. Não tem código de acesso nem
// form de novo aviso — esses são do educador (ver SalaModalEducador).
// ---------------------------------------------------------------------------

export type SalaModalAlunoProps = {
  sala: Sala;
  usuarioId: string;
  aulaAberta: boolean;
  onFechar: () => void;
  onAbrirAula: (aula: AulaView, modulo: ModuloView) => void;
};

export function SalaModalAluno({ sala, usuarioId, aulaAberta, onFechar, onAbrirAula }: SalaModalAlunoProps) {
  const [moduloAberto, setModuloAberto] = useState(0);
  const { avisos, jogadores } = useSalaModal(sala, usuarioId);

  const totalAulas = sala.totalAulas;
  const progresso = totalAulas > 0 ? Math.round((sala.aulasConcluidas / totalAulas) * 100) : 0;

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

            <div className="salas__colunas">
              {/* Trilha de aprendizagem (aulas feitas aqui valem só para a sala) */}
              <section className="salas__painel salas__modulos">
                <div className="salas__painel-cabecalho">
                  <div>
                    <p className="salas__rotulo">CONTEÚDO DA SALA</p>
                    <h3 className="salas__painel-titulo">Trilha de aprendizagem</h3>
                  </div>
                  <span className="salas__painel-resumo">{sala.modulos.length} módulos · {totalAulas} aulas</span>
                </div>

                {!sala.cursoId ? (
                  <p className="salas__vazio-painel">Esta sala ainda não tem um curso vinculado.</p>
                ) : sala.modulos.length === 0 ? (
                  <p className="salas__vazio-painel">O curso desta sala ainda não tem módulos, ou o conteúdo não está liberado para você.</p>
                ) : (
                  <>
                    <div className="salas__barra-progresso" role="progressbar" aria-label="Seu progresso na sala" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>
                      <span style={{ width: `${progresso}%` }} />
                    </div>
                    <p className="salas__painel-resumo salas__painel-resumo--bloco">{sala.aulasConcluidas} de {totalAulas} aulas concluídas na sala</p>

                    <div className="salas__acordeao">
                      {sala.modulos.map((modulo, indice) => (
                        <div
                          className={`salas__modulo${moduloAberto === indice ? " salas__modulo--aberto" : ""}`}
                          key={modulo.id}
                        >
                          <button
                            className="salas__modulo-botao"
                            type="button"
                            aria-expanded={moduloAberto === indice}
                            onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}
                          >
                            <span className="salas__modulo-numero">{String(indice + 1).padStart(2, "0")}</span>
                            <span>
                              <strong>{modulo.titulo}</strong>
                              {modulo.descricao && <small>{modulo.descricao}</small>}
                            </span>
                            <Icone nome="chevron" tamanho={19} />
                          </button>

                          {moduloAberto === indice && (
                            <div className="salas__aulas">
                              {modulo.aulas.length === 0 && <p className="salas__vazio-painel">Nenhuma aula neste módulo.</p>}
                              {modulo.aulas.map((aula) => (
                                <button
                                  type="button"
                                  className={`salas__aula salas__aula--botao${aula.concluida ? " salas__aula--concluida" : ""}`}
                                  key={aula.id}
                                  onClick={() => onAbrirAula(aula, modulo)}
                                >
                                  <span className="salas__aula-play"><Icone nome={aula.concluida ? "check" : "play"} tamanho={13} /></span>
                                  <span>{aula.titulo}</span>
                                  <small>{aula.concluida ? "Concluída" : "Fazer aula"}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Desempenho, ranking e mural */}
              <aside className="salas__painel salas__lateral">
                {sala.meuMembro && (
                  <div className="salas__desempenho">
                    <p className="salas__rotulo">SEU DESEMPENHO NA SALA</p>
                    <div className="salas__nota-resumo">
                      <strong className="salas__nota-numero">{sala.meuMembro.xp_internal}</strong>
                      <span className="salas__nota-estrela">XP</span>
                    </div>
                    <p className="salas__nota-legenda">
                      PAC {Math.round(Number(sala.meuMembro.pac_internal))}% · progresso {Math.round(Number(sala.meuMembro.progress))}%
                    </p>
                    <p className="salas__nota-legenda">O XP da sala não soma no seu XP global.</p>
                  </div>
                )}

                <div className="salas__ranking">
                  <p className="salas__rotulo">RANKING DA SALA</p>
                  <h3 className="salas__ranking-titulo">Top 5 da sala</h3>
                  {jogadores.length > 0
                    ? <RankingPodium players={jogadores} compact width="compact" ariaLabel="Top 5 da sala" />
                    : <p className="salas__vazio-painel">Ainda não há alunos no ranking.</p>}
                </div>

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
              </aside>
            </div>
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
