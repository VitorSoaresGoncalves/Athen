import { useState, type FormEvent } from "react";
import { avisoRepository, salaRepository } from "../../data/repositories";
import { Modal, ModalFechar } from "../modal/Modal";
import { RankingPodium } from "../ranking/RankingPodium";
import { Abas, type Aba } from "./Abas";
import { Icone } from "./Icone";
import {
  OPCOES_PAC,
  formatarData,
  traduzirErro,
  type Sala,
} from "./tipos";
import { useEstatisticasSala } from "./useEstatisticasSala";
import { useSalaModal } from "./useSalaModal";

// ---------------------------------------------------------------------------
// Pop-up da sala para o educador.
//
// Layout em abas: identidade e código de acesso ficam fixos no topo; 
// o resto é dividido em Visão geral, Alunos, Conteúdo, Ranking e Mural.
//
// As métricas de Visão geral/Alunos/Conteúdo vêm das quatro RPCs de
// estatísticas usadas por useEstatisticasSala; ranking e mural usam useSalaModal.
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

function descreverAtencao(aluno: { days_idle: number; progress: number; first_try_rate: number | null }) {
  const partes: string[] = [];

  if (aluno.days_idle >= 6) {
    partes.push(`Parado há ${aluno.days_idle} dias · progresso ${Math.round(Number(aluno.progress))}%`);
  }

  if (aluno.first_try_rate !== null && Number(aluno.first_try_rate) < 50) {
    partes.push(`acerto ${Math.round(Number(aluno.first_try_rate))}%`);
  }

  return partes.join(" · ");
}

function textoUltimoAcesso(diasParado: number) {
  if (diasParado <= 0)
    return "Hoje";

  if (diasParado === 1) 
    return "Ontem";

  return `Há ${diasParado} dias`;
}

