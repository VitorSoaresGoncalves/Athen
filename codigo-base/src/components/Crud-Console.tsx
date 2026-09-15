import { useCallback, useEffect, useState } from 'react'
import { cursoRepository, usuarioRepository, moduloRepository, aulaRepository, questaoRepository, salaRepository, notebookRepository, matriculaRepository } from '../data/repositories'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import './Crud-Console.css'

type Usuario = Database['public']['Tables']['Usuario']['Row']
type Curso = Database['public']['Tables']['Curso']['Row']
type Modulo = Database['public']['Tables']['Modulo']['Row']
type Aula = Database['public']['Tables']['Aula']['Row']
type Questao = Database['public']['Tables']['Questao']['Row']
type Sala = Database['public']['Tables']['Sala']['Row']
type Cargo = 'learner' | 'creator' | 'moderator'
type CourseLevel = Database['public']['Enums']['course_level']
type CourseStatus = Database['public']['Enums']['course_status']
type QuestionType = Database['public']['Enums']['question_type']
type Tab = 'usuarios' | 'cursos' | 'modulo' | 'sala' | 'aula' | 'questao' | 'notebook' | 'matricula';

type FormUsuario = { email: string; password: string; Nome_Display: string; Nome_Usuario: string; Cargo: Cargo; Biografia: string }
type FormCurso = { ID_Criador: string; Titulo: string; Slug: string; Descricao: string; Dificuldade: CourseLevel; Categoria: string; Tags: string; Cor_Capa: string; Icone: string; Status: CourseStatus }
type FormModulo = { ID_Curso: string; Titulo: string; Subtitulo: string; Icone: string; Cor_Tema: string; Posicao: string }
type FormAula = { ID_Modulo: string; Titulo: string; Descricao: string; Duracao: string; Posicao: string; Publicado: boolean }
type FormQuestao = { ID_Aula: string; Enunciado: string; Explicacao: string; Tipo: QuestionType; Tipo_Resposta: string; XP: string; Posicao: string }
type FormSala = { ID_Criador: string; Nome: string; Codigo: string; fk_Curso_ID: string }


const initialUsuario: FormUsuario = { email: '', password: '', Nome_Display: '', Nome_Usuario: '', Cargo: 'learner', Biografia: '' }
const initialCurso: FormCurso = { ID_Criador: '', Titulo: '', Slug: '', Descricao: '', Dificuldade: 'Beginner', Categoria: '', Tags: '', Cor_Capa: '#fff', Icone: '◒', Status: 'draft' }
const initialModulo: FormModulo = { ID_Curso: '', Titulo: '', Subtitulo: '', Icone: '📘', Cor_Tema: '#fff', Posicao: '0' }
const initialAula: FormAula = { ID_Modulo: '', Titulo: '', Descricao: '', Duracao: '', Posicao: '0', Publicado: false }
const initialQuestao: FormQuestao = { ID_Aula: '', Enunciado: '', Explicacao: '', Tipo: 'multiple_choice', Tipo_Resposta: '', XP: '0', Posicao: '0' }
const initialSala: FormSala = { ID_Criador: '', Nome: '', Codigo: '', fk_Curso_ID: '' }


