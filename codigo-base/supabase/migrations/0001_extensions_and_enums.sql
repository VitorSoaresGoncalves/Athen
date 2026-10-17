-- 0001_extensions_and_enums.sql
-- Athen data foundation: required extensions and domain enums.
--
-- The Supabase SQL layer is the AUTHORITY for XP / PAC / level / division /
-- medals / permissions / room access. The TypeScript src/domain modules only
-- mirror these values for display and pre-validation.
--
-- NOTE (section 8.6): there is intentionally NO weekly period, reset, cron, or
-- scheduled job anywhere in this schema. Do not add one.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- pgcrypto -> gen_random_uuid() for primary keys.
-- citext    -> case-insensitive usernames.
-- unaccent  -> fill_blank answer normalization (strip diacritics) in SQL,
--              mirroring src/domain/rules.ts normalizeFillBlank().
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- Enums (idempotent creation)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'educator', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'course_status') then
    create type public.course_status as enum ('draft', 'published');
  end if;

  if not exists (select 1 from pg_type where typname = 'course_visibility') then
    create type public.course_visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_type') then
    -- order_sequence is LEGACY and intentionally excluded.
    create type public.question_type as enum (
      'match', 'multiple_choice', 'fill_blank', 'sum_alternatives'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type public.enrollment_status as enum ('active', 'completed', 'dropped');
  end if;

  if not exists (select 1 from pg_type where typname = 'room_member_status') then
    create type public.room_member_status as enum ('active', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'friendship_status') then
    create type public.friendship_status as enum (
      'pending', 'accepted', 'declined', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'atualizacao_curso', 'pedido_amizade', 'convite_sala', 'missao', 'lembrete_estudo'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'deactivated');
  end if;

  if not exists (select 1 from pg_type where typname = 'content_status') then
    -- Generic publish/moderation lifecycle reused by lessons, announcements,
    -- missions and reviews.
    create type public.content_status as enum ('draft', 'published', 'archived');
  end if;
end
$$;
