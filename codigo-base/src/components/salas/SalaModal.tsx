import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal, ModalFechar } from "../modal/Modal";
import { RankingPodium, type PodiumPlayer } from "../ranking/RankingPodium";
import { avisoRepository, salaRepository, usuarioRepository } from "../../data/repositories";
import { Icone } from "./Icone";
import {
  ALTURAS,
  OPCOES_PAC,
  formatarData,
  tierPorPac,
  traduzirErro,
  type AulaView,
  type AvisoLinha,
  type ModuloView,
  type Sala,
} from "./tipos";

// ---------------------------------------------------------------------------
// Pop-up da sala
//
// Extraído de pages/Salas.tsx sem mudança de comportamento. É o mesmo modal
// para aluno e educador; o educador ganha o bloco de código de acesso e o
// formulário de novo aviso via `sala.souEducador`.
// ---------------------------------------------------------------------------

export type SalaModalProps = {
  sala: Sala;
  usuarioId: string;
  aulaAberta: boolean;
  onFechar: () => void;
  onAbrirAula: (aula: AulaView, modulo: ModuloView) => void;
  onAtualizar: () => Promise<void>;
};

export function SalaModal({ sala, usuarioId, aulaAberta, onFechar, onAbrirAula, onAtualizar }: SalaModalProps) {
  const [moduloAberto, setModuloAberto] = useState(0);
  const [avisos, setAvisos] = useState<AvisoLinha[] | null>(null);
  const [versaoAvisos, setVersaoAvisos] = useState(0);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [tituloAviso, setTituloAviso] = useState("");
  const [textoAviso, setTextoAviso] = useState("");

  const top5 = useMemo(() => sala.ranking.slice(0, 5), [sala.ranking]);
  const idsDoRanking = top5.map((membro) => membro.user_id).join(",");
  const totalAulas = sala.totalAulas;
  const progresso = totalAulas > 0 ? Math.round((sala.aulasConcluidas / totalAulas) * 100) : 0;

  // Carrega o mural; publicar um aviso novo só incrementa o contador para recarregar.
  useEffect(() => {
    let cancelado = false;

    async function carregarAvisos() {
      try {
        const lista = await avisoRepository.listarPorSala(sala.id);
        if (!cancelado) setAvisos(lista.filter((aviso) => aviso.status === "published"));
      } catch {
        if (!cancelado) setAvisos([]);
      }
    }

    void carregarAvisos();
    return () => { cancelado = true; };
  }, [sala.id, versaoAvisos]);

  // Nomes de quem aparece no ranking.
  useEffect(() => {
    let cancelado = false;
    const ids = idsDoRanking ? idsDoRanking.split(",") : [];

    async function carregarNomes() {
      const perfis = await Promise.all(ids.map((id) => usuarioRepository.obterPorId(id)));
      if (cancelado) return;
      const mapa = new Map<string, string>();
      for (const perfil of perfis) {
        if (perfil) mapa.set(perfil.id, perfil.display_name);
      }
      setNomes(mapa);
    }

    void carregarNomes();
    return () => { cancelado = true; };
  }, [idsDoRanking]);

  // O PAC dos colegas só aparece se a sala permitir (ou se você for o educador).
  const mostrarPac = sala.souEducador || sala.pacVisibilidade !== "educator_only";

  const jogadores = useMemo(() => {
    const lista: PodiumPlayer[] = top5.map((membro, indice) => {
      const pac = Math.round(Number(membro.pac_internal));
      const ehVoce = membro.user_id === usuarioId;
      const detalhe = mostrarPac || ehVoce ? `${pac}% · ${membro.xp_internal} XP` : `${membro.xp_internal} XP`;
      return {
        position: `${indice + 1}º`,
        name: ehVoce ? "Você" : nomes.get(membro.user_id) ?? "Aluno",
        detail: detalhe,
        tier: tierPorPac(pac),
        height: ALTURAS[indice],
        isYou: ehVoce,
      };
    });
    // Ordem visual do pódio (esquerda → direita): 4º, 2º, 1º, 3º, 5º.
    return [3, 1, 0, 2, 4].filter((posicao) => lista[posicao]).map((posicao) => lista[posicao]);
  }, [top5, nomes, usuarioId, mostrarPac]);

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
      setVersaoAvisos((versao) => versao + 1);
    } catch (error) {
      setErro(traduzirErro(error));
    } finally {
      setOcupado(false);
    }
  }

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

            {sala.souEducador && (
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
            )}

            {erro && <p className="salas__erro-inline" role="alert">{erro}</p>}

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

                {sala.souEducador && (
                  <form className="salas__form-aviso" onSubmit={(evento) => void publicarAviso(evento)}>
                    <p className="salas__rotulo">NOVO AVISO</p>
                    <input required maxLength={120} placeholder="Título do aviso" value={tituloAviso} onChange={(e) => setTituloAviso(e.target.value)} />
                    <textarea rows={3} maxLength={500} placeholder="Mensagem (opcional)" value={textoAviso} onChange={(e) => setTextoAviso(e.target.value)} />
                    <button className="salas__botao-primario salas__botao-pequeno" type="submit" disabled={ocupado || !tituloAviso.trim()}>
                      Publicar aviso
                    </button>
                  </form>
                )}
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
