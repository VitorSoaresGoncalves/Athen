import { useCallback, useEffect, useRef, useState } from "react";
import { anotacoesRepository, notebookRepository } from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Notebook = Database["public"]["Tables"]["Notebook"]["Row"];
type Anotacao = Database["public"]["Tables"]["Anotacoes"]["Row"];

type CourseNotebookProps = {
  course: Curso;
};

type NoteContent = {
  text?: string;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function getSavedText(content: Anotacao["Conteudo"]): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && !Array.isArray(content) && "text" in content) {
    return typeof content.text === "string" ? content.text : "";
  }
  return "";
}

function sortPages(pages: Anotacao[]): Anotacao[] {
  return [...pages].sort((first, second) => {
    const firstTitle = first.Titulo.trim() || "Sem título";
    const secondTitle = second.Titulo.trim() || "Sem título";
    return firstTitle.localeCompare(secondTitle, "pt-BR", { sensitivity: "base" });
  });
}

export function CursoNotebook({ course }: CourseNotebookProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<Anotacao[]>([]);
  const [annotation, setAnnotation] = useState<Anotacao | null>(null);
  const [notebookName, setNotebookName] = useState("Anotações");
  const [pageTitle, setPageTitle] = useState("");
  const [savedPageTitle, setSavedPageTitle] = useState("");
  const [editingPageTitle, setEditingPageTitle] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savedNoteText, setSavedNoteText] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 440, height: 420 });
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
        setNotebook(null);
        setPages([]);
        setAnnotation(null);
        return;
      }

      const notebooks = await notebookRepository.listar();
      const courseNotebook = notebooks.find((item) => item.ID_Curso === course.ID && item.ID_Usuario === currentUserId) ?? null;
      setNotebook(courseNotebook);
      setNotebookName(courseNotebook?.Nome || "Anotações");

      if (!courseNotebook) {
        setPages([]);
        setAnnotation(null);
        return;
      }

      const loadedPages = sortPages(await anotacoesRepository.listarPorNotebook(courseNotebook.ID));
      const firstPage = loadedPages[0] ?? null;
      setPages(loadedPages);
      setAnnotation(firstPage);
      const loadedTitle = firstPage?.Titulo || "";
      const loadedText = firstPage ? getSavedText(firstPage.Conteudo) : "";
      setPageTitle(loadedTitle);
      setSavedPageTitle(loadedTitle);
      setNoteText(loadedText);
      setSavedNoteText(loadedText);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o notebook.");
    } finally {
      setLoading(false);
    }
  }, [course.ID]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotebook();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotebook]);

  useEffect(() => {
    if (!open) return;

    function handlePointerMove(event: PointerEvent) {
      if (dragRef.current.active) {
        setPosition({
          x: Math.max(8, event.clientX - dragRef.current.offsetX),
          y: Math.max(8, event.clientY - dragRef.current.offsetY),
        });
      }

      if (resizeRef.current.active) {
        const { direction, startX, startY, startLeft, startTop, startWidth, startHeight } = resizeRef.current;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const resizingWest = direction.includes("w");
        const resizingNorth = direction.includes("n");

        setSize({
          width: Math.max(240, startWidth + (resizingWest ? -deltaX : direction.includes("e") ? deltaX : 0)),
          height: Math.max(200, startHeight + (resizingNorth ? -deltaY : direction.includes("s") ? deltaY : 0)),
        });

        if (resizingWest || resizingNorth) {
          setPosition({
            x: resizingWest ? Math.max(8, startLeft + deltaX) : startLeft,
            y: resizingNorth ? Math.max(8, startTop + deltaY) : startTop,
          });
        }
      }
    }

    function handlePointerUp() {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [open]);

  function openNotebook() {
    setPosition({
      x: Math.max(16, Math.round((window.innerWidth - size.width) / 2)),
      y: Math.max(80, Math.round((window.innerHeight - size.height) / 2)),
    });
    setOpen(true);
  }

  function startDragging(event: React.PointerEvent<HTMLElement>) {
    const clickedElement = event.target as HTMLElement;
    if (clickedElement.closest("button, input")) return;

    const target = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      active: true,
      offsetX: event.clientX - target.left,
      offsetY: event.clientY - target.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function startResizing(event: React.PointerEvent<HTMLButtonElement>, direction: ResizeDirection) {
    event.stopPropagation();
    resizeRef.current = {
      active: true,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.x,
      startTop: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function setPageState(nextPage: Anotacao | null) {
    setAnnotation(nextPage);
    setEditingPageTitle(false);
    const nextTitle = nextPage?.Titulo || "";
    const nextText = nextPage ? getSavedText(nextPage.Conteudo) : "";
    setPageTitle(nextTitle);
    setSavedPageTitle(nextTitle);
    setNoteText(nextText);
    setSavedNoteText(nextText);
  }

  function hasUnsavedChanges() {
    return pageTitle !== savedPageTitle || noteText !== savedNoteText;
  }

  function selectPage(nextPage: Anotacao) {
    if (nextPage.ID === annotation?.ID) return;
    if (hasUnsavedChanges()) {
      const discardChanges = window.confirm("Existem alterações não salvas. Deseja trocar de página e descartá-las?");
      if (!discardChanges) return;
    }
    setPageState(nextPage);
  }

  function handlePageTabClick(page: Anotacao) {
    if (page.ID === annotation?.ID && editingPageTitle) {
      setEditingPageTitle(false);
      return;
    }

    selectPage(page);
  }

  function handlePageTabDoubleClick(page: Anotacao) {
    if (page.ID === annotation?.ID && !minimumNotebook) {
      setEditingPageTitle(true);
    }
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
        Nome: notebookName || "Anotações",
        ID_Curso: course.ID,
        ID_Usuario: userId,
        ID_Modulo: null,
        ID_Sala: null,
      });
      setNotebook(createdNotebook);
      setNotebookName(createdNotebook.Nome);
      setPages([]);
      setPageState(null);
      await createPage(createdNotebook.ID);
      openNotebook();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o notebook.");
    } finally {
      setSaving(false);
    }
  }

  async function createPage(notebookId = notebook?.ID) {
    if (!notebookId) return;

    setSaving(true);
    setError("");
    try {
      const createdPage = await anotacoesRepository.criar({
        ID_Notebook: notebookId,
        Titulo: "Nova página",
        Conteudo: { text: "" },
      });
      const nextPages = sortPages([...pages, createdPage]);
      setPages(nextPages);
      setPageState(createdPage);
      if (!minimumNotebook) setEditingPageTitle(true);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a página.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotebook() {
    if (!notebook || !annotation) return;

    setSaving(true);
    setError("");
    try {
      const title = pageTitle.trim() || "Sem título";
      const updatedNotebook = await notebookRepository.atualizar(notebook.ID, { Nome: notebookName || "Anotações" });
      const content: NoteContent = { text: noteText };
      const updatedPage = await anotacoesRepository.atualizar(annotation.ID, { Titulo: title, Conteudo: content });
      setNotebook(updatedNotebook);
      setPages(sortPages(pages.map((page) => page.ID === updatedPage.ID ? updatedPage : page)));
      setAnnotation(updatedPage);
      setPageTitle(title);
      setSavedPageTitle(title);
      setEditingPageTitle(false);
      setNoteText(getSavedText(updatedPage.Conteudo));
      setSavedNoteText(getSavedText(updatedPage.Conteudo));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o notebook.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentPage() {
    if (!annotation) return;
    const shouldDelete = window.confirm(`Apagar a página "${pageTitle || "Sem título"}"?`);
    if (!shouldDelete) return;

    setSaving(true);
    setError("");
    try {
      await anotacoesRepository.deletar(annotation.ID);
      const remainingPages = sortPages(pages.filter((page) => page.ID !== annotation.ID));
      setPages(remainingPages);
      setPageState(remainingPages[0] ?? null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar a página.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotebook() {
    if (!notebook) return;
    const shouldDelete = window.confirm("Apagar o notebook e todas as suas páginas?");
    if (!shouldDelete) return;

    setSaving(true);
    setError("");
    try {
      await Promise.all(pages.map((page) => anotacoesRepository.deletar(page.ID)));
      await notebookRepository.deletar(notebook.ID);
      setNotebook(null);
      setPages([]);
      setPageState(null);
      setOpen(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar o notebook.");
    } finally {
      setSaving(false);
    }
  }

  function closeNotebook() {
    if (hasUnsavedChanges()) {
      const discardChanges = window.confirm("Existem alterações não salvas. Deseja fechar e descartar essas alterações?");
      if (!discardChanges) return;
      setPageState(annotation);
    }

    setOpen(false);
  }

  const actionLabel = loading ? "Carregando notebook" : notebook ? "Abrir notebook" : "Criar notebook";
  const compactNotebook = size.width <= 360 || size.height <= 320;
  const minimumNotebook = size.width <= 280 || size.height <= 240;

  return (
    <>
      <button
        type="button"
        data-toggle-notebook="true"
        className="fixed bottom-6 left-[calc(var(--sidebar-left-width,230px)+32px)] z-20 inline-flex h-[84px] w-[84px] items-center justify-center rounded-[18px] border-2 border-[#8d6cb5]/60 bg-[#182335] text-4xl leading-none text-[#f4eeff] shadow-lg shadow-black/25 transition-transform transition-colors hover:scale-105 hover:border-[#c19cff] hover:bg-[#24314a] focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 disabled:cursor-wait disabled:opacity-60"
        onClick={notebook ? openNotebook : createNotebook}
        disabled={loading || saving}
        aria-label={actionLabel}
      >
        <span aria-hidden="true">{notebook ? "📖" : "+"}</span>
      </button>

      {error && !open && <p className="absolute right-[108px] top-[76px] z-10 max-w-[280px] rounded-lg bg-[#3a1522] px-3 py-2 text-xs text-red-100">{error}</p>}

      {open && notebook && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="course-notebook-title"
          className="fixed z-40 flex min-w-[240px] flex-col overflow-hidden rounded-[10px] border border-[#d1a85c]/70 bg-[#f7e7b5] text-[#302719] shadow-[8px_12px_30px_rgba(0,0,0,0.4)]"
          style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
        >
          <header
            className={`flex cursor-grab touch-none items-center border-b border-[#c29b55]/70 bg-[#edcf82] active:cursor-grabbing ${minimumNotebook ? "gap-1 px-1.5 py-1" : compactNotebook ? "gap-2 px-2 py-1.5" : "gap-3 px-3 py-2"}`}
            onPointerDown={startDragging}
          >
            <span id="course-notebook-title" className={`min-w-0 flex-1 truncate font-bold ${minimumNotebook ? "text-xs" : compactNotebook ? "text-sm" : "text-base"}`}>Anotações</span>
            <button type="button" className={`rounded leading-none hover:bg-black/10 ${minimumNotebook ? "px-1 text-base" : compactNotebook ? "px-1.5 text-lg" : "px-2 text-xl"}`} onPointerDown={(event) => event.stopPropagation()} onClick={closeNotebook} aria-label="Fechar notebook">×</button>
          </header>

          <div className="flex min-h-0 border-b border-[#c29b55]/45 bg-[#f0d994]">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-1.5">
              {sortPages(pages).map((page) => (
                <button
                  key={page.ID}
                  type="button"
                  onClick={() => handlePageTabClick(page)}
                  onDoubleClick={() => handlePageTabDoubleClick(page)}
                  className={`max-w-[150px] shrink-0 truncate rounded px-2 py-1 text-[11px] transition ${page.ID === annotation?.ID ? "bg-[#80602b] font-bold text-[#fff8dc]" : "text-[#806a3d] hover:bg-[#d9bc70]/60"}`}
                  title={page.Titulo || "Sem título"}
                >
                  {page.Titulo || "Sem título"}
                </button>
              ))}
            </div>
            <button type="button" className="shrink-0 border-l border-[#c29b55]/45 px-3 text-lg font-bold text-[#80602b] hover:bg-[#d9bc70]/60" onClick={() => void createPage()} disabled={saving} aria-label="Criar nova página">+</button>
          </div>

          <div className={`flex min-h-0 flex-1 flex-col ${minimumNotebook ? "p-1.5" : compactNotebook ? "p-2" : "p-3"}`}>
            {annotation ? (
              <>
                {editingPageTitle && !minimumNotebook && (
                  <input
                    autoFocus
                    value={pageTitle}
                    onChange={(event) => setPageTitle(event.target.value)}
                    placeholder="Título da página"
                    onBlur={() => setEditingPageTitle(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        setPageTitle(savedPageTitle);
                        event.currentTarget.blur();
                      }
                    }}
                    title="Edite o nome da página"
                    className={`mb-1 w-full rounded border border-[#d5b96e]/60 bg-[#fff8dc]/55 px-2 py-1 font-bold text-[#806a3d] outline-none placeholder:text-[#a38b5c] focus:border-[#9a7432] ${compactNotebook ? "text-xs" : "text-sm"}`}
                    aria-label="Título da página"
                  />
                )}
                {minimumNotebook ? (
                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Escreva suas anotações aqui..."
                    className="min-h-0 flex-1 resize-none rounded border border-[#d5b96e]/70 bg-[#fff8dc]/80 p-1.5 text-sm leading-6 outline-none placeholder:text-[#a38b5c] focus:border-[#9a7432]"
                  />
                ) : (
                  <>
                    <p className={`${compactNotebook ? "mb-1 h-3 text-[10px] leading-3" : "mb-2 h-4 text-xs leading-4"} truncate overflow-hidden text-[#806a3d]`}>{course.Titulo}</p>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Escreva suas anotações aqui..."
                      className={`min-h-0 flex-1 resize-none rounded border border-[#d5b96e]/70 bg-[#fff8dc]/80 text-sm leading-6 outline-none placeholder:text-[#a38b5c] focus:border-[#9a7432] ${compactNotebook ? "p-2" : "p-3"}`}
                    />
                  </>
                )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                <p className="font-bold text-[#806a3d]">Nenhuma página ainda</p>
                <p className="mt-1 text-xs text-[#a38b5c]">Crie uma página para começar suas anotações.</p>
                <button type="button" className="mt-3 rounded bg-[#80602b] px-3 py-1.5 text-xs font-bold text-[#fff8dc]" onClick={() => void createPage()} disabled={saving}>Criar página</button>
              </div>
            )}

            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
            <footer className={`flex flex-wrap items-center justify-between gap-1 ${compactNotebook ? "mt-2" : "mt-3"}`}>
              <div className="flex min-w-0 gap-1">
                {annotation && <button type="button" className={`rounded text-red-800 hover:bg-red-900/10 ${minimumNotebook ? "px-1 py-1 text-[9px]" : compactNotebook ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"}`} onClick={() => void deleteCurrentPage()} disabled={saving}>{minimumNotebook ? "Apagar pág." : "Apagar página"}</button>}
                <button type="button" className={`rounded text-red-800 hover:bg-red-900/10 ${minimumNotebook ? "px-1 py-1 text-[9px]" : compactNotebook ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"}`} onClick={() => void deleteNotebook()} disabled={saving}>{minimumNotebook ? "Apagar" : "Apagar notebook"}</button>
              </div>
              {annotation && <button type="button" className={`ml-auto rounded bg-[#80602b] font-bold text-[#fff8dc] hover:bg-[#674b22] ${minimumNotebook ? "px-2 py-1 text-[10px]" : compactNotebook ? "px-2.5 py-1 text-[11px]" : "px-4 py-2 text-xs"}`} onClick={() => void saveNotebook()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>}
            </footer>
          </div>

          <button type="button" aria-label="Ajustar altura superior" className="absolute inset-x-2 top-0 z-10 h-2 cursor-ns-resize opacity-0" onPointerDown={(event) => startResizing(event, "n")} />
          <button type="button" aria-label="Ajustar altura inferior" className="absolute inset-x-2 bottom-0 z-10 h-2 cursor-ns-resize opacity-0" onPointerDown={(event) => startResizing(event, "s")} />
          <button type="button" aria-label="Ajustar largura esquerda" className="absolute inset-y-2 left-0 z-10 w-2 cursor-ew-resize opacity-0" onPointerDown={(event) => startResizing(event, "w")} />
          <button type="button" aria-label="Ajustar largura direita" className="absolute inset-y-2 right-0 z-10 w-2 cursor-ew-resize opacity-0" onPointerDown={(event) => startResizing(event, "e")} />
          <button type="button" aria-label="Ajustar tamanho pelo canto superior esquerdo" className="absolute left-0 top-0 z-20 h-3 w-3 cursor-nwse-resize opacity-0" onPointerDown={(event) => startResizing(event, "nw")} />
          <button type="button" aria-label="Ajustar tamanho pelo canto superior direito" className="absolute right-0 top-0 z-20 h-3 w-3 cursor-nesw-resize opacity-0" onPointerDown={(event) => startResizing(event, "ne")} />
          <button type="button" aria-label="Ajustar tamanho pelo canto inferior esquerdo" className="absolute bottom-0 left-0 z-20 h-3 w-3 cursor-nesw-resize opacity-0" onPointerDown={(event) => startResizing(event, "sw")} />
          <button type="button" aria-label="Ajustar tamanho pelo canto inferior direito" className="absolute bottom-0 right-0 z-20 h-3 w-3 cursor-nwse-resize opacity-0" onPointerDown={(event) => startResizing(event, "se")} />
        </section>
      )}
    </>
  );
}
