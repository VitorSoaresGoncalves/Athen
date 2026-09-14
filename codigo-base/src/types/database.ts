// ============================================================
// ENUMS & TIPOS AUXILIARES
// ============================================================
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type QuestionType = 'word_match' | 'fill_blank' | 'multiple_choice' | 'order_sequence';
export type UserCargo = 'learner' | 'creator' | 'moderator';

// ============================================================
// INTERFACES DAS TABELAS (SCHEMA PUBLIC)
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Tabela: "Usuario" */
export interface Usuario {
  ID: string;
  Nome_Display: string;
  Avatar_Url?: string | null;
  Biografia: string;
  Cargo: UserCargo;
  Nome_Usuario?: string | null;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Curso" */
export interface Curso {
  ID: string;
  Cor_Capa: string;
  Titulo: string;
  Slug: string;
  Descricao: string;
  ID_Criador: string;
  Dificuldade: CourseLevel;
  Categoria: string;
  Tags: string[];
  Icone: string;
  Status: CourseStatus;
  Avaliacao: number;
  Contagem_Avaliacao: number;
  Contagem_Estudante: number;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Sala" */
export interface Sala {
  ID: string;
  Nome: string;
  Codigo: string;
  ID_Criador: string;
  fk_Curso_ID?: string | null;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Modulo" */
export interface Modulo {
  ID: string;
  ID_Curso: string;
  Titulo: string;
  Subtitulo: string;
  Icone: string;
  Cor_Tema: string;
  Posicao: number;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Aula" */
export interface Aula {
  ID: string;
  ID_Modulo: string;
  Titulo: string;
  Descricao: string;
  Duracao: string;
  Posicao: number;
  Publicado: boolean;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Questao" */
export interface Questao {
  ID: string;
  ID_Aula: string;
  Tipo: QuestionType;
  Enunciado: Json;
  Explicacao: string;
  XP: number;
  Tipo_Resposta: Json;
  Posicao: number;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "matricula" (Chave composta: fk_Curso_ID, fk_Usuario_ID) */
export interface Matricula {
  fk_Curso_ID: string;
  fk_Usuario_ID: string;
  Aulas_Finalizadas: number;
  XP_Diario: number;
  XP_Total: number;
  Ultima_Aparicao?: string | null;
  Data_Atualizacao: string;
  Data_Matricula: string;
  Avaliacao?: number | null;
}

/** Tabela: "participa" (Chave composta: fk_Usuario_ID, fk_Sala_ID) */
export interface Participa {
  fk_Usuario_ID: string;
  fk_Sala_ID: string;
  Pontos: number;
  Data_Associacao: string;
}

/** Tabela: "conclui" (Chave composta: fk_Usuario_ID, fk_Aula_ID) */
export interface Conclui {
  fk_Usuario_ID: string;
  fk_Aula_ID: string;
  Pontuacao: number;
  Data_Finalizacao: string;
  XP_Ganho: number;
}

/** Tabela: "Notebook" */
export interface Notebook {
  ID: string;
  ID_Usuario: string;
  Nome: string;
  ID_Curso?: string | null;
  ID_Modulo?: string | null;
  ID_Sala?: string | null;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

/** Tabela: "Anotacoes" */
export interface Anotacoes {
  ID: string;
  ID_Notebook: string;
  Titulo: string;
  Conteudo: Json;
  Data_Criacao: string;
  Data_Atualizacao: string;
}

// ============================================================
// TIPOS PARA CRIAÇÃO (INPUTS)
// ============================================================

export type CreateUsuarioInput = {
  ID: string; // Obrigatório pois vem de auth.users (id)
  Nome_Display?: string;
  Avatar_Url?: string | null;
  Biografia?: string;
  Cargo?: UserCargo;
  Nome_Usuario?: string | null;
};

export type CreateCursoInput = {
  Titulo: string;
  Slug: string;
  ID_Criador: string;
  Cor_Capa?: string;
  Descricao?: string;
  Dificuldade?: CourseLevel;
  Categoria?: string;
  Tags?: string[];
  Icone?: string;
  Status?: CourseStatus;
};

export type CreateSalaInput = {
  Nome: string;
  Codigo: string;
  ID_Criador: string;
  fk_Curso_ID?: string | null;
};

export type CreateModuloInput = {
  ID_Curso: string;
  Titulo: string;
  Subtitulo?: string;
  Icone?: string;
  Cor_Tema?: string;
  Posicao?: number;
};

export type CreateAulaInput = {
  ID_Modulo: string;
  Titulo: string;
  Descricao?: string;
  Duracao?: string;
  Posicao?: number;
  Publicado?: boolean;
};

export type CreateQuestaoInput = {
  ID_Aula: string;
  Tipo: QuestionType;
  Enunciado?: Json;
  Explicacao?: string;
  XP?: number;
  Tipo_Resposta?: Json  ;
  Posicao?: number;
};

export type CreateMatriculaInput = {
  fk_Curso_ID: string;
  fk_Usuario_ID: string;
  XP_Diario?: number;
  Avaliacao?: number | null;
};

export type CreateParticipaInput = {
  fk_Usuario_ID: string;
  fk_Sala_ID: string;
  Pontos?: number;
};

export type CreateConcluiInput = {
  fk_Usuario_ID: string;
  fk_Aula_ID: string;
  Pontuacao?: number;
  XP_Ganho?: number;
};

export type CreateNotebookInput = {
  ID_Usuario: string;
  Nome: string;
  ID_Curso?: string | null;
  ID_Modulo?: string | null;
  ID_Sala?: string | null;
};

export type CreateAnotacoesInput = {
  ID_Notebook: string;
  Titulo?: string;
  Conteudo?: Json;
};

// ============================================================
// DEFINIÇÃO DO SCHEMA PARA O CLIENTE SUPABASE
// ============================================================
export interface Database {
  public: {
    Tables: {
      Usuario: {
        Row: Usuario;
        Insert: CreateUsuarioInput;
        Update: Partial<CreateUsuarioInput>;
      };
      Curso: {
        Row: Curso;
        Insert: CreateCursoInput;
        Update: Partial<CreateCursoInput>;
      };
      Sala: {
        Row: Sala;
        Insert: CreateSalaInput;
        Update: Partial<CreateSalaInput>;
      };
      Modulo: {
        Row: Modulo;
        Insert: CreateModuloInput;
        Update: Partial<CreateModuloInput>;
      };
      Aula: {
        Row: Aula;
        Insert: CreateAulaInput;
        Update: Partial<CreateAulaInput>;
      };
      Questao: {
        Row: Questao;
        Insert: CreateQuestaoInput;
        Update: Partial<CreateQuestaoInput>;
      };
      matricula: {
        Row: Matricula;
        Insert: CreateMatriculaInput;
        Update: Partial<CreateMatriculaInput>;
      };
      participa: {
        Row: Participa;
        Insert: CreateParticipaInput;
        Update: Partial<CreateParticipaInput>;
      };
      conclui: {
        Row: Conclui;
        Insert: CreateConcluiInput;
        Update: Partial<CreateConcluiInput>;
      };
      Notebook: {
        Row: Notebook;
        Insert: CreateNotebookInput;
        Update: Partial<CreateNotebookInput>;
      };
      Anotacoes: {
        Row: Anotacoes;
        Insert: CreateAnotacoesInput;
        Update: Partial<CreateAnotacoesInput>;
      };
    };
    Enums: {
      course_level: CourseLevel;
      course_status: CourseStatus;
      question_type: QuestionType;
    };
  };
}