export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          id: string
          room_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          id?: string
          room_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          submitted: Json
          xp_earned: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          submitted?: Json
          xp_earned?: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          submitted?: Json
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          correct_count: number
          course_id: string | null
          finished_at: string | null
          id: string
          lesson_id: string
          room_id: string | null
          started_at: string
          total_count: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          correct_count?: number
          course_id?: string | null
          finished_at?: string | null
          id?: string
          lesson_id: string
          room_id?: string | null
          started_at?: string
          total_count?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          correct_count?: number
          course_id?: string | null
          finished_at?: string | null
          id?: string
          lesson_id?: string
          room_id?: string | null
          started_at?: string
          total_count?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          parent_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      completions: {
        Row: {
          attempt_id: string | null
          completed_at: string
          context: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          completed_at?: string
          context: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          completed_at?: string
          context?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          cover_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          duration_minutes: number
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          tags: string[]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["course_visibility"]
        }
        Insert: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          duration_minutes?: number
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["course_visibility"]
        }
        Update: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["course_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "courses_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "courses_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          progress: number
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          progress?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          progress?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_entries: {
        Row: {
          closed_at: string | null
          entry_kind: string
          final_position: number | null
          final_score: number | null
          group_id: string
          group_size: number | null
          id: string
          joined_at: string
          movement: string | null
          season_id: string
          tier: number
          tier_after: number | null
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          entry_kind: string
          final_position?: number | null
          final_score?: number | null
          group_id: string
          group_size?: number | null
          id?: string
          joined_at?: string
          movement?: string | null
          season_id: string
          tier: number
          tier_after?: number | null
          user_id: string
        }
        Update: {
          closed_at?: string | null
          entry_kind?: string
          final_position?: number | null
          final_score?: number | null
          group_id?: string
          group_size?: number | null
          id?: string
          joined_at?: string
          movement?: string | null
          season_id?: string
          tier?: number
          tier_after?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "league_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "league_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_groups: {
        Row: {
          created_at: string
          group_number: number
          id: string
          late: boolean
          season_id: string
          tier: number
        }
        Insert: {
          created_at?: string
          group_number: number
          id?: string
          late?: boolean
          season_id: string
          tier: number
        }
        Update: {
          created_at?: string
          group_number?: number
          id?: string
          late?: boolean
          season_id?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          seed: string
          starts_at: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          seed?: string
          starts_at: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          seed?: string
          starts_at?: string
          status?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: string | null
          created_at: string
          id: string
          module_id: string
          position: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          module_id: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          module_id?: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      medals: {
        Row: {
          code: string
          description: string
          icon: string | null
          name: string
        }
        Insert: {
          code: string
          description: string
          icon?: string | null
          name: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string | null
          name?: string
        }
        Relationships: []
      }
      mission_assignments: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          current_count: number
          granted: boolean
          id: string
          occurrence_id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_count?: number
          granted?: boolean
          id?: string
          occurrence_id: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_count?: number
          granted?: boolean
          id?: string
          occurrence_id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_assignments_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "mission_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mission_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_definitions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          objective: Database["public"]["Enums"]["mission_objective"]
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          objective: Database["public"]["Enums"]["mission_objective"]
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          objective?: Database["public"]["Enums"]["mission_objective"]
          reward_xp?: number
          scope?: Database["public"]["Enums"]["mission_scope"]
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mission_occurrences: {
        Row: {
          course_id: string | null
          created_at: string
          definition_id: string
          id: string
          objective: Database["public"]["Enums"]["mission_objective"]
          period_end: string
          period_start: string
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          definition_id: string
          id?: string
          objective: Database["public"]["Enums"]["mission_objective"]
          period_end: string
          period_start: string
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
        }
        Update: {
          course_id?: string | null
          created_at?: string
          definition_id?: string
          id?: string
          objective?: Database["public"]["Enums"]["mission_objective"]
          period_end?: string
          period_start?: string
          reward_xp?: number
          scope?: Database["public"]["Enums"]["mission_scope"]
          target?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_occurrences_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "mission_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_progress: {
        Row: {
          completed: boolean
          id: string
          mission_id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          mission_id: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          mission_id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mission_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          author_id: string
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          min_correct: number
          reward_xp: number
          room_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          min_correct?: number
          reward_xp?: number
          room_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          min_correct?: number
          reward_xp?: number
          room_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          color: string | null
          course_id: string
          created_at: string
          description: string | null
          icon: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          notebook_id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          notebook_id: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          notebook_id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_pages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notebooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          reference_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          reference_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          reference_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          last_study_date: string | null
          level: number
          notification_preferences: Json
          role: Database["public"]["Enums"]["user_role"]
          streak_count: number
          updated_at: string
          username: string
          xp_global: number
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          last_study_date?: string | null
          level?: number
          notification_preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          streak_count?: number
          updated_at?: string
          username: string
          xp_global?: number
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_study_date?: string | null
          level?: number
          notification_preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          streak_count?: number
          updated_at?: string
          username?: string
          xp_global?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          config: Json
          created_at: string
          explanation: string | null
          id: string
          lesson_id: string
          position: number
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
          xp_value: number
        }
        Insert: {
          config?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id: string
          position?: number
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at?: string
          xp_value?: number
        }
        Update: {
          config?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id?: string
          position?: number
          prompt?: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
          xp_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          rating: number
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          rating: number
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          pac_internal: number
          progress: number
          removed_at: string | null
          room_id: string
          status: Database["public"]["Enums"]["room_member_status"]
          updated_at: string
          user_id: string
          xp_internal: number
        }
        Insert: {
          id?: string
          joined_at?: string
          pac_internal?: number
          progress?: number
          removed_at?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["room_member_status"]
          updated_at?: string
          user_id: string
          xp_internal?: number
        }
        Update: {
          id?: string
          joined_at?: string
          pac_internal?: number
          progress?: number
          removed_at?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["room_member_status"]
          updated_at?: string
          user_id?: string
          xp_internal?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          access_code: string
          code_active: boolean
          course_id: string | null
          created_at: string
          educator_id: string
          id: string
          name: string
          pac_visibility: string
          updated_at: string
        }
        Insert: {
          access_code: string
          code_active?: boolean
          course_id?: string | null
          created_at?: string
          educator_id: string
          id?: string
          name: string
          pac_visibility?: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          code_active?: boolean
          course_id?: string | null
          created_at?: string
          educator_id?: string
          id?: string
          name?: string
          pac_visibility?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_educator_id_fkey"
            columns: ["educator_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rooms_educator_id_fkey"
            columns: ["educator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_entries: {
        Row: {
          category: Database["public"]["Enums"]["season_category"]
          created_at: string
          final_rank: number | null
          group_id: string | null
          id: string
          identity_hidden: boolean
          joined_at: string
          result_category: Database["public"]["Enums"]["season_category"] | null
          season_id: string
          season_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["season_category"]
          created_at?: string
          final_rank?: number | null
          group_id?: string | null
          id?: string
          identity_hidden?: boolean
          joined_at?: string
          result_category?:
            | Database["public"]["Enums"]["season_category"]
            | null
          season_id: string
          season_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["season_category"]
          created_at?: string
          final_rank?: number | null
          group_id?: string | null
          id?: string
          identity_hidden?: boolean
          joined_at?: string
          result_category?:
            | Database["public"]["Enums"]["season_category"]
            | null
          season_id?: string
          season_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "season_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "season_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_groups: {
        Row: {
          capacity: number
          category: Database["public"]["Enums"]["season_category"]
          created_at: string
          group_index: number
          id: string
          season_id: string
        }
        Insert: {
          capacity?: number
          category: Database["public"]["Enums"]["season_category"]
          created_at?: string
          group_index: number
          id?: string
          season_id: string
        }
        Update: {
          capacity?: number
          category?: Database["public"]["Enums"]["season_category"]
          created_at?: string
          group_index?: number
          id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_ops_log: {
        Row: {
          created_at: string
          detail: Json
          event: string
          id: string
          season_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          event: string
          id?: string
          season_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "season_ops_log_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_medals: {
        Row: {
          acquired_at: string
          featured: boolean
          id: string
          medal_code: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          featured?: boolean
          id?: string
          medal_code: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          featured?: boolean
          id?: string
          medal_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medals_medal_code_fkey"
            columns: ["medal_code"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_credits: {
        Row: {
          amount: number
          answer_id: string | null
          attempt_id: string | null
          base_xp: number | null
          competitive: boolean
          course_id: string | null
          created_at: string
          id: string
          legacy: boolean
          ordinal: number | null
          question_id: string | null
          room_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          answer_id?: string | null
          attempt_id?: string | null
          base_xp?: number | null
          competitive?: boolean
          course_id?: string | null
          created_at?: string
          id?: string
          legacy?: boolean
          ordinal?: number | null
          question_id?: string | null
          room_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          answer_id?: string | null
          attempt_id?: string | null
          base_xp?: number | null
          competitive?: boolean
          course_id?: string | null
          created_at?: string
          id?: string
          legacy?: boolean
          ordinal?: number | null
          question_id?: string | null
          room_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_credits_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_credits_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_credits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_credits_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_credits_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "xp_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          attempt_id: string | null
          context: Database["public"]["Enums"]["xp_event_context"]
          course_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          mission_id: string | null
          occurred_at: string
          origin: Database["public"]["Enums"]["xp_event_origin"]
          room_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          attempt_id?: string | null
          context: Database["public"]["Enums"]["xp_event_context"]
          course_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          mission_id?: string | null
          occurred_at?: string
          origin: Database["public"]["Enums"]["xp_event_origin"]
          room_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          attempt_id?: string | null
          context?: Database["public"]["Enums"]["xp_event_context"]
          course_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          mission_id?: string | null
          occurred_at?: string
          origin?: Database["public"]["Enums"]["xp_event_origin"]
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_ranking"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      global_ranking: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          level: number | null
          position: number | null
          streak_count: number | null
          user_id: string | null
          username: string | null
          xp_global: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_missions_for_attempt: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      check_season_alerts: {
        Args: { p_grace_minutes?: number }
        Returns: number
      }
      close_season: {
        Args: { p_min?: number; p_season_id: string }
        Returns: undefined
      }
      complete_empty_lesson: {
        Args: { p_lesson_id: string }
        Returns: undefined
      }
      count_mission_progress: {
        Args: { p_occurrence_id: string; p_user_id: string }
        Returns: number
      }
      course_coverage: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: number
      }
      create_notification: {
        Args: {
          p_message?: string
          p_recipient_id: string
          p_reference_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: string
      }
      current_season: {
        Args: never
        Returns: {
          ends_at: string
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["season_status"]
        }[]
      }
      deactivate_account: { Args: never; Returns: undefined }
      deliver_season_alert: {
        Args: { p_detail: Json; p_season_id: string }
        Returns: undefined
      }
      division_for_pac: { Args: { p_pac: number }; Returns: string }
      ensure_current_global_occurrences: { Args: never; Returns: undefined }
      ensure_occurrence: {
        Args: {
          p_course_id: string
          p_definition_id: string
          p_instant: string
        }
        Returns: string
      }
      estimate_course_duration: {
        Args: { p_course_id: string }
        Returns: number
      }
      finalize_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          correct_count: number
          total_count: number
          xp_earned: number
        }[]
      }
      form_season_groups: {
        Args: {
          p_cap?: number
          p_min?: number
          p_season_id: string
          p_target?: number
        }
        Returns: number
      }
      friends_course_pac: {
        Args: { p_course_id: string }
        Returns: {
          avatar_url: string
          correct: number
          display_name: string
          division: string
          is_self: boolean
          pac: number
          total: number
          user_id: string
          username: string
        }[]
      }
      friends_course_pac_v2: {
        Args: { p_course_id: string }
        Returns: {
          avatar_url: string
          correct: number
          coverage: number
          display_name: string
          division: string
          is_self: boolean
          pac: number
          total: number
          user_id: string
          username: string
        }[]
      }
      grade_answer: {
        Args: {
          p_config: Json
          p_submitted: Json
          p_type: Database["public"]["Enums"]["question_type"]
          p_xp_value: number
        }
        Returns: {
          is_correct: boolean
          xp: number
        }[]
      }
      grant_medals: { Args: { p_user_id: string }; Returns: undefined }
      home_categories: {
        Args: { lim?: number }
        Returns: {
          label: string
          total: number
        }[]
      }
      home_course_students: {
        Args: { course_ids: string[] }
        Returns: {
          course_id: string
          students: number
        }[]
      }
      home_featured_courses: {
        Args: { cat?: string; lim?: number }
        Returns: {
          author: string
          avg_rating: number
          category: string
          cover_url: string
          created_at: string
          id: string
          slug: string
          students: number
          title: string
          xp: number
        }[]
      }
      home_featured_reviews: {
        Args: { lim?: number }
        Returns: {
          comment: string
          course_title: string
          display_name: string
          id: string
          level: number
          rating: number
          username: string
          xp_global: number
        }[]
      }
      home_stats: { Args: never; Returns: Json }
      home_top_learners: {
        Args: { lim?: number }
        Returns: {
          bio: string
          display_name: string
          id: string
          level: number
          username: string
          xp_global: number
        }[]
      }
      is_active_room_member: { Args: { p_room_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_in_season_group: { Args: { p_group_id: string }; Returns: boolean }
      is_recently_active: {
        Args: { p_from: string; p_to: string; p_user_id: string }
        Returns: boolean
      }
      is_room_educator: {
        Args: { p_room_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      join_room: { Args: { p_access_code: string }; Returns: string }
      league_affinity: {
        Args: { p_user_ids: string[] }
        Returns: {
          a: string
          b: string
          w: number
        }[]
      }
      league_close_season: { Args: { p_season_id: string }; Returns: undefined }
      league_compute: {
        Args: { p_group_id?: string; p_season_id: string }
        Returns: {
          entry_id: string
          group_id: string
          group_size: number
          movement: string
          position: number
          score: number
          tier: number
          tier_after: number
          user_id: string
        }[]
      }
      league_form_groups: {
        Args: { p_season_id: string; p_tier: number; p_user_ids: string[] }
        Returns: number
      }
      league_late_enroll: {
        Args: { p_season_id: string; p_user_id: string }
        Returns: string
      }
      league_my_group: {
        Args: { p_season_id?: string }
        Returns: {
          active: boolean
          avatar_url: string
          banner_url: string
          display_name: string
          is_self: boolean
          movement: string
          position: number
          score: number
          user_id: string
        }[]
      }
      league_my_history: {
        Args: { p_limit?: number }
        Returns: {
          ends_at: string
          final_position: number
          final_score: number
          group_size: number
          movement: string
          season_id: string
          starts_at: string
          tier: number
          tier_after: number
        }[]
      }
      league_open_season: { Args: { p_start: string }; Returns: string }
      league_overview: {
        Args: never
        Returns: {
          ends_at: string
          entered: boolean
          entry_kind: string
          group_number: number
          group_size: number
          position: number
          projected: string
          projected_tier: number
          score: number
          season_id: string
          starts_at: string
          tier: number
        }[]
      }
      league_register_activity: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      league_sync: { Args: never; Returns: undefined }
      league_tick: { Args: never; Returns: undefined }
      league_week_end: { Args: { p_start: string }; Returns: string }
      league_week_start: { Args: { p_ts: string }; Returns: string }
      learning_attempt_breakdown: {
        Args: { p_attempt_id: string }
        Returns: {
          base_xp: number
          credited_xp: number
          is_correct: boolean
          question_id: string
          status: string
          submission_ordinal: number
        }[]
      }
      learning_first_correct_ordinal: {
        Args: { p_question_id: string; p_room_id: string; p_user_id: string }
        Returns: number
      }
      learning_xp_preview: {
        Args: { p_lesson_id: string; p_room_id?: string }
        Returns: {
          base_xp: number
          credited: boolean
          credited_xp: number
          next_ordinal: number
          potential_xp: number
          question_id: string
        }[]
      }
      level_for_xp: { Args: { p_xp: number }; Returns: number }
      log_season_op: {
        Args: { p_detail?: Json; p_event: string; p_season_id?: string }
        Returns: undefined
      }
      mission_day_start: { Args: { p_ts: string }; Returns: string }
      mission_week_start: { Args: { p_ts: string }; Returns: string }
      my_mission_detail: {
        Args: { p_occurrence_id: string }
        Returns: {
          code: string
          completed: boolean
          course_id: string
          course_title: string
          current_count: number
          definition_id: string
          description: string
          objective: Database["public"]["Enums"]["mission_objective"]
          occurrence_id: string
          period_end: string
          period_start: string
          progress: number
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
          title: string
        }[]
      }
      my_missions: {
        Args: never
        Returns: {
          code: string
          completed: boolean
          course_id: string
          course_title: string
          current_count: number
          definition_id: string
          description: string
          objective: Database["public"]["Enums"]["mission_objective"]
          occurrence_id: string
          period_end: string
          period_start: string
          progress: number
          reward_xp: number
          scope: Database["public"]["Enums"]["mission_scope"]
          target: number
          title: string
        }[]
      }
      my_season_group: {
        Args: { p_season_id: string }
        Returns: {
          avatar_url: string
          banner_url: string
          display_name: string
          hidden: boolean
          is_self: boolean
          rank_position: number
          season_xp: number
          user_id: string
        }[]
      }
      my_season_history: {
        Args: { p_limit?: number }
        Returns: {
          category: Database["public"]["Enums"]["season_category"]
          ends_at: string
          final_rank: number
          result_category: Database["public"]["Enums"]["season_category"]
          season_id: string
          season_xp: number
          starts_at: string
          status: Database["public"]["Enums"]["season_status"]
        }[]
      }
      my_season_summary: {
        Args: { p_season_id: string }
        Returns: {
          category: Database["public"]["Enums"]["season_category"]
          final_rank: number
          group_id: string
          group_index: number
          group_size: number
          result_category: Database["public"]["Enums"]["season_category"]
          season_id: string
          season_xp: number
        }[]
      }
      normalize_fill_blank: { Args: { p_text: string }; Returns: string }
      notify_course_update: { Args: { p_course_id: string }; Returns: number }
      notify_friend_request: {
        Args: { p_friendship_id: string }
        Returns: string
      }
      notify_room_invite: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: string
      }
      notify_room_mission: { Args: { p_mission_id: string }; Returns: number }
      open_season: { Args: { p_starts_at: string }; Returns: string }
      pac: { Args: { p_correct: number; p_total: number }; Returns: number }
      recompute_course_duration: {
        Args: { p_course_id: string }
        Returns: undefined
      }
      recompute_course_progress: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: number
      }
      recompute_room_metrics: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      record_xp_event: {
        Args: {
          p_amount: number
          p_attempt_id?: string
          p_context: Database["public"]["Enums"]["xp_event_context"]
          p_course_id?: string
          p_idempotency_key: string
          p_mission_id?: string
          p_occurred_at?: string
          p_origin: Database["public"]["Enums"]["xp_event_origin"]
          p_room_id?: string
          p_user_id: string
        }
        Returns: string
      }
      resolve_login_email: {
        Args: { p_password: string; p_username: string }
        Returns: string
      }
      search_profiles: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          level: number
          username: string
        }[]
      }
      season_alerts: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          detail: Json
          minutes_overdue: number
          season_id: string
        }[]
      }
      season_category_from_rank: {
        Args: { p_rank: number }
        Returns: Database["public"]["Enums"]["season_category"]
      }
      season_category_rank: {
        Args: { p_category: Database["public"]["Enums"]["season_category"] }
        Returns: number
      }
      seasons_needing_attention: {
        Args: { p_grace_minutes?: number }
        Returns: {
          ended_at: string
          last_error: string
          last_error_at: string
          minutes_overdue: number
          season_id: string
          status: Database["public"]["Enums"]["season_status"]
        }[]
      }
      send_study_reminder: { Args: { p_friend_id: string }; Returns: string }
      social_distance_order: {
        Args: {
          p_category: Database["public"]["Enums"]["season_category"]
          p_season_id: string
          p_seed: string
        }
        Returns: {
          distance: number
          joined_at: string
          user_id: string
        }[]
      }
      tick_seasons: { Args: never; Returns: number }
      touch_streak: { Args: { p_user_id: string }; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_mission_assignment: {
        Args: { p_occurrence_id: string; p_user_id: string }
        Returns: undefined
      }
      user_season_xp: {
        Args: { p_from: string; p_to: string; p_user_id: string }
        Returns: number
      }
      user_xp_in_window: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      xp_credit_for: {
        Args: { p_base: number; p_ordinal: number }
        Returns: number
      }
      xp_from_question: {
        Args: { p_type: Database["public"]["Enums"]["question_type"] }
        Returns: number
      }
    }
    Enums: {
      account_status: "active" | "deactivated"
      content_status: "draft" | "published" | "archived"
      course_status: "draft" | "published"
      course_visibility: "public" | "private"
      enrollment_status: "active" | "completed" | "dropped"
      friendship_status: "pending" | "accepted" | "declined" | "cancelled"
      mission_objective:
        | "complete_lessons"
        | "correct_questions"
        | "complete_executions"
        | "study_days"
      mission_scope: "global_daily" | "global_weekly" | "course_daily"
      notification_type:
        | "atualizacao_curso"
        | "pedido_amizade"
        | "convite_sala"
        | "missao"
        | "lembrete_estudo"
      question_type:
        | "match"
        | "multiple_choice"
        | "fill_blank"
        | "sum_alternatives"
      room_member_status: "active" | "removed"
      season_category:
        | "bronze"
        | "silver"
        | "gold"
        | "platinum"
        | "diamond"
        | "master"
        | "legendary"
      season_status: "scheduled" | "open" | "closing" | "closed"
      user_role: "student" | "educator" | "admin"
      xp_event_context: "course" | "room"
      xp_event_origin:
        | "learning_base"
        | "mission_bonus"
        | "legacy_opening"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "deactivated"],
      content_status: ["draft", "published", "archived"],
      course_status: ["draft", "published"],
      course_visibility: ["public", "private"],
      enrollment_status: ["active", "completed", "dropped"],
      friendship_status: ["pending", "accepted", "declined", "cancelled"],
      mission_objective: [
        "complete_lessons",
        "correct_questions",
        "complete_executions",
        "study_days",
      ],
      mission_scope: ["global_daily", "global_weekly", "course_daily"],
      notification_type: [
        "atualizacao_curso",
        "pedido_amizade",
        "convite_sala",
        "missao",
        "lembrete_estudo",
      ],
      question_type: [
        "match",
        "multiple_choice",
        "fill_blank",
        "sum_alternatives",
      ],
      room_member_status: ["active", "removed"],
      season_category: [
        "bronze",
        "silver",
        "gold",
        "platinum",
        "diamond",
        "master",
        "legendary",
      ],
      season_status: ["scheduled", "open", "closing", "closed"],
      user_role: ["student", "educator", "admin"],
      xp_event_context: ["course", "room"],
      xp_event_origin: [
        "learning_base",
        "mission_bonus",
        "legacy_opening",
        "adjustment",
      ],
    },
  },
} as const
