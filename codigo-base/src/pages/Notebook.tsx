import { useEffect, useMemo, useState } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { anotacoesRepository, cursoRepository, notebookRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Notebook = Database["public"]["Tables"]["Notebook"]["Row"];
type Anotacao = Database["public"]["Tables"]["Anotacoes"]["Row"];

type NotebookComCurso = {
  notebook: Notebook;
  curso: Curso | null;
};

type ConteudoAnotacao = {
  text?: string;
};

// Os cadernos são sempre exibidos alfabeticamente pelo nome.
function ordenarNotebooks(items: NotebookComCurso[]) {
  return [...items].sort((a, b) => a.notebook.Nome.localeCompare(b.notebook.Nome, "pt-BR", { sensitivity: "base" }));
}

function textoDaAnotacao(conteudo: Anotacao["Conteudo"]): string {
  if (typeof conteudo === "string") return conteudo;
  if (conteudo && typeof conteudo === "object" && !Array.isArray(conteudo) && "text" in conteudo) {
    return typeof (conteudo as ConteudoAnotacao).text === "string" ? (conteudo as ConteudoAnotacao).text ?? "" : "";
  }
  return "";
}

function ordenarPaginas(paginas: Anotacao[]) {
  return [...paginas].sort((a, b) => (a.Titulo || "Sem título").localeCompare(b.Titulo || "Sem título", "pt-BR", { sensitivity: "base" }));
}

function dataFormatada(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(data));
}

function NotebookCard({ item, onOpen }: { item: NotebookComCurso; onOpen: () => void }) {
  const { notebook, curso } = item;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative min-h-[190px] overflow-hidden rounded-[4px] border border-[#d4b56d]/35 bg-[#f7e7b5] p-5 text-left text-[#302719] shadow-[5px_7px_0_rgba(94,65,28,0.18),0_12px_25px_rgba(0,0,0,0.2)] transition duration-200 hover:-translate-y-1 hover:border-[#d4b56d]/60 hover:shadow-[7px_10px_0_rgba(94,65,28,0.2),0_18px_32px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a759]"
    >
      <span className="absolute -right-5 -top-5 h-16 w-16 rounded-full border border-[#b99145]/30 bg-[#edcf82]/70" aria-hidden="true" />
      <span className="absolute left-0 top-0 h-full w-2 border-r border-[#b99045]/30 bg-[#edcf82]" aria-hidden="true" />
      <span className="relative flex items-start justify-between gap-3 pl-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#b58d45]/50 bg-[#edcf82] text-2xl shadow-inner" style={curso?.Cor_Capa ? { backgroundColor: curso.Cor_Capa } : undefined}>
          {curso?.Icone || "📖"}
        </span>
        <span className="rounded-full border border-[#b58d45]/45 bg-[#fff4c9]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#806a3d]">Abrir</span>
      </span>
      <span className="relative mt-6 block border-b border-dashed border-[#b58d45]/55 pb-2 pl-2 text-xs font-bold uppercase tracking-[0.12em] text-[#806a3d]">{curso?.Titulo || "Notebook sem curso"}</span>
      <span className="relative mt-3 block break-words pl-2 font-display text-xl leading-tight text-[#493a25]">{notebook.Nome}</span>
      <span className="relative mt-3 block pl-2 text-xs text-[#8d7547]">Criado em {dataFormatada(notebook.Data_Criacao)}</span>
    </button>
  );
}

