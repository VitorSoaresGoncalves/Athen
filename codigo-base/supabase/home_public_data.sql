-- Funções públicas da home (rodar no SQL Editor do Supabase). Opcional, mas recomendado.
--
-- A home é vista por visitantes sem login e a RLS bloqueia contagens e listagens de profiles/enrollments
-- ("self only"). Estas funções (security definer) expõem SOMENTE agregados e o top do ranking,
-- sem abrir as tabelas. Se não forem criadas, services.ts cai para consultas diretas.
--
-- Baseado no schema: profiles.account_status, courses.status/visibility, reviews.status,
-- enrollments.status, profiles.xp_global/level (integer), profiles.username (tipo próprio -> ::text).

drop function if exists public.home_stats();
drop function if exists public.home_course_students(uuid[]);
drop function if exists public.home_top_learners(int);
drop function if exists public.home_categories(int);
drop function if exists public.home_featured_reviews(int);
drop function if exists public.home_featured_courses(text, int);

-- Números do hero e do CTA
create function public.home_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'students',   (select count(*) from profiles where account_status = 'active'),
    'courses',    (select count(*) from courses where status = 'published' and visibility = 'public'),
    'categories', (select count(distinct category) from courses
                    where status = 'published' and visibility = 'public' and category is not null),
    'avg_rating', (select round(avg(r.rating)::numeric, 1)
                     from reviews r
                     join courses c on c.id = r.course_id
                    where r.status = 'published' and c.status = 'published' and c.visibility = 'public')
  );
$$;

-- Alunos por curso (só cursos públicos e publicados; matrículas desistentes não contam)
create function public.home_course_students(course_ids uuid[])
returns table (course_id uuid, students bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.course_id, count(*)::bigint
    from enrollments e
    join courses c on c.id = e.course_id
   where e.course_id = any(course_ids)
     and e.status <> 'dropped'
     and c.status = 'published'
     and c.visibility = 'public'
   group by e.course_id;
$$;

-- Top do ranking global
create function public.home_top_learners(lim int default 3)
returns table (id uuid, display_name text, username text, bio text, level int, xp_global int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.username::text, p.bio, p.level, p.xp_global
    from profiles p
   where p.account_status = 'active'
   order by p.xp_global desc, p.created_at asc
   limit least(greatest(coalesce(lim, 3), 1), 10);
$$;

-- Categorias dos cursos públicos e publicados
create function public.home_categories(lim int default 8)
returns table (label text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select trim(c.category), count(*)::bigint
    from courses c
   where c.status = 'published'
     and c.visibility = 'public'
     and nullif(trim(c.category), '') is not null
   group by 1
   order by 2 desc, 1
   limit least(greatest(coalesce(lim, 8), 1), 24);
$$;

-- Cursos em destaque já com autor, XP total, alunos e nota média (cat = null traz todas as categorias)
create function public.home_featured_courses(cat text default null, lim int default 4)
returns table (
  id uuid, slug text, title text, category text, cover_url text, author text,
  xp bigint, students bigint, avg_rating numeric, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.title, c.category, c.cover_url,
         p.username::text,
         coalesce((
           select sum(q.xp_value)
             from modules m
             join lessons l on l.module_id = m.id and l.status = 'published'
             join questions q on q.lesson_id = l.id
            where m.course_id = c.id
         ), 0)::bigint,
         (select count(*) from enrollments e where e.course_id = c.id and e.status <> 'dropped')::bigint,
         (select round(avg(r.rating)::numeric, 1) from reviews r where r.course_id = c.id and r.status = 'published'),
         c.created_at
    from courses c
    left join profiles p on p.id = c.creator_id
   where c.status = 'published'
     and c.visibility = 'public'
     and (cat is null or trim(c.category) = cat)
   order by 8 desc, 9 desc nulls last, c.created_at desc
   limit least(greatest(coalesce(lim, 4), 1), 24);
$$;

-- Depoimentos reais: avaliações publicadas com comentário, de usuários ativos, sobre cursos públicos
create function public.home_featured_reviews(lim int default 3)
returns table (
  id uuid, comment text, rating int, display_name text, username text,
  level int, xp_global int, course_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, trim(r.comment), r.rating, p.display_name, p.username::text,
         p.level, p.xp_global, c.title
    from reviews r
    join profiles p on p.id = r.user_id and p.account_status = 'active'
    join courses c on c.id = r.course_id and c.status = 'published' and c.visibility = 'public'
   where r.status = 'published'
     and nullif(trim(r.comment), '') is not null
   order by r.rating desc, r.created_at desc
   limit least(greatest(coalesce(lim, 3), 1), 10);
$$;

revoke all on function public.home_stats() from public;
revoke all on function public.home_course_students(uuid[]) from public;
revoke all on function public.home_top_learners(int) from public;
grant execute on function public.home_stats() to anon, authenticated;
grant execute on function public.home_course_students(uuid[]) to anon, authenticated;
grant execute on function public.home_top_learners(int) to anon, authenticated;
revoke all on function public.home_categories(int) from public;
revoke all on function public.home_featured_courses(text, int) from public;
grant execute on function public.home_categories(int) to anon, authenticated;
grant execute on function public.home_featured_courses(text, int) to anon, authenticated;
revoke all on function public.home_featured_reviews(int) from public;
grant execute on function public.home_featured_reviews(int) to anon, authenticated;
