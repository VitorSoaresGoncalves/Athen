-- 0022_complete_empty_lesson.sql
-- Permite concluir uma aula SEM questões (0 XP).
--
-- Contexto: finalize_attempt (0010) só grava a conclusão quando a aula tem
-- questões e todas foram respondidas. Aulas sem questões, portanto, nunca
-- ficavam concluídas. Esta função cobre esse caso: grava a conclusão no
-- contexto de curso, garante a matrícula e recalcula o progresso — tudo SEM
-- creditar XP (a aula não tem questões). Mantém as mesmas fronteiras de
-- propriedade/matrícula do finalize_attempt.
--
-- É SECURITY DEFINER (como finalize_attempt) porque o cliente não pode inserir
-- em completions diretamente (RLS). Só o dono (ou admin) pode concluir para si.

create or replace function public.complete_empty_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_qcount       integer;
  v_course_id    uuid;
  v_accessible   boolean := false;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Só vale para aulas sem nenhuma questão. Aulas com questões usam o fluxo de
  -- tentativa (finalize_attempt), que credita XP e grava a conclusão.
  select count(*) into v_qcount from public.questions where lesson_id = p_lesson_id;
  if v_qcount > 0 then
    raise exception 'lesson % has questions; use finalize_attempt instead', p_lesson_id;
  end if;

  -- Resolve o curso da aula (aula -> módulo -> curso).
  select m.course_id into v_course_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'lesson % not found', p_lesson_id;
  end if;

  -- Mesma fronteira do finalize_attempt: o curso precisa ser acessível ao
  -- usuário (público+publicado, próprio, ou já matriculado).
  select (c.status = 'published' and c.visibility = 'public')
         or c.creator_id = v_user
         or exists (
              select 1 from public.enrollments e
               where e.user_id = v_user and e.course_id = v_course_id
            )
    into v_accessible
    from public.courses c
   where c.id = v_course_id;

  if not coalesce(v_accessible, false) then
    raise exception 'course % is not accessible to the current user', v_course_id using errcode = '42501';
  end if;

  -- Conclusão (contexto de curso), sem attempt e sem XP.
  insert into public.completions (user_id, lesson_id, context, attempt_id)
  values (v_user, p_lesson_id, 'course', null)
  on conflict (user_id, lesson_id, context) do nothing;

  -- Garante a matrícula e recalcula o progresso do curso.
  insert into public.enrollments (user_id, course_id)
  values (v_user, v_course_id)
  on conflict (user_id, course_id) do nothing;

  perform public.recompute_course_progress(v_user, v_course_id);

  -- Atividade de estudo conta para streak e medalhas (como no finalize).
  perform public.touch_streak(v_user);
  perform public.grant_medals(v_user);
end;
$$;

comment on function public.complete_empty_lesson(uuid) is
  'Conclui uma aula sem questões (0 XP) no contexto de curso: grava completions, garante matrícula, recalcula progresso e aplica streak/medalhas. Só o dono (ou admin), respeitando a fronteira de acesso do curso.';

grant execute on function public.complete_empty_lesson(uuid) to authenticated;
