import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

// ATENÇÃO: os tipos abaixo dependem do `database.ts` regenerado a partir do banco novo
// (npx supabase gen types typescript --project-id <id> > src/types/database.ts).

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
type FunctionReturn<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]['Returns'];
type Json = Database['public']['Tables']['questions']['Row']['config'];

// entidades do banco

type Usuario = Tables<'profiles'>;
type CreateUsuarioInput = TablesInsert<'profiles'>;
type BuscaUsuario = FunctionReturn<'search_profiles'>[number];

type Curso = Tables<'courses'>;
type CreateCursoInput = TablesInsert<'courses'>;

type Sala = Tables<'rooms'>;
type CreateSalaInput = TablesInsert<'rooms'>;

type Modulo = Tables<'modules'>;
type CreateModuloInput = TablesInsert<'modules'>;

type Aula = Tables<'lessons'>;
type CreateAulaInput = TablesInsert<'lessons'>;

type Questao = Tables<'questions'>;
type CreateQuestaoInput = TablesInsert<'questions'>;
type TipoQuestao = Enums<'question_type'>;

type Matricula = Tables<'enrollments'>;
type CreateMatriculaInput = TablesInsert<'enrollments'>;
type StatusMatricula = Enums<'enrollment_status'>;

type Tentativa = Tables<'attempts'>;
type CreateTentativaInput = TablesInsert<'attempts'>;
type ResultadoTentativa = FunctionReturn<'finalize_attempt'>[number];

type Resposta = Tables<'answers'>;
type CreateRespostaInput = TablesInsert<'answers'>;
type ResultadoCorrecao = FunctionReturn<'grade_answer'>[number];

type Aviso = Tables<'announcements'>;
type CreateAvisoInput = TablesInsert<'announcements'>;

type Missao = Tables<'missions'>;
type CreateMissaoInput = TablesInsert<'missions'>;

type Avaliacao = Tables<'reviews'>;
type CreateAvaliacaoInput = TablesInsert<'reviews'>;

type Comentario = Tables<'comments'>;
type CreateComentarioInput = TablesInsert<'comments'>;

type Notebook = Tables<'notebooks'>;
type CreateNotebookInput = TablesInsert<'notebooks'>;

type Anotacoes = Tables<'notebook_pages'>;
type CreateAnotacoesInput = TablesInsert<'notebook_pages'>;

type RankingGlobal = Views<'global_ranking'>;
type RankingAmigosCurso = FunctionReturn<'friends_course_pac'>[number];

type Amizade = Tables<'friendships'>;
type CreateAmizadeInput = TablesInsert<'friendships'>;
type StatusAmizade = Enums<'friendship_status'>;

type Notificacao = Tables<'notifications'>;

type Medalha = Tables<'medals'>;
type CreateMedalhaInput = TablesInsert<'medals'>;

// relacionamentos 

type ProgressoMissao = Tables<'mission_progress'>;
type CreateProgressoMissaoInput = TablesInsert<'mission_progress'>;

type MedalhaUsuario = Tables<'user_medals'>;

type Conclui = Tables<'completions'>;
type ContextoConclusao = 'course' | 'room';

type Participa = Tables<'room_members'>;
type CreateParticipaInput = TablesInsert<'room_members'>;

// Id do usuário logado (usado pelos atalhos que gravam em nome de quem está autenticado).
async function obterIdUsuarioAtual(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Usuário não autenticado.');
  return data.user.id;
}

// profiles (um registro por conta do auth). O perfil é criado por trigger no cadastro;
// role, xp_global, level e streak_count são controlados pelo servidor.
export const usuarioRepository = {
  async listar(): Promise<Usuario[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar usuários: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async listarPorIds(ids: string[]): Promise<Usuario[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
    if (error) throw new Error(`Erro ao listar perfis: ${error.message}`);
    return data || [];
  },

  async obterPorUsername(username: string): Promise<Usuario | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
    if (error) return null;
    return data;
  },

  async obterAtual(): Promise<Usuario | null> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;
    return usuarioRepository.obterPorId(authData.user.id);
  },

  async buscar(termo: string): Promise<BuscaUsuario[]> {
    const { data, error } = await supabase.rpc('search_profiles', { p_query: termo });
    if (error) throw new Error(`Erro ao buscar usuários: ${error.message}`);
    return data || [];
  },

  // Login por username: devolve o e-mail somente se a senha conferir (ou null).
  async resolverEmailLogin(username: string, senha: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('resolve_login_email', { p_username: username, p_password: senha });
    if (error) throw new Error(`Erro ao resolver login: ${error.message}`);
    return data ?? null;
  },

  async criar(dados: CreateUsuarioInput): Promise<Usuario> {
    const { data, error } = await supabase.from('profiles').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateUsuarioInput>): Promise<Usuario> {
    const { data, error } = await supabase.from('profiles').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    return data;
  },

  // Preferências no formato { pedido_amizade: true, missao: false, ... } (chave ausente = ativada).
  async atualizarPreferenciasNotificacao(id: string, preferencias: Record<string, boolean>): Promise<Usuario> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ notification_preferences: preferencias })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar preferências de notificação: ${error.message}`);
    return data;
  },

  // Exclusão "suave" da própria conta: desativa e apaga dados pessoais.
  async desativarConta(): Promise<void> {
    const { error } = await supabase.rpc('deactivate_account');
    if (error) throw new Error(`Erro ao desativar conta: ${error.message}`);
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar usuário: ${error.message}`);
  }
};

