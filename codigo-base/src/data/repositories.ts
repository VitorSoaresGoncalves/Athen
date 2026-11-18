import { supabase } from '../lib/supabase';
import type { Database, Json as ValorJson } from '../types/database';

// Contratos derivados dos tipos gerados do schema public.
// Origem e comando de geração: docs/banco-de-dados/documentacao-bd.md.

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
type FunctionReturn<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]['Returns'];
type Json = Database['public']['Tables']['questions']['Row']['config'];

// entidades do banco

type Usuario = Tables<'profiles'>;
type CreateUsuarioInput = TablesInsert<'profiles'>;
type UpdateUsuarioInput = Partial<Pick<Usuario,
  'username' | 'display_name' | 'bio' | 'avatar_url' | 'banner_url' | 'notification_preferences'>>;
type BuscaUsuario = FunctionReturn<'search_profiles'>[number];

type Curso = Tables<'courses'>;
type CatalogoCursoMetricas = FunctionReturn<'catalog_course_feed'>[number];
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

// Temporadas competitivas (migrações 0026–0029).
type TemporadaAtual = FunctionReturn<'current_season'>[number];
type ResumoTemporada = FunctionReturn<'my_season_summary'>[number];
type GrupoTemporada = FunctionReturn<'my_season_group'>[number];
type ClassificacaoTemporada = FunctionReturn<'my_season_standings'>[number];
type HistoricoTemporada = FunctionReturn<'my_season_history'>[number];

// Missões globais/curso para a UI (migração 0031).
type MissaoGlobal = FunctionReturn<'my_missions'>[number];
type DetalheMissaoGlobal = FunctionReturn<'my_mission_detail'>[number];

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

