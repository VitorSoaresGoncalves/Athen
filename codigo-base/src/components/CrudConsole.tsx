import { useCallback, useEffect, useState } from 'react'
import { cursoRepository, usuarioRepository } from '../data/repositories'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import './CrudConsole.css'

type Usuario = Database['public']['Tables']['Usuario']['Row']
type Curso = Database['public']['Tables']['Curso']['Row']
type Cargo = 'learner' | 'creator' | 'moderator'
type CourseLevel = Database['public']['Enums']['course_level']
type CourseStatus = Database['public']['Enums']['course_status']
type Tab = 'usuarios' | 'cursos'

type FormUsuario = { email: string; password: string; Nome_Display: string; Nome_Usuario: string; Cargo: Cargo; Biografia: string }
type FormCurso = { ID_Criador: string; Titulo: string; Slug: string; Descricao: string; Dificuldade: CourseLevel; Categoria: string; Tags: string; Cor_Capa: string; Icone: string; Status: CourseStatus }

const initialUsuario: FormUsuario = { email: '', password: '', Nome_Display: '', Nome_Usuario: '', Cargo: 'learner', Biografia: '' }
const initialCurso: FormCurso = { ID_Criador: '', Titulo: '', Slug: '', Descricao: '', Dificuldade: 'Beginner', Categoria: '', Tags: '', Cor_Capa: '#dcefe5', Icone: '◒', Status: 'draft' }

export function CrudConsole() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [fUsuario, setFUsuario] = useState<FormUsuario>(initialUsuario)
  const [fCurso, setFCurso] = useState<FormCurso>(initialCurso)
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null)
  const [editingCursoId, setEditingCursoId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const notify = (text: string, isError = false) => setStatusMsg({ text, isError })
  const loadUsuarios = useCallback(async () => { try { setUsuarios(await usuarioRepository.listar()) } catch (error) { notify(`Erro ao carregar usuários: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])
  const loadCursos = useCallback(async () => { try { setCursos(await cursoRepository.listar()) } catch (error) { notify(`Erro ao carregar cursos: ${error instanceof Error ? error.message : 'erro desconhecido'}`, true) } }, [])

  useEffect(() => { if (activeTab === 'usuarios') void loadUsuarios(); else void loadCursos() }, [activeTab, loadUsuarios, loadCursos])
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) setFCurso((current) => ({ ...current, ID_Criador: data.user.id })) }) }, [])

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

    const editUsuario = (usuario: Usuario) => { setFUsuario({ email: '', password: '', Nome_Display: usuario.Nome_Display, Nome_Usuario: usuario.Nome_Usuario ?? '', Cargo: usuario.Cargo as Cargo, Biografia: usuario.Biografia }); setEditingUsuarioId(usuario.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const editCurso = (curso: Curso) => { setFCurso({ ID_Criador: curso.ID_Criador, Titulo: curso.Titulo, Slug: curso.Slug, Descricao: curso.Descricao, Dificuldade: curso.Dificuldade, Categoria: curso.Categoria, Tags: curso.Tags.join(', '), Cor_Capa: curso.Cor_Capa, Icone: curso.Icone, Status: curso.Status }); setEditingCursoId(curso.ID); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const removeUsuario = async (id: string) => { if (!window.confirm('Excluir este usuário?')) return; setLoading(true); try { await usuarioRepository.deletar(id); notify('Usuário excluído com sucesso.'); await loadUsuarios() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir usuário.', true) } finally { setLoading(false) } }
    const removeCurso = async (id: string) => { if (!window.confirm('Excluir este curso?')) return; setLoading(true); try { await cursoRepository.deletar(id); notify('Curso excluído com sucesso.'); await loadCursos() } catch (error) { notify(error instanceof Error ? error.message : 'Erro ao excluir curso.', true) } finally { setLoading(false) } }
    const resetCurrentForm = () => { setStatusMsg(null); setEditingUsuarioId(null); setEditingCursoId(null); if (activeTab === 'usuarios') setFUsuario(initialUsuario); else setFCurso((current) => ({ ...initialCurso, ID_Criador: current.ID_Criador })) }

    return <main className="crud-shell">

        <nav className="table-tabs" aria-label="Tabelas do banco">
            <button className={activeTab === 'usuarios' ? 'active' : ''} onClick={() => { setActiveTab('usuarios'); resetCurrentForm() }}>Usuários</button>
            <button className={activeTab === 'cursos' ? 'active' : ''} onClick={() => { setActiveTab('cursos'); resetCurrentForm() }}>Cursos</button>
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
                        <span className="eyebrow">REGISTROS</span>
                        <h2>Usuários</h2>
                    </div>
                <button className="button ghost" onClick={() => void loadUsuarios()} disabled={loading}>Atualizar lista</button>
                </div>
                <UserTable usuarios={usuarios} loading={loading} onEdit={editUsuario} onDelete={(id) => void removeUsuario(id)} />
            </section>

        </> : <>

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