export const cursoRepository = {
  async listar(): Promise<Curso[]> {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar cursos: ${error.message}`);
    return data || [];
  },

  async listarPublicados(): Promise<Curso[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar cursos publicados: ${error.message}`);
    return data || [];
  },

  async listarPorCriador(idCriador: string): Promise<Curso[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('creator_id', idCriador)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar cursos do criador: ${error.message}`);
    return data || [];
  },

  async listarPorCategoria(categoria: string): Promise<Curso[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('category', categoria)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar cursos da categoria: ${error.message}`);
    return data || [];
  },

  async buscarPorTitulo(termo: string): Promise<Curso[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .ilike('title', `%${termo}%`)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao buscar cursos: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Curso | null> {
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async obterPorSlug(slug: string): Promise<Curso | null> {
    const { data, error } = await supabase.from('courses').select('*').eq('slug', slug).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateCursoInput): Promise<Curso> {
    const { data, error } = await supabase.from('courses').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar curso: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateCursoInput>): Promise<Curso> {
    const { data, error } = await supabase.from('courses').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar curso: ${error.message}`);
    return data;
  },

  // Rascunho pode ser editado por completo; depois de publicado, só aceita novos módulos.
  async publicar(id: string): Promise<Curso> {
    const { data, error } = await supabase.from('courses').update({ status: 'published' }).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao publicar curso: ${error.message}`);
    return data;
  },

  async despublicar(id: string): Promise<Curso> {
    const { data, error } = await supabase.from('courses').update({ status: 'draft' }).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao despublicar curso: ${error.message}`);
    return data;
  },

  // Avisa os alunos matriculados que o curso foi atualizado. Retorna quantos foram notificados.
  async notificarAtualizacao(id: string): Promise<number> {
    const { data, error } = await supabase.rpc('notify_course_update', { p_course_id: id });
    if (error) throw new Error(`Erro ao notificar atualização do curso: ${error.message}`);
    return data ?? 0;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar curso: ${error.message}`);
  }
};

export const salaRepository = {
  async listar(): Promise<Sala[]> {
    const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar salas: ${error.message}`);
    return data || [];
  },

  async listarPorEducador(idEducador: string): Promise<Sala[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('educator_id', idEducador)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar salas do educador: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Sala[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('course_id', idCurso)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar salas do curso: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Sala | null> {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async obterPorCodigo(codigoAcesso: string): Promise<Sala | null> {
    const { data, error } = await supabase.from('rooms').select('*').eq('access_code', codigoAcesso).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateSalaInput): Promise<Sala> {
    const { data, error } = await supabase.from('rooms').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar sala: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateSalaInput>): Promise<Sala> {
    const { data, error } = await supabase.from('rooms').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar sala: ${error.message}`);
    return data;
  },

  async atualizarCodigoAtivo(id: string, ativo: boolean): Promise<Sala> {
    const { data, error } = await supabase.from('rooms').update({ code_active: ativo }).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar código da sala: ${error.message}`);
    return data;
  },

  // Entra na sala com o código de acesso. Retorna o id do registro em room_members.
  async entrarPorCodigo(codigoAcesso: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_room', { p_access_code: codigoAcesso });
    if (error) throw new Error(`Erro ao entrar na sala: ${error.message}`);
    return data;
  },

  // Notifica um usuário de que ele foi convidado para a sala (somente o educador da sala).
  async convidarUsuario(idSala: string, idUsuario: string): Promise<string> {
    const { data, error } = await supabase.rpc('notify_room_invite', { p_room_id: idSala, p_user_id: idUsuario });
    if (error) throw new Error(`Erro ao convidar usuário para a sala: ${error.message}`);
    return data;
  },

  async ehEducador(idSala: string, idUsuario?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_room_educator', {
      p_room_id: idSala,
      ...(idUsuario ? { p_user_id: idUsuario } : {})
    });
    if (error) throw new Error(`Erro ao verificar educador da sala: ${error.message}`);
    return data ?? false;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar sala: ${error.message}`);
  }
};