export function CrudConsole() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [fUsuario, setFUsuario] = useState<FormUsuario>(initialUsuario)
  const [fCurso, setFCurso] = useState<FormCurso>(initialCurso)
  const [fModulo, setFModulo] = useState<FormModulo>(initialModulo)
  const [fAula, setFAula] = useState<FormAula>(initialAula)
  const [fQuestao, setFQuestao] = useState<FormQuestao>(initialQuestao) 
  const [fSala, setFSala] = useState<FormSala>(initialSala)
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null)
  const [editingCursoId, setEditingCursoId] = useState<string | null>(null)
  const [editingModuloId, setEditingModuloId] = useState<string | null>(null)
  const [editingAulaId, setEditingAulaId] = useState<string | null>(null)
  const [editingQuestaoId, setEditingQuestaoId] = useState<string | null>(null)
  const [editingSalaId, setEditingSalaId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const notify = (text: string, isError = false) => setStatusMsg({ text, isError })
  const loadUsuarios = useCallback(async () => { try { setUsuarios(await usuarioRepository.listar()) } catch (error) { notify(`Erro ao carregar usuários: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadCursos = useCallback(async () => { try { setCursos(await cursoRepository.listar()) } catch (error) { notify(`Erro ao carregar cursos: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadModulos = useCallback(async () => { try { setModulos(await moduloRepository.listar()) } catch (error) { notify(`Erro ao carregar módulos: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadAulas = useCallback(async () => { try { setAulas(await aulaRepository.listar()) } catch (error) { notify(`Erro ao carregar aulas: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadQuestoes = useCallback(async () => { try { setQuestoes(await questaoRepository.listar()) } catch (error) { notify(`Erro ao carregar questões: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadSalas = useCallback(async () => { try { setSalas(await salaRepository.listar()) } catch (error) { notify(`Erro ao carregar salas: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])


  useEffect(() => { if (activeTab === 'usuarios') void loadUsuarios(); 
                    else if (activeTab === 'cursos') void loadCursos()
                    else if (activeTab === 'modulo') { void loadCursos(); void loadModulos() }
                    else if (activeTab === 'aula') { void loadCursos(); void loadModulos(); void loadAulas() }
                    else if (activeTab === 'questao') { void loadCursos(); void loadModulos(); void loadAulas(); void loadQuestoes() }
                    else if (activeTab === 'sala') { void loadCursos(); void loadSalas() }
                  }, [activeTab, loadUsuarios, loadCursos, loadModulos, loadAulas, loadQuestoes, loadSalas])

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) { setFCurso((current) => ({ ...current, ID_Criador: data.user.id })); setFSala((current) => ({ ...current, ID_Criador: data.user.id })) } }) }, [])

    // handles

    const handleUsuario = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            const username = fUsuario.Nome_Usuario.trim()
            if (editingUsuarioId) {
                await usuarioRepository.atualizar(editingUsuarioId, { 
                    Nome_Display: fUsuario.Nome_Display.trim(), 
                    Nome_Usuario: username || null, 
                    Cargo: fUsuario.Cargo, 
                    Biografia: fUsuario.Biografia.trim() 
                })
                notify('Usuário atualizado com sucesso.')
            }
            else {
                if (username) {
                    const { data: existing, error } = await supabase.from('Usuario').select('ID').eq('Nome_Usuario', username).maybeSingle()
                    if (error) throw new Error(`Erro ao checar nome de usuário: ${error.message}`)
                    if (existing) throw new Error('Esse nome de usuário já está em uso.')
                }

                const { data, error } = await supabase.auth.signUp({ 
                    email: fUsuario.email.trim(), 
                    password: fUsuario.password, 
                    options: { 
                        data: { 
                            name: fUsuario.Nome_Display.trim(), 
                            username 
                        } 
                    } 
                })
                if (error) throw new Error(`Erro no cadastro (Auth): ${error.message}`)
                if (!data.user) throw new Error('O Supabase não retornou o usuário criado.')
                if (data.user.identities?.length === 0) throw new Error('Já existe uma conta com esse e-mail.')

                if (data.session) {
                    await usuarioRepository.atualizar(data.user.id, { 
                        Nome_Display: fUsuario.Nome_Display.trim(), 
                        Nome_Usuario: username || null, 
                        Cargo: fUsuario.Cargo, 
                        Biografia: fUsuario.Biografia.trim() 
                    })
                }
                setFCurso((current) => ({ ...current, ID_Criador: data.user!.id }))
                notify(data.session ? `Usuário criado e perfil atualizado. ID: ${data.user.id}` : 'Usuário criado. Confirme o e-mail para completar o perfil.')
            }

            setFUsuario(initialUsuario); 
            setEditingUsuarioId(null); 
            await loadUsuarios()

        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar usuário.', true) } 
        finally { setLoading(false) }
    }

    const handleCurso = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            const creatorId = fCurso.ID_Criador.trim()
            if (!creatorId) throw new Error('Informe o ID do criador.')
            if (!fCurso.Titulo.trim() || !fCurso.Slug.trim()) throw new Error('Título e slug são obrigatórios.')
            const payload = { 
                ID_Criador: creatorId, 
                Titulo: fCurso.Titulo.trim(), 
                Slug: fCurso.Slug.trim().toLowerCase(), 
                Descricao: fCurso.Descricao.trim(), 
                Dificuldade: fCurso.Dificuldade, 
                Categoria: fCurso.Categoria.trim(), 
                Tags: fCurso.Tags.split(',').map((tag) => tag.trim()).filter(Boolean), 
                Cor_Capa: fCurso.Cor_Capa, 
                Icone: fCurso.Icone, 
                Status: fCurso.Status 
            }
            if (editingCursoId) { 
                await cursoRepository.atualizar(editingCursoId, payload); 
                notify('Curso atualizado com sucesso.') 
            }
            else { 
                await cursoRepository.criar(payload); notify('Curso criado com sucesso.') 
            }
            const lastCreator = fCurso.ID_Criador; 
            setFCurso({ ...initialCurso, ID_Criador: lastCreator }); 
            setEditingCursoId(null); 
            await loadCursos()
            
        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar curso.', true) } 
        finally { setLoading(false) }
    }

    const handleModulo = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            if (!fModulo.ID_Curso) throw new Error('Selecione o curso.')
            if (!fModulo.Titulo.trim()) throw new Error('Título é obrigatório.')
            const payload = {
                ID_Curso: fModulo.ID_Curso,
                Titulo: fModulo.Titulo.trim(),
                Subtitulo: fModulo.Subtitulo.trim(),
                Icone: fModulo.Icone,
                Cor_Tema: fModulo.Cor_Tema,
                Posicao: Number(fModulo.Posicao) || 0,
            }
            if (editingModuloId) {
                await moduloRepository.atualizar(editingModuloId, payload)
                notify('Módulo atualizado com sucesso.')
            } else {
                await moduloRepository.criar(payload)
                notify('Módulo criado com sucesso.')
            }
            const lastCurso = fModulo.ID_Curso
            setFModulo({ ...initialModulo, ID_Curso: lastCurso })
            setEditingModuloId(null)
            await loadModulos()
        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar módulo.', true) }
        finally { setLoading(false) }
    }

    const handleAula = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            if (!fAula.ID_Modulo) throw new Error('Selecione o módulo.')
            if (!fAula.Titulo.trim()) throw new Error('Título é obrigatório.')
            const payload = {
                ID_Modulo: fAula.ID_Modulo,
                Titulo: fAula.Titulo.trim(),
                Descricao: fAula.Descricao.trim(),
                Duracao: fAula.Duracao.trim(),
                Posicao: Number(fAula.Posicao) || 0,
                Publicado: fAula.Publicado,
            }
            if (editingAulaId) {
                await aulaRepository.atualizar(editingAulaId, payload)
                notify('Aula atualizada com sucesso.')
            } else {
                await aulaRepository.criar(payload)
                notify('Aula criada com sucesso.')
            }
            const lastModulo = fAula.ID_Modulo
            setFAula({ ...initialAula, ID_Modulo: lastModulo })
            setEditingAulaId(null)
            await loadAulas()
        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar aula.', true) }
        finally { setLoading(false) }
    }

    const handleQuestao = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            if (!fQuestao.ID_Aula) throw new Error('Selecione a aula.')
            if (!fQuestao.Enunciado.trim()) throw new Error('Enunciado é obrigatório.')
            const payload = {
                ID_Aula: fQuestao.ID_Aula,
                Enunciado: fQuestao.Enunciado.trim(),
                Explicacao: fQuestao.Explicacao.trim(),
                Tipo: fQuestao.Tipo,
                Tipo_Resposta: fQuestao.Tipo_Resposta.trim() || null,
                XP: Number(fQuestao.XP) || 0,
                Posicao: Number(fQuestao.Posicao) || 0,
            }
            if (editingQuestaoId) {
                await questaoRepository.atualizar(editingQuestaoId, payload)
                notify('Questão atualizada com sucesso.')
            } else {
                await questaoRepository.criar(payload)
                notify('Questão criada com sucesso.')
            }
            const lastAula = fQuestao.ID_Aula
            setFQuestao({ ...initialQuestao, ID_Aula: lastAula })
            setEditingQuestaoId(null)
            await loadQuestoes()
        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar questão.', true) }
        finally { setLoading(false) }
    }

    const handleSala = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setStatusMsg(null); setLoading(true)
        try {
            const creatorId = fSala.ID_Criador.trim()
            if (!creatorId) throw new Error('Informe o ID do criador.')
            if (!fSala.Nome.trim() || !fSala.Codigo.trim()) throw new Error('Nome e código são obrigatórios.')
            const payload = {
                ID_Criador: creatorId,
                Nome: fSala.Nome.trim(),
                Codigo: fSala.Codigo.trim().toUpperCase(),
                fk_Curso_ID: fSala.fk_Curso_ID || null,
            }
            if (editingSalaId) {
                await salaRepository.atualizar(editingSalaId, payload)
                notify('Sala atualizada com sucesso.')
            } else {
                await salaRepository.criar(payload)
                notify('Sala criada com sucesso.')
            }
            const lastCreator = fSala.ID_Criador
            setFSala({ ...initialSala, ID_Criador: lastCreator })
            setEditingSalaId(null)
            await loadSalas()
        } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao salvar sala.', true) }
        finally { setLoading(false) }
    }

    const editUsuario = (usuario: Usuario) => { setFUsuario({ email: '', password: '', Nome_Display: usuario.Nome_Display, Nome_Usuario: usuario.Nome_Usuario ?? '', Cargo: usuario.Cargo as Cargo, Biografia: usuario.Biografia }); setEditingUsuarioId(usuario.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editCurso = (curso: Curso) => { setFCurso({ ID_Criador: curso.ID_Criador, Titulo: curso.Titulo, Slug: curso.Slug, Descricao: curso.Descricao, Dificuldade: curso.Dificuldade, Categoria: curso.Categoria, Tags: curso.Tags.join(', '), Cor_Capa: curso.Cor_Capa, Icone: curso.Icone, Status: curso.Status }); setEditingCursoId(curso.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editModulo = (modulo: Modulo) => { setFModulo({ ID_Curso: modulo.ID_Curso, Titulo: modulo.Titulo, Subtitulo: modulo.Subtitulo, Icone: modulo.Icone, Cor_Tema: modulo.Cor_Tema, Posicao: String(modulo.Posicao) }); setEditingModuloId(modulo.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editAula = (aula: Aula) => { setFAula({ ID_Modulo: aula.ID_Modulo, Titulo: aula.Titulo, Descricao: aula.Descricao, Duracao: aula.Duracao, Posicao: String(aula.Posicao), Publicado: aula.Publicado }); setEditingAulaId(aula.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editQuestao = (questao: Questao) => { setFQuestao({ ID_Aula: questao.ID_Aula, Enunciado: questao.Enunciado, Explicacao: questao.Explicacao, Tipo: questao.Tipo, Tipo_Resposta: questao.Tipo_Resposta ?? '', XP: String(questao.XP), Posicao: String(questao.Posicao) }); setEditingQuestaoId(questao.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editSala = (sala: Sala) => { setFSala({ ID_Criador: sala.ID_Criador, Nome: sala.Nome, Codigo: sala.Codigo, fk_Curso_ID: sala.fk_Curso_ID ?? '' }); setEditingSalaId(sala.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }

    const removeUsuario = async (id: string) => { if (!window.confirm('Excluir este usuário?')) return; setLoading(true); try { await usuarioRepository.deletar(id); notify('Usuário excluído com sucesso.'); await loadUsuarios() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir usuário.', true) } finally { setLoading(false) } }
    const removeCurso = async (id: string) => { if (!window.confirm('Excluir este curso?')) return; setLoading(true); try { await cursoRepository.deletar(id); notify('Curso excluído com sucesso.'); await loadCursos() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir curso.', true) } finally { setLoading(false) } }
    const removeModulo = async (id: string) => { if (!window.confirm('Excluir este módulo?')) return; setLoading(true); try { await moduloRepository.deletar(id); notify('Módulo excluído com sucesso.'); await loadModulos() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir módulo.', true) } finally { setLoading(false) } }
    const removeAula = async (id: string) => { if (!window.confirm('Excluir esta aula?')) return; setLoading(true); try { await aulaRepository.deletar(id); notify('Aula excluída com sucesso.'); await loadAulas() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir aula.', true) } finally { setLoading(false) } }
    const removeQuestao = async (id: string) => { if (!window.confirm('Excluir esta questão?')) return; setLoading(true); try { await questaoRepository.deletar(id); notify('Questão excluída com sucesso.'); await loadQuestoes() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir questão.', true) } finally { setLoading(false) } }
    const removeSala = async (id: string) => { if (!window.confirm('Excluir esta sala?')) return; setLoading(true); try { await salaRepository.deletar(id); notify('Sala excluída com sucesso.'); await loadSalas() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir sala.', true) } finally { setLoading(false) } }

    const resetCurrentForm = () => {
        setStatusMsg(null); setEditingUsuarioId(null); setEditingCursoId(null); setEditingModuloId(null)
        if (activeTab === 'usuarios') setFUsuario(initialUsuario)
        else if (activeTab === 'cursos') setFCurso((current) => ({ ...initialCurso, ID_Criador: current.ID_Criador }))
        else if (activeTab === 'modulo') setFModulo((current) => ({ ...initialModulo, ID_Curso: current.ID_Curso }))
        else if (activeTab === 'aula') setFAula((current) => ({ ...initialAula, ID_Modulo: current.ID_Modulo }))
        else if (activeTab === 'questao') setFQuestao((current) => ({ ...initialQuestao, ID_Aula: current.ID_Aula }))
        else setFSala((current) => ({ ...initialSala, ID_Criador: current.ID_Criador }))
    }
        
    return <main className="crud-shell">

        <nav className="table-tabs" aria-label="Tabelas do banco">
            <button className={activeTab === 'usuarios' ? 'active' : ''} onClick={() => { setActiveTab('usuarios'); resetCurrentForm() }}>Usuários</button>
            <button className={activeTab === 'cursos' ? 'active' : ''} onClick={() => { setActiveTab('cursos'); resetCurrentForm() }}>Cursos</button>
            <button className={activeTab === 'modulo' ? 'active' : ''} onClick={() => { setActiveTab('modulo'); resetCurrentForm() }}>modulo</button>
            <button className={activeTab === 'aula' ? 'active' : ''} onClick={() => { setActiveTab('aula'); resetCurrentForm() }}>aula</button>
            <button className={activeTab === 'questao' ? 'active' : ''} onClick={() => { setActiveTab('questao'); resetCurrentForm() }}>Questões</button>
            <button className={activeTab === 'sala' ? 'active' : ''} onClick={() => { setActiveTab('sala'); resetCurrentForm() }}>Salas</button> {/* 👈 NOVO */}
        </nav>
        
        {statusMsg && <div className={`crud-status ${statusMsg.isError ? 'error' : 'success'}`} role="status">{statusMsg.text}</div>}

        {activeTab === 'usuarios' ? <>
            <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingUsuarioId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingUsuarioId ? 'Alterar usuário' : 'Criar usuário'}</h2>
                </div>
                
                <form onSubmit={handleUsuario} className="crud-form">{
                    !editingUsuarioId && <>
                    <label><span>E-mail *</span><input type="email" value={fUsuario.email} onChange={(event) => setFUsuario({ ...fUsuario, email: event.target.value })} required /></label>
                    <label><span>Senha *</span><input type="password" value={fUsuario.password} onChange={(event) => setFUsuario({ ...fUsuario, password: event.target.value })} minLength={6} required /></label></>}
                    <label><span>Nome de exibição *</span><input value={fUsuario.Nome_Display} onChange={(event) => setFUsuario({ ...fUsuario, Nome_Display: event.target.value })} required /></label>
                    <label><span>Nome de usuário</span><input value={fUsuario.Nome_Usuario} onChange={(event) => setFUsuario({ ...fUsuario, Nome_Usuario: event.target.value })} /></label>
                    <label><span>Cargo</span><select value={fUsuario.Cargo} onChange={(event) => setFUsuario({ ...fUsuario, Cargo: event.target.value as Cargo })}><option value="learner">learner</option><option value="creator">creator</option><option value="moderator">moderator</option></select></label>
                    <label><span>Biografia</span><textarea value={fUsuario.Biografia} onChange={(event) => setFUsuario({ ...fUsuario, Biografia: event.target.value })} rows={4} /></label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingUsuarioId ? 'Salvar alterações' : 'Criar usuário'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>
        
            <section className="crud-card list-card">
                <div className="list-toolbar">
                    <div>
                        
                        <h2>Ultimo usuário criado</h2>
                    </div>
                <button className="button ghost" onClick={() => void loadUsuarios()} disabled={loading}>Atualizar</button>
                </div>
                <UserTable usuarios={usuarios} loading={loading} onEdit={editUsuario} onDelete={(id) => void removeUsuario(id)} />
            </section>

        </> 
        : activeTab === 'cursos' ? <>

            <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingCursoId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingCursoId ? 'Alterar curso' : 'Criar curso'}</h2>
                    <p>O ID do criador começa com o último cadastrado e pode ser conferido no banco.</p>
                </div>

                <form onSubmit={handleCurso} className="crud-form">
                    <label><span>ID do criador *</span><input value={fCurso.ID_Criador} readOnly placeholder="Último usuário cadastrado" /></label>
                    <label><span>Título *</span><input value={fCurso.Titulo} onChange={(event) => setFCurso({ ...fCurso, Titulo: event.target.value })} required /></label>
                    <label><span>Slug *</span><input value={fCurso.Slug} onChange={(event) => setFCurso({ ...fCurso, Slug: event.target.value })} required /></label>
                    <label><span>Descrição</span><textarea value={fCurso.Descricao} onChange={(event) => setFCurso({ ...fCurso, Descricao: event.target.value })} rows={4} /></label>
                    <label><span>Dificuldade</span><select value={fCurso.Dificuldade} onChange={(event) => setFCurso({ ...fCurso, Dificuldade: event.target.value as CourseLevel })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
                    <label><span>Categoria</span><input value={fCurso.Categoria} onChange={(event) => setFCurso({ ...fCurso, Categoria: event.target.value })} /></label>
                    <label><span>Tags</span><input value={fCurso.Tags} onChange={(event) => setFCurso({ ...fCurso, Tags: event.target.value })} placeholder="javascript, frontend, web" /></label>
                    <label><span>Cor da capa</span><input type="color" value={fCurso.Cor_Capa} onChange={(event) => setFCurso({ ...fCurso, Cor_Capa: event.target.value })} /></label>
                    <label><span>Ícone</span><input value={fCurso.Icone} onChange={(event) => setFCurso({ ...fCurso, Icone: event.target.value })} /></label>
                    <label><span>Status</span><select value={fCurso.Status} onChange={(event) => setFCurso({ ...fCurso, Status: event.target.value as CourseStatus })}><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingCursoId ? 'Salvar alterações' : 'Criar curso'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>

            <section className="crud-card list-card">
                <div className="list-toolbar"><div>
                    <span className="eyebrow">REGISTROS</span>
                    <h2>Cursos</h2>
                </div>
                <button className="button ghost" onClick={() => void loadCursos()} disabled={loading}>Atualizar lista</button></div><CourseTable cursos={cursos} loading={loading} onEdit={editCurso} onDelete={(id) => void removeCurso(id)} />

            </section>
        </>
        : activeTab === 'modulo' ? <>
            <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingModuloId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingModuloId ? 'Alterar módulo' : 'Criar módulo'}</h2>
                    <p>Escolha a qual curso este módulo pertence.</p>
                </div>

                <form onSubmit={handleModulo} className="crud-form">
                    <label>
                        <span>Curso *</span>
                        <select value={fModulo.ID_Curso} onChange={(event) => setFModulo({ ...fModulo, ID_Curso: event.target.value })} required>
                            <option value="" disabled>Selecione um curso</option>
                            {cursos
                            .filter((curso) => curso.ID_Criador === fCurso.ID_Criador).map((curso) => <option key={curso.ID} value={curso.ID}>{curso.Titulo}</option>)}
                        </select>
                    </label>
                    <label><span>Título *</span><input value={fModulo.Titulo} onChange={(event) => setFModulo({ ...fModulo, Titulo: event.target.value })} required /></label>
                    <label><span>Subtítulo</span><input value={fModulo.Subtitulo} onChange={(event) => setFModulo({ ...fModulo, Subtitulo: event.target.value })} /></label>
                    <label><span>Posição</span><input type="number" value={fModulo.Posicao} onChange={(event) => setFModulo({ ...fModulo, Posicao: event.target.value })} /></label>
                    <label><span>Cor do tema</span><input type="color" value={fModulo.Cor_Tema} onChange={(event) => setFModulo({ ...fModulo, Cor_Tema: event.target.value })} /></label>
                    <label><span>Ícone</span><input value={fModulo.Icone} onChange={(event) => setFModulo({ ...fModulo, Icone: event.target.value })} /></label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingModuloId ? 'Salvar alterações' : 'Criar módulo'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>

            <section className="crud-card list-card">
                <div className="list-toolbar"><div>
                    <span className="eyebrow">REGISTROS</span>
                    <h2>Módulos</h2>
                </div>
                <button className="button ghost" onClick={() => void loadModulos()} disabled={loading}>Atualizar lista</button></div>
                <ModuloTable modulos={modulos} cursos={cursos} loading={loading} onEdit={editModulo} onDelete={(id) => void removeModulo(id)} />
            </section>
        </>
        : activeTab === 'aula' ? <>
            <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingAulaId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingAulaId ? 'Alterar aula' : 'Criar aula'}</h2>
                    <p>Escolha a qual módulo esta aula pertence (só módulos dos seus cursos aparecem aqui).</p>
                </div>

                <form onSubmit={handleAula} className="crud-form">
                    <label>
                        <span>Módulo *</span>
                        <select value={fAula.ID_Modulo} onChange={(event) => setFAula({ ...fAula, ID_Modulo: event.target.value })} required>
                            <option value="" disabled>Selecione um módulo</option>
                            {modulos
                                .filter((modulo) => cursos.some((curso) => curso.ID === modulo.ID_Curso && curso.ID_Criador === fCurso.ID_Criador))
                                .map((modulo) => {
                                    const cursoDoModulo = cursos.find((c) => c.ID === modulo.ID_Curso)
                                    return <option key={modulo.ID} value={modulo.ID}>{cursoDoModulo?.Titulo ?? '?'} → {modulo.Titulo}</option>
                                })}
                        </select>
                    </label>
                    <label><span>Título *</span><input value={fAula.Titulo} onChange={(event) => setFAula({ ...fAula, Titulo: event.target.value })} required /></label>
                    <label><span>Descrição</span><textarea value={fAula.Descricao} onChange={(event) => setFAula({ ...fAula, Descricao: event.target.value })} rows={4} /></label>
                    <label><span>Duração</span><input value={fAula.Duracao} onChange={(event) => setFAula({ ...fAula, Duracao: event.target.value })} placeholder="ex: 00:12:00" /></label>
                    <label><span>Posição</span><input type="number" value={fAula.Posicao} onChange={(event) => setFAula({ ...fAula, Posicao: event.target.value })} /></label>
                    <label><span>Publicado</span><input type="checkbox" checked={fAula.Publicado} onChange={(event) => setFAula({ ...fAula, Publicado: event.target.checked })} /></label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingAulaId ? 'Salvar alterações' : 'Criar aula'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>

            <section className="crud-card list-card">
                <div className="list-toolbar"><div>
                    <span className="eyebrow">REGISTROS</span>
                    <h2>Aulas</h2>
                </div>
                <button className="button ghost" onClick={() => void loadAulas()} disabled={loading}>Atualizar lista</button></div>
                <AulaTable aulas={aulas} modulos={modulos} loading={loading} onEdit={editAula} onDelete={(id) => void removeAula(id)} />
            </section>
        </>
        : activeTab === 'questao' ? <>
            <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingQuestaoId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingQuestaoId ? 'Alterar questão' : 'Criar questão'}</h2>
                    <p>Escolha a qual aula esta questão pertence (só aulas dos seus cursos aparecem aqui).</p>
                </div>

                <form onSubmit={handleQuestao} className="crud-form">
                    <label>
                        <span>Aula *</span>
                        <select value={fQuestao.ID_Aula} onChange={(event) => setFQuestao({ ...fQuestao, ID_Aula: event.target.value })} required>
                            <option value="" disabled>Selecione uma aula</option>
                            {aulas
                                .filter((aula) => {
                                    const modulo = modulos.find((m) => m.ID === aula.ID_Modulo)
                                    if (!modulo) return false
                                    return cursos.some((curso) => curso.ID === modulo.ID_Curso && curso.ID_Criador === fCurso.ID_Criador)
                                })
                                .map((aula) => <option key={aula.ID} value={aula.ID}>{aula.Titulo}</option>)}
                        </select>
                    </label>
                    <label className="wide"><span>Enunciado *</span><textarea value={fQuestao.Enunciado} onChange={(event) => setFQuestao({ ...fQuestao, Enunciado: event.target.value })} rows={3} required /></label>
                    <label><span>Tipo</span><select value={fQuestao.Tipo} onChange={(event) => setFQuestao({ ...fQuestao, Tipo: event.target.value as QuestionType })}><option value="multiple_choice">multiple_choice</option><option value="word_match">word_match</option><option value="fill_blank">fill_blank</option><option value="order_sequence">order_sequence</option></select></label>
                    <label><span>Tipo de resposta</span><input value={fQuestao.Tipo_Resposta} onChange={(event) => setFQuestao({ ...fQuestao, Tipo_Resposta: event.target.value })} placeholder="opcional" /></label>
                    <label><span>XP</span><input type="number" value={fQuestao.XP} onChange={(event) => setFQuestao({ ...fQuestao, XP: event.target.value })} /></label>
                    <label><span>Posição</span><input type="number" value={fQuestao.Posicao} onChange={(event) => setFQuestao({ ...fQuestao, Posicao: event.target.value })} /></label>
                    <label className="wide"><span>Explicação</span><textarea value={fQuestao.Explicacao} onChange={(event) => setFQuestao({ ...fQuestao, Explicacao: event.target.value })} rows={3} /></label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingQuestaoId ? 'Salvar alterações' : 'Criar questão'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>

            <section className="crud-card list-card">
                <div className="list-toolbar"><div>
                    <span className="eyebrow">REGISTROS</span>
                    <h2>Questões</h2>
                </div>
                <button className="button ghost" onClick={() => void loadQuestoes()} disabled={loading}>Atualizar lista</button></div>
                <QuestaoTable questoes={questoes} aulas={aulas} loading={loading} onEdit={editQuestao} onDelete={(id) => void removeQuestao(id)} />
            </section>
        </>
        : <>
        <section className="crud-card form-card">
                <div className="section-heading">
                    <span className="eyebrow">{editingSalaId ? 'EDIÇÃO' : 'NOVO REGISTRO'}</span>
                    <h2>{editingSalaId ? 'Alterar sala' : 'Criar sala'}</h2>
                    <p>Vínculo com curso é opcional. Código precisa ser único.</p>
                </div>

                <form onSubmit={handleSala} className="crud-form">
                    <label><span>ID do criador *</span><input value={fSala.ID_Criador} readOnly placeholder="Último usuário cadastrado" /></label>
                    <label><span>Nome *</span><input value={fSala.Nome} onChange={(event) => setFSala({ ...fSala, Nome: event.target.value })} required /></label>
                    <label><span>Código *</span><input value={fSala.Codigo} onChange={(event) => setFSala({ ...fSala, Codigo: event.target.value })} placeholder="ex: TURMA2024" required /></label>
                    <label>
                        <span>Curso vinculado</span>
                        <select value={fSala.fk_Curso_ID} onChange={(event) => setFSala({ ...fSala, fk_Curso_ID: event.target.value })}>
                            <option value="">Nenhum</option>
                            {cursos.filter((curso) => curso.ID_Criador === fSala.ID_Criador).map((curso) => <option key={curso.ID} value={curso.ID}>{curso.Titulo}</option>)}
                        </select>
                    </label>
                    <div className="form-actions"><button className="button primary" type="submit" disabled={loading}>{loading ? 'Salvando...' : editingSalaId ? 'Salvar alterações' : 'Criar sala'}</button><button className="button ghost" type="button" onClick={resetCurrentForm}>Limpar</button></div>
                </form>
            </section>

            <section className="crud-card list-card">
                <div className="list-toolbar"><div>
                    <span className="eyebrow">REGISTROS</span>
                    <h2>Salas</h2>
                </div>
                <button className="button ghost" onClick={() => void loadSalas()} disabled={loading}>Atualizar lista</button></div>
                <SalaTable salas={salas} cursos={cursos} loading={loading} onEdit={editSala} onDelete={(id) => void removeSala(id)} />
            </section>
        </>}
    </main>
}

function UserTable({ usuarios, loading, onEdit, onDelete }:{ usuarios: Usuario[]; loading: boolean; onEdit: (usuario: Usuario) => void; onDelete: (id: string) => void }) { 
        return <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Usuário</th>
                            <th>Cargo</th>
                            <th>Biografia</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>{ usuarios.map((usuario) => 
                            <tr key={usuario.ID}>
                                <td><code>{usuario.ID}</code></td>
                                <td>{usuario.Nome_Display}</td>
                                <td>{usuario.Nome_Usuario ?? '—'}</td>
                                <td>{usuario.Cargo}</td><td>{usuario.Biografia || '—'}</td>
                                <td className="row-actions"><button className="link-button" onClick={() => onEdit(usuario)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(usuario.ID)}>Apagar</button></td>
                                </tr>)
                            }
                            { usuarios.length === 0 && <tr>
                                <td className="empty" colSpan={6}>{loading ? 'Carregando...' : 'Nenhum usuário visível para a sessão atual.'}</td>
                                </tr>}
                    </tbody>
                </table>
                </div> 
}

function CourseTable({ cursos, loading, onEdit, onDelete }: { cursos: Curso[]; loading: boolean; onEdit: (curso: Curso) => void; onDelete: (id: string) => void }) { 
    return <div className="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>ID Criador</th>
                    <th>Título</th>
                    <th>Slug</th>
                    <th>Dificuldade</th>
                    <th>Categoria</th>
                    <th>Status</th>
                    <th>Alunos</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>{cursos.map((curso) => 
                <tr key={curso.ID}>
                    <td><code>{curso.ID}</code></td>
                    <td><code>{curso.ID_Criador}</code></td>
                    <td>{curso.Icone} {curso.Titulo}</td>
                    <td>{curso.Slug}</td>
                    <td>{curso.Dificuldade}</td>
                    <td>{curso.Categoria}</td>
                    <td>{curso.Status}</td>
                    <td>{curso.Contagem_Estudante}</td>
                    <td className="row-actions"><button className="link-button" onClick={() => onEdit(curso)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(curso.ID)}>Apagar</button></td>
                    </tr>)
                    }
                    { cursos.length === 0 && <tr>
                        <td className="empty" colSpan={9}>{loading ? 'Carregando...' : 'Nenhum curso visível para a sessão atual.'}</td>
                        </tr>}
            </tbody>
        </table>
        </div> 
}

function ModuloTable({ modulos, cursos, loading, onEdit, onDelete }: { modulos: Modulo[]; cursos: Curso[]; loading: boolean; onEdit: (modulo: Modulo) => void; onDelete: (id: string) => void }) {
    return <div className="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Curso</th>
                    <th>Título</th>
                    <th>Subtítulo</th>
                    <th>Posição</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>{modulos.map((modulo) =>
                <tr key={modulo.ID}>
                    <td><code>{modulo.ID}</code></td>
                    <td>{cursos.find((c) => c.ID === modulo.ID_Curso)?.Titulo ?? <code>{modulo.ID_Curso}</code>}</td>
                    <td>{modulo.Icone} {modulo.Titulo}</td>
                    <td>{modulo.Subtitulo || '—'}</td>
                    <td>{modulo.Posicao}</td>
                    <td className="row-actions"><button className="link-button" onClick={() => onEdit(modulo)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(modulo.ID)}>Apagar</button></td>
                </tr>)
                }
                { modulos.length === 0 && <tr>
                    <td className="empty" colSpan={6}>{loading ? 'Carregando...' : 'Nenhum módulo cadastrado.'}</td>
                    </tr>}
            </tbody>
        </table>
        </div>
}

function AulaTable({ aulas, modulos, loading, onEdit, onDelete }: { aulas: Aula[]; modulos: Modulo[]; loading: boolean; onEdit: (aula: Aula) => void; onDelete: (id: string) => void }) {
    return <div className="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Módulo</th>
                    <th>Título</th>
                    <th>Duração</th>
                    <th>Posição</th>
                    <th>Publicado</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>{aulas.map((aula) =>
                <tr key={aula.ID}>
                    <td><code>{aula.ID}</code></td>
                    <td>{modulos.find((m) => m.ID === aula.ID_Modulo)?.Titulo ?? <code>{aula.ID_Modulo}</code>}</td>
                    <td>{aula.Titulo}</td>
                    <td>{aula.Duracao || '—'}</td>
                    <td>{aula.Posicao}</td>
                    <td>{aula.Publicado ? 'Sim' : 'Não'}</td>
                    <td className="row-actions"><button className="link-button" onClick={() => onEdit(aula)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(aula.ID)}>Apagar</button></td>
                </tr>)
                }
                { aulas.length === 0 && <tr>
                    <td className="empty" colSpan={7}>{loading ? 'Carregando...' : 'Nenhuma aula cadastrada.'}</td>
                    </tr>}
            </tbody>
        </table>
        </div>
}

function QuestaoTable({ questoes, aulas, loading, onEdit, onDelete }: { questoes: Questao[]; aulas: Aula[]; loading: boolean; onEdit: (questao: Questao) => void; onDelete: (id: string) => void }) {
    return <div className="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Aula</th>
                    <th>Enunciado</th>
                    <th>Tipo</th>
                    <th>XP</th>
                    <th>Posição</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>{questoes.map((questao) =>
                <tr key={questao.ID}>
                    <td><code>{questao.ID}</code></td>
                    <td>{aulas.find((a) => a.ID === questao.ID_Aula)?.Titulo ?? <code>{questao.ID_Aula}</code>}</td>
                    <td>{questao.Enunciado}</td>
                    <td>{questao.Tipo}</td>
                    <td>{questao.XP}</td>
                    <td>{questao.Posicao}</td>
                    <td className="row-actions"><button className="link-button" onClick={() => onEdit(questao)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(questao.ID)}>Apagar</button></td>
                </tr>)
                }
                { questoes.length === 0 && <tr>
                    <td className="empty" colSpan={7}>{loading ? 'Carregando...' : 'Nenhuma questão cadastrada.'}</td>
                    </tr>}
            </tbody>
        </table>
        </div>
}

function SalaTable({ salas, cursos, loading, onEdit, onDelete }: { salas: Sala[]; cursos: Curso[]; loading: boolean; onEdit: (sala: Sala) => void; onDelete: (id: string) => void }) {
    return <div className="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Código</th>
                    <th>Curso vinculado</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>{salas.map((sala) =>
                <tr key={sala.ID}>
                    <td><code>{sala.ID}</code></td>
                    <td>{sala.Nome}</td>
                    <td><code>{sala.Codigo}</code></td>
                    <td>{sala.fk_Curso_ID ? (cursos.find((c) => c.ID === sala.fk_Curso_ID)?.Titulo ?? <code>{sala.fk_Curso_ID}</code>) : '—'}</td>
                    <td className="row-actions"><button className="link-button" onClick={() => onEdit(sala)}>Alterar</button><button className="link-button danger" onClick={() => onDelete(sala.ID)}>Apagar</button></td>
                </tr>)
                }
                { salas.length === 0 && <tr>
                    <td className="empty" colSpan={5}>{loading ? 'Carregando...' : 'Nenhuma sala cadastrada.'}</td>
                    </tr>}
            </tbody>
        </table>
        </div>
}
