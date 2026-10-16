import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  avaliacaoRepository,
  aulaRepository,
  cursoRepository,
  dominioRepository,
  matriculaRepository,
  moduloRepository,
  questaoRepository,
  salaRepository,
  usuarioRepository,
} from '../data/repositories'
import { supabase } from '../lib/supabase'
import type { Database, Json } from '../types/database'
import './CrudConsole.css'

type Usuario = Database['public']['Tables']['profiles']['Row']
type Curso = Database['public']['Tables']['courses']['Row']
type Modulo = Database['public']['Tables']['modules']['Row']
type Aula = Database['public']['Tables']['lessons']['Row']
type Questao = Database['public']['Tables']['questions']['Row']
type Sala = Database['public']['Tables']['rooms']['Row']
type Matricula = Database['public']['Tables']['enrollments']['Row']
type Avaliacao = Database['public']['Tables']['reviews']['Row']
type CourseStatus = Database['public']['Enums']['course_status']
type CourseVisibility = Database['public']['Enums']['course_visibility']
type ContentStatus = Database['public']['Enums']['content_status']
type EnrollmentStatus = Database['public']['Enums']['enrollment_status']
type QuestionType = Database['public']['Enums']['question_type']
type Tab = 'usuarios' | 'cursos' | 'modulo' | 'aula' | 'questao' | 'sala' | 'matricula'

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Múltipla escolha',
  fill_blank: 'Preencher lacuna',
  match: 'Associação (pares)',
  sum_alternatives: 'Soma de alternativas',
}

// Modelos de `questions.config` no formato que a função grade_answer do banco (0010) espera:
//   match:            { pairs: [{ left, right }] }
//   multiple_choice:  { options: [{ id, text, correct }] }
//   fill_blank:       { answers: ['...'] }
//   sum_alternatives: { statements: [{ value, correct }], expected }  (expected é opcional)
const configTemplates: Record<QuestionType, Json> = {
  multiple_choice: { options: [{ id: 'a', text: '', correct: true }, { id: 'b', text: '', correct: false }] },
  fill_blank: { answers: [''] },
  match: { pairs: [{ left: '', right: '' }] },
  sum_alternatives: { statements: [{ value: 1, correct: true }, { value: 2, correct: false }], expected: 1 },
}
const configToText = (config: Json) => JSON.stringify(config, null, 2)

const errMsg = (error: unknown, fallback = 'erro desconhecido') => (error instanceof Error ? error.message : fallback)

type FormUsuario = { email: string; password: string; display_name: string; username: string; bio: string }
type FormCurso = { title: string; slug: string; description: string; category: string; tags: string; cover_url: string; status: CourseStatus; visibility: CourseVisibility }
type FormModulo = { course_id: string; title: string; description: string; color: string; position: string }
type FormAula = { module_id: string; title: string; content: string; position: string; status: ContentStatus }
type FormQuestao = { lesson_id: string; prompt: string; type: QuestionType; xp_value: string; position: string; config: string }
type FormSala = { name: string; access_code: string; course_id: string }
type FormMatricula = { course_id: string; status: EnrollmentStatus; rating: string }

const initialUsuario: FormUsuario = { email: 'a@a', password: '123456', display_name: 'jorge', username: 'aaaa', bio: 'aaa' }
const initialCurso: FormCurso = { title: 'aaa', slug: 'zzz', description: 'zzz', category: 'zz', tags: 'zzz', cover_url: '', status: 'draft', visibility: 'public' }
const initialModulo: FormModulo = { course_id: '', title: 'zz', description: 'zz', color: '#ffffff', position: '0' }
const initialAula: FormAula = { module_id: '', title: 'zzzz', content: 'zzz', position: '0', status: 'draft' }
const initialQuestao: FormQuestao = { lesson_id: '', prompt: 'zzzzz', type: 'multiple_choice', xp_value: '1', position: '0', config: configToText(configTemplates.multiple_choice) }
const initialSala: FormSala = { name: 'zzzzz', access_code: 'zzzz', course_id: '' }
const initialMatricula: FormMatricula = { course_id: '', status: 'active', rating: '' }

// ---------------------------------------------------------------------------
// Componentes auxiliares. Ficam FORA de CrudConsole de propósito: componentes declarados
// dentro de outro componente são recriados a cada render e perdem o estado.
// ---------------------------------------------------------------------------

function Field({ label, help, className, children }: { label: string; help?: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span>{label}</span>
      {children}
      {help && <small className="field-help">{help}</small>}
    </label>
  )
}

function FormActions({ editing, createLabel, loading, onReset }: { editing: boolean; createLabel: string; loading: boolean; onReset: () => void }) {
  return (
    <div className="form-actions">
      <button className="button primary" type="submit" disabled={loading}>
        {loading ? 'Salvando...' : editing ? 'Salvar alterações' : createLabel}
      </button>
      <button className="button ghost" type="button" onClick={onReset}>Limpar</button>
    </div>
  )
}

function ListToolbar({ title, onRefresh, loading }: { title: string; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="list-toolbar">
      <div><span className="eyebrow">REGISTROS</span><h2>{title}</h2></div>
      <button className="button ghost" onClick={onRefresh} disabled={loading}>Atualizar lista</button>
    </div>
  )
}

function SectionHeading({ editing, createTitle, editTitle, hint }: { editing: boolean; createTitle: string; editTitle: string; hint?: string }) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{editing ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
      <h2>{editing ? editTitle : createTitle}</h2>
      {hint && <p>{hint}</p>}
    </div>
  )
}