export const moduloRepository = {
  async listar(): Promise<Modulo[]> {
    const { data, error } = await supabase.from('modules').select('*').order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar módulos: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Modulo[]> {
    const { data, error } = await supabase.from('modules').select('*').eq('course_id', idCurso).order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar módulos do curso: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Modulo | null> {
    const { data, error } = await supabase.from('modules').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateModuloInput): Promise<Modulo> {
    const { data, error } = await supabase.from('modules').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar módulo: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateModuloInput>): Promise<Modulo> {
    const { data, error } = await supabase.from('modules').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar módulo: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar módulo: ${error.message}`);
  }
};

export const aulaRepository = {
  async listar(): Promise<Aula[]> {
    const { data, error } = await supabase.from('lessons').select('*').order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar aulas: ${error.message}`);
    return data || [];
  },

  async listarPorModulo(idModulo: string): Promise<Aula[]> {
    const { data, error } = await supabase.from('lessons').select('*').eq('module_id', idModulo).order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar aulas do módulo: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Aula | null> {
    const { data, error } = await supabase.from('lessons').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateAulaInput): Promise<Aula> {
    const { data, error } = await supabase.from('lessons').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar aula: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateAulaInput>): Promise<Aula> {
    const { data, error } = await supabase.from('lessons').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar aula: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar aula: ${error.message}`);
  }
};

export const questaoRepository = {
  async listar(): Promise<Questao[]> {
    const { data, error } = await supabase.from('questions').select('*').order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar questões: ${error.message}`);
    return data || [];
  },

  async listarPorAula(idAula: string): Promise<Questao[]> {
    const { data, error } = await supabase.from('questions').select('*').eq('lesson_id', idAula).order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar questões da aula: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Questao | null> {
    const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateQuestaoInput): Promise<Questao> {
    const { data, error } = await supabase.from('questions').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar questão: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateQuestaoInput>): Promise<Questao> {
    const { data, error } = await supabase.from('questions').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar questão: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar questão: ${error.message}`);
  }
};

// enrollments. O progresso é calculado pelo servidor ao finalizar tentativas.
// A nota do curso agora fica em avaliacaoRepository (reviews).
export const matriculaRepository = {
  async listar(): Promise<Matricula[]> {
    const { data, error } = await supabase.from('enrollments').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar matrículas: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Matricula[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('user_id', idUsuario)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar matrículas do usuário: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Matricula[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', idCurso)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar matrículas do curso: ${error.message}`);
    return data || [];
  },

  async obter(idCurso: string, idUsuario: string): Promise<Matricula | null> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario)
      .single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateMatriculaInput): Promise<Matricula> {
    const { data, error } = await supabase.from('enrollments').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar matrícula: ${error.message}`);
    return data;
  },

  // Atalho: matricula o usuário logado no curso.
  async matricular(idCurso: string): Promise<Matricula> {
    const idUsuario = await obterIdUsuarioAtual();
    return matriculaRepository.criar({ course_id: idCurso, user_id: idUsuario });
  },

  async atualizarStatus(idCurso: string, idUsuario: string, status: StatusMatricula): Promise<Matricula> {
    const { data, error } = await supabase
      .from('enrollments')
      .update({ status })
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar status da matrícula: ${error.message}`);
    return data;
  },

  // Recalcula o progresso (0 a 100) com base nas aulas concluídas. Retorna o novo valor.
  async recalcularProgresso(idUsuario: string, idCurso: string): Promise<number> {
    const { data, error } = await supabase.rpc('recompute_course_progress', { p_user_id: idUsuario, p_course_id: idCurso });
    if (error) throw new Error(`Erro ao recalcular progresso do curso: ${error.message}`);
    return Number(data ?? 0);
  },

  async deletar(idCurso: string, idUsuario: string): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario);
    if (error) throw new Error(`Erro ao deletar matrícula: ${error.message}`);
  }
};

