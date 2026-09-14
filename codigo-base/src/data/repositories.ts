import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];

type Usuario = Tables<'Usuario'>;
type CreateUsuarioInput = TablesInsert<'Usuario'>;

type Curso = Tables<'Curso'>;
type CreateCursoInput = TablesInsert<'Curso'>;

type Sala = Tables<'Sala'>;
type CreateSalaInput = TablesInsert<'Sala'>;

type Modulo = Tables<'Modulo'>;
type CreateModuloInput = TablesInsert<'Modulo'>;

type Aula = Tables<'Aula'>;
type CreateAulaInput = TablesInsert<'Aula'>;

type Questao = Tables<'Questao'>;
type CreateQuestaoInput = TablesInsert<'Questao'>;

type Matricula = Tables<'matricula'>;
type CreateMatriculaInput = TablesInsert<'matricula'>;

type Participa = Tables<'participa'>;
type CreateParticipaInput = TablesInsert<'participa'>;

type Conclui = Tables<'conclui'>;
type CreateConcluiInput = TablesInsert<'conclui'>;

type Notebook = Tables<'Notebook'>;
type CreateNotebookInput = TablesInsert<'Notebook'>;

type Anotacoes = Tables<'Anotacoes'>;
type CreateAnotacoesInput = TablesInsert<'Anotacoes'>;

