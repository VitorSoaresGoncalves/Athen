import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import { anotacoesRepository, cursoRepository, notebookRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
type Anotacao = Database["public"]["Tables"]["notebook_pages"]["Row"];

type NotebookComCurso = {
  notebook: Notebook;
  curso: Curso | null;
};

// ATENÇÃO: a tabela "notebooks" não tem mais course_id (chave estrangeira para courses).
// Antes o caderno se ligava ao curso por essa FK; hoje a ligação é feita apenas pelo título
// (notebooks.title === courses.title), convenção usada também no CursoNotebook.
// Isso é frágil: se o aluno renomear o caderno, ele deixa de aparecer ligado ao curso.
// TODO: reintroduzir a coluna course_id em notebooks (FK -> courses.id) e voltar a casar por ela,
// como era antes, em vez de depender do título.
function cursoDoNotebook(notebook: Notebook, cursos: Curso[]): Curso | null {
  return cursos.find((curso) => curso.title === notebook.title) ?? null;
}

// Os cadernos são sempre exibidos alfabeticamente pelo nome.
function ordenarNotebooks(items: NotebookComCurso[]) {
  return [...items].sort((a, b) => a.notebook.title.localeCompare(b.notebook.title, "pt-BR", { sensitivity: "base" }));
}

function ordenarPaginas(paginas: Anotacao[]) {
  return [...paginas].sort((a, b) => (a.title || "Sem título").localeCompare(b.title || "Sem título", "pt-BR", { sensitivity: "base" }));
}

function dataFormatada(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(data));
}