// attempts. Uma tentativa pertence a uma aula e acontece no contexto de curso (course_id)
// ou de sala (room_id). XP, acertos e totais são calculados só por finalizar().
// Fluxo: criar() -> respostaRepository.salvar()/criarVarias() -> finalizar().
export const tentativaRepository = {
  async listar(): Promise<Tentativa[]> {
    const { data, error } = await supabase.from('attempts').select('*').order('started_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar tentativas: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Tentativa[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', idUsuario)
      .order('started_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar tentativas do usuário: ${error.message}`);
    return data || [];
  },

  async listarPorAula(idAula: string): Promise<Tentativa[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('lesson_id', idAula)
      .order('started_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar tentativas da aula: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Tentativa[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('course_id', idCurso)
      .order('started_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar tentativas do curso: ${error.message}`);
    return data || [];
  },

  async listarPorSala(idSala: string): Promise<Tentativa[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('room_id', idSala)
      .order('started_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar tentativas da sala: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Tentativa | null> {
    const { data, error } = await supabase.from('attempts').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateTentativaInput): Promise<Tentativa> {
    const { data, error } = await supabase.from('attempts').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar tentativa: ${error.message}`);
    return data;
  },

  // Atalho: inicia uma tentativa do usuário logado (curso OU sala).
  async iniciar(idAula: string, contexto: { idCurso?: string; idSala?: string } = {}): Promise<Tentativa> {
    const idUsuario = await obterIdUsuarioAtual();
    return tentativaRepository.criar({
      user_id: idUsuario,
      lesson_id: idAula,
      course_id: contexto.idCurso ?? null,
      room_id: contexto.idSala ?? null
    });
  },

  // Corrige todas as respostas no servidor, aplica XP/progresso/medalhas e retorna os totais.
  async finalizar(idTentativa: string): Promise<ResultadoTentativa> {
    const { data, error } = await supabase.rpc('finalize_attempt', { p_attempt_id: idTentativa });
    if (error) throw new Error(`Erro ao finalizar tentativa: ${error.message}`);
    const resultado = Array.isArray(data) ? data[0] : data;
    if (!resultado) throw new Error('Erro ao finalizar tentativa: resposta vazia.');
    return resultado;
  }
};

// answers. is_correct e xp_earned enviados pelo cliente são sobrescritos pela correção do servidor.
// Formatos de `submitted` por tipo de questão:
//   match: { pairs: [{ left, right }] }   multiple_choice: { selected: ['a', 'c'] }
//   fill_blank: { text: '...' }           sum_alternatives: { sum: 7 }
export const respostaRepository = {
  async listarPorTentativa(idTentativa: string): Promise<Resposta[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('attempt_id', idTentativa)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Erro ao listar respostas da tentativa: ${error.message}`);
    return data || [];
  },

  async listarPorQuestao(idQuestao: string): Promise<Resposta[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('question_id', idQuestao)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar respostas da questão: ${error.message}`);
    return data || [];
  },

  async obter(idTentativa: string, idQuestao: string): Promise<Resposta | null> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('attempt_id', idTentativa)
      .eq('question_id', idQuestao)
      .single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateRespostaInput): Promise<Resposta> {
    const { data, error } = await supabase.from('answers').insert(dados).select().single();
    if (error) throw new Error(`Erro ao registrar resposta: ${error.message}`);
    return data;
  },

  async criarVarias(dados: CreateRespostaInput[]): Promise<Resposta[]> {
    const { data, error } = await supabase.from('answers').insert(dados).select();
    if (error) throw new Error(`Erro ao registrar respostas: ${error.message}`);
    return data || [];
  },

  // Cria ou substitui a resposta da questão dentro da tentativa (única por tentativa + questão).
  async salvar(dados: CreateRespostaInput): Promise<Resposta> {
    const { data, error } = await supabase
      .from('answers')
      .upsert(dados, { onConflict: 'attempt_id,question_id' })
      .select()
      .single();
    if (error) throw new Error(`Erro ao salvar resposta: ${error.message}`);
    return data;
  }
};

// completions. As conclusões são gravadas pelo servidor em tentativaRepository.finalizar();
// o cliente só consulta (não existe permissão de insert).
export const concluiRepository = {
  async listar(): Promise<Conclui[]> {
    const { data, error } = await supabase.from('completions').select('*').order('completed_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar conclusões: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Conclui[]> {
    const { data, error } = await supabase
      .from('completions')
      .select('*')
      .eq('user_id', idUsuario)
      .order('completed_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar conclusões do usuário: ${error.message}`);
    return data || [];
  },

  async listarPorAula(idAula: string): Promise<Conclui[]> {
    const { data, error } = await supabase
      .from('completions')
      .select('*')
      .eq('lesson_id', idAula)
      .order('completed_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar conclusões da aula: ${error.message}`);
    return data || [];
  },

  async listarPorContexto(contexto: ContextoConclusao): Promise<Conclui[]> {
    const { data, error } = await supabase
      .from('completions')
      .select('*')
      .eq('context', contexto)
      .order('completed_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar conclusões do contexto: ${error.message}`);
    return data || [];
  },

  async obter(idUsuario: string, idAula: string, contexto: ContextoConclusao): Promise<Conclui | null> {
    const { data, error } = await supabase
      .from('completions')
      .select('*')
      .eq('user_id', idUsuario)
      .eq('lesson_id', idAula)
      .eq('context', contexto)
      .single();
    if (error) return null;
    return data;
  }
};

// room_members. xp_internal, progress e pac_internal valem só dentro da sala (nunca entram no XP global).
export const participaRepository = {
  async listar(): Promise<Participa[]> {
    const { data, error } = await supabase.from('room_members').select('*').order('xp_internal', { ascending: false });
    if (error) throw new Error(`Erro ao listar participações: ${error.message}`);
    return data || [];
  },

  // Membros ativos da sala, já ordenados como ranking interno.
  async listarPorSala(idSala: string): Promise<Participa[]> {
    const { data, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', idSala)
      .eq('status', 'active')
      .order('xp_internal', { ascending: false });
    if (error) throw new Error(`Erro ao listar membros da sala: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Participa[]> {
    const { data, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('user_id', idUsuario)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar salas do usuário: ${error.message}`);
    return data || [];
  },

  async obter(idUsuario: string, idSala: string): Promise<Participa | null> {
    const { data, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('user_id', idUsuario)
      .eq('room_id', idSala)
      .single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateParticipaInput): Promise<Participa> {
    const { data, error } = await supabase.from('room_members').insert(dados).select().single();
    if (error) throw new Error(`Erro ao registrar participação em sala: ${error.message}`);
    return data;
  },

  // Marca o membro como removido (mantém o histórico).
  async remover(idUsuario: string, idSala: string): Promise<Participa> {
    const { data, error } = await supabase
      .from('room_members')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('user_id', idUsuario)
      .eq('room_id', idSala)
      .select()
      .single();
    if (error) throw new Error(`Erro ao remover usuário da sala: ${error.message}`);
    return data;
  },

  async ehMembroAtivo(idSala: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_active_room_member', { p_room_id: idSala });
    if (error) throw new Error(`Erro ao verificar participação na sala: ${error.message}`);
    return data ?? false;
  },

  async ehMembro(idSala: string, idUsuario: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_room_member', { p_room_id: idSala, p_user_id: idUsuario });
    if (error) throw new Error(`Erro ao verificar participação na sala: ${error.message}`);
    return data ?? false;
  },

  async deletar(idUsuario: string, idSala: string): Promise<void> {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('user_id', idUsuario)
      .eq('room_id', idSala);
    if (error) throw new Error(`Erro ao remover usuário da sala: ${error.message}`);
  }
};

export const avisoRepository = {
  async listarPorSala(idSala: string): Promise<Aviso[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('room_id', idSala)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar avisos da sala: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Aviso | null> {
    const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateAvisoInput): Promise<Aviso> {
    const { data, error } = await supabase.from('announcements').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar aviso: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateAvisoInput>): Promise<Aviso> {
    const { data, error } = await supabase.from('announcements').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar aviso: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar aviso: ${error.message}`);
  }
};

export const missaoRepository = {
  async listarPorSala(idSala: string): Promise<Missao[]> {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('room_id', idSala)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar missões da sala: ${error.message}`);
    return data || [];
  },

  // Missoes publicadas e ainda no prazo. O RLS ja limita as salas do usuario logado.
  async listarAtivas(limite = 3): Promise<Missao[]> {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('status', 'published')
      .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(limite);
    if (error) throw new Error(`Erro ao listar missões ativas: ${error.message}`);
    return data || [];
  },


  async obterPorId(id: string): Promise<Missao | null> {
    const { data, error } = await supabase.from('missions').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateMissaoInput): Promise<Missao> {
    const { data, error } = await supabase.from('missions').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar missão: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateMissaoInput>): Promise<Missao> {
    const { data, error } = await supabase.from('missions').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar missão: ${error.message}`);
    return data;
  },

  // Avisa os membros da sala sobre a missão. Retorna quantos foram notificados.
  async notificarSala(id: string): Promise<number> {
    const { data, error } = await supabase.rpc('notify_room_mission', { p_mission_id: id });
    if (error) throw new Error(`Erro ao notificar missão: ${error.message}`);
    return data ?? 0;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar missão: ${error.message}`);
  }
};

export const progressoMissaoRepository = {
  async listarPorMissao(idMissao: string): Promise<ProgressoMissao[]> {
    const { data, error } = await supabase
      .from('mission_progress')
      .select('*')
      .eq('mission_id', idMissao)
      .order('progress', { ascending: false });
    if (error) throw new Error(`Erro ao listar progresso da missão: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<ProgressoMissao[]> {
    const { data, error } = await supabase
      .from('mission_progress')
      .select('*')
      .eq('user_id', idUsuario)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar progresso de missões do usuário: ${error.message}`);
    return data || [];
  },

  async obter(idMissao: string, idUsuario: string): Promise<ProgressoMissao | null> {
    const { data, error } = await supabase
      .from('mission_progress')
      .select('*')
      .eq('mission_id', idMissao)
      .eq('user_id', idUsuario)
      .single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateProgressoMissaoInput): Promise<ProgressoMissao> {
    const { data, error } = await supabase.from('mission_progress').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar progresso da missão: ${error.message}`);
    return data;
  },

  // Cria ou atualiza o progresso do usuário na missão.
  async salvar(dados: CreateProgressoMissaoInput): Promise<ProgressoMissao> {
    const { data, error } = await supabase
      .from('mission_progress')
      .upsert(dados, { onConflict: 'mission_id,user_id' })
      .select()
      .single();
    if (error) throw new Error(`Erro ao salvar progresso da missão: ${error.message}`);
    return data;
  },

  async atualizar(idMissao: string, idUsuario: string, dados: Partial<CreateProgressoMissaoInput>): Promise<ProgressoMissao> {
    const { data, error } = await supabase
      .from('mission_progress')
      .update(dados)
      .eq('mission_id', idMissao)
      .eq('user_id', idUsuario)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar progresso da missão: ${error.message}`);
    return data;
  },

  async deletar(idMissao: string, idUsuario: string): Promise<void> {
    const { error } = await supabase
      .from('mission_progress')
      .delete()
      .eq('mission_id', idMissao)
      .eq('user_id', idUsuario);
    if (error) throw new Error(`Erro ao deletar progresso da missão: ${error.message}`);
  }
};

// friendships. O requerente cria o pedido; o destinatário aceita ou recusa.
export const amizadeRepository = {
  async listar(): Promise<Amizade[]> {
    const { data, error } = await supabase.from('friendships').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar amizades: ${error.message}`);
    return data || [];
  },

  async listarPorStatus(status: StatusAmizade): Promise<Amizade[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar amizades por status: ${error.message}`);
    return data || [];
  },

  async listarAmigos(idUsuario: string): Promise<Amizade[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${idUsuario},addressee_id.eq.${idUsuario}`)
      .order('responded_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar amigos: ${error.message}`);
    return data || [];
  },

  async listarPedidosRecebidos(idUsuario: string): Promise<Amizade[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('addressee_id', idUsuario)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar pedidos recebidos: ${error.message}`);
    return data || [];
  },

  async listarPedidosEnviados(idUsuario: string): Promise<Amizade[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('requester_id', idUsuario)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar pedidos enviados: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Amizade | null> {
    const { data, error } = await supabase.from('friendships').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  // Amizade entre dois usuários, em qualquer direção.
  async obterEntre(idUsuarioA: string, idUsuarioB: string): Promise<Amizade | null> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${idUsuarioA},addressee_id.eq.${idUsuarioB}),and(requester_id.eq.${idUsuarioB},addressee_id.eq.${idUsuarioA})`
      )
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateAmizadeInput): Promise<Amizade> {
    const { data, error } = await supabase.from('friendships').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar pedido de amizade: ${error.message}`);
    return data;
  },

  // Atalho: o usuário logado envia um pedido e o destinatário recebe a notificação.
  async enviarPedido(idDestinatario: string): Promise<Amizade> {
    const idUsuario = await obterIdUsuarioAtual();
    const amizade = await amizadeRepository.criar({ requester_id: idUsuario, addressee_id: idDestinatario });
    await amizadeRepository.notificarPedido(amizade.id);
    return amizade;
  },

  async notificarPedido(idAmizade: string): Promise<string> {
    const { data, error } = await supabase.rpc('notify_friend_request', { p_friendship_id: idAmizade });
    if (error) throw new Error(`Erro ao notificar pedido de amizade: ${error.message}`);
    return data;
  },

  async responder(id: string, status: Extract<StatusAmizade, 'accepted' | 'declined'>): Promise<Amizade> {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao responder pedido de amizade: ${error.message}`);
    return data;
  },

  async cancelar(id: string): Promise<Amizade> {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao cancelar pedido de amizade: ${error.message}`);
    return data;
  },

  // Cutuca um amigo para estudar (notificação de lembrete).
  async enviarLembreteEstudo(idAmigo: string): Promise<string> {
    const { data, error } = await supabase.rpc('send_study_reminder', { p_friend_id: idAmigo });
    if (error) throw new Error(`Erro ao enviar lembrete de estudo: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('friendships').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar amizade: ${error.message}`);
  }
};

// notifications. O usuário só enxerga as próprias. A criação acontece no servidor
// (notify_* em salaRepository, missaoRepository, cursoRepository e amizadeRepository).
export const notificacaoRepository = {
  async listar(): Promise<Notificacao[]> {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar notificações: ${error.message}`);
    return data || [];
  },

  async listarNaoLidas(): Promise<Notificacao[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar notificações não lidas: ${error.message}`);
    return data || [];
  },

  async contarNaoLidas(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) throw new Error(`Erro ao contar notificações não lidas: ${error.message}`);
    return count ?? 0;
  },

  async obterPorId(id: string): Promise<Notificacao | null> {
    const { data, error } = await supabase.from('notifications').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async marcarComoLida(id: string): Promise<Notificacao> {
    const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao marcar notificação como lida: ${error.message}`);
    return data;
  },

  async marcarTodasComoLidas(): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) throw new Error(`Erro ao marcar notificações como lidas: ${error.message}`);
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar notificação: ${error.message}`);
  },

  async deletarLidas(): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('is_read', true);
    if (error) throw new Error(`Erro ao deletar notificações lidas: ${error.message}`);
  }
};

// medals: catálogo fixo do sistema (first_lesson, on_fire, bookworm, owl). Escrita só para admin.
export const medalhaRepository = {
  async listar(): Promise<Medalha[]> {
    const { data, error } = await supabase.from('medals').select('*').order('name', { ascending: true });
    if (error) throw new Error(`Erro ao listar medalhas: ${error.message}`);
    return data || [];
  },

  async obterPorCodigo(codigo: string): Promise<Medalha | null> {
    const { data, error } = await supabase.from('medals').select('*').eq('code', codigo).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateMedalhaInput): Promise<Medalha> {
    const { data, error } = await supabase.from('medals').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar medalha: ${error.message}`);
    return data;
  },

  async atualizar(codigo: string, dados: Partial<CreateMedalhaInput>): Promise<Medalha> {
    const { data, error } = await supabase.from('medals').update(dados).eq('code', codigo).select().single();
    if (error) throw new Error(`Erro ao atualizar medalha: ${error.message}`);
    return data;
  },

  async deletar(codigo: string): Promise<void> {
    const { error } = await supabase.from('medals').delete().eq('code', codigo);
    if (error) throw new Error(`Erro ao deletar medalha: ${error.message}`);
  }
};