export const usuarioRepository = {
  async listar(): Promise<Usuario[]> {
    const { data, error } = await supabase.from('Usuario').select('*').order('Data_Criacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar usuários: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase.from('Usuario').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateUsuarioInput): Promise<Usuario> {
    const { data, error } = await supabase.from('Usuario').insert([dados]).select().single();
    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateUsuarioInput>): Promise<Usuario> {
    const { data, error } = await supabase.from('Usuario').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Usuario').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar usuário: ${error.message}`);
  }
};

export const cursoRepository = {
  async listar(): Promise<Curso[]> {
    const { data, error } = await supabase.from('Curso').select('*').order('Data_Criacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar cursos: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Curso | null> {
    const { data, error } = await supabase.from('Curso').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateCursoInput): Promise<Curso> {
    const { data, error } = await supabase.from('Curso').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar curso: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateCursoInput>): Promise<Curso> {
    const { data, error } = await supabase.from('Curso').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar curso: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Curso').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar curso: ${error.message}`);
  }
};

export const salaRepository = {
  async listar(): Promise<Sala[]> {
    const { data, error } = await supabase.from('Sala').select('*').order('Data_Criacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar salas: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Sala | null> {
    const { data, error } = await supabase.from('Sala').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateSalaInput): Promise<Sala> {
    const { data, error } = await supabase.from('Sala').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar sala: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateSalaInput>): Promise<Sala> {
    const { data, error } = await supabase.from('Sala').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar sala: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Sala').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar sala: ${error.message}`);
  }
};

export const moduloRepository = {
  async listar(): Promise<Modulo[]> {
    const { data, error } = await supabase.from('Modulo').select('*').order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar módulos: ${error.message}`);
    return data || [];
  },

  async listarPorCurso(idCurso: string): Promise<Modulo[]> {
    const { data, error } = await supabase.from('Modulo').select('*').eq('ID_Curso', idCurso).order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar módulos do curso: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Modulo | null> {
    const { data, error } = await supabase.from('Modulo').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateModuloInput): Promise<Modulo> {
    const { data, error } = await supabase.from('Modulo').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar módulo: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateModuloInput>): Promise<Modulo> {
    const { data, error } = await supabase.from('Modulo').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar módulo: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Modulo').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar módulo: ${error.message}`);
  }
};

export const aulaRepository = {
  async listar(): Promise<Aula[]> {
    const { data, error } = await supabase.from('Aula').select('*').order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar aulas: ${error.message}`);
    return data || [];
  },

  async listarPorModulo(idModulo: string): Promise<Aula[]> {
    const { data, error } = await supabase.from('Aula').select('*').eq('ID_Modulo', idModulo).order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar aulas do módulo: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Aula | null> {
    const { data, error } = await supabase.from('Aula').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateAulaInput): Promise<Aula> {
    const { data, error } = await supabase.from('Aula').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar aula: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateAulaInput>): Promise<Aula> {
    const { data, error } = await supabase.from('Aula').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar aula: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Aula').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar aula: ${error.message}`);
  }
};

export const questaoRepository = {
  async listar(): Promise<Questao[]> {
    const { data, error } = await supabase.from('Questao').select('*').order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar questões: ${error.message}`);
    return data || [];
  },

  async listarPorAula(idAula: string): Promise<Questao[]> {
    const { data, error } = await supabase.from('Questao').select('*').eq('ID_Aula', idAula).order('Posicao', { ascending: true });
    if (error) throw new Error(`Erro ao listar questões da aula: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Questao | null> {
    const { data, error } = await supabase.from('Questao').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateQuestaoInput): Promise<Questao> {
    const { data, error } = await supabase.from('Questao').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar questão: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateQuestaoInput>): Promise<Questao> {
    const { data, error } = await supabase.from('Questao').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar questão: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Questao').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar questão: ${error.message}`);
  }
};

export const matriculaRepository = {
  async listar(): Promise<Matricula[]> {
    const { data, error } = await supabase.from('matricula').select('*').order('Data_Matricula', { ascending: false });
    if (error) throw new Error(`Erro ao listar matrículas: ${error.message}`);
    return data || [];
  },

  async obter(fkCursoId: string, fkUsuarioId: string): Promise<Matricula | null> {
    const { data, error } = await supabase
      .from('matricula')
      .select('*')
      .eq('fk_Curso_ID', fkCursoId)
      .eq('fk_Usuario_ID', fkUsuarioId)
      .single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateMatriculaInput): Promise<Matricula> {
    const { data, error } = await supabase.from('matricula').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar matrícula: ${error.message}`);
    return data;
  },

  async atualizarAvaliacao(fkCursoId: string, fkUsuarioId: string, avaliacao: number): Promise<Matricula> {
    const { data, error } = await supabase
      .from('matricula')
      .update({ Avaliacao: avaliacao })
      .eq('fk_Curso_ID', fkCursoId)
      .eq('fk_Usuario_ID', fkUsuarioId)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar avaliação: ${error.message}`);
    return data;
  },

  async deletar(fkCursoId: string, fkUsuarioId: string): Promise<void> {
    const { error } = await supabase
      .from('matricula')
      .delete()
      .eq('fk_Curso_ID', fkCursoId)
      .eq('fk_Usuario_ID', fkUsuarioId);
    if (error) throw new Error(`Erro ao deletar matrícula: ${error.message}`);
  }
};

export const participaRepository = {
  async listar(): Promise<Participa[]> {
    const { data, error } = await supabase.from('participa').select('*').order('Pontos', { ascending: false });
    if (error) throw new Error(`Erro ao listar participações: ${error.message}`);
    return data || [];
  },

  async criar(dados: CreateParticipaInput): Promise<Participa> {
    const { data, error } = await supabase.from('participa').insert(dados).select().single();
    if (error) throw new Error(`Erro ao registrar participação em sala: ${error.message}`);
    return data;
  },

  async deletar(fkUsuarioId: string, fkSalaId: string): Promise<void> {
    const { error } = await supabase
      .from('participa')
      .delete()
      .eq('fk_Usuario_ID', fkUsuarioId)
      .eq('fk_Sala_ID', fkSalaId);
    if (error) throw new Error(`Erro ao remover usuário da sala: ${error.message}`);
  }
};

export const concluiRepository = {
  async listar(): Promise<Conclui[]> {
    const { data, error } = await supabase.from('conclui').select('*').order('Data_Finalizacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar conclusões: ${error.message}`);
    return data || [];
  },

  async criar(dados: CreateConcluiInput): Promise<Conclui> {
    const { data, error } = await supabase.from('conclui').insert(dados).select().single();
    if (error) throw new Error(`Erro ao registrar conclusão de aula: ${error.message}`);
    return data;
  }
};

export const notebookRepository = {
  async listar(): Promise<Notebook[]> {
    const { data, error } = await supabase.from('Notebook').select('*').order('Data_Criacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar notebooks: ${error.message}`);
    return data || [];
  },

  async obterPorId(id: string): Promise<Notebook | null> {
    const { data, error } = await supabase.from('Notebook').select('*').eq('ID', id).single();
    if (error) return null;
    return data;
  },

  async criar(dados: CreateNotebookInput): Promise<Notebook> {
    const { data, error } = await supabase.from('Notebook').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar notebook: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateNotebookInput>): Promise<Notebook> {
    const { data, error } = await supabase.from('Notebook').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar notebook: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Notebook').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar notebook: ${error.message}`);
  }
};

export const anotacoesRepository = {
  async listarPorNotebook(idNotebook: string): Promise<Anotacoes[]> {
    const { data, error } = await supabase
      .from('Anotacoes')
      .select('*')
      .eq('ID_Notebook', idNotebook)
      .order('Data_Criacao', { ascending: false });
    if (error) throw new Error(`Erro ao listar anotações: ${error.message}`);
    return data || [];
  },

  async criar(dados: CreateAnotacoesInput): Promise<Anotacoes> {
    const { data, error } = await supabase.from('Anotacoes').insert(dados).select().single();
    if (error) throw new Error(`Erro ao criar anotação: ${error.message}`);
    return data;
  },

  async atualizar(id: string, dados: Partial<CreateAnotacoesInput>): Promise<Anotacoes> {
    const { data, error } = await supabase.from('Anotacoes').update(dados).eq('ID', id).select().single();
    if (error) throw new Error(`Erro ao atualizar anotação: ${error.message}`);
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('Anotacoes').delete().eq('ID', id);
    if (error) throw new Error(`Erro ao deletar anotação: ${error.message}`);
  }
};