// Estatísticas da sala para o educador (migração 0042).
type EstatisticasSalaGeral = FunctionReturn<'room_stats_overview'>[number];
type EstatisticasSalaAluno = FunctionReturn<'room_stats_students'>[number];
type EstatisticasSalaModulo = FunctionReturn<'room_stats_modules'>[number];
type QuestaoMaisErrada = FunctionReturn<'room_stats_hard_questions'>[number];


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

  async atualizar(id: string, dados: UpdateUsuarioInput): Promise<Usuario> {
    const { data, error } = await supabase.from('profiles').update(dados).eq('id', id).select().single();
    if (error) throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    return data;
  },

  // Preferências no formato { pedido_amizade: true, missao: false, ... } (chave ausente = ativada).
  async atualizarPreferenciasNotificacao(id: string, preferencias: Record<string, ValorJson | undefined>): Promise<Usuario> {
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

  // Métricas por curso publicado para os carrosséis do catálogo (nota ponderada,
  // matrículas dos últimos 7 dias e recomendação do usuário logado). Regras em
  // supabase/migrations/0047_catalog_course_feed.sql.
  async listarMetricasCatalogo(): Promise<CatalogoCursoMetricas[]> {
    const { data, error } = await supabase.rpc('catalog_course_feed');
    if (error) throw new Error(`Erro ao carregar métricas do catálogo: ${error.message}`);
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

  // Estatísticas do pop-up do educador. Só o educador da sala consegue chamar.
  async estatisticasGerais(idSala: string): Promise<EstatisticasSalaGeral | null> {
    const { data, error } = await supabase.rpc('room_stats_overview', { p_room_id: idSala });
    if (error) throw new Error(`Erro ao carregar visão geral da sala: ${error.message}`);
    return data?.[0] ?? null;
  },
  
  async estatisticasAlunos(idSala: string): Promise<EstatisticasSalaAluno[]> {
    const { data, error } = await supabase.rpc('room_stats_students', { p_room_id: idSala });
    if (error) throw new Error(`Erro ao carregar alunos da sala: ${error.message}`);
    return data || [];
  },
  
  async estatisticasModulos(idSala: string): Promise<EstatisticasSalaModulo[]> {
    const { data, error } = await supabase.rpc('room_stats_modules', { p_room_id: idSala });
    if (error) throw new Error(`Erro ao carregar conclusão por módulo: ${error.message}`);
    return data || [];
  },
  
  async questoesMaisErradas(idSala: string): Promise<QuestaoMaisErrada[]> {
    const { data, error } = await supabase.rpc('room_stats_hard_questions', { p_room_id: idSala });
    if (error) throw new Error(`Erro ao carregar questões com mais erros: ${error.message}`);
    return data || [];
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

// Revisão de curso: DTOs oficiais da revisão 2. Não reutiliza tentativas/aulas.
export type RespostaRevisao =
  | { selected: string[] }
  | { text: string }
  | { sum: number }
  | { pairs: { left: string; right: string }[] };

export type ResultadoRevisao = {
  session_id: string;
  correct_count: number;
  total_count: number;
  approved: boolean;
  bonus_earned: number;
  bonus_outcome: 'not_applicable' | 'below_target' | 'awarded' | 'already_awarded';
  xp_event_id: string | null;
  finished_at: string;
};

export type UltimaRevisaoCurso = {
  course_id: string;
  mode: 'normal' | 'bonus';
  result: ResultadoRevisao;
};

export type ItemRevisao = {
  question_id: string;
  ordinal: number;
  module_id: string;
  module_title: string;
  lesson_id: string;
  type: TipoQuestao;
  prompt: string;
  config: Json;
  explanation: string | null;
  submitted: RespostaRevisao | null;
  is_correct: boolean | null;
};

export type SessaoRevisao = {
  session_id: string;
  course_id: string;
  course_title: string;
  mode: 'normal' | 'bonus';
  occurrence_id: string | null;
  expires_at: string | null;
  bonus_xp: number;
  finished_at: string | null;
  result: ResultadoRevisao | null;
  items: ItemRevisao[];
};

export type OcorrenciaRevisao = {
  occurrence_id: string;
  period_index: number;
  course_id: string | null;
  course_title: string | null;
  state: 'available' | 'no_candidates' | 'unavailable' | 'expired' | 'claimed';
  due_at: string;
  expires_at: string;
  bonus_xp: number;
  delivery_state: 'not_applicable' | 'pending' | 'delivered' | 'suppressed' | 'failed';
  resume_session_id: string | null;
  last_finished_session_id: string | null;
  reward_session_id: string | null;
  rewarded_at: string | null;
};

export type DisponibilidadeRevisao = {
  course_id: string;
  course_title: string;
  can_review: boolean;
  reason: string | null;
  question_count: number;
  sample_count: number;
  module_counts: { module_id: string; question_count: number; sample_count: number }[];
};

export type FeedbackRespostaRevisao = {
  question_id: string;
  is_correct: boolean;
  answered_count: number;
  total_count: number;
};

const MENSAGENS_REVISAO: Record<string, string> = {
  REVIEW_FORBIDDEN: 'Você não tem acesso a esta revisão.',
  REVIEW_INVALID_INPUT: 'Os dados enviados para a revisão são inválidos.',
  REVIEW_NOT_ELIGIBLE: 'Conclua todas as aulas atuais no contexto individual para revisar este curso.',
  REVIEW_EMPTY: 'Este curso não tem questões para revisão.',
  REVIEW_OCCURRENCE_EXPIRED: 'O prazo desta revisão com bônus terminou.',
  REVIEW_OCCURRENCE_UNAVAILABLE: 'Esta revisão com bônus não está disponível.',
  REVIEW_BONUS_ALREADY_AWARDED: 'O bônus deste período já foi recebido.',
  REVIEW_INCOMPLETE: 'Responda todas as questões antes de finalizar a revisão.',
  REVIEW_ANSWER_LOCKED: 'A resposta desta questão já foi registrada e não pode ser alterada.',
  REVIEW_FINISHED: 'Esta revisão já foi finalizada.',
  REVIEW_REQUEST_CONFLICT: 'Este pedido já foi usado para iniciar outra revisão.',
};

export class ErroRevisao extends Error {
  readonly code: string;
  readonly reason: string;
  constructor(code: string, reason: string, message: string) {
    super(message);
    this.name = 'ErroRevisao';
    this.code = code;
    this.reason = reason;
  }
}

function respostaRevisaoInvalida(): never {
  throw new ErroRevisao('REVIEW_INVALID_RESPONSE', 'REVIEW_INVALID_RESPONSE',
    'O servidor retornou dados de revisão inválidos. Tente novamente.');
}

function ehObjetoRevisao(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objetoRevisao(value: unknown): Record<string, unknown> {
  if (!ehObjetoRevisao(value)) return respostaRevisaoInvalida();
  return value;
}

function textoRevisao(value: unknown): string {
  if (typeof value !== 'string') return respostaRevisaoInvalida();
  return value;
}

function idRevisao(value: unknown): string {
  const text = textoRevisao(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return respostaRevisaoInvalida();
  return text;
}

function dataRevisao(value: unknown): string {
  const text = textoRevisao(value);
  if (!Number.isFinite(Date.parse(text))) return respostaRevisaoInvalida();
  return text;
}

function numeroRevisao(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return respostaRevisaoInvalida();
  return value;
}

function booleanoRevisao(value: unknown): boolean {
  if (typeof value !== 'boolean') return respostaRevisaoInvalida();
  return value;
}

function nuloRevisao<T>(value: unknown, parse: (input: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

function listaRevisao<T>(value: unknown, parse: (input: unknown) => T): T[] {
  if (!Array.isArray(value)) return respostaRevisaoInvalida();
  return value.map((item: unknown) => parse(item));
}

function opcaoRevisao<const T extends string>(value: unknown, choices: readonly T[]): T {
  const found = choices.find(choice => choice === value);
  return found ?? respostaRevisaoInvalida();
}

function objetoJsonRevisao(value: unknown): Record<string, ValorJson> {
  return Object.fromEntries(Object.entries(objetoRevisao(value)).map(([key, item]) => [key, jsonRevisao(item)]));
}

function jsonRevisao(value: unknown): ValorJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item: unknown) => jsonRevisao(item));
  return objetoJsonRevisao(value);
}

function lerRespostaRevisao(value: unknown, type: TipoQuestao): RespostaRevisao {
  const row = objetoRevisao(value);
  switch (type) {
    case 'multiple_choice': return { selected: listaRevisao(row.selected, textoRevisao) };
    case 'fill_blank': return { text: textoRevisao(row.text) };
    case 'sum_alternatives':
      if (typeof row.sum !== 'number' || !Number.isFinite(row.sum)) return respostaRevisaoInvalida();
      return { sum: row.sum };
    case 'match': return { pairs: listaRevisao(row.pairs, pair => {
      const item = objetoRevisao(pair);
      return { left: textoRevisao(item.left), right: textoRevisao(item.right) };
    }) };
  }
}

function lerResultadoRevisao(value: unknown): ResultadoRevisao {
  const row = objetoRevisao(value);
  const result: ResultadoRevisao = {
    session_id: idRevisao(row.session_id),
    correct_count: numeroRevisao(row.correct_count),
    total_count: numeroRevisao(row.total_count),
    approved: booleanoRevisao(row.approved),
    bonus_earned: numeroRevisao(row.bonus_earned),
    bonus_outcome: opcaoRevisao(row.bonus_outcome, ['not_applicable', 'below_target', 'awarded', 'already_awarded']),
    xp_event_id: nuloRevisao(row.xp_event_id, idRevisao),
    finished_at: dataRevisao(row.finished_at),
  };
  if (result.total_count === 0 || result.correct_count > result.total_count
    || (result.bonus_outcome === 'awarded'
      ? result.bonus_earned !== 10 || result.xp_event_id === null || !result.approved
      : result.bonus_earned !== 0 || result.xp_event_id !== null)) return respostaRevisaoInvalida();
  return result;
}

function lerItemRevisao(value: unknown): ItemRevisao {
  const row = objetoRevisao(value);
  const type = opcaoRevisao(row.type, ['multiple_choice', 'fill_blank', 'sum_alternatives', 'match']);
  const item: ItemRevisao = {
    question_id: idRevisao(row.question_id),
    ordinal: numeroRevisao(row.ordinal),
    module_id: idRevisao(row.module_id),
    module_title: textoRevisao(row.module_title),
    lesson_id: idRevisao(row.lesson_id),
    type,
    prompt: textoRevisao(row.prompt),
    config: objetoJsonRevisao(row.config),
    explanation: nuloRevisao(row.explanation, textoRevisao),
    submitted: nuloRevisao(row.submitted, submitted => lerRespostaRevisao(submitted, type)),
    is_correct: nuloRevisao(row.is_correct, booleanoRevisao),
  };
  if ((item.submitted === null) !== (item.is_correct === null)) return respostaRevisaoInvalida();
  return item;
}

function lerSessaoRevisao(value: unknown): SessaoRevisao {
  const row = objetoRevisao(value);
  const session: SessaoRevisao = {
    session_id: idRevisao(row.session_id),
    course_id: idRevisao(row.course_id),
    course_title: textoRevisao(row.course_title),
    mode: opcaoRevisao(row.mode, ['normal', 'bonus']),
    occurrence_id: nuloRevisao(row.occurrence_id, idRevisao),
    expires_at: nuloRevisao(row.expires_at, dataRevisao),
    bonus_xp: numeroRevisao(row.bonus_xp),
    finished_at: nuloRevisao(row.finished_at, dataRevisao),
    result: nuloRevisao(row.result, lerResultadoRevisao),
    items: listaRevisao(row.items, lerItemRevisao),
  };
  if (session.items.length === 0 || new Set(session.items.map(item => item.question_id)).size !== session.items.length
    || session.items.some((item, index) => item.ordinal !== index + 1)
    || (session.mode === 'normal'
      ? session.occurrence_id !== null || session.expires_at !== null || session.bonus_xp !== 0
      : session.occurrence_id === null || session.expires_at === null || session.bonus_xp !== 10)
    || (session.finished_at === null) !== (session.result === null)
    || (session.result !== null && (session.result.session_id !== session.session_id
      || session.result.total_count !== session.items.length
      || Date.parse(session.result.finished_at) !== Date.parse(session.finished_at ?? '')
      || session.items.some(item => item.submitted === null)
      || (session.mode === 'normal') !== (session.result.bonus_outcome === 'not_applicable')))) {
    return respostaRevisaoInvalida();
  }
  return session;
}

function lerOcorrenciaRevisao(value: unknown): OcorrenciaRevisao {
  const row = objetoRevisao(value);
  const occurrence: OcorrenciaRevisao = {
    occurrence_id: idRevisao(row.occurrence_id),
    period_index: numeroRevisao(row.period_index),
    course_id: nuloRevisao(row.course_id, idRevisao),
    course_title: nuloRevisao(row.course_title, textoRevisao),
    state: opcaoRevisao(row.state, ['available', 'no_candidates', 'unavailable', 'expired', 'claimed']),
    due_at: dataRevisao(row.due_at),
    expires_at: dataRevisao(row.expires_at),
    bonus_xp: numeroRevisao(row.bonus_xp),
    delivery_state: opcaoRevisao(row.delivery_state, ['not_applicable', 'pending', 'delivered', 'suppressed', 'failed']),
    resume_session_id: nuloRevisao(row.resume_session_id, idRevisao),
    last_finished_session_id: nuloRevisao(row.last_finished_session_id, idRevisao),
    reward_session_id: nuloRevisao(row.reward_session_id, idRevisao),
    rewarded_at: nuloRevisao(row.rewarded_at, dataRevisao),
  };
  if (occurrence.period_index < 1 || Date.parse(occurrence.expires_at) <= Date.parse(occurrence.due_at)
    || (occurrence.course_id === null ? occurrence.bonus_xp !== 0 || occurrence.course_title !== null
      : occurrence.bonus_xp !== 10 || occurrence.course_title === null)
    || (occurrence.reward_session_id === null) !== (occurrence.rewarded_at === null)
    || (occurrence.state === 'claimed') !== (occurrence.reward_session_id !== null)) return respostaRevisaoInvalida();
  return occurrence;
}

function lerDisponibilidadeRevisao(value: unknown): DisponibilidadeRevisao {
  const row = objetoRevisao(value);
  return {
    course_id: idRevisao(row.course_id),
    course_title: textoRevisao(row.course_title),
    can_review: booleanoRevisao(row.can_review),
    reason: nuloRevisao(row.reason, textoRevisao),
    question_count: numeroRevisao(row.question_count),
    sample_count: numeroRevisao(row.sample_count),
    module_counts: listaRevisao(row.module_counts, module => {
      const item = objetoRevisao(module);
      return { module_id: idRevisao(item.module_id), question_count: numeroRevisao(item.question_count),
        sample_count: numeroRevisao(item.sample_count) };
    }),
  };
}

function traduzirErroRevisao(error: unknown): ErroRevisao {
  if (error instanceof ErroRevisao) return error;
  const row = typeof error === 'object' && error !== null ? error : {};
  const code = 'code' in row && typeof row.code === 'string' ? row.code : 'REVIEW_REQUEST_FAILED';
  const reason = 'message' in row && typeof row.message === 'string' ? row.message : '';
  return new ErroRevisao(code, reason, MENSAGENS_REVISAO[reason]
    ?? 'Não foi possível carregar ou salvar a revisão. Tente novamente.');
}

async function linhaRpcRevisao<T>(request: PromiseLike<{
  data: T[] | null; error: { code: string; message: string } | null;
}>, optional = false): Promise<T | null> {
  let response;
  try {
    response = await request;
  } catch (error) {
    throw traduzirErroRevisao(error);
  }
  if (response.error) throw traduzirErroRevisao(response.error);
  // Só a consulta da ocorrência atual admite zero linhas, nunca null/ausência.
  if (!Array.isArray(response.data) || response.data.length > 1
    || (!optional && response.data.length !== 1)) return respostaRevisaoInvalida();
  if (response.data.length === 0) return null;
  const row = response.data[0];
  if (row === null || row === undefined) return respostaRevisaoInvalida();
  return row;
}

export const revisaoRepository = {
  async obterUltimaFinalizada(cursoId: string): Promise<UltimaRevisaoCurso | null> {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Entre na sua conta para consultar a última revisão.');
    const { data, error } = await supabase.from('course_review_sessions')
      .select('id,user_id,course_id,mode,finished_at,correct_count,total_count,approved,bonus_earned,bonus_outcome,xp_event_id')
      .eq('user_id', auth.user.id).eq('course_id', cursoId).not('finished_at', 'is', null)
      .order('finished_at', { ascending: false }).order('id', { ascending: false }).limit(1);
    if (error) throw traduzirErroRevisao(error);
    if (!Array.isArray(data) || data.length > 1) return respostaRevisaoInvalida();
    if (data.length === 0) return null;
    const row = objetoRevisao(data[0]);
    if (idRevisao(row.user_id) !== auth.user.id || idRevisao(row.course_id) !== cursoId) return respostaRevisaoInvalida();
    const mode = opcaoRevisao(row.mode, ['normal', 'bonus']);
    const result = lerResultadoRevisao({ ...row, session_id: row.id });
    if ((mode === 'normal') !== (result.bonus_outcome === 'not_applicable')) return respostaRevisaoInvalida();
    return { course_id: cursoId, mode, result };
  },
  async obterDisponibilidade(cursoId: string): Promise<DisponibilidadeRevisao> {
    const row = lerDisponibilidadeRevisao(await linhaRpcRevisao(supabase.rpc('course_review_status', { p_course_id: cursoId })));
    if (row.course_id.toLowerCase() !== cursoId.toLowerCase()) return respostaRevisaoInvalida();
    return row;
  },
  async obterOcorrenciaAtual(): Promise<OcorrenciaRevisao | null> {
    const row = await linhaRpcRevisao(supabase.rpc('my_current_course_review'), true);
    return row === null ? null : lerOcorrenciaRevisao(row);
  },
  async obterOcorrencia(ocorrenciaId: string): Promise<OcorrenciaRevisao> {
    const row = lerOcorrenciaRevisao(await linhaRpcRevisao(supabase.rpc('my_course_review_occurrence', { p_occurrence_id: ocorrenciaId })));
    if (row.occurrence_id.toLowerCase() !== ocorrenciaId.toLowerCase()) return respostaRevisaoInvalida();
    return row;
  },
  async iniciar({ cursoId, ocorrenciaId, requestId }: {
    cursoId: string; ocorrenciaId?: string; requestId: string;
  }): Promise<SessaoRevisao> {
    const row = lerSessaoRevisao(await linhaRpcRevisao(supabase.rpc('start_course_review', {
      p_course_id: cursoId, p_request_id: requestId,
      ...(ocorrenciaId === undefined ? {} : { p_occurrence_id: ocorrenciaId }),
    })));
    if (row.course_id.toLowerCase() !== cursoId.toLowerCase()
      || row.occurrence_id?.toLowerCase() !== ocorrenciaId?.toLowerCase()
      || row.mode !== (ocorrenciaId === undefined ? 'normal' : 'bonus')) return respostaRevisaoInvalida();
    return row;
  },
  async obter(sessaoId: string): Promise<SessaoRevisao> {
    const row = lerSessaoRevisao(await linhaRpcRevisao(supabase.rpc('my_course_review', { p_session_id: sessaoId })));
    if (row.session_id.toLowerCase() !== sessaoId.toLowerCase()) return respostaRevisaoInvalida();
    return row;
  },
  async salvarResposta(sessaoId: string, questaoId: string, submitted: RespostaRevisao): Promise<FeedbackRespostaRevisao> {
    const row = objetoRevisao(await linhaRpcRevisao(supabase.rpc('submit_course_review_answer', {
      p_session_id: sessaoId, p_question_id: questaoId, p_submitted: submitted,
    })));
    const feedback = { question_id: idRevisao(row.question_id), is_correct: booleanoRevisao(row.is_correct),
      answered_count: numeroRevisao(row.answered_count), total_count: numeroRevisao(row.total_count) };
    if (feedback.question_id.toLowerCase() !== questaoId.toLowerCase() || feedback.answered_count > feedback.total_count
      || feedback.total_count === 0) return respostaRevisaoInvalida();
    return feedback;
  },
  async finalizar(sessaoId: string): Promise<ResultadoRevisao> {
    const result = lerResultadoRevisao(await linhaRpcRevisao(supabase.rpc('finalize_course_review', { p_session_id: sessaoId })));
    if (result.session_id.toLowerCase() !== sessaoId.toLowerCase()) return respostaRevisaoInvalida();
    return result;
  },
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
    const { data, error } = await supabase.from('notifications').delete().eq('id', id).select('id');
    if (error) throw new Error(`Erro ao deletar notificação: ${error.message}`);
    if (!data?.some(row => row.id === id)) throw new Error('Notificação não encontrada ou sem permissão para remover.');
  },

  async deletarLidas(): Promise<string[]> {
    const { data, error } = await supabase.from('notifications').delete().eq('is_read', true).select('id');
    if (error) throw new Error(`Erro ao deletar notificações lidas: ${error.message}`);
    return (data ?? []).map(row => row.id);
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

// Temporadas competitivas (ligas globais por XP). Leituras expostas pelas
// migrações 0028–0029; a formação/fechamento é operação de autoridade no banco.
export const temporadaRepository = {
  // Temporada corrente (janela contém agora) ou null se não houver nenhuma ativa.
  async atual(): Promise<TemporadaAtual | null> {
    const { data, error } = await supabase.rpc('current_season');
    if (error) throw new Error(`Erro ao obter a temporada atual: ${error.message}`);
    return data?.[0] ?? null;
  },

  // Resumo pessoal do usuário logado numa temporada (categoria, grupo, XP, posição).
  async meuResumo(idTemporada: string): Promise<ResumoTemporada | null> {
    const { data, error } = await supabase.rpc('my_season_summary', { p_season_id: idTemporada });
    if (error) throw new Error(`Erro ao obter o resumo da temporada: ${error.message}`);
    return data?.[0] ?? null;
  },

  // Classificação do próprio grupo do usuário na temporada (só o próprio grupo).
  async meuGrupo(idTemporada: string): Promise<GrupoTemporada[]> {
    const { data, error } = await supabase.rpc('my_season_group', { p_season_id: idTemporada });
    if (error) throw new Error(`Erro ao obter o grupo da temporada: ${error.message}`);
    return data ?? [];
  },

  // XP corrente e projeções calculados pelo servidor para o próprio grupo.
  async minhaClassificacao(idTemporada: string): Promise<ClassificacaoTemporada[]> {
    const { data, error } = await supabase.rpc('my_season_standings', { p_season_id: idTemporada });
    if (error) throw new Error(`Erro ao obter a classificação da temporada: ${error.message}`);
    return data ?? [];
  },

  // Histórico próprio das temporadas do usuário (mais recentes primeiro).
  async meuHistorico(limite = 20): Promise<HistoricoTemporada[]> {
    const { data, error } = await supabase.rpc('my_season_history', { p_limit: limite });
    if (error) throw new Error(`Erro ao obter o histórico de temporadas: ${error.message}`);
    return data ?? [];
  }
};

// Missões globais e diárias de curso do usuário (migração 0031). Distinto do
// missaoRepository, que trata as missões de SALA.
export const missaoGlobalRepository = {
  // Missões do período corrente do usuário logado (globais + diárias de curso),
  // com progresso. Materializa as globais do período no servidor antes de ler.
  async minhas(): Promise<MissaoGlobal[]> {
    const { data, error } = await supabase.rpc('my_missions');
    if (error) throw new Error(`Erro ao listar missões: ${error.message}`);
    return data ?? [];
  },

  // Detalhe de uma ocorrência de missão.
  async detalhe(idOcorrencia: string): Promise<DetalheMissaoGlobal | null> {
    const { data, error } = await supabase.rpc('my_mission_detail', { p_occurrence_id: idOcorrencia });
    if (error) throw new Error(`Erro ao obter o detalhe da missão: ${error.message}`);
    return data?.[0] ?? null;
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