// user_medals. As medalhas são concedidas pelo servidor; o usuário só escolhe quais destacar (máx. 3).
export const medalhaUsuarioRepository = {
  async listarPorUsuario(idUsuario: string): Promise<MedalhaUsuario[]> {
    const { data, error } = await supabase
      .from('user_medals')
      .select('*')
      .eq('user_id', idUsuario)
      .order('acquired_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar medalhas do usuário: ${error.message}`);
    return data || [];
  },

  async listarEmDestaque(idUsuario: string): Promise<MedalhaUsuario[]> {
    const { data, error } = await supabase
      .from('user_medals')
      .select('*')
      .eq('user_id', idUsuario)
      .eq('featured', true)
      .order('acquired_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar medalhas em destaque: ${error.message}`);
    return data || [];
  },

  async listarEmDestaquePorUsuarios(idsUsuarios: string[]): Promise<MedalhaUsuario[]> {
    if (idsUsuarios.length === 0) return [];
    const { data, error } = await supabase
      .from('user_medals')
      .select('*')
      .in('user_id', idsUsuarios)
      .eq('featured', true)
      .order('acquired_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar medalhas em destaque: ${error.message}`);
    return data || [];
  },

  async atualizarDestaque(id: string, emDestaque: boolean): Promise<MedalhaUsuario> {
    const { data, error } = await supabase.from('user_medals').update({ featured: emDestaque }).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar destaque da medalha: ${error.message}`);
    return data;
  }
};

// reviews: uma nota (0 a 5) por usuário por curso.
export const avaliacaoRepository = {
  // Todas as avaliações visíveis (usado para a nota média de cada curso no catálogo).
  async listar(): Promise<Avaliacao[]> {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar avaliações: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Avaliacao[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('course_id', idCurso)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar avaliações do curso: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Avaliacao[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', idUsuario)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar avaliações do usuário: ${error.message}`);
    return data || [];
  },

  async obter(idCurso: string, idUsuario: string): Promise<Avaliacao | null> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario)
      .single();
    if (error) return null;
    return data;
  },

  async obterMediaPorCurso(idCurso: string): Promise<{ media: number; total: number }> {
    const { data, error } = await supabase.from('reviews').select('rating').eq('course_id', idCurso);
    if (error) throw new Error(`Erro ao calcular média do curso: ${error.message}`);
    const notas = (data || []).map((avaliacao) => avaliacao.rating);
    const total = notas.length;
    const media = total > 0 ? notas.reduce((soma, nota) => soma + nota, 0) / total : 0;
    return { media, total };
  },

  async criar(dados: CreateAvaliacaoInput): Promise<Avaliacao> {
    const { data, error } = await supabase.from('reviews').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar avaliação: ${error.message}`);
    return data;
  },

  // Cria ou substitui a avaliação do usuário no curso.
  async salvar(dados: CreateAvaliacaoInput): Promise<Avaliacao> {
    const { data, error } = await supabase
      .from('reviews')
      .upsert(dados, { onConflict: 'user_id,course_id' })
      .select()
      .single();
    if (error) throw new Error(`Erro ao salvar avaliação: ${error.message}`);
    return data;
  },

  async atualizar(idCurso: string, idUsuario: string, dados: Partial<CreateAvaliacaoInput>): Promise<Avaliacao> {
    const { data, error } = await supabase
      .from('reviews')
      .update(dados)
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar avaliação: ${error.message}`);
    return data;
  },

  async deletar(idCurso: string, idUsuario: string): Promise<void> {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('course_id', idCurso)
      .eq('user_id', idUsuario);
    if (error) throw new Error(`Erro ao deletar avaliação: ${error.message}`);
  }
};