export function SalaModalEducador({ sala, usuarioId, aulaAberta, onFechar, onAtualizar }: SalaModalEducadorProps) {
  const { avisos, jogadores, recarregarAvisos } = useSalaModal(sala, usuarioId);
  const { geral, alunos, questoes, modulos, erroEstatisticas } = useEstatisticasSala(sala.id);
  const emAtencao = alunos?.filter((aluno) => aluno.needs_attention) ?? [];
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [ soParados, setSoParados ] = useState(false);
  const [erro, setErro] = useState("");
  const [tituloAviso, setTituloAviso] = useState("");
  const [textoAviso, setTextoAviso] = useState("");
  const alunosVisiveis = soParados
          ? (alunos ?? []).filter((aluno) => aluno.days_idle >= 6)
          : (alunos ?? []);

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

      // Todo o painel de Visao Geral:
      // Mostra membros ativos, média de progresso, % de acertos de primeira
      // número e quais alunos precisam de atenção
      painel: (
        <div className="salas__painel-aba">
          {erroEstatisticas && <p className="salas__erro-inline" role="alert">{erroEstatisticas}</p>}
  
          {alunos === null && <p className="salas__vazio-painel">Carregando estatísticas...</p>}

          {alunos !== null && (
            <>
               <div className="salas__cartoes">
                <div className="salas__cartao">
                  <span className="salas__cartao-valor">{geral?.active_members ?? 0}</span>
                  <span className="salas__cartao-rotulo">Membros ativos</span>
                </div>

                <div className="salas__cartao">
                  <span className="salas__cartao-valor">{Math.round(Number(geral?.avg_progress ?? 0))}%</span>
                  <span className="salas__cartao-rotulo">Média de progresso</span>
                </div>

                <div className="salas__cartao">
                  <span className="salas__cartao-valor">{Math.round(Number(geral?.avg_first_try ?? 0))}%</span>
                  <span className="salas__cartao-rotulo">Acerto de primeira</span>
                </div>

                <div className="salas__cartao">
                  <span className="salas__cartao-valor">{geral?.attention_count ?? 0}</span>
                  <span className="salas__cartao-rotulo">Precisam de atenção</span>
                </div>
              </div>

              <p className="salas__rotulo">PRECISAM DE ATENÇÃO</p>
              {emAtencao.length === 0 ? (
                <p className="salas__vazio-painel">Nenhum aluno precisa de atenção agora.</p>
              ) : (
                <ul className="salas__atencao">
                  {emAtencao.map((aluno) => (
                    <li className="salas__atencao-item" key={aluno.user_id}>
                      <strong>{aluno.display_name}</strong>
                      <span>{descreverAtencao(aluno)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      id: "alunos",
      rotulo: "Alunos",

      painel: (
        <div className="salas__painel-aba">
          {alunos === null && <p className="salas__vazio-painel">Carregando Alunos...</p>}

          {alunos !== null && alunos.length === 0 && (
            <p className="salas__vazio-painel">Ainda não há alunos nesta sala.</p>
          )}

          {alunos !== null && (
            <>
              <div className="salas__filtros-alunos">
                <button
                type="button"
                className={`salas__chip${!soParados ? " salas__chip--ativo" : ""}`}
                aria-pressed={!soParados}
                onClick={() => setSoParados(false)}
                >
                  Todos
                </button>

                <button
                type="button"
                className={`salas__chip${soParados ? " salas__chip--ativo" : ""}`}
                aria-pressed={soParados}
                onClick={() => setSoParados(true)}
                >
                  Parados 6+ dias
                </button>
              </div>


              <div className="salas__tabela-rolagem" role="region" aria-label="Estatísticas dos alunos" tabIndex={0}>
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
                  {alunosVisiveis.map((aluno) => (
                    <tr key={aluno.user_id}>
                      <td>{aluno.display_name}</td>
                      <td>{aluno.xp}</td>
                      <td>{Math.round(Number(aluno.progress))}%</td>
                      <td>{aluno.first_try_rate === null ? "—" : `${Math.round(Number(aluno.first_try_rate))}%`}</td>
                      <td>{textoUltimoAcesso(aluno.days_idle)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          
            </>
          )}

        </div>
      ),
    },
    {
      id: "conteudo",
      rotulo: "Conteúdo",

      painel: (
        <div className="salas__painel-aba">
          {modulos === null || questoes === null ? (
            <p className="salas__vazio-painel">Carregando Conteúdo...</p>
          ): (
            <>
              <p className="salas__rotulo">CONCLUSÃO POR MÓDULO</p>

              {modulos.length === 0 ? (
                <p className="salas__vazio-painel">
                {sala.cursoTitulo ? "O curso desta sala ainda não tem módulos." : "Esta sala não tem um curso vinculado."}
                </p>
              ) : (
                <ul className="salas__conclusao"> 
                  {modulos.map((modulo) => {
                    const pct = Math.min(100, Math.max(0, Math.round(Number(modulo.completion_pct))));

                    return (
                      <li className="salas__conclusao-item" key={modulo.module_id}>
                        <div className="salas__conclusao-linha">
                          <span>{modulo.title}</span>
                          <strong>{pct}%</strong>
                        </div>

                        <div className="salas__barra-progresso" role="presentation"><span style={{ width: `${pct}%` }} /></div>
                      </li>
                    );
                })}
                </ul>
              )}
  

              <p className="salas__rotulo">QUESTÕES COM MAIS ERROS</p>

              {questoes.length === 0 ? (
                <p className="salas__vazio-painel">Ainda não há respostas suficientes para mostrar as questões mais difíceis.</p>
              ) : (
                <ul className="salas__atencao">
                  {questoes.map((questao) => (
                    <li className="salas__atencao-item" key={questao.question_id}>
                      <strong>{questao.prompt}</strong>
                      <span>
                        {questao.lesson_title} · acerto de primeira: {Math.round(Number(questao.first_try_rate))}% ({questao.answers_count} respostas)
                      </span>
                    </li>
                  ))}
                </ul>
              )}

            </>
          )}

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
          {jogadores.length > 0 && (
            <ol className="salas__ranking-completo" aria-label="Nomes e resultados do ranking">
              {jogadores.map((jogador) => (
                <li key={jogador.position}><strong>{jogador.position} · {jogador.name}</strong>{jogador.detail && <span>{jogador.detail}</span>}</li>
              ))}
            </ol>
          )}
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
            <input aria-label="Título do aviso" required maxLength={120} placeholder="Título do aviso" value={tituloAviso} onChange={(e) => setTituloAviso(e.target.value)} />
            <textarea aria-label="Mensagem (opcional)" rows={3} maxLength={500} placeholder="Mensagem (opcional)" value={textoAviso} onChange={(e) => setTextoAviso(e.target.value)} />
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
