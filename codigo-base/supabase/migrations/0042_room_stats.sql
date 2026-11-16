-- 0042_room_stats.sql
-- Estatísticas da sala para o pop-up do educador: abas Visão geral, Alunos e Conteúdo.
--
-- As funções públicas chamam assert_room_educator antes de ler qualquer dado e
-- devolvem só agregados, nunca respostas cruas. Não há policy nova: attempts e
-- answers continuam acessíveis só ao dono da tentativa e ao admin.
--
-- Acerto de primeira considera, para cada aluno e cada questão, somente a primeira
-- resposta em tentativa finalizada na sala. O último acesso é a tentativa iniciada
-- mais recente na sala, ou joined_at quando não há nenhuma. Um aluno precisa de
-- atenção quando está parado há 6 dias ou mais, ou quando o acerto de primeira é
-- menor que 50%.

create or replace function public.assert_room_educator(p_room_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_room_educator(p_room_id, auth.uid()) then
    raise exception 'permission denied for room statistics' using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_room_educator(uuid) is
  'Lança erro 42501 se o chamador não for o educador da sala. Mesma mensagem para sala inexistente e sala de outro educador, para não revelar a existência da sala. Função interna: sem EXECUTE para o cliente.';

create or replace function public.room_first_answers(p_room_id uuid)
returns table (user_id uuid, question_id uuid, is_correct boolean)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (a.user_id, ans.question_id)
         a.user_id, ans.question_id, ans.is_correct
    from public.attempts a
    join public.answers ans on ans.attempt_id = a.id
    join public.room_members rm
      on rm.room_id = a.room_id and rm.user_id = a.user_id and rm.status = 'active'
   where a.room_id = p_room_id
     and a.finished_at is not null
   order by a.user_id, ans.question_id, a.finished_at, a.id;
$$;

comment on function public.room_first_answers(uuid) is
  'Primeira resposta de cada membro ativo a cada questão, considerando só tentativas finalizadas na sala. Função interna, sem checagem própria: quem chama precisa ter passado por assert_room_educator.';

create or replace function public.room_student_metrics(p_room_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  xp              integer,
  progress        numeric,
  first_try_rate  numeric,
  last_access     timestamptz,
  days_idle       integer,
  needs_attention boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select rm.user_id, rm.xp_internal, rm.progress, rm.joined_at
      from public.room_members rm
     where rm.room_id = p_room_id and rm.status = 'active'
  ),
  first_try as (
    select fa.user_id,
           round(100.0 * count(*) filter (where fa.is_correct) / count(*)) as rate
      from public.room_first_answers(p_room_id) fa
     group by fa.user_id
  ),
  access as (
    select a.user_id, max(a.started_at) as last_at
      from public.attempts a
     where a.room_id = p_room_id
     group by a.user_id
  ),
  base as (
    select m.user_id,
           coalesce(p.display_name, 'Aluno') as display_name,
           m.xp_internal as xp,
           m.progress,
           ft.rate as first_try_rate,
           coalesce(ac.last_at, m.joined_at) as last_access
      from members m
      left join public.profiles p on p.id = m.user_id
      left join first_try ft on ft.user_id = m.user_id
      left join access ac on ac.user_id = m.user_id
  )
  select b.user_id, b.display_name, b.xp, b.progress, b.first_try_rate, b.last_access,
         floor(extract(epoch from (now() - b.last_access)) / 86400)::integer as days_idle,
         (floor(extract(epoch from (now() - b.last_access)) / 86400) >= 6
          or coalesce(b.first_try_rate, 100) < 50) as needs_attention
    from base b;
$$;

comment on function public.room_student_metrics(uuid) is
  'Métricas por membro ativo da sala (XP, progresso, acerto de primeira, último acesso, dias parado e atenção). Base das funções públicas de estatísticas. Função interna, sem checagem própria.';

-- Visão geral: cartões.
create or replace function public.room_stats_overview(p_room_id uuid)
returns table (
  active_members  integer,
  avg_progress    numeric,
  avg_first_try   numeric,
  attention_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_room_educator(p_room_id);
  return query
    select count(*)::integer,
           coalesce(round(avg(m.progress)), 0),
           coalesce(round(avg(m.first_try_rate)), 0),
           (count(*) filter (where m.needs_attention))::integer
      from public.room_student_metrics(p_room_id) m;
end;
$$;

comment on function public.room_stats_overview(uuid) is
  'Cartões da aba Visão geral: membros ativos, média de progresso, média de acerto de primeira e quantidade de alunos que precisam de atenção. Só o educador da sala.';

-- Alunos: uma linha por membro ativo.
create or replace function public.room_stats_students(p_room_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  xp              integer,
  progress        numeric,
  first_try_rate  numeric,
  last_access     timestamptz,
  days_idle       integer,
  needs_attention boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_room_educator(p_room_id);
  return query
    select m.user_id, m.display_name, m.xp, m.progress, m.first_try_rate,
           m.last_access, m.days_idle, m.needs_attention
      from public.room_student_metrics(p_room_id) m
     order by m.xp desc, m.display_name;
end;
$$;

comment on function public.room_stats_students(uuid) is
  'Tabela da aba Alunos e lista de atenção, ordenada por XP da sala. Só o educador da sala.';

-- Conteúdo: conclusão por módulo do curso vinculado à sala. Sem curso, nenhuma linha.
create or replace function public.room_stats_modules(p_room_id uuid)
returns table (
  module_id       uuid,
  title           text,
  module_position integer,
  lesson_count    integer,
  completion_pct  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_room_educator(p_room_id);
  return query
    with n as (
      select count(*)::integer as members
        from public.room_members rm
       where rm.room_id = p_room_id and rm.status = 'active'
    )
    select mo.id, mo.title, mo.position,
           count(distinct l.id)::integer,
           case when n.members = 0 or count(distinct l.id) = 0 then 0::numeric
                else round(100.0 * count(done.user_id) / (n.members * count(distinct l.id)))
           end
      from public.rooms r
      join public.modules mo on mo.course_id = r.course_id
      cross join n
      left join public.lessons l on l.module_id = mo.id and l.status = 'published'
      left join lateral (
        select distinct a.user_id
          from public.attempts a
          join public.room_members rm
            on rm.room_id = a.room_id and rm.user_id = a.user_id and rm.status = 'active'
         where a.room_id = p_room_id
           and a.lesson_id = l.id
           and a.finished_at is not null
      ) done on true
     where r.id = p_room_id
     group by mo.id, mo.title, mo.position, n.members
     order by mo.position;
end;
$$;

comment on function public.room_stats_modules(uuid) is
  'Percentual de conclusão por módulo do curso da sala, contando alunos ativos que finalizaram tentativa em cada aula publicada. Sala sem curso devolve nenhuma linha. Só o educador da sala.';

-- Conteúdo: as 3 questões com menor acerto de primeira, com pelo menos 3 respostas.
create or replace function public.room_stats_hard_questions(p_room_id uuid)
returns table (
  question_id    uuid,
  prompt         text,
  lesson_title   text,
  first_try_rate numeric,
  answers_count  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_room_educator(p_room_id);
  return query
    select q.id, q.prompt, l.title,
           round(100.0 * count(*) filter (where fa.is_correct) / count(*)),
           count(*)::integer
      from public.room_first_answers(p_room_id) fa
      join public.questions q on q.id = fa.question_id
      join public.lessons l on l.id = q.lesson_id
     group by q.id, q.prompt, l.title
    having count(*) >= 3
     order by 4 asc, 5 desc
     limit 3;
end;
$$;

comment on function public.room_stats_hard_questions(uuid) is
  'Até 3 questões com menor acerto de primeira na sala, considerando só questões com pelo menos 3 primeiras respostas. Só o educador da sala.';

-- Permissões. Supabase concede EXECUTE a anon e authenticated em funções novas do
-- schema public, por isso o revoke é explícito (mesmo padrão da 0040).
-- Funções internas: sem EXECUTE para o cliente. Públicas: só authenticated.
revoke execute on function public.assert_room_educator(uuid)  from public, anon, authenticated;
revoke execute on function public.room_first_answers(uuid)    from public, anon, authenticated;
revoke execute on function public.room_student_metrics(uuid)  from public, anon, authenticated;

revoke execute on function public.room_stats_overview(uuid)       from public, anon;
revoke execute on function public.room_stats_students(uuid)       from public, anon;
revoke execute on function public.room_stats_modules(uuid)        from public, anon;
revoke execute on function public.room_stats_hard_questions(uuid) from public, anon;
grant  execute on function public.room_stats_overview(uuid)       to authenticated;
grant  execute on function public.room_stats_students(uuid)       to authenticated;
grant  execute on function public.room_stats_modules(uuid)        to authenticated;
grant  execute on function public.room_stats_hard_questions(uuid) to authenticated;
