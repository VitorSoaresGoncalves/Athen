-- 0013_seed.sql
-- Seed data. The medal catalog is REQUIRED (grant_medals references these codes).
-- Demo content is optional and guarded so re-running is safe.

-- ---------------------------------------------------------------------------
-- Medal catalog (fixed system set). No weekly / educator-created medals.
-- ---------------------------------------------------------------------------
insert into public.medals (code, name, description, icon) values
  ('first_lesson', 'Primeira aula',       'Concluiu a primeira aula.',                      '🎓'),
  ('on_fire',      'Em chamas',           'Manteve uma sequência de estudos de 7 dias.',    '🔥'),
  ('bookworm',     'Rato de biblioteca',  'Concluiu 5 cursos.',                             '📚'),
  ('owl',          'Coruja',              'Concluiu 10 aulas.',                             '🦉')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon;

-- ---------------------------------------------------------------------------
-- Optional demo content. Only inserted when there are no courses yet AND at
-- least one profile exists to own them. Safe to re-run (guarded by the check).
-- Real profiles are created by auth signup (handle_new_user), so this block is
-- a no-op on a fresh database with no users and will not fail.
-- ---------------------------------------------------------------------------
do $$
declare
  v_owner uuid;
  v_course uuid;
  v_module uuid;
  v_lesson uuid;
begin
  if exists (select 1 from public.courses) then
    return; -- demo already present or real data exists
  end if;

  select id into v_owner from public.profiles
   where role in ('educator', 'admin') order by created_at limit 1;
  if v_owner is null then
    select id into v_owner from public.profiles order by created_at limit 1;
  end if;
  if v_owner is null then
    return; -- no users yet; nothing to seed
  end if;

  insert into public.courses (creator_id, title, slug, description, category, status, visibility)
  values (v_owner, 'Introdução ao Athen', 'introducao-ao-athen',
          'Curso de demonstração com os quatro tipos de questão.',
          'Geral', 'published', 'public')
  returning id into v_course;

  insert into public.modules (course_id, title, position)
  values (v_course, 'Módulo 1', 0)
  returning id into v_module;

  insert into public.lessons (module_id, title, content, position, status)
  values (v_module, 'Aula 1 - Tipos de questão', 'Conteúdo de exemplo.', 0, 'published')
  returning id into v_lesson;

  insert into public.questions (lesson_id, type, prompt, position, config) values
    (v_lesson, 'match', 'Associe os pares corretos.', 0,
      '{"pairs":[{"left":"Sol","right":"Estrela"},{"left":"Terra","right":"Planeta"}]}'::jsonb),
    (v_lesson, 'multiple_choice', 'Selecione as afirmações corretas.', 1,
      '{"options":[{"id":"a","text":"Correta","correct":true},{"id":"b","text":"Errada","correct":false},{"id":"c","text":"Correta","correct":true}]}'::jsonb),
    (v_lesson, 'fill_blank', 'Capital da França?', 2,
      '{"answers":["Paris"]}'::jsonb),
    (v_lesson, 'sum_alternatives', 'Some as alternativas corretas.', 3,
      '{"statements":[{"value":1,"correct":true},{"value":2,"correct":false},{"value":4,"correct":true}],"expected":5}'::jsonb);
end
$$;
