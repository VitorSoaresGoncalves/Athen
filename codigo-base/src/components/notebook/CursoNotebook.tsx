import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { anotacoesRepository, notebookRepository } from "../../data/repositories";
import { ConfirmDialog } from "../dialogbox/ConfirmDialog";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";
import { clampNotebookRect, type NotebookRect } from "./notebook-geometry";
import "./CursoNotebook.css";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
type Anotacao = Database["public"]["Tables"]["notebook_pages"]["Row"];

type CourseNotebookProps = {
  course: Curso;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

// ATENÇÃO: a tabela "notebooks" não tem mais course_id. O caderno de um curso é identificado
// pelo título (notebooks.title === courses.title), mesma convenção da NotebookPage.
// O ideal é adicionar uma coluna course_id em notebooks e filtrar por ela.
const notebookTitleFor = (course: Curso) => course.title;

function sortPages(pages: Anotacao[]): Anotacao[] {
  return [...pages].sort((first, second) => {
    const firstTitle = first.title.trim() || "Sem título";
    const secondTitle = second.title.trim() || "Sem título";
    return firstTitle.localeCompare(secondTitle, "pt-BR", { sensitivity: "base" });
  });
}

function ordenarNotebooks(items: Notebook[]): Notebook[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }));
}

export function CursoNotebook({ course }: CourseNotebookProps) {
  const courseTitle = notebookTitleFor(course);
  const [userId, setUserId] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<Anotacao[]>([]);
  const [annotation, setAnnotation] = useState<Anotacao | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [savedPageTitle, setSavedPageTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savedNoteText, setSavedNoteText] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rect, setRect] = useState<NotebookRect>({ x: 0, y: 0, width: 440, height: 420 });
  const rectRef = useRef(rect);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const pointerCapture = useRef<{ target: HTMLElement; id: number } | null>(null);
  const [geometryError, setGeometryError] = useState("");
  const [adjustments, setAdjustments] = useState(false);
  const [geometryInput, setGeometryInput] = useState({ x: "", y: "", width: "", height: "" });

  // Confirmação pendente (substitui o window.confirm). `tone: "danger"` deixa o
  // botão de confirmar vermelho (usado nos apagar). `tertiaryLabel`/
  // `acaoTerciaria` habilitam uma terceira opção (ex.: "Descartar").
  const [confirmacao, setConfirmacao] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    tone?: "danger";
    acao: () => void;
    tertiaryLabel?: string;
    acaoTerciaria?: () => void;
  }>(null);
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const resizeRef = useRef({ active: false, direction: "se" as ResizeDirection, startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 440, startHeight: 420 });

  const loadNotebook = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = data.user?.id ?? null;
      setUserId(currentUserId);

      if (!currentUserId) {
        setNotebooks([]);
        setNotebook(null);
        setPages([]);
        setAnnotation(null);
        return;
      }

      const todosNotebooks = await notebookRepository.listarPorUsuario(currentUserId);
      // Mantém a lista completa para o seletor; o caderno do curso é só o
      // selecionado inicial (ligação por título — ver aviso do course_id acima).
      setNotebooks(ordenarNotebooks(todosNotebooks));
      const courseNotebook = todosNotebooks.find((item) => item.title === courseTitle) ?? null;
      setNotebook(courseNotebook);

      if (!courseNotebook) {
        setPages([]);
        setAnnotation(null);
        return;
      }

      const loadedPages = sortPages(await anotacoesRepository.listarPorNotebook(courseNotebook.id));
      const firstPage = loadedPages[0] ?? null;
      setPages(loadedPages);
      setAnnotation(firstPage);
      const loadedTitle = firstPage?.title || "";
      const loadedText = firstPage?.content ?? "";
      setPageTitle(loadedTitle);
      setSavedPageTitle(loadedTitle);
      setNoteText(loadedText);
      setSavedNoteText(loadedText);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o notebook.");
    } finally {
      setLoading(false);
    }
  }, [courseTitle]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotebook();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotebook]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;

    function handlePointerMove(event: PointerEvent) {
      if (dragRef.current.active) {
        applyRect({ ...rectRef.current, x: event.clientX - dragRef.current.offsetX, y: event.clientY - dragRef.current.offsetY });
      }

      if (resizeRef.current.active) {
        const { direction, startX, startY, startLeft, startTop, startWidth, startHeight } = resizeRef.current;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const resizingWest = direction.includes("w");
        const resizingNorth = direction.includes("n");

        applyRect({
          width: startWidth + (resizingWest ? -deltaX : direction.includes("e") ? deltaX : 0),
          height: startHeight + (resizingNorth ? -deltaY : direction.includes("s") ? deltaY : 0),
          x: resizingWest ? startLeft + deltaX : startLeft,
          y: resizingNorth ? startTop + deltaY : startTop,
        });
      }
    }

    function handlePointerUp() {
      dragRef.current.active = false;
      resizeRef.current.active = false;
      const capture = pointerCapture.current;
      if (capture?.target.hasPointerCapture?.(capture.id)) capture.target.releasePointerCapture(capture.id);
      pointerCapture.current = null;
    }
    function recoverViewport() {
      handlePointerUp();
      applyRect(rectRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", recoverViewport);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", recoverViewport);
    viewport?.addEventListener("scroll", recoverViewport);
    closeRef.current?.focus();
    return () => {
      handlePointerUp();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("resize", recoverViewport);
      viewport?.removeEventListener("resize", recoverViewport);
      viewport?.removeEventListener("scroll", recoverViewport);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  useLayoutEffect(() => {
    const focused = document.activeElement;
    if (open && focused instanceof HTMLElement && panelRef.current?.contains(focused)) {
      focused.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [rect, open]);

  function applyRect(desired: NotebookRect) {
    const next = clampNotebookRect(desired, notebookViewport());
    rectRef.current = next;
    setRect(next);
  }

  function centerRect(width: number, height: number) {
    const area = notebookViewport();
    const limited = clampNotebookRect({ x: area.left, y: area.top, width, height }, area);
    applyRect({ ...limited, x: area.left + (area.width - limited.width) / 2, y: area.top + (area.height - limited.height) / 2 });
  }

  function openNotebook() {
    centerRect(rectRef.current.width, rectRef.current.height);
    setOpen(true);
  }

  function startDragging(event: React.PointerEvent<HTMLElement>) {
    const clickedElement = event.target as HTMLElement;
    if (clickedElement.closest("button, input, select, summary")) return;

    dragRef.current = {
      active: true,
      offsetX: event.clientX - rectRef.current.x,
      offsetY: event.clientY - rectRef.current.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerCapture.current = { target: event.currentTarget, id: event.pointerId };
  }

  function startResizing(event: React.PointerEvent<HTMLSpanElement>, direction: ResizeDirection) {
    event.stopPropagation();
    resizeRef.current = {
      active: true,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.x,
      startTop: rect.y,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerCapture.current = { target: event.currentTarget, id: event.pointerId };
  }

  function setPageState(nextPage: Anotacao | null) {
    setAnnotation(nextPage);
    const nextTitle = nextPage?.title || "";
    const nextText = nextPage?.content ?? "";
    setPageTitle(nextTitle);
    setSavedPageTitle(nextTitle);
    setNoteText(nextText);
    setSavedNoteText(nextText);
  }

  function hasUnsavedChanges() {
    return pageTitle !== savedPageTitle || noteText !== savedNoteText;
  }

  function selectPage(nextPage: Anotacao) {
    if (nextPage.id === annotation?.id) return;
    if (hasUnsavedChanges()) {
      setConfirmacao({
        title: "Alterações não salvas",
        message: "Existem alterações não salvas. Deseja trocar de página e descartá-las?",
        confirmLabel: "Descartar e trocar",
        acao: () => setPageState(nextPage),
      });
      return;
    }
    setPageState(nextPage);
  }

  // Carrega as páginas do caderno escolhido e passa a exibi-lo. É a ação crua,
  // sem checar alterações não salvas (quem chama resolve isso antes).
  async function abrirNotebookSelecionado(alvo: Notebook) {
    setSaving(true);
    setError("");
    try {
      const loadedPages = sortPages(await anotacoesRepository.listarPorNotebook(alvo.id));
      setNotebook(alvo);
      setPages(loadedPages);
      setPageState(loadedPages[0] ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o notebook.");
    } finally {
      setSaving(false);
    }
  }

  // Troca o caderno exibido no painel. Protege anotação não salva com o mesmo
  // fluxo de três opções (salvar / descartar / cancelar).
  function trocarNotebook(id: string) {
    if (id === notebook?.id) return;
    const alvo = notebooks.find((item) => item.id === id);
    if (!alvo) return;

    if (hasUnsavedChanges()) {
      setConfirmacao({
        title: "Alterações não salvas",
        message: "Você tem alterações não salvas. Salve ou descarte antes de trocar de notebook.",
        confirmLabel: "Salvar",
        acao: async () => {
          if (await saveNotebook()) await abrirNotebookSelecionado(alvo);
        },
        tertiaryLabel: "Descartar",
        acaoTerciaria: () => void abrirNotebookSelecionado(alvo),
      });
      return;
    }

    void abrirNotebookSelecionado(alvo);
  }

  async function createNotebook() {
    if (!userId) {
      setError("É necessário estar autenticado para criar um notebook.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const createdNotebook = await notebookRepository.criar({
        title: notebookTitleFor(course),
        user_id: userId,
      });
      setNotebooks((current) => ordenarNotebooks([...current, createdNotebook]));
      setNotebook(createdNotebook);
      setPages([]);
      setPageState(null);
      await createPage(createdNotebook.id, []);
      openNotebook();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o notebook.");
    } finally {
      setSaving(false);
    }
  }

  async function createPage(notebookId = notebook?.id, currentPages = pages) {
    if (!notebookId) return;

    setSaving(true);
    setError("");
    try {
      const createdPage = await anotacoesRepository.criar({
        notebook_id: notebookId,
        title: "Nova página",
        content: "",
        position: currentPages.length,
      });
      const nextPages = sortPages([...currentPages, createdPage]);
      setPages(nextPages);
      setPageState(createdPage);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a página.");
    } finally {
      setSaving(false);
    }
  }

  // Protege a anotação não salva antes de criar uma página pelo botão "+":
  // deixa salvar, descartar ou cancelar, em vez de descartar em silêncio.
  function novaPagina() {
    if (hasUnsavedChanges()) {
      setConfirmacao({
        title: "Alterações não salvas",
        message: "Você tem alterações não salvas. Salve ou descarte antes de criar a nova página.",
        confirmLabel: "Salvar",
        acao: async () => {
          const paginasPosSave = await saveNotebook();
          if (paginasPosSave) await createPage(notebook?.id, paginasPosSave);
        },
        tertiaryLabel: "Descartar",
        acaoTerciaria: () => void createPage(),
      });
      return;
    }

    void createPage();
  }

  // Salva a página atual (o título do notebook é o do curso e não é editado aqui).
  // Retorna a lista de páginas já com o save aplicado, para quem encadeia uma
  // ação logo depois (ex.: "Salvar e criar") não depender do closure.
  async function saveNotebook(): Promise<Anotacao[] | null> {
    if (!notebook || !annotation) return pages;

    setSaving(true);
    setError("");
    try {
      const title = pageTitle.trim() || "Sem título";
      const updatedPage = await anotacoesRepository.atualizar(annotation.id, { title, content: noteText });
      const paginasPosSave = sortPages(pages.map((page) => page.id === updatedPage.id ? updatedPage : page));
      setPages(paginasPosSave);
      setAnnotation(updatedPage);
      setPageTitle(title);
      setSavedPageTitle(title);
      setNoteText(updatedPage.content ?? "");
      setSavedNoteText(updatedPage.content ?? "");
      return paginasPosSave;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o notebook.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentPage() {
    if (!annotation) return;
    const pagina = annotation;

    const executar = async () => {
      setSaving(true);
      setError("");
      try {
        await anotacoesRepository.deletar(pagina.id);
        const remainingPages = sortPages(pages.filter((page) => page.id !== pagina.id));
        setPages(remainingPages);
        setPageState(remainingPages[0] ?? null);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar a página.");
      } finally {
        setSaving(false);
      }
    };

    setConfirmacao({
      title: "Apagar página",
      message: `Tem certeza que deseja apagar a página "${pageTitle || "Sem título"}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Apagar página",
      tone: "danger",
      acao: () => void executar(),
    });
  }

  async function deleteNotebook() {
    if (!notebook) return;
    const notebookAtual = notebook;

    const executar = async () => {
      setSaving(true);
      setError("");
      try {
        await Promise.all(pages.map((page) => anotacoesRepository.deletar(page.id)));
        await notebookRepository.deletar(notebookAtual.id);
        setNotebooks((current) => current.filter((item) => item.id !== notebookAtual.id));
        setNotebook(null);
        setPages([]);
        setPageState(null);
        setOpen(false);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar o notebook.");
      } finally {
        setSaving(false);
      }
    };

    setConfirmacao({
      title: "Apagar notebook",
      message: "Tem certeza que deseja apagar o notebook? Todas as suas páginas serão apagadas junto. Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar notebook",
      tone: "danger",
      acao: () => void executar(),
    });
  }

  function closeNotebook() {
    if (hasUnsavedChanges()) {
      setConfirmacao({
        title: "Alterações não salvas",
        message: "Existem alterações não salvas. Deseja fechar e descartá-las?",
        confirmLabel: "Fechar sem salvar",
        acao: () => {
          setPageState(annotation);
          setOpen(false);
        },
      });
      return;
    }

    setOpen(false);
  }

  const actionLabel = loading ? "Carregando notebook" : notebook ? "Abrir notebook" : "Criar notebook";

  // Lista do dropdown: o caderno atual no topo, os demais em ordem alfabética
  const notebooksNaLista = notebook
    ? [notebook, ...notebooks.filter((item) => item.id !== notebook.id)]
    : notebooks;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-toggle-notebook="true"
        className="course-notebook-trigger fixed bottom-6 left-[calc(var(--sidebar-left-offset)+64px)] z-20 inline-flex h-[84px] w-[84px] items-center justify-center rounded-[18px] border-2 border-[#8d6cb5]/60 bg-[#182335] text-4xl leading-none text-[#f4eeff] shadow-lg shadow-black/25 transition-transform transition-colors hover:scale-105 hover:border-[#c19cff] hover:bg-[#24314a] focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 disabled:cursor-wait disabled:opacity-60"
        onClick={notebook ? openNotebook : createNotebook}
        disabled={loading || saving}
        aria-label={actionLabel}
      >
        <span aria-hidden="true">{notebook ? "📖" : "+"}</span>
      </button>

      {error && !open && <p role="alert" className="course-notebook-error">{error}</p>}

      {open && notebook && (
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="course-notebook-title"
          className="course-notebook"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented || confirmacao || document.querySelector('[aria-modal="true"]')) return;
            event.stopPropagation();
            closeNotebook();
          }}
        >
          <header
            className="course-notebook__header"
            onPointerDown={startDragging}
          >
            <span id="course-notebook-title" className="sr-only">Notebook do curso</span>
            <select aria-label="Selecionar notebook" value={notebook.id} onChange={event => trocarNotebook(event.target.value)} disabled={saving}>
              {notebooksNaLista.map(item => <option key={item.id} value={item.id}>{item.title || "Sem título"}</option>)}
            </select>
            <button ref={closeRef} type="button" onClick={closeNotebook} aria-label="Fechar notebook">×</button>
          </header>

          <div className="course-notebook__body">
          <div className="course-notebook__adjust">
            <button type="button" onClick={() => centerRect(440, 420)}>Ajustar à tela</button>
            <button type="button" aria-expanded={adjustments} aria-controls="course-notebook-geometry" onClick={() => {
              setGeometryInput({ x: String(rect.x), y: String(rect.y), width: String(rect.width), height: String(rect.height) });
              setAdjustments(!adjustments);
            }}>Ajustar janela</button>
            <form id="course-notebook-geometry" hidden={!adjustments} onSubmit={event => {
              event.preventDefault();
              const next = { x: Number(geometryInput.x), y: Number(geometryInput.y), width: Number(geometryInput.width), height: Number(geometryInput.height) };
              if (Object.values(geometryInput).some(value => !value.trim()) || Object.values(next).some(value => !Number.isFinite(value)) || next.width <= 0 || next.height <= 0) {
                setGeometryError("Preencha posições e dimensões válidas; largura e altura devem ser positivas.");
                return;
              }
              setGeometryError("");
              applyRect(next);
            }}>
              {([["x", "X"], ["y", "Y"], ["width", "Largura"], ["height", "Altura"]] as const).map(([key, label]) =>
                <label key={key}>{label}<input type="number" step="any" value={geometryInput[key]} onChange={event => setGeometryInput(current => ({ ...current, [key]: event.target.value }))} /></label>)}
              <button type="submit">Aplicar</button>
              {geometryError && <p role="alert">{geometryError}</p>}
            </form>
          </div>
          <div className="course-notebook__pages">
            <div className="course-notebook__tabs" aria-label="Páginas">
              {sortPages(pages).map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => selectPage(page)}
                  aria-pressed={page.id === annotation?.id}
                  className={`max-w-[150px] shrink-0 truncate rounded px-2 py-1 text-[11px] transition ${page.id === annotation?.id ? "bg-[#80602b] font-bold text-[#fff8dc]" : "text-[#806a3d] hover:bg-[#d9bc70]/60"}`}
                  title={page.title || "Sem título"}
                >
                  {page.title || "Sem título"}
                </button>
              ))}
            </div>
            <button type="button" className="shrink-0 border-l border-[#c29b55]/45 px-3 text-lg font-bold text-[#80602b] hover:bg-[#d9bc70]/60" onClick={() => novaPagina()} disabled={saving} aria-label="Criar nova página">+</button>
          </div>

          <div className="course-notebook__editor">
            {annotation ? (
              <>
                  <input
                    value={pageTitle}
                    onChange={(event) => setPageTitle(event.target.value)}
                    placeholder="Título da página"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        if (pageTitle !== savedPageTitle) {
                          event.stopPropagation();
                          setPageTitle(savedPageTitle);
                        }
                      }
                    }}
                    title="Edite o nome da página"
                    aria-label="Título da página"
                  />
                    <p>{course.title}</p>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Escreva suas anotações aqui..."
                      aria-label="Anotações"
                    />
              </>
            ) : !error ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                <p className="font-bold text-[#806a3d]">Nenhuma página ainda</p>
                <p className="mt-1 text-xs text-[#a38b5c]">Crie uma página para começar suas anotações.</p>
                <button type="button" className="mt-3 rounded bg-[#80602b] px-3 py-1.5 text-xs font-bold text-[#fff8dc]" onClick={() => novaPagina()} disabled={saving}>Criar página</button>
              </div>
            ) : null}

            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            <footer>
              <div className="flex min-w-0 gap-1">
                {annotation && <button type="button" onClick={() => void deleteCurrentPage()} disabled={saving}>Apagar página</button>}
                <button type="button" onClick={() => void deleteNotebook()} disabled={saving}>Apagar notebook</button>
              </div>
              {annotation && <button type="button" className="course-notebook__save" onClick={() => void saveNotebook()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>}
            </footer>
          </div>
          </div>
          {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map(direction =>
            <span key={direction} aria-hidden="true" className={`course-notebook__resize course-notebook__resize--${direction}`} onPointerDown={event => startResizing(event, direction)} />)}
        </section>
      )}

      <ConfirmDialog
        open={confirmacao !== null}
        title={confirmacao?.title ?? ""}
        message={confirmacao?.message}
        confirmLabel={confirmacao?.confirmLabel}
        tone={confirmacao?.tone}
        tertiaryLabel={confirmacao?.tertiaryLabel}
        onTertiary={
          confirmacao?.acaoTerciaria
            ? () => {
                confirmacao.acaoTerciaria?.();
                setConfirmacao(null);
              }
            : undefined
        }
        onConfirm={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancel={() => setConfirmacao(null)}
      />
    </>
  );
}

function notebookViewport() {
  const viewport = window.visualViewport;
  return viewport
    ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}