export function CrudConsole() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios')
  const [currentUserId, setCurrentUserId] = useState('')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [fUsuario, setFUsuario] = useState<FormUsuario>(initialUsuario)
  const [fCurso, setFCurso] = useState<FormCurso>(initialCurso)
  const [fModulo, setFModulo] = useState<FormModulo>(initialModulo)
  const [fAula, setFAula] = useState<FormAula>(initialAula)
  const [fQuestao, setFQuestao] = useState<FormQuestao>(initialQuestao)
  const [fSala, setFSala] = useState<FormSala>(initialSala)
  const [fMatricula, setFMatricula] = useState<FormMatricula>(initialMatricula)
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null)
  const [editingCursoId, setEditingCursoId] = useState<string | null>(null)
  const [editingModuloId, setEditingModuloId] = useState<string | null>(null)
  const [editingAulaId, setEditingAulaId] = useState<string | null>(null)
  const [editingQuestaoId, setEditingQuestaoId] = useState<string | null>(null)
  const [editingSalaId, setEditingSalaId] = useState<string | null>(null)
  const [editingMatricula, setEditingMatricula] = useState<Matricula | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const notify = useCallback((text: string, isError = false) => setStatusMsg({ text, isError }), [])
  const loadUsuarios = useCallback(async () => { try { setUsuarios(await usuarioRepository.listar()) } catch (error) { notify(`Erro ao carregar usuários: ${errMsg(error)}`, true) } }, [notify])
  const loadCursos = useCallback(async () => { try { setCursos(await cursoRepository.listar()) } catch (error) { notify(`Erro ao carregar cursos: ${errMsg(error)}`, true) } }, [notify])
  const loadModulos = useCallback(async () => { try { setModulos(await moduloRepository.listar()) } catch (error) { notify(`Erro ao carregar módulos: ${errMsg(error)}`, true) } }, [notify])
  const loadAulas = useCallback(async () => { try { setAulas(await aulaRepository.listar()) } catch (error) { notify(`Erro ao carregar aulas: ${errMsg(error)}`, true) } }, [notify])
  const loadQuestoes = useCallback(async () => { try { setQuestoes(await questaoRepository.listar()) } catch (error) { notify(`Erro ao carregar questões: ${errMsg(error)}`, true) } }, [notify])
  const loadSalas = useCallback(async () => { try { setSalas(await salaRepository.listar()) } catch (error) { notify(`Erro ao carregar salas: ${errMsg(error)}`, true) } }, [notify])
  const loadMatriculas = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser()
      setMatriculas(await matriculaRepository.listar())
      if (data.user) setAvaliacoes(await avaliacaoRepository.listarPorUsuario(data.user.id))
    } catch (error) { notify(`Erro ao carregar matrículas: ${errMsg(error)}`, true) }
  }, [notify])

  useEffect(() => {
    const carregarDados = async () => {
      if (activeTab === 'usuarios') await loadUsuarios()
      else if (activeTab === 'cursos') await loadCursos()
      else if (activeTab === 'modulo') { await loadCursos(); await loadModulos() }
      else if (activeTab === 'aula') { await loadCursos(); await loadModulos(); await loadAulas() }
      else if (activeTab === 'questao') { await loadCursos(); await loadModulos(); await loadAulas(); await loadQuestoes() }
      else if (activeTab === 'sala') { await loadCursos(); await loadSalas() }
      else if (activeTab === 'matricula') { await loadCursos(); await loadMatriculas() }
    }
    void carregarDados()
  }, [activeTab, loadUsuarios, loadCursos, loadModulos, loadAulas, loadQuestoes, loadSalas, loadMatriculas])

  // Usuário logado: é o criador dos cursos e o educador das salas.
  // Fica sincronizado com a sessão do Supabase (login, logout, troca de usuário), para que
  // o creator_id / educator_id enviados sempre batam com auth.uid() nas policies de RLS.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? '')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Cursos / módulos / aulas que pertencem ao usuário logado (para os selects).
  const meusCursos = cursos.filter((curso) => curso.creator_id === currentUserId)
  const meusModulos = modulos.filter((modulo) => meusCursos.some((curso) => curso.id === modulo.course_id))
  const minhasAulas = aulas.filter((aula) => meusModulos.some((modulo) => modulo.id === aula.module_id))

  // handles

  const handleUsuario = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      const username = fUsuario.username.trim()
      const displayName = fUsuario.display_name.trim()
      if (!displayName) throw new Error('Informe o nome de exibição.')
      if (!username) throw new Error('Informe o nome de usuário.')

      if (editingUsuarioId) {
        // role, xp, nível e streak são controlados pelo servidor e não são editados aqui.
        await usuarioRepository.atualizar(editingUsuarioId, { display_name: displayName, username, bio: fUsuario.bio.trim() || null })
        notify('Usuário atualizado com sucesso.')
      } else {
        const existing = await usuarioRepository.obterPorUsername(username)
        if (existing) throw new Error('Esse nome de usuário já está em uso.')

        // O perfil (profiles) é criado por trigger (handle_new_user), que lê display_name e
        // username dos metadados abaixo.
        const { data, error } = await supabase.auth.signUp({
          email: fUsuario.email.trim(),
          password: fUsuario.password,
          options: { data: { display_name: displayName, username } },
        })
        if (error) throw new Error(`Erro no cadastro (Auth): ${error.message}`)
        if (!data.user) throw new Error('O Supabase não retornou o usuário criado.')
        if (data.user.identities?.length === 0) throw new Error('Já existe uma conta com esse e-mail.')

        // Com sessão (confirmação de e-mail desligada), o signUp já deixa o novo usuário logado,
        // então a policy profiles_update_own permite atualizar o próprio perfil.
        if (data.session) {
          await usuarioRepository.atualizar(data.user.id, { display_name: displayName, username, bio: fUsuario.bio.trim() || null })
        }
        notify(data.session ? `Usuário criado e perfil atualizado. ID: ${data.user.id}` : 'Usuário criado. Confirme o e-mail para completar o perfil.')
      }

      setFUsuario(initialUsuario)
      setEditingUsuarioId(null)
      await loadUsuarios()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar usuário.'), true) }
    finally { setLoading(false) }
  }

  const handleCurso = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      // Confere o usuário direto na sessão (não no estado) para evitar creator_id desatualizado.
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) throw new Error('Faça login para criar cursos.')
      if (!fCurso.title.trim() || !fCurso.slug.trim()) throw new Error('Título e slug são obrigatórios.')
      const payload = {
        creator_id: userId,
        title: fCurso.title.trim(),
        slug: fCurso.slug.trim().toLowerCase(),
        description: fCurso.description.trim() || null,
        category: fCurso.category.trim() || null,
        tags: fCurso.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        cover_url: fCurso.cover_url.trim() || null,
        status: fCurso.status,
        visibility: fCurso.visibility,
      }
      if (editingCursoId) {
        await cursoRepository.atualizar(editingCursoId, payload)
        notify('Curso atualizado com sucesso.')
      } else {
        await cursoRepository.criar(payload)
        notify('Curso criado com sucesso.')
      }
      setFCurso(initialCurso)
      setEditingCursoId(null)
      await loadCursos()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar curso.'), true) }
    finally { setLoading(false) }
  }

  const handleModulo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      if (!fModulo.course_id) throw new Error('Selecione o curso.')
      if (!fModulo.title.trim()) throw new Error('Título é obrigatório.')
      const payload = {
        course_id: fModulo.course_id,
        title: fModulo.title.trim(),
        description: fModulo.description.trim() || null,
        color: fModulo.color || null,
        position: Number(fModulo.position) || 0,
      }
      if (editingModuloId) {
        await moduloRepository.atualizar(editingModuloId, payload)
        notify('Módulo atualizado com sucesso.')
      } else {
        await moduloRepository.criar(payload)
        notify('Módulo criado com sucesso.')
      }
      setFModulo({ ...initialModulo, course_id: fModulo.course_id })
      setEditingModuloId(null)
      await loadModulos()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar módulo.'), true) }
    finally { setLoading(false) }
  }

  const handleAula = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      if (!fAula.module_id) throw new Error('Selecione o módulo.')
      if (!fAula.title.trim()) throw new Error('Título é obrigatório.')
      const payload = {
        module_id: fAula.module_id,
        title: fAula.title.trim(),
        content: fAula.content.trim() || null,
        position: Number(fAula.position) || 0,
        status: fAula.status,
      }
      if (editingAulaId) {
        await aulaRepository.atualizar(editingAulaId, payload)
        notify('Aula atualizada com sucesso.')
      } else {
        await aulaRepository.criar(payload)
        notify('Aula criada com sucesso.')
      }
      setFAula({ ...initialAula, module_id: fAula.module_id })
      setEditingAulaId(null)
      await loadAulas()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar aula.'), true) }
    finally { setLoading(false) }
  }

  const handleQuestao = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      if (!fQuestao.lesson_id) throw new Error('Selecione a aula.')
      if (!fQuestao.prompt.trim()) throw new Error('Enunciado é obrigatório.')

      let config: Json
      try { config = JSON.parse(fQuestao.config) as Json }
      catch { throw new Error('A configuração (config) não é um JSON válido.') }

      const payload = {
        lesson_id: fQuestao.lesson_id,
        prompt: fQuestao.prompt.trim(),
        type: fQuestao.type,
        config,
        xp_value: Number(fQuestao.xp_value) || 0,
        position: Number(fQuestao.position) || 0,
      }
      if (editingQuestaoId) {
        await questaoRepository.atualizar(editingQuestaoId, payload)
        notify('Questão atualizada com sucesso.')
      } else {
        await questaoRepository.criar(payload)
        notify('Questão criada com sucesso.')
      }
      setFQuestao({ ...initialQuestao, lesson_id: fQuestao.lesson_id })
      setEditingQuestaoId(null)
      await loadQuestoes()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar questão.'), true) }
    finally { setLoading(false) }
  }

  const handleSala = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) throw new Error('Faça login para criar salas.')
      if (!fSala.name.trim() || !fSala.access_code.trim()) throw new Error('Nome e código são obrigatórios.')
      const payload = {
        educator_id: userId,
        name: fSala.name.trim(),
        access_code: fSala.access_code.trim().toUpperCase(),
        course_id: fSala.course_id || null,
      }
      if (editingSalaId) {
        await salaRepository.atualizar(editingSalaId, payload)
        notify('Sala atualizada com sucesso.')
      } else {
        await salaRepository.criar(payload)
        notify('Sala criada com sucesso.')
      }
      setFSala(initialSala)
      setEditingSalaId(null)
      await loadSalas()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar sala.'), true) }
    finally { setLoading(false) }
  }

  const handleMatricula = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatusMsg(null); setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) throw new Error('Faça login para gerenciar matrículas.')
      if (editingMatricula) {
        // o progresso é calculado pelo servidor; aqui só mudam o status e a nota (reviews)
        await matriculaRepository.atualizarStatus(editingMatricula.course_id, userId, fMatricula.status)
        if (fMatricula.rating !== '') {
          const nota = Number(fMatricula.rating)
          if (Number.isNaN(nota) || nota < 0 || nota > 5) throw new Error('Informe uma avaliação de 0 a 5.')
          await avaliacaoRepository.salvar({ course_id: editingMatricula.course_id, user_id: userId, rating: nota })
        }
        notify('Matrícula atualizada com sucesso.')
      } else {
        if (!fMatricula.course_id) throw new Error('Selecione o curso.')
        await matriculaRepository.criar({ course_id: fMatricula.course_id, user_id: userId })
        notify('Matrícula criada com sucesso.')
      }
      setFMatricula(initialMatricula)
      setEditingMatricula(null)
      await loadMatriculas()
    } catch (error) { notify(errMsg(error, 'Erro ao salvar matrícula.'), true) }
    finally { setLoading(false) }
  }

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const editUsuario = (usuario: Usuario) => { setFUsuario({ email: '', password: '', display_name: usuario.display_name, username: usuario.username, bio: usuario.bio ?? '' }); setEditingUsuarioId(usuario.id); scrollTop() }
  const editCurso = (curso: Curso) => { setFCurso({ title: curso.title, slug: curso.slug, description: curso.description ?? '', category: curso.category ?? '', tags: curso.tags.join(', '), cover_url: curso.cover_url ?? '', status: curso.status, visibility: curso.visibility }); setEditingCursoId(curso.id); scrollTop() }
  const editModulo = (modulo: Modulo) => { setFModulo({ course_id: modulo.course_id, title: modulo.title, description: modulo.description ?? '', color: modulo.color ?? '#ffffff', position: String(modulo.position) }); setEditingModuloId(modulo.id); scrollTop() }
  const editAula = (aula: Aula) => { setFAula({ module_id: aula.module_id, title: aula.title, content: aula.content ?? '', position: String(aula.position), status: aula.status }); setEditingAulaId(aula.id); scrollTop() }
  const editQuestao = (questao: Questao) => { setFQuestao({ lesson_id: questao.lesson_id, prompt: questao.prompt, type: questao.type, xp_value: String(questao.xp_value), position: String(questao.position), config: configToText(questao.config) }); setEditingQuestaoId(questao.id); scrollTop() }
  const editSala = (sala: Sala) => { setFSala({ name: sala.name, access_code: sala.access_code, course_id: sala.course_id ?? '' }); setEditingSalaId(sala.id); scrollTop() }
  const editMatricula = (matricula: Matricula) => {
    const avaliacao = avaliacoes.find((item) => item.course_id === matricula.course_id)
    setFMatricula({ course_id: matricula.course_id, status: matricula.status, rating: avaliacao ? String(avaliacao.rating) : '' })
    setEditingMatricula(matricula)
    scrollTop()
  }

  // Ao trocar o tipo, carrega o modelo de config e o XP padrão do tipo (calculado no banco).
  const changeQuestionType = async (type: QuestionType) => {
    setFQuestao((current) => ({ ...current, type, config: configToText(configTemplates[type]) }))
    try {
      const xp = await dominioRepository.xpPorTipoQuestao(type)
      setFQuestao((current) => (current.type === type ? { ...current, xp_value: String(xp) } : current))
    } catch { /* mantém o XP atual */ }
  }

  const remove = async (label: string, article: 'este' | 'esta', action: () => Promise<void>, reload: () => Promise<void>) => {
    if (!window.confirm(`Excluir ${article} ${label}?`)) return
    setLoading(true)
    try { await action(); notify(`${label[0].toUpperCase()}${label.slice(1)} excluíd${article === 'este' ? 'o' : 'a'} com sucesso.`); await reload() }
    catch (error) { notify(errMsg(error, `Erro ao excluir ${label}.`), true) }
    finally { setLoading(false) }
  }
  const removeUsuario = (id: string) => remove('usuário', 'este', () => usuarioRepository.deletar(id), loadUsuarios)
  const removeCurso = (id: string) => remove('curso', 'este', () => cursoRepository.deletar(id), loadCursos)
  const removeModulo = (id: string) => remove('módulo', 'este', () => moduloRepository.deletar(id), loadModulos)
  const removeAula = (id: string) => remove('aula', 'esta', () => aulaRepository.deletar(id), loadAulas)
  const removeQuestao = (id: string) => remove('questão', 'esta', () => questaoRepository.deletar(id), loadQuestoes)
  const removeSala = (id: string) => remove('sala', 'esta', () => salaRepository.deletar(id), loadSalas)
  const removeMatricula = (matricula: Matricula) => remove('matrícula', 'esta', () => matriculaRepository.deletar(matricula.course_id, matricula.user_id), loadMatriculas)

  const resetAll = () => {
    setStatusMsg(null)
    setEditingUsuarioId(null); setEditingCursoId(null); setEditingModuloId(null); setEditingAulaId(null)
    setEditingQuestaoId(null); setEditingSalaId(null); setEditingMatricula(null)
    setFUsuario(initialUsuario); setFCurso(initialCurso); setFModulo(initialModulo); setFAula(initialAula)
    setFQuestao(initialQuestao); setFSala(initialSala); setFMatricula(initialMatricula)
  }
  const switchTab = (tab: Tab) => { setActiveTab(tab); resetAll() }

  const tabs: [Tab, string][] = [
    ['usuarios', 'Usuários'], ['cursos', 'Cursos'], ['modulo', 'Módulos'], ['aula', 'Aulas'],
    ['questao', 'Questões'], ['sala', 'Salas'], ['matricula', 'Matrículas'],
  ]

  return <main className="crud-shell">

    <nav className="table-tabs" aria-label="Tabelas do banco">
      {tabs.map(([tab, label]) => (
        <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => switchTab(tab)}>{label}</button>
      ))}
    </nav>

    {statusMsg && <div className={`crud-status ${statusMsg.isError ? 'error' : 'success'}`} role="status">{statusMsg.text}</div>}

    {activeTab === 'usuarios' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingUsuarioId} createTitle="Criar usuário" editTitle="Alterar usuário" hint="O perfil é criado por trigger no cadastro. Cargo, XP, nível e streak são controlados pelo servidor." />
        <form onSubmit={handleUsuario} className="crud-form">
          {!editingUsuarioId && <>
            <Field label="E-mail *" help="Ex.: usuario@exemplo.com — e-mail utilizado para autenticação no Supabase Auth.">
              <input type="email" value={fUsuario.email} onChange={(event) => setFUsuario({ ...fUsuario, email: event.target.value })} required />
            </Field>
            <Field label="Senha *" help="Mínimo de 6 caracteres.">
              <input type="password" value={fUsuario.password} onChange={(event) => setFUsuario({ ...fUsuario, password: event.target.value })} minLength={6} required />
            </Field>
          </>}
          <Field label="Nome de exibição *" help="Ex.: Maria Silva — nome público exibido no perfil.">
            <input value={fUsuario.display_name} onChange={(event) => setFUsuario({ ...fUsuario, display_name: event.target.value })} required />
          </Field>
          <Field label="Nome de usuário *" help="Ex.: maria_silva — nome de usuário único no sistema.">
            <input value={fUsuario.username} onChange={(event) => setFUsuario({ ...fUsuario, username: event.target.value })} required />
          </Field>
          <Field label="Biografia" help="Ex.: Desenvolvedor Front-end apaixonado por React e TypeScript.">
            <textarea value={fUsuario.bio} onChange={(event) => setFUsuario({ ...fUsuario, bio: event.target.value })} rows={4} />
          </Field>
          <FormActions editing={!!editingUsuarioId} createLabel="Criar usuário" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Usuários" onRefresh={() => void loadUsuarios()} loading={loading} />
        <UserTable usuarios={usuarios} loading={loading} onEdit={editUsuario} onDelete={(id) => void removeUsuario(id)} />
      </section>
    </>
    : activeTab === 'cursos' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingCursoId} createTitle="Criar curso" editTitle="Alterar curso" hint="O criador do curso é o usuário logado." />
        <form onSubmit={handleCurso} className="crud-form">
          <Field label="ID do criador *" help="UUID do usuário logado (preenchido automaticamente).">
            <input value={currentUserId} readOnly placeholder="Faça login" />
          </Field>
          <Field label="Título *" help="Título do curso.">
            <input value={fCurso.title} onChange={(event) => setFCurso({ ...fCurso, title: event.target.value })} required />
          </Field>
          <Field label="Slug *" help="Slug do curso (usado para a URL). Precisa ser único.">
            <input value={fCurso.slug} onChange={(event) => setFCurso({ ...fCurso, slug: event.target.value })} required />
          </Field>
          <Field label="Descrição" help="Descrição do curso.">
            <textarea value={fCurso.description} onChange={(event) => setFCurso({ ...fCurso, description: event.target.value })} rows={4} />
          </Field>
          <Field label="Categoria" help="Ex.: Programação, Design, Data Science">
            <input value={fCurso.category} onChange={(event) => setFCurso({ ...fCurso, category: event.target.value })} />
          </Field>
          <Field label="Tags" help="Tags do curso (separadas por vírgula).">
            <input value={fCurso.tags} onChange={(event) => setFCurso({ ...fCurso, tags: event.target.value })} placeholder="javascript, frontend, web" />
          </Field>
          <Field label="URL da capa" help="Endereço da imagem de capa do curso.">
            <input type="url" value={fCurso.cover_url} onChange={(event) => setFCurso({ ...fCurso, cover_url: event.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Status" help="draft (rascunho) ou published (publicado).">
            <select value={fCurso.status} onChange={(event) => setFCurso({ ...fCurso, status: event.target.value as CourseStatus })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </Field>
          <Field label="Visibilidade" help="public (todos veem) ou private (só quem tem acesso).">
            <select value={fCurso.visibility} onChange={(event) => setFCurso({ ...fCurso, visibility: event.target.value as CourseVisibility })}>
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </Field>
          <FormActions editing={!!editingCursoId} createLabel="Criar curso" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Cursos" onRefresh={() => void loadCursos()} loading={loading} />
        <CourseTable cursos={cursos} loading={loading} onEdit={editCurso} onDelete={(id) => void removeCurso(id)} />
      </section>
    </>
    : activeTab === 'modulo' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingModuloId} createTitle="Criar módulo" editTitle="Alterar módulo" hint="Escolha a qual curso este módulo pertence (só cursos seus aparecem aqui)." />
        <form onSubmit={handleModulo} className="crud-form">
          <Field label="Curso *" help="Selecione o curso ao qual este módulo pertence.">
            <select value={fModulo.course_id} onChange={(event) => setFModulo({ ...fModulo, course_id: event.target.value })} required>
              <option value="" disabled>Selecione um curso</option>
              {meusCursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.title}</option>)}
            </select>
          </Field>
          <Field label="Título *" help="Título do módulo.">
            <input value={fModulo.title} onChange={(event) => setFModulo({ ...fModulo, title: event.target.value })} required />
          </Field>
          <Field label="Descrição" help="Descrição do módulo.">
            <textarea value={fModulo.description} onChange={(event) => setFModulo({ ...fModulo, description: event.target.value })} rows={3} />
          </Field>
          <Field label="Posição" help="Posição do módulo no curso.">
            <input type="number" value={fModulo.position} onChange={(event) => setFModulo({ ...fModulo, position: event.target.value })} />
          </Field>
          <Field label="Cor" help="Cor associada ao módulo.">
            <input type="color" value={fModulo.color} onChange={(event) => setFModulo({ ...fModulo, color: event.target.value })} />
          </Field>
          <FormActions editing={!!editingModuloId} createLabel="Criar módulo" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Módulos" onRefresh={() => void loadModulos()} loading={loading} />
        <ModuloTable modulos={modulos} cursos={cursos} loading={loading} onEdit={editModulo} onDelete={(id) => void removeModulo(id)} />
      </section>
    </>
    : activeTab === 'aula' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingAulaId} createTitle="Criar aula" editTitle="Alterar aula" hint="Escolha a qual módulo esta aula pertence (só módulos dos seus cursos aparecem aqui)." />
        <form onSubmit={handleAula} className="crud-form">
          <Field label="Módulo *" help="Módulo que conterá esta aula.">
            <select value={fAula.module_id} onChange={(event) => setFAula({ ...fAula, module_id: event.target.value })} required>
              <option value="" disabled>Selecione um módulo</option>
              {meusModulos.map((modulo) => {
                const cursoDoModulo = cursos.find((c) => c.id === modulo.course_id)
                return <option key={modulo.id} value={modulo.id}>{cursoDoModulo?.title ?? '?'} → {modulo.title}</option>
              })}
            </select>
          </Field>
          <Field label="Título *" help="Título da aula.">
            <input value={fAula.title} onChange={(event) => setFAula({ ...fAula, title: event.target.value })} required />
          </Field>
          <Field label="Conteúdo" help="Conteúdo da aula.">
            <textarea value={fAula.content} onChange={(event) => setFAula({ ...fAula, content: event.target.value })} rows={5} />
          </Field>
          <Field label="Posição" help="Posição da aula no módulo.">
            <input type="number" value={fAula.position} onChange={(event) => setFAula({ ...fAula, position: event.target.value })} />
          </Field>
          <Field label="Status" help="draft (rascunho), published (publicada) ou archived (arquivada).">
            <select value={fAula.status} onChange={(event) => setFAula({ ...fAula, status: event.target.value as ContentStatus })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <FormActions editing={!!editingAulaId} createLabel="Criar aula" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Aulas" onRefresh={() => void loadAulas()} loading={loading} />
        <AulaTable aulas={aulas} modulos={modulos} loading={loading} onEdit={editAula} onDelete={(id) => void removeAula(id)} />
      </section>
    </>
    : activeTab === 'questao' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingQuestaoId} createTitle="Criar questão" editTitle="Alterar questão" hint="Escolha a qual aula esta questão pertence (só aulas dos seus cursos aparecem aqui)." />
        <form onSubmit={handleQuestao} className="crud-form">
          <Field label="Aula *" help="Selecione a aula relacionada à questão.">
            <select value={fQuestao.lesson_id} onChange={(event) => setFQuestao({ ...fQuestao, lesson_id: event.target.value })} required>
              <option value="" disabled>Selecione uma aula</option>
              {minhasAulas.map((aula) => <option key={aula.id} value={aula.id}>{aula.title}</option>)}
            </select>
          </Field>
          <Field label="Tipo" help="Formato da interação esperada do aluno.">
            <select value={fQuestao.type} onChange={(event) => void changeQuestionType(event.target.value as QuestionType)}>
              {Object.entries(questionTypeLabels).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </Field>
          <Field className="wide" label="Enunciado *" help="Ex.: Qual hook é utilizado para gerenciar estado em componentes funcionais?">
            <textarea value={fQuestao.prompt} onChange={(event) => setFQuestao({ ...fQuestao, prompt: event.target.value })} rows={3} required />
          </Field>
          <Field className="wide" label="Configuração (JSON) *" help="Opções, respostas corretas, pares etc. Ao trocar o tipo, um modelo no formato do grade_answer é carregado.">
            <textarea value={fQuestao.config} onChange={(event) => setFQuestao({ ...fQuestao, config: event.target.value })} rows={10} spellCheck={false} style={{ fontFamily: 'monospace' }} required />
          </Field>
          <Field label="XP" help="Pontos de experiência da questão (o padrão vem do tipo).">
            <input type="number" value={fQuestao.xp_value} onChange={(event) => setFQuestao({ ...fQuestao, xp_value: event.target.value })} />
          </Field>
          <Field label="Posição" help="Ex.: 1 — ordem da questão na aula.">
            <input type="number" value={fQuestao.position} onChange={(event) => setFQuestao({ ...fQuestao, position: event.target.value })} />
          </Field>
          <FormActions editing={!!editingQuestaoId} createLabel="Criar questão" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Questões" onRefresh={() => void loadQuestoes()} loading={loading} />
        <QuestaoTable questoes={questoes} aulas={aulas} loading={loading} onEdit={editQuestao} onDelete={(id) => void removeQuestao(id)} />
      </section>
    </>
    : activeTab === 'sala' ? <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingSalaId} createTitle="Criar sala" editTitle="Alterar sala" hint="Vínculo com curso é opcional. Código precisa ser único." />
        <form onSubmit={handleSala} className="crud-form">
          <Field label="ID do educador *" help="UUID do usuário logado, responsável pela sala.">
            <input value={currentUserId} readOnly placeholder="Faça login" />
          </Field>
          <Field label="Nome *" help="Ex.: Turma React 2026.1">
            <input value={fSala.name} onChange={(event) => setFSala({ ...fSala, name: event.target.value })} required />
          </Field>
          <Field label="Código de acesso *" help="Ex.: TURMA2026 — código único em maiúsculas para entrada na sala.">
            <input value={fSala.access_code} onChange={(event) => setFSala({ ...fSala, access_code: event.target.value })} placeholder="ex: TURMA2024" required />
          </Field>
          <Field label="Curso vinculado" help="Associe um curso opcional para os estudantes da sala.">
            <select value={fSala.course_id} onChange={(event) => setFSala({ ...fSala, course_id: event.target.value })}>
              <option value="">Nenhum</option>
              {meusCursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.title}</option>)}
            </select>
          </Field>
          <FormActions editing={!!editingSalaId} createLabel="Criar sala" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Salas" onRefresh={() => void loadSalas()} loading={loading} />
        <SalaTable salas={salas} cursos={cursos} loading={loading} onEdit={editSala} onDelete={(id) => void removeSala(id)} />
      </section>
    </>
    : <>
      <section className="crud-card form-card">
        <SectionHeading editing={!!editingMatricula} createTitle="Nova matrícula" editTitle="Atualizar matrícula" hint='Aqui você só vê e mexe nas suas próprias matrículas (RLS "self only").' />
        <form onSubmit={handleMatricula} className="crud-form">
          {!editingMatricula && (
            <Field label="Curso *" help="Selecione o curso para realizar a matrícula.">
              <select value={fMatricula.course_id} onChange={(event) => setFMatricula({ ...fMatricula, course_id: event.target.value })} required>
                <option value="" disabled>Selecione um curso</option>
                {cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.title}</option>)}
              </select>
            </Field>
          )}
          {editingMatricula && (
            <>
              <p><strong>Curso:</strong> {cursos.find((c) => c.id === editingMatricula.course_id)?.title ?? editingMatricula.course_id}</p>
              <Field label="Status" help="active, completed ou dropped. O progresso é calculado pelo servidor.">
                <select value={fMatricula.status} onChange={(event) => setFMatricula({ ...fMatricula, status: event.target.value as EnrollmentStatus })}>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="dropped">dropped</option>
                </select>
              </Field>
              <Field label="Avaliação" help="Nota inteira de 0 a 5 (gravada em reviews). Deixe em branco para não alterar.">
                <input type="number" min={0} max={5} step={1} value={fMatricula.rating} onChange={(event) => setFMatricula({ ...fMatricula, rating: event.target.value })} />
              </Field>
            </>
          )}
          <FormActions editing={!!editingMatricula} createLabel="Matricular" loading={loading} onReset={resetAll} />
        </form>
      </section>

      <section className="crud-card list-card">
        <ListToolbar title="Minhas matrículas" onRefresh={() => void loadMatriculas()} loading={loading} />
        <MatriculaTable matriculas={matriculas} cursos={cursos} avaliacoes={avaliacoes} loading={loading} onEdit={editMatricula} onDelete={(matricula) => void removeMatricula(matricula)} />
      </section>
    </>}
  </main>
}