export default function NotebookPage() {
  const [notebooks, setNotebooks] = useState<NotebookComCurso[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pages, setPages] = useState<Anotacao[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageText, setPageText] = useState("");
  const [editingNotebookName, setEditingNotebookName] = useState(false);
  const [editingPageTitle, setEditingPageTitle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const selectedNotebook = notebooks.find(({ notebook }) => notebook.ID === selectedId) ?? null;
  const selectedPage = pages.find((page) => page.ID === selectedPageId) ?? null;


  // A pesquisa procura pelo nome do notebook ou pelo curso.
  const notebooksVisiveis = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return notebooks;
    return notebooks.filter(({ notebook, curso }) => `${notebook.Nome} ${curso?.Titulo ?? ""}`.toLocaleLowerCase().includes(term));
  }, [notebooks, search]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setLoading(true);
      setError("");
      try {
        const [{ data: authData, error: authError }, todosNotebooks, cursos] = await Promise.all([
          supabase.auth.getUser(),
          notebookRepository.listar(),
          cursoRepository.listar(),
        ]);
        if (authError) throw authError;
        if (!authData.user) return;
        if (cancelado) return;

        const cursosPorId = new Map(cursos.map((curso) => [curso.ID, curso]));
        const notebooksDoUsuario = todosNotebooks
          .filter((notebook) => notebook.ID_Usuario === authData.user?.id)
          .map((notebook) => ({ notebook, curso: notebook.ID_Curso ? cursosPorId.get(notebook.ID_Curso) ?? null : null }));
        setNotebooks(ordenarNotebooks(notebooksDoUsuario));
      } catch (loadError) {
        if (!cancelado) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar seus notebooks.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function abrirNotebook(id: string) {
    const item = notebooks.find(({ notebook }) => notebook.ID === id);
    if (!item) return;
    if (id === selectedId) return;
    if (hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Deseja trocar de notebook e descartá-las?")) return;

    setSelectedId(id);
    setNotebookName(item.notebook.Nome);
    setEditingNotebookName(false);
    setLoadingPages(true);
    setError("");
    try {
      const loadedPages = ordenarPaginas(await anotacoesRepository.listarPorNotebook(id));
      const firstPage = loadedPages[0] ?? null;
      setPages(loadedPages);
      selecionarPagina(firstPage, loadedPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as anotações.");
    } finally {
      setLoadingPages(false);
    }
  }

  function selecionarPagina(page: Anotacao | null, pageList = pages) {
    if (page?.ID !== selectedPageId && hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Deseja trocar de página e descartá-las?")) return;
    setSelectedPageId(page?.ID ?? null);
    setEditingPageTitle(false);
    setPageTitle(page?.Titulo ?? "");
    setPageText(page ? textoDaAnotacao(page.Conteudo) : "");
    if (!page && pageList.length === 0) {
      setPageTitle("");
      setPageText("");
    }
  }

  function fecharNotebook() {
    if (hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Deseja voltar e descartá-las?")) return;
    setSelectedId(null);
    setPages([]);
    setSelectedPageId(null);
    setEditingNotebookName(false);
    setEditingPageTitle(false);
    setPageTitle("");
    setPageText("");
    setError("");
  }

  // Detecta alterações antes de trocar de contexto ou fechar o editor.
  function hasUnsavedChanges() {
    const notebookChanged = Boolean(selectedNotebook && notebookName.trim() !== selectedNotebook.notebook.Nome);
    const pageChanged = Boolean(selectedPage && (pageTitle.trim() !== selectedPage.Titulo || pageText !== textoDaAnotacao(selectedPage.Conteudo)));
    return notebookChanged || pageChanged;
  }

  async function concluirNomeNotebook() {
    if (!selectedNotebook) return;
    setSaving(true);
    setError("");
    try {
      const updated = await notebookRepository.atualizar(selectedNotebook.notebook.ID, { Nome: notebookName.trim() || "Anotações" });
      setNotebooks((current) => current.map((item) => (item.notebook.ID === updated.ID ? { ...item, notebook: updated } : item)));
      setNotebookName(updated.Nome);
      setEditingNotebookName(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o nome do notebook.");
    } finally {
      setSaving(false);
    }
  }

  async function concluirTituloPagina() {
    if (!selectedPage) return;
    setSaving(true);
    setError("");
    try {
      const updated = await anotacoesRepository.atualizar(selectedPage.ID, { Titulo: pageTitle.trim() || "Sem título" });
      setPages((current) => ordenarPaginas(current.map((page) => (page.ID === updated.ID ? updated : page))));
      setPageTitle(updated.Titulo);
      setEditingPageTitle(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o nome da página.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarTudo() {
    if (!selectedNotebook) return;
    setSaving(true);
    setError("");
    try {
      const notebookChanged = notebookName.trim() !== selectedNotebook.notebook.Nome;
      const pageChanged = selectedPage && (pageTitle.trim() !== selectedPage.Titulo || pageText !== textoDaAnotacao(selectedPage.Conteudo));
      const [updatedNotebook, updatedPage] = await Promise.all([
        notebookChanged ? notebookRepository.atualizar(selectedNotebook.notebook.ID, { Nome: notebookName.trim() || "Anotações" }) : Promise.resolve(null),
        pageChanged && selectedPage ? anotacoesRepository.atualizar(selectedPage.ID, { Titulo: pageTitle.trim() || "Sem título", Conteudo: { text: pageText } }) : Promise.resolve(null),
      ]);

      if (updatedNotebook) {
        setNotebooks((current) => current.map((item) => (item.notebook.ID === updatedNotebook.ID ? { ...item, notebook: updatedNotebook } : item)));
        setNotebookName(updatedNotebook.Nome);
      }
      if (updatedPage) {
        const updatedPages = ordenarPaginas(pages.map((page) => (page.ID === updatedPage.ID ? updatedPage : page)));
        setPages(updatedPages);
        setPageTitle(updatedPage.Titulo);
        setPageText(textoDaAnotacao(updatedPage.Conteudo));
      }
      setEditingNotebookName(false);
      setEditingPageTitle(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function criarPagina() {
    if (!selectedNotebook) return;
    setSaving(true);
    setError("");
    try {
      const created = await anotacoesRepository.criar({ ID_Notebook: selectedNotebook.notebook.ID, Titulo: "Nova página", Conteudo: { text: "" } });
      const updatedPages = ordenarPaginas([...pages, created]);
      setPages(updatedPages);
      selecionarPagina(created, updatedPages);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a página.");
    } finally {
      setSaving(false);
    }
  }

  async function apagarPagina() {
    if (!selectedPage) return;
    if (!window.confirm(`Apagar a página "${pageTitle || "Sem título"}"?`)) return;
    setSaving(true);
    try {
      await anotacoesRepository.deletar(selectedPage.ID);
      const remaining = pages.filter((page) => page.ID !== selectedPage.ID);
      setPages(remaining);
      selecionarPagina(ordenarPaginas(remaining)[0] ?? null, remaining);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar a página.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-svh bg-[#141322] font-body text-[#f4eeff]">
      <SidebarLeft />
      <main className="min-h-svh pl-[230px]">
        <div className="mx-auto min-h-svh max-w-[1700px] px-6 pb-12 pt-8 min-[1440px]:px-10">
          {/* Estante: pesquisa e cards em ordem alfabética. */}
          {!selectedNotebook && (
            <>
              <header className="mx-auto max-w-[1180px] border-b border-[#a486d5]/15 pb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a486d5]">Área de estudos</p>
                <h1 className="mt-2 font-display text-3xl text-[#f4eeff] min-[1280px]:text-4xl">Minha estante</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b8aacb]">Escolha um caderno para abrir suas anotações. Os cadernos são organizados em ordem alfabética.</p>
              </header>

              {loading && <p className="mx-auto mt-10 max-w-[1180px] text-center text-sm text-[#b8aacb]">Carregando seus cadernos...</p>}
              {error && <p className="mt-8 rounded-lg border border-[#c2455a]/40 bg-[#3a1522] px-4 py-3 text-sm text-[#f2b4bd]">{error}</p>}
              {!loading && !error && notebooks.length === 0 && <div className="mx-auto mt-10 max-w-[1180px] rounded-xl border border-dashed border-[#a486d5]/35 bg-[#1d1a31]/70 px-6 py-16 text-center"><p className="text-4xl">📖</p><h2 className="mt-3 font-display text-xl">Sua estante está vazia</h2><p className="mt-2 text-sm text-[#a99bbb]">Crie um notebook dentro de um curso para ele aparecer aqui.</p></div>}

              {!loading && notebooks.length > 0 && <div className="mx-auto mt-8 max-w-[1180px]"><label htmlFor="notebook-search" className="sr-only">Pesquisar notebooks</label><input id="notebook-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por caderno ou curso..." className="mb-7 w-full rounded-lg border border-[#a486d5]/30 bg-[#1d1a31] px-4 py-3 text-sm text-[#f4eeff] outline-none placeholder:text-[#8f829f] focus:border-[#a486d5] focus:ring-2 focus:ring-[#a486d5]/25" /><div className="grid grid-cols-1 gap-7 min-[900px]:grid-cols-2">{notebooksVisiveis.map((item) => <NotebookCard key={item.notebook.ID} item={item} onOpen={() => void abrirNotebook(item.notebook.ID)} />)}</div>{notebooksVisiveis.length === 0 && <p className="rounded-lg border border-dashed border-[#a486d5]/30 px-5 py-10 text-center text-sm text-[#a99bbb]">Nenhum notebook encontrado.</p>}</div>}
            </>
          )}

          {/* Editor: navegação lateral, título, páginas e conteúdo. */}
          {selectedNotebook && <div className="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-xl border border-[#a486d5]/20 bg-[#1d1a31] shadow-2xl shadow-black/20 min-[1000px]:flex-row">
            <aside className="w-full shrink-0 border-b border-[#a486d5]/20 bg-[#171628] p-5 min-[1000px]:w-[320px] min-[1000px]:border-b-0 min-[1000px]:border-r">
              <button type="button" onClick={fecharNotebook} className="mb-6 text-sm text-[#b8aacb] hover:text-[#f4eeff]">← Voltar para a estante</button>
              <div className="rounded-lg border border-[#d4b56d]/45 bg-[#f7e7b5] p-4 text-[#302719] shadow-[3px_4px_0_rgba(94,65,28,0.2)]"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#806a3d]">{selectedNotebook.curso?.Titulo || "Sem curso"}</p><div className="mt-3 text-3xl">{selectedNotebook.curso?.Icone || "📖"}</div><label className="mt-4 block text-xs font-bold text-[#806a3d]" htmlFor="notebook-name">Nome do notebook</label><p className="mt-1 break-words py-1 text-lg font-bold text-[#493a25]">{notebookName || "Anotações"}</p></div><button type="button" onClick={() => void salvarTudo()} disabled={saving} className="mt-3 w-full rounded-md bg-[#a486d5] px-3 py-2 text-sm font-bold text-[#171628] hover:bg-[#c9b8e8] disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button><div className="mt-8"><div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#a99bbb]">Trocar notebook</h2><span className="text-xs text-[#8f829f]">{notebooks.length}</span></div><div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 min-[1000px]:max-h-[48vh]">{notebooks.map((item) => <button key={item.notebook.ID} type="button" draggable onClick={() => void abrirNotebook(item.notebook.ID)} className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${item.notebook.ID === selectedId ? "border-[#a486d5] bg-[#a486d5]/15 text-[#f4eeff]" : "border-transparent text-[#b8aacb] hover:border-[#a486d5]/25 hover:bg-[#a486d5]/10"}`}><span>{item.curso?.Icone || "📖"}</span><span className="min-w-0"><strong className="block truncate">{item.notebook.Nome}</strong><small className="block truncate text-xs text-[#8f829f]">{item.curso?.Titulo || "Sem curso"}</small></span></button>)}</div></div>
            </aside>

            <section className="flex min-h-[600px] min-w-0 flex-1 flex-col bg-[#ead18b] text-[#302719]">
              <header className="flex items-center justify-between gap-4 border-b border-[#c29b55]/70 bg-[#edcf82] px-5 py-4"><div className="flex min-w-0 flex-1 items-center gap-3"><input aria-label="Nome do notebook" value={notebookName} onChange={(event) => setNotebookName(event.target.value)} disabled={!editingNotebookName} className="min-w-0 flex-1 border-b-2 border-[#b58d45]/60 bg-transparent px-0 py-1 font-display text-2xl text-[#493a25] outline-none placeholder:text-[#806a3d] focus:border-[#80602b] disabled:cursor-default disabled:border-transparent" placeholder="Nome do notebook" /><button type="button" onClick={() => (editingNotebookName ? void concluirNomeNotebook() : setEditingNotebookName(true))} disabled={saving} className="shrink-0 rounded-md border border-[#80602b]/45 px-2 py-1 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2] disabled:opacity-60">{editingNotebookName ? "Concluir" : "Editar nome"}</button></div><span className="text-3xl" aria-hidden="true">📖</span></header>
              <div className="flex items-center gap-2 overflow-x-auto border-b border-[#c29b55]/50 bg-[#f0d994] px-4 py-2">{pages.map((page) => <button key={page.ID} type="button" onClick={() => selecionarPagina(page)} className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold ${page.ID === selectedPageId ? "border-[#80602b] bg-[#80602b] text-[#fff8dc]" : "border-[#c29b55]/55 bg-[#fff3c2]/60 text-[#806a3d] hover:bg-[#fff8dc]"}`}>{page.Titulo || "Sem título"}</button>)}<button type="button" onClick={() => void criarPagina()} disabled={saving} className="shrink-0 rounded-md border border-dashed border-[#80602b]/60 px-3 py-1.5 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2]">+ Nova página</button></div>
              {loadingPages ? <div className="flex flex-1 items-center justify-center text-sm text-[#806a3d]">Abrindo as anotações...</div> : <div className="flex min-h-0 flex-1 flex-col p-5 min-[1000px]:p-8">{selectedPage ? <><div className="mb-4 flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-center"><input value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} disabled={!editingPageTitle} className="min-w-0 flex-1 border-b-2 border-[#c29b55] bg-transparent px-1 py-2 font-display text-2xl text-[#493a25] outline-none placeholder:text-[#a38b5c] disabled:cursor-default disabled:border-transparent" placeholder="Nome da página" /><button type="button" onClick={() => (editingPageTitle ? void concluirTituloPagina() : setEditingPageTitle(true))} disabled={saving} className="shrink-0 rounded-md border border-[#80602b]/45 px-3 py-2 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2] disabled:opacity-60">{editingPageTitle ? "Concluir" : "Editar nome"}</button><button type="button" onClick={() => void salvarTudo()} disabled={saving} className="rounded-md bg-[#80602b] px-4 py-2 text-sm font-bold text-[#fff8dc] hover:bg-[#674b22] disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button></div><textarea value={pageText} onChange={(event) => setPageText(event.target.value)} placeholder="Escreva suas anotações aqui..." className="min-h-[320px] flex-1 resize-none rounded-md border border-[#c29b55]/70 bg-[#fff8dc]/75 p-5 text-base leading-7 text-[#493a25] outline-none placeholder:text-[#a38b5c] focus:border-[#80602b]" /><div className="mt-3 flex justify-between"><span className="text-xs text-[#8d7547]">As páginas são ordenadas pelo título.</span><button type="button" onClick={() => void apagarPagina()} disabled={saving} className="text-xs font-bold text-[#9b3948] hover:underline">Apagar página</button></div></> : <div className="flex flex-1 flex-col items-center justify-center text-center"><p className="text-5xl">📝</p><h2 className="mt-4 font-display text-2xl">Este notebook ainda está vazio</h2><p className="mt-2 text-sm text-[#806a3d]">Crie uma página para começar a escrever.</p><button type="button" onClick={() => void criarPagina()} className="mt-5 rounded-md bg-[#80602b] px-4 py-2 text-sm font-bold text-[#fff8dc]">Criar primeira página</button></div>}</div>}
              {error && <p className="border-t border-[#9b3948]/30 bg-[#f0c7b8] px-5 py-2 text-xs text-[#74303c]">{error}</p>}
            </section>
          </div>}
        </div>
      </main>
    </div>
  );
}