// Deixa o texto comparável na busca: minúsculo e sem acentos. Assim "pratica" encontra
// "Prática" (e vice-versa). NFD separa a letra do acento; o regex remove os diacríticos.
function normalizarBusca(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
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
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#b58d45]/50 bg-[#edcf82] text-2xl shadow-inner">
          📖
        </span>
        <span className="rounded-full border border-[#b58d45]/45 bg-[#fff4c9]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#806a3d]">Abrir</span>
      </span>
      <span className="relative mt-6 block border-b border-dashed border-[#b58d45]/55 pb-2 pl-2 text-xs font-bold uppercase tracking-[0.12em] text-[#806a3d]">{curso?.title || "Notebook sem curso"}</span>
      <span className="relative mt-3 block break-words pl-2 font-display text-xl leading-tight text-[#493a25]">{notebook.title}</span>
      <span className="relative mt-3 block pl-2 text-xs text-[#8d7547]">Criado em {dataFormatada(notebook.created_at)}</span>
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

  const selectedNotebook = notebooks.find(({ notebook }) => notebook.id === selectedId) ?? null;
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;

  // A pesquisa procura pelo nome do notebook ou pelo curso, ignorando acentos.
  const notebooksVisiveis = useMemo(() => {
    const term = normalizarBusca(search.trim());
    if (!term) return notebooks;
    return notebooks.filter(({ notebook, curso }) => normalizarBusca(`${notebook.title} ${curso?.title ?? ""}`).includes(term));
  }, [notebooks, search]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setLoading(true);
      setError("");
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) return;

        const [notebooksDoUsuario, cursos] = await Promise.all([
          notebookRepository.listarPorUsuario(authData.user.id),
          cursoRepository.listar(),
        ]);
        if (cancelado) return;

        setNotebooks(
          ordenarNotebooks(notebooksDoUsuario.map((notebook) => ({ notebook, curso: cursoDoNotebook(notebook, cursos) }))),
        );
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
    const item = notebooks.find(({ notebook }) => notebook.id === id);
    if (!item) return;
    if (id === selectedId) return;
    if (hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Deseja trocar de notebook e descartá-las?")) return;

    setSelectedId(id);
    setNotebookName(item.notebook.title);
    setEditingNotebookName(false);
    setLoadingPages(true);
    setError("");
    try {
      const loadedPages = ordenarPaginas(await anotacoesRepository.listarPorNotebook(id));
      const firstPage = loadedPages[0] ?? null;
      setPages(loadedPages);
      selecionarPagina(firstPage, loadedPages, true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as anotações.");
    } finally {
      setLoadingPages(false);
    }
  }

  // `force` pula a confirmação (usado quando acabamos de trocar de notebook, que já confirmou).
  function selecionarPagina(page: Anotacao | null, pageList = pages, force = false) {
    if (!force && page?.id !== selectedPageId && hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Deseja trocar de página e descartá-las?")) return;
    setSelectedPageId(page?.id ?? null);
    setEditingPageTitle(false);
    setPageTitle(page?.title ?? "");
    setPageText(page?.content ?? "");
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
    const notebookChanged = Boolean(selectedNotebook && notebookName.trim() !== selectedNotebook.notebook.title);
    const pageChanged = Boolean(selectedPage && (pageTitle.trim() !== selectedPage.title || pageText !== (selectedPage.content ?? "")));
    return notebookChanged || pageChanged;
  }

  async function concluirNomeNotebook() {
    if (!selectedNotebook) return;
    setSaving(true);
    setError("");
    try {
      const updated = await notebookRepository.atualizar(selectedNotebook.notebook.id, { title: notebookName.trim() || "Anotações" });
      setNotebooks((current) => ordenarNotebooks(current.map((item) => (item.notebook.id === updated.id ? { ...item, notebook: updated } : item))));
      setNotebookName(updated.title);
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
      const updated = await anotacoesRepository.atualizar(selectedPage.id, { title: pageTitle.trim() || "Sem título" });
      setPages((current) => ordenarPaginas(current.map((page) => (page.id === updated.id ? updated : page))));
      setPageTitle(updated.title);
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
      const notebookChanged = notebookName.trim() !== selectedNotebook.notebook.title;
      const pageChanged = selectedPage && (pageTitle.trim() !== selectedPage.title || pageText !== (selectedPage.content ?? ""));
      const [updatedNotebook, updatedPage] = await Promise.all([
        notebookChanged ? notebookRepository.atualizar(selectedNotebook.notebook.id, { title: notebookName.trim() || "Anotações" }) : Promise.resolve(null),
        pageChanged && selectedPage ? anotacoesRepository.atualizar(selectedPage.id, { title: pageTitle.trim() || "Sem título", content: pageText }) : Promise.resolve(null),
      ]);

      if (updatedNotebook) {
        setNotebooks((current) => ordenarNotebooks(current.map((item) => (item.notebook.id === updatedNotebook.id ? { ...item, notebook: updatedNotebook } : item))));
        setNotebookName(updatedNotebook.title);
      }
      if (updatedPage) {
        const updatedPages = ordenarPaginas(pages.map((page) => (page.id === updatedPage.id ? updatedPage : page)));
        setPages(updatedPages);
        setPageTitle(updatedPage.title);
        setPageText(updatedPage.content ?? "");
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
      const created = await anotacoesRepository.criar({
        notebook_id: selectedNotebook.notebook.id,
        title: "Nova página",
        content: "",
        position: pages.length,
      });
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
      await anotacoesRepository.deletar(selectedPage.id);
      const remaining = pages.filter((page) => page.id !== selectedPage.id);
      setPages(remaining);
      selecionarPagina(ordenarPaginas(remaining)[0] ?? null, remaining, true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar a página.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout variant="bare">
      <div className="min-h-svh bg-[#140a2b] font-body text-ink">
        <main className="relative isolate min-h-svh">
          <div className="pointer-events-none fixed -right-[120px] -top-[200px] -z-10 h-[560px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(120,63,220,0.2),rgba(20,10,43,0)_68%)]" />

          <div className="mx-auto max-w-[1700px] px-[56px] pb-[48px] pt-[42px] max-[760px]:px-[20px] max-[760px]:pt-[28px]">
          {/* Estante: pesquisa e cards em ordem alfabética. */}
          {!selectedNotebook && (
            <>
              <header className="mb-[32px]">
                <p className="mb-[10px] text-[10px] font-bold uppercase tracking-[1.4px] text-violet-pale/50">PLATAFORMA / <span className="text-gold">NOTEBOOK</span></p>
                <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.8px] text-ink min-[760px]:text-[46px]">Notebook</h1>
                <p className="mt-[9px] text-[14px] text-muted">Escolha um caderno para abrir suas anotações e acompanhar seus estudos.</p>
              </header>

              {loading && <p className="mt-10 text-sm text-muted">Carregando seus cadernos...</p>}
              {error && <p className="mt-8 rounded-lg border border-[#c2455a]/40 bg-[#3a1522] px-4 py-3 text-sm text-[#f2b4bd]">{error}</p>}
              {!loading && !error && notebooks.length === 0 && <div className="mt-10 rounded-xl border border-dashed border-violet-mid/35 bg-[#1d1a31]/70 px-6 py-16 text-center"><p className="text-4xl">📖</p><h2 className="mt-3 font-display text-xl">Sua estante está vazia</h2><p className="mt-2 text-sm text-muted">Crie um notebook dentro de um curso para ele aparecer aqui.</p></div>}

              {!loading && notebooks.length > 0 && <div className="mt-8"><label htmlFor="notebook-search" className="sr-only">Pesquisar notebooks</label><input id="notebook-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por caderno ou curso..." className="mb-7 w-full rounded-lg border border-violet-mid/30 bg-[#1d1a31] px-4 py-3 text-sm text-ink outline-none placeholder:text-[#8f829f] focus:border-violet-mid focus:ring-2 focus:ring-violet-mid/25" /><div className="grid grid-cols-1 gap-7 min-[900px]:grid-cols-2">{notebooksVisiveis.map((item) => <NotebookCard key={item.notebook.id} item={item} onOpen={() => void abrirNotebook(item.notebook.id)} />)}</div>{notebooksVisiveis.length === 0 && <p className="rounded-lg border border-dashed border-violet-mid/30 px-5 py-10 text-center text-sm text-muted">Nenhum notebook encontrado.</p>}</div>}
            </>
          )}

          {/* Editor: navegação lateral, título, páginas e conteúdo. */}
          {selectedNotebook && <div className="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-xl border border-[#a486d5]/20 bg-[#1d1a31] shadow-2xl shadow-black/20 min-[1000px]:flex-row">
            <aside className="w-full shrink-0 border-b border-[#a486d5]/20 bg-[#171628] p-5 min-[1000px]:w-[320px] min-[1000px]:border-b-0 min-[1000px]:border-r">
              <button type="button" onClick={fecharNotebook} className="mb-6 text-sm text-[#b8aacb] hover:text-[#f4eeff]">← Voltar para a estante</button>
              <div className="rounded-lg border border-[#d4b56d]/45 bg-[#f7e7b5] p-4 text-[#302719] shadow-[3px_4px_0_rgba(94,65,28,0.2)]"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#806a3d]">{selectedNotebook.curso?.title || "Sem curso"}</p><div className="mt-3 text-3xl">📖</div><label className="mt-4 block text-xs font-bold text-[#806a3d]" htmlFor="notebook-name">Nome do notebook</label><p className="mt-1 break-words py-1 text-lg font-bold text-[#493a25]">{notebookName || "Anotações"}</p></div><button type="button" onClick={() => void salvarTudo()} disabled={saving} className="mt-3 w-full rounded-md bg-[#a486d5] px-3 py-2 text-sm font-bold text-[#171628] hover:bg-[#c9b8e8] disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button><div className="mt-8"><div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#a99bbb]">Trocar notebook</h2><span className="text-xs text-[#8f829f]">{notebooks.length}</span></div><div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 min-[1000px]:max-h-[48vh]">{notebooks.map((item) => <button key={item.notebook.id} type="button" onClick={() => void abrirNotebook(item.notebook.id)} className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${item.notebook.id === selectedId ? "border-[#a486d5] bg-[#a486d5]/15 text-[#f4eeff]" : "border-transparent text-[#b8aacb] hover:border-[#a486d5]/25 hover:bg-[#a486d5]/10"}`}><span>📖</span><span className="min-w-0"><strong className="block truncate">{item.notebook.title}</strong><small className="block truncate text-xs text-[#8f829f]">{item.curso?.title || "Sem curso"}</small></span></button>)}</div></div>
            </aside>

            <section className="flex min-h-[600px] min-w-0 flex-1 flex-col bg-[#ead18b] text-[#302719]">
              <header className="flex items-center justify-between gap-4 border-b border-[#c29b55]/70 bg-[#edcf82] px-5 py-4"><div className="flex min-w-0 flex-1 items-center gap-3"><input aria-label="Nome do notebook" value={notebookName} onChange={(event) => setNotebookName(event.target.value)} disabled={!editingNotebookName} className="min-w-0 flex-1 border-b-2 border-[#b58d45]/60 bg-transparent px-0 py-1 font-display text-2xl text-[#493a25] outline-none placeholder:text-[#806a3d] focus:border-[#80602b] disabled:cursor-default disabled:border-transparent" placeholder="Nome do notebook" /><button type="button" onClick={() => (editingNotebookName ? void concluirNomeNotebook() : setEditingNotebookName(true))} disabled={saving} className="shrink-0 rounded-md border border-[#80602b]/45 px-2 py-1 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2] disabled:opacity-60">{editingNotebookName ? "Concluir" : "Editar nome"}</button></div><span className="text-3xl" aria-hidden="true">📖</span></header>
              <div className="flex items-center gap-2 overflow-x-auto border-b border-[#c29b55]/50 bg-[#f0d994] px-4 py-2">{pages.map((page) => <button key={page.id} type="button" onClick={() => selecionarPagina(page)} className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold ${page.id === selectedPageId ? "border-[#80602b] bg-[#80602b] text-[#fff8dc]" : "border-[#c29b55]/55 bg-[#fff3c2]/60 text-[#806a3d] hover:bg-[#fff8dc]"}`}>{page.title || "Sem título"}</button>)}<button type="button" onClick={() => void criarPagina()} disabled={saving} className="shrink-0 rounded-md border border-dashed border-[#80602b]/60 px-3 py-1.5 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2]">+ Nova página</button></div>
              {loadingPages ? <div className="flex flex-1 items-center justify-center text-sm text-[#806a3d]">Abrindo as anotações...</div> : <div className="flex min-h-0 flex-1 flex-col p-5 min-[1000px]:p-8">{selectedPage ? <><div className="mb-4 flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-center"><input value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} disabled={!editingPageTitle} className="min-w-0 flex-1 border-b-2 border-[#c29b55] bg-transparent px-1 py-2 font-display text-2xl text-[#493a25] outline-none placeholder:text-[#a38b5c] disabled:cursor-default disabled:border-transparent" placeholder="Nome da página" /><button type="button" onClick={() => (editingPageTitle ? void concluirTituloPagina() : setEditingPageTitle(true))} disabled={saving} className="shrink-0 rounded-md border border-[#80602b]/45 px-3 py-2 text-xs font-bold text-[#80602b] hover:bg-[#fff3c2] disabled:opacity-60">{editingPageTitle ? "Concluir" : "Editar nome"}</button><button type="button" onClick={() => void salvarTudo()} disabled={saving} className="rounded-md bg-[#80602b] px-4 py-2 text-sm font-bold text-[#fff8dc] hover:bg-[#674b22] disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button></div><textarea value={pageText} onChange={(event) => setPageText(event.target.value)} placeholder="Escreva suas anotações aqui..." className="min-h-[320px] flex-1 resize-none rounded-md border border-[#c29b55]/70 bg-[#fff8dc]/75 p-5 text-base leading-7 text-[#493a25] outline-none placeholder:text-[#a38b5c] focus:border-[#80602b]" /><div className="mt-3 flex justify-between"><span className="text-xs text-[#8d7547]">As páginas são ordenadas pelo título.</span><button type="button" onClick={() => void apagarPagina()} disabled={saving} className="text-xs font-bold text-[#9b3948] hover:underline">Apagar página</button></div></> : <div className="flex flex-1 flex-col items-center justify-center text-center"><p className="text-5xl">📝</p><h2 className="mt-4 font-display text-2xl">Este notebook ainda está vazio</h2><p className="mt-2 text-sm text-[#806a3d]">Crie uma página para começar a escrever.</p><button type="button" onClick={() => void criarPagina()} className="mt-5 rounded-md bg-[#80602b] px-4 py-2 text-sm font-bold text-[#fff8dc]">Criar primeira página</button></div>}</div>}
              {error && <p className="border-t border-[#9b3948]/30 bg-[#f0c7b8] px-5 py-2 text-xs text-[#74303c]">{error}</p>}
            </section>
          </div>}
        </div>
        </main>
      </div>
    </PageLayout>
  );
}