// comments: comentários em curso ou aula; parent_id forma as respostas encadeadas.
export const comentarioRepository = {
  async listarPorCurso(idCurso: string): Promise<Comentario[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('course_id', idCurso)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Erro ao listar comentários do curso: ${error.message}`);
    return data || [];
  },

  async listarPorAula(idAula: string): Promise<Comentario[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('lesson_id', idAula)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Erro ao listar comentários da aula: ${error.message}`);
    return data || [];
  },

  async listarRespostas(idComentario: string): Promise<Comentario[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('parent_id', idComentario)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Erro ao listar respostas do comentário: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Comentario | null> {
    const { data, error } = await supabase.from('comments').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateComentarioInput): Promise<Comentario> {
    const { data, error } = await supabase.from('comments').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar comentário: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateComentarioInput>): Promise<Comentario> {
    const { data, error } = await supabase.from('comments').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar comentário: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar comentário: ${error.message}`);
  }
};

export const notebookRepository = {
  async listar(): Promise<Notebook[]> {
    const { data, error } = await supabase.from('notebooks').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar notebooks: ${error.message}`);
    return data || [];
  },

  async listarPorUsuario(idUsuario: string): Promise<Notebook[]> {
    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', idUsuario)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao listar notebooks do usuário: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Notebook | null> {
    const { data, error } = await supabase.from('notebooks').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateNotebookInput): Promise<Notebook> {
    const { data, error } = await supabase.from('notebooks').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar notebook: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateNotebookInput>): Promise<Notebook> {
    const { data, error } = await supabase.from('notebooks').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar notebook: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('notebooks').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar notebook: ${error.message}`);
  }
};

// notebook_pages (páginas do caderno, ordenadas por position).
export const anotacoesRepository = {
  async listarPorNotebook(idNotebook: string): Promise<Anotacoes[]> {
    const { data, error } = await supabase
      .from('notebook_pages')
      .select('*')
      .eq('notebook_id', idNotebook)
      .order('position', { ascending: true });
    if (error) throw new Error(`Erro ao listar anotações: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Anotacoes | null> {
    const { data, error } = await supabase.from('notebook_pages').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateAnotacoesInput): Promise<Anotacoes> {
    const { data, error } = await supabase.from('notebook_pages').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar anotação: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateAnotacoesInput>): Promise<Anotacoes> {
    const { data, error } = await supabase.from('notebook_pages').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar anotação: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('notebook_pages').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar anotação: ${error.message}`);
  }
};

// Rankings (somente leitura). Não existe ranking semanal: o global é por XP acumulado.
export const rankingRepository = {
  async listarGlobal(limite = 50): Promise<RankingGlobal[]> {
    const { data, error } = await supabase
      .from('global_ranking')
      .select('*')
      .order('position', { ascending: true })
      .limit(limite);
    if (error) throw new Error(`Erro ao listar ranking global: ${error.message}`);
    return data || [];
  },

  async obterPosicaoDoUsuario(idUsuario: string): Promise<RankingGlobal | null> {
    const { data, error } = await supabase.from('global_ranking').select('*').eq('user_id', idUsuario).single();
    if (error) return null;
    return data;
  },

  // PAC e divisão do usuário logado e dos amigos aceitos em um curso (só tentativas de curso).
  async listarAmigosPorCurso(idCurso: string): Promise<RankingAmigosCurso[]> {
    const { data, error } = await supabase.rpc('friends_course_pac', { p_course_id: idCurso });
    if (error) throw new Error(`Erro ao listar ranking de amigos do curso: ${error.message}`);
    return data || [];
  },

  // Ranking interno da sala (por xp_internal).
  async listarPorSala(idSala: string): Promise<Participa[]> {
    return participaRepository.listarPorSala(idSala);
  }
};

// Regras de domínio calculadas no banco (XP, nível, PAC, divisão e correção de respostas).
export const dominioRepository = {
  async concluirAulaSemQuestoes(idAula: string): Promise<void> {
    const { error } = await supabase.rpc('complete_empty_lesson', { p_lesson_id: idAula });
    if (error) throw new Error(`Erro ao concluir aula sem questões: ${error.message}`);
  },

  async xpPorTipoQuestao(tipo: TipoQuestao): Promise<number> {
    const { data, error } = await supabase.rpc('xp_from_question', { p_type: tipo });
    if (error) throw new Error(`Erro ao obter XP do tipo de questão: ${error.message}`);
    return data ?? 0;
  },

  async nivelPorXp(xp: number): Promise<number> {
    const { data, error } = await supabase.rpc('level_for_xp', { p_xp: xp });
    if (error) throw new Error(`Erro ao calcular nível: ${error.message}`);
    return data ?? 1;
  },

  async calcularPac(acertos: number, total: number): Promise<number> {
    const { data, error } = await supabase.rpc('pac', { p_correct: acertos, p_total: total });
    if (error) throw new Error(`Erro ao calcular PAC: ${error.message}`);
    return Number(data ?? 0);
  },

  async divisaoPorPac(pac: number): Promise<string> {
    const { data, error } = await supabase.rpc('division_for_pac', { p_pac: pac });
    if (error) throw new Error(`Erro ao obter divisão: ${error.message}`);
    return data ?? '';
  },

  async normalizarRespostaLacuna(texto: string): Promise<string> {
    const { data, error } = await supabase.rpc('normalize_fill_blank', { p_text: texto });
    if (error) throw new Error(`Erro ao normalizar resposta: ${error.message}`);
    return data ?? '';
  },

  // Simula a correção de uma resposta sem gravar nada (a correção oficial é tentativaRepository.finalizar).
  async corrigirResposta(tipo: TipoQuestao, config: Json, resposta: Json, xpValor: number): Promise<ResultadoCorrecao> {
    const { data, error } = await supabase.rpc('grade_answer', {
      p_type: tipo,
      p_config: config,
      p_submitted: resposta,
      p_xp_value: xpValor
    });
    if (error) throw new Error(`Erro ao corrigir resposta: ${error.message}`);
    const resultado = Array.isArray(data) ? data[0] : data;
    if (!resultado) throw new Error('Erro ao corrigir resposta: resposta vazia.');
    return resultado;
  },

  async ehAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) throw new Error(`Erro ao verificar permissão de admin: ${error.message}`);
    return data ?? false;
  }
};