function RowActions({ onEdit, onDelete, editLabel = 'Alterar' }: { onEdit: () => void; onDelete: () => void; editLabel?: string }) {
  return (
    <td className="row-actions">
      <button className="link-button" onClick={onEdit}>{editLabel}</button>
      <button className="link-button danger" onClick={onDelete}>Apagar</button>
    </td>
  )
}

function EmptyRow({ colSpan, loading, text }: { colSpan: number; loading: boolean; text: string }) {
  return <tr><td className="empty" colSpan={colSpan}>{loading ? 'Carregando...' : text}</td></tr>
}

function UserTable({ usuarios, loading, onEdit, onDelete }: { usuarios: Usuario[]; loading: boolean; onEdit: (usuario: Usuario) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Nome</th><th>Usuário</th><th>Cargo</th><th>Nível</th><th>XP</th><th>Biografia</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {usuarios.map((usuario) =>
          <tr key={usuario.id}>
            <td><code>{usuario.id}</code></td>
            <td>{usuario.display_name}</td>
            <td>{usuario.username}</td>
            <td>{usuario.role}</td>
            <td>{usuario.level}</td>
            <td>{usuario.xp_global}</td>
            <td>{usuario.bio || '—'}</td>
            <RowActions onEdit={() => onEdit(usuario)} onDelete={() => onDelete(usuario.id)} />
          </tr>)}
        {usuarios.length === 0 && <EmptyRow colSpan={8} loading={loading} text="Nenhum usuário visível para a sessão atual." />}
      </tbody>
    </table>
  </div>
}

function CourseTable({ cursos, loading, onEdit, onDelete }: { cursos: Curso[]; loading: boolean; onEdit: (curso: Curso) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>ID Criador</th><th>Título</th><th>Slug</th><th>Categoria</th><th>Status</th><th>Visibilidade</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {cursos.map((curso) =>
          <tr key={curso.id}>
            <td><code>{curso.id}</code></td>
            <td><code>{curso.creator_id}</code></td>
            <td>{curso.title}</td>
            <td>{curso.slug}</td>
            <td>{curso.category ?? '—'}</td>
            <td>{curso.status}</td>
            <td>{curso.visibility}</td>
            <RowActions onEdit={() => onEdit(curso)} onDelete={() => onDelete(curso.id)} />
          </tr>)}
        {cursos.length === 0 && <EmptyRow colSpan={8} loading={loading} text="Nenhum curso visível para a sessão atual." />}
      </tbody>
    </table>
  </div>
}

function ModuloTable({ modulos, cursos, loading, onEdit, onDelete }: { modulos: Modulo[]; cursos: Curso[]; loading: boolean; onEdit: (modulo: Modulo) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Curso</th><th>Título</th><th>Descrição</th><th>Posição</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {modulos.map((modulo) =>
          <tr key={modulo.id}>
            <td><code>{modulo.id}</code></td>
            <td>{cursos.find((c) => c.id === modulo.course_id)?.title ?? <code>{modulo.course_id}</code>}</td>
            <td>{modulo.title}</td>
            <td>{modulo.description || '—'}</td>
            <td>{modulo.position}</td>
            <RowActions onEdit={() => onEdit(modulo)} onDelete={() => onDelete(modulo.id)} />
          </tr>)}
        {modulos.length === 0 && <EmptyRow colSpan={6} loading={loading} text="Nenhum módulo cadastrado." />}
      </tbody>
    </table>
  </div>
}

function AulaTable({ aulas, modulos, loading, onEdit, onDelete }: { aulas: Aula[]; modulos: Modulo[]; loading: boolean; onEdit: (aula: Aula) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Módulo</th><th>Título</th><th>Posição</th><th>Status</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {aulas.map((aula) =>
          <tr key={aula.id}>
            <td><code>{aula.id}</code></td>
            <td>{modulos.find((m) => m.id === aula.module_id)?.title ?? <code>{aula.module_id}</code>}</td>
            <td>{aula.title}</td>
            <td>{aula.position}</td>
            <td>{aula.status}</td>
            <RowActions onEdit={() => onEdit(aula)} onDelete={() => onDelete(aula.id)} />
          </tr>)}
        {aulas.length === 0 && <EmptyRow colSpan={6} loading={loading} text="Nenhuma aula cadastrada." />}
      </tbody>
    </table>
  </div>
}

function QuestaoTable({ questoes, aulas, loading, onEdit, onDelete }: { questoes: Questao[]; aulas: Aula[]; loading: boolean; onEdit: (questao: Questao) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Aula</th><th>Enunciado</th><th>Tipo</th><th>XP</th><th>Posição</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {questoes.map((questao) =>
          <tr key={questao.id}>
            <td><code>{questao.id}</code></td>
            <td>{aulas.find((a) => a.id === questao.lesson_id)?.title ?? <code>{questao.lesson_id}</code>}</td>
            <td>{questao.prompt}</td>
            <td>{questionTypeLabels[questao.type]}</td>
            <td>{questao.xp_value}</td>
            <td>{questao.position}</td>
            <RowActions onEdit={() => onEdit(questao)} onDelete={() => onDelete(questao.id)} />
          </tr>)}
        {questoes.length === 0 && <EmptyRow colSpan={7} loading={loading} text="Nenhuma questão cadastrada." />}
      </tbody>
    </table>
  </div>
}

function SalaTable({ salas, cursos, loading, onEdit, onDelete }: { salas: Sala[]; cursos: Curso[]; loading: boolean; onEdit: (sala: Sala) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Nome</th><th>Código</th><th>Curso vinculado</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {salas.map((sala) =>
          <tr key={sala.id}>
            <td><code>{sala.id}</code></td>
            <td>{sala.name}</td>
            <td><code>{sala.access_code}</code></td>
            <td>{sala.course_id ? (cursos.find((c) => c.id === sala.course_id)?.title ?? <code>{sala.course_id}</code>) : '—'}</td>
            <RowActions onEdit={() => onEdit(sala)} onDelete={() => onDelete(sala.id)} />
          </tr>)}
        {salas.length === 0 && <EmptyRow colSpan={5} loading={loading} text="Nenhuma sala cadastrada." />}
      </tbody>
    </table>
  </div>
}

function MatriculaTable({ matriculas, cursos, avaliacoes, loading, onEdit, onDelete }: { matriculas: Matricula[]; cursos: Curso[]; avaliacoes: Avaliacao[]; loading: boolean; onEdit: (matricula: Matricula) => void; onDelete: (matricula: Matricula) => void }) {
  return <div className="table-wrap">
    <table>
      <thead>
        <tr><th>Curso</th><th>Status</th><th>Progresso</th><th>Avaliação</th><th>Matriculado em</th><th>Ações</th></tr>
      </thead>
      <tbody>
        {matriculas.map((matricula) =>
          <tr key={matricula.id}>
            <td>{cursos.find((c) => c.id === matricula.course_id)?.title ?? <code>{matricula.course_id}</code>}</td>
            <td>{matricula.status}</td>
            <td>{Math.round(matricula.progress)}%</td>
            <td>{avaliacoes.find((a) => a.course_id === matricula.course_id)?.rating ?? '—'}</td>
            <td>{new Date(matricula.created_at).toLocaleDateString('pt-BR')}</td>
            <RowActions editLabel="Editar" onEdit={() => onEdit(matricula)} onDelete={() => onDelete(matricula)} />
          </tr>)}
        {matriculas.length === 0 && <EmptyRow colSpan={6} loading={loading} text="Nenhuma matrícula." />}
      </tbody>
    </table>
  </div>
}