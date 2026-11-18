-- Dados dos carrosséis do catálogo: Recomendados, Em alta e Melhor avaliados.
-- Leitura única, sem alterar tabelas existentes; só acrescenta um índice.
--
-- Regras (calculadas no servidor para a UI só ordenar e exibir):
--   Em alta           matrículas dos últimos 7 dias (enrollments_7d). Matrículas do
--                     próprio criador no seu curso não contam.
--   Melhor avaliados  média ponderada (bayesiana) das avaliações publicadas:
--                     (n / (n + m)) * média_do_curso + (m / (n + m)) * média_global,
--                     com m = 5. Um curso com poucas avaliações fica próximo da média
--                     global, então 1 avaliação 5★ não passa 200 avaliações 4,8★.
--   Recomendados      afinidade do usuário logado com cada curso, a partir dos cursos
--                     em que ele já se matriculou:
--                       3 * (matrículas dele na mesma categoria)
--                       + soma das matrículas dele em cada tag em comum
--                     mais popularidade como complemento (0,25 * ln(1 + matrículas)
--                     + 0,1 * nota ponderada). Sem matrículas, a ordem vira só
--                     popularidade/nota. Cursos em que ele já está matriculado ou que
--                     criou recebem recommended_score nulo (não são recomendados).
--
-- SECURITY DEFINER porque `enrollments` é visível só ao dono e a contagem agregada
-- precisa somar todos os usuários. Expõe apenas totais por curso e dados do próprio
-- chamador (is_enrolled / recommended_score), nunca linhas de outros usuários.

create index if not exists enrollments_course_created_idx
  on public.enrollments (course_id, created_at);

create or replace function public.catalog_course_feed()
returns table (
  course_id         uuid,
  rating_avg        numeric,
  rating_count      integer,
  enrollments_total integer,
  enrollments_7d    integer,
  top_rated_score   numeric,
  recommended_score numeric,
  is_enrolled       boolean
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  pub as (
    select c.id, c.creator_id,
           lower(btrim(coalesce(c.category, ''))) as category,
           c.tags
      from public.courses c
     where c.status = 'published' and c.visibility = 'public'
  ),
  rev as (
    select r.course_id,
           avg(r.rating)::numeric as avg_rating,
           count(*)::integer      as n
      from public.reviews r
      join pub on pub.id = r.course_id
     where r.status = 'published'
     group by r.course_id
  ),
  prior as (
    select coalesce(avg(r.rating), 0)::numeric as mean
      from public.reviews r
      join pub on pub.id = r.course_id
     where r.status = 'published'
  ),
  enr as (
    select e.course_id,
           count(*)::integer as total,
           (count(*) filter (where e.created_at >= now() - interval '7 days'))::integer as recent
      from public.enrollments e
      join pub on pub.id = e.course_id
     where e.user_id <> pub.creator_id
     group by e.course_id
  ),
  mine as (
    select e.course_id,
           lower(btrim(coalesce(c.category, ''))) as category,
           c.tags
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.user_id = (select uid from me)
  ),
  cat_w as (
    select m.category, count(*)::numeric as w
      from mine m
     where m.category <> ''
     group by m.category
  ),
  tag_w as (
    select lower(btrim(t.tag)) as tag, count(*)::numeric as w
      from mine m
     cross join lateral unnest(m.tags) as t(tag)
     group by 1
  ),
  base as (
    select pub.id, pub.creator_id, pub.category, pub.tags,
           coalesce(rev.avg_rating, 0)::numeric as avg_rating,
           coalesce(rev.n, 0)                   as n,
           coalesce(enr.total, 0)               as total,
           coalesce(enr.recent, 0)              as recent,
           (select mean from prior)             as mean,
           exists (select 1 from mine where mine.course_id = pub.id) as enrolled
      from pub
      left join rev on rev.course_id = pub.id
      left join enr on enr.course_id = pub.id
  ),
  scored as (
    select b.*,
           ((b.n::numeric / (b.n + 5)) * b.avg_rating
            + (5::numeric / (b.n + 5)) * b.mean) as bayes,
           (3 * coalesce((select cw.w from cat_w cw where cw.category = b.category), 0)
            + coalesce((select sum(tw.w) from tag_w tw
                         where tw.tag in (select lower(btrim(x)) from unnest(b.tags) as x)), 0)) as affinity
      from base b
  )
  select s.id,
         round(s.avg_rating, 2),
         s.n,
         s.total,
         s.recent,
         round(s.bayes, 4),
         case
           when s.enrolled or s.creator_id = (select uid from me) then null
           else round(s.affinity + 0.25 * ln(1 + s.total)::numeric + 0.1 * s.bayes, 4)
         end,
         s.enrolled
    from scored s;
$$;

comment on function public.catalog_course_feed() is
  'Métricas por curso publicado para os carrosséis do catálogo: nota ponderada (bayesiana, m=5), matrículas totais e dos últimos 7 dias e pontuação de recomendação para o usuário logado (nula para cursos já matriculados ou próprios).';

revoke execute on function public.catalog_course_feed() from public, anon;
grant execute on function public.catalog_course_feed() to authenticated;