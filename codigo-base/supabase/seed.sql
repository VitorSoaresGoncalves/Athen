-- seed.sql
-- Dados de teste para popular a plataforma enquanto as chamadas ao banco não
-- estão ligadas em todas as páginas. NÃO é uma migration: rode manualmente
-- (veja o comando no fim deste arquivo). É idempotente — pode rodar de novo.
--
-- Cria contas acessíveis (login por e-mail, senha única "test123!"), perfis com
-- papéis diferentes (student / educator / admin), cursos criados por DIVERSOS
-- usuários (inclusive students — qualquer um cria curso; educator se diferencia
-- por poder criar/configurar SALAS) e salas de educadores com students membros.
--
-- Observações importantes:
--   * As contas são inseridas direto em auth.users + auth.identities com a senha
--     em hash (bcrypt). O gatilho handle_new_user cria o profile a partir do
--     raw_user_meta_data (username / display_name / role).
--   * courses.duration_minutes é calculado pelos gatilhos da migration 0021;
--     não é definido aqui.
--   * UUIDs são fixos para manter FKs estáveis e permitir reexecução segura.

-- ===========================================================================
-- 1. CONTAS (auth.users + auth.identities) — senha "test123!"
-- ===========================================================================
do $$
declare
  -- Cada registro: id, email, username, display_name, role.
  v_users jsonb := '[
    {"id":"00000000-0000-4000-a000-000000000001","email":"admindev@athen.dev","username":"admindev","name":"AdminDev","role":"admin"},
    {"id":"00000000-0000-4000-a000-000000000002","email":"ana.educator@athen.dev","username":"ana.prof","name":"Ana Ribeiro","role":"educator"},
    {"id":"00000000-0000-4000-a000-000000000003","email":"bruno.educator@athen.dev","username":"bruno.prof","name":"Bruno Carvalho","role":"educator"},
    {"id":"00000000-0000-4000-a000-000000000004","email":"carla.student@athen.dev","username":"carla.s","name":"Carla Mendes","role":"student"},
    {"id":"00000000-0000-4000-a000-000000000005","email":"diego.student@athen.dev","username":"diego.s","name":"Diego Alves","role":"student"},
    {"id":"00000000-0000-4000-a000-000000000006","email":"elisa.student@athen.dev","username":"elisa.s","name":"Elisa Souza","role":"student"},
    {"id":"00000000-0000-4000-a000-000000000007","email":"felipe.student@athen.dev","username":"felipe.s","name":"Felipe Lima","role":"student"}
  ]'::jsonb;
  v_user jsonb;
  v_id uuid;
  v_hash text := crypt('test123!', gen_salt('bf'));
begin
  for v_user in select * from jsonb_array_elements(v_users) loop
    v_id := (v_user->>'id')::uuid;

    -- auth.users: só cria se ainda não existir (idempotente).
    if not exists (select 1 from auth.users where id = v_id) then
      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_user->>'email',
        v_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'username', v_user->>'username',
          'display_name', v_user->>'name',
          'role', v_user->>'role'
        ),
        now(), now(),
        '', '', '', ''
      );

      -- auth.identities: necessário para login por e-mail/senha (GoTrue v2).
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id, v_user->>'email',
        jsonb_build_object('sub', v_id::text, 'email', v_user->>'email', 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end
$$;

-- ===========================================================================
-- 2. ENRIQUECE OS PERFIS (o profile base é criado pelo gatilho handle_new_user)
-- XP/level/streak são "server-authoritative", mas aqui usamos valores de teste
-- só para popular a UI. Ajuste livre.
-- ===========================================================================
update public.profiles set bio = 'Conta administradora de desenvolvimento.', xp_global = 0,    level = 1,  streak_count = 0  where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set bio = 'Professora de programação e lógica.',      xp_global = 5200, level = 12, streak_count = 9  where id = '00000000-0000-4000-a000-000000000002';
update public.profiles set bio = 'Educador de idiomas e humanidades.',        xp_global = 4300, level = 10, streak_count = 3  where id = '00000000-0000-4000-a000-000000000003';
update public.profiles set bio = 'Estudante curiosa, cria trilhas próprias.',  xp_global = 2800, level = 7,  streak_count = 14 where id = '00000000-0000-4000-a000-000000000004';
update public.profiles set bio = 'Aprendendo e compartilhando conhecimento.',  xp_global = 1500, level = 5,  streak_count = 0  where id = '00000000-0000-4000-a000-000000000005';
update public.profiles set bio = 'Foco em ciências e matemática.',             xp_global = 900,  level = 3,  streak_count = 2  where id = '00000000-0000-4000-a000-000000000006';
update public.profiles set bio = 'Começando a jornada no Athen.',              xp_global = 200,  level = 2,  streak_count = 0  where id = '00000000-0000-4000-a000-000000000007';

-- ===========================================================================
-- 3. CURSOS (criados por usuários variados: educators E students)
-- Cada curso tem um número diferente de módulos e aulas.
-- ===========================================================================

-- --- Curso A: Lógica de Programação (educator Ana) — 3 módulos, 7 aulas ------
insert into public.courses (id, creator_id, title, slug, description, category, tags, status, visibility) values
  ('00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-a000-000000000002',
   'Lógica de Programação', 'logica-de-programacao',
   'Fundamentos de lógica, algoritmos e resolução de problemas.',
   'Tecnologia', '{"programação","lógica"}', 'published', 'public')
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, description, icon, color, position) values
  ('00000000-0000-4000-d000-00000000a001', '00000000-0000-4000-c000-00000000000a', 'Introdução à lógica', 'O que é um algoritmo', '🧠', '#06b6d4', 0),
  ('00000000-0000-4000-d000-00000000a002', '00000000-0000-4000-c000-00000000000a', 'Estruturas de decisão', 'Condições e ramificações', '🔀', '#22c55e', 1),
  ('00000000-0000-4000-d000-00000000a003', '00000000-0000-4000-c000-00000000000a', 'Repetição', 'Laços e iteração', '🔁', '#a855f7', 2)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, title, content, position, status) values
  ('00000000-0000-4000-e000-00000000a101', '00000000-0000-4000-d000-00000000a001', 'O que é lógica', 'Introdução.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000a102', '00000000-0000-4000-d000-00000000a001', 'Pseudocódigo', 'Escrevendo passos.', 1, 'published'),
  ('00000000-0000-4000-e000-00000000a103', '00000000-0000-4000-d000-00000000a001', 'Variáveis', 'Guardando valores.', 2, 'published'),
  ('00000000-0000-4000-e000-00000000a201', '00000000-0000-4000-d000-00000000a002', 'If / else', 'Tomando decisões.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000a202', '00000000-0000-4000-d000-00000000a002', 'Operadores lógicos', 'E, ou, não.', 1, 'published'),
  ('00000000-0000-4000-e000-00000000a301', '00000000-0000-4000-d000-00000000a003', 'While', 'Repetindo enquanto.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000a302', '00000000-0000-4000-d000-00000000a003', 'For', 'Repetição contada.', 1, 'published')
on conflict (id) do nothing;

insert into public.questions (id, lesson_id, type, prompt, position, config, explanation) values
  ('00000000-0000-4000-f000-00000000a101', '00000000-0000-4000-e000-00000000a101', 'multiple_choice', 'O que é um algoritmo?', 0,
    '{"options":[{"id":"a","text":"Uma sequência de passos","correct":true},{"id":"b","text":"Um tipo de computador","correct":false}]}'::jsonb,
    'Um algoritmo é uma sequência finita de passos para resolver um problema.'),
  ('00000000-0000-4000-f000-00000000a201', '00000000-0000-4000-e000-00000000a201', 'fill_blank', 'A estrutura ____ executa um bloco quando a condição é verdadeira.', 0,
    '{"answers":["if","se"]}'::jsonb, null)
on conflict (id) do nothing;

-- --- Curso B: Inglês para Conversação (educator Bruno) — 2 módulos, 4 aulas --
insert into public.courses (id, creator_id, title, slug, description, category, tags, status, visibility) values
  ('00000000-0000-4000-c000-00000000000b', '00000000-0000-4000-a000-000000000003',
   'Inglês para Conversação', 'ingles-para-conversacao',
   'Pratique inglês do dia a dia com diálogos e vocabulário.',
   'Idiomas', '{"inglês","conversação"}', 'published', 'public')
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, description, icon, color, position) values
  ('00000000-0000-4000-d000-00000000b001', '00000000-0000-4000-c000-00000000000b', 'Saudações', 'Greetings e apresentações', '👋', '#f97316', 0),
  ('00000000-0000-4000-d000-00000000b002', '00000000-0000-4000-c000-00000000000b', 'No restaurante', 'Pedindo comida', '🍽️', '#eab308', 1)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, title, content, position, status) values
  ('00000000-0000-4000-e000-00000000b101', '00000000-0000-4000-d000-00000000b001', 'Hello / Goodbye', 'Cumprimentos.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000b102', '00000000-0000-4000-d000-00000000b001', 'Introducing yourself', 'Me apresentando.', 1, 'published'),
  ('00000000-0000-4000-e000-00000000b201', '00000000-0000-4000-d000-00000000b002', 'Ordering food', 'Fazendo um pedido.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000b202', '00000000-0000-4000-d000-00000000b002', 'The bill', 'Pagando a conta.', 1, 'published')
on conflict (id) do nothing;

insert into public.questions (id, lesson_id, type, prompt, position, config, explanation) values
  ('00000000-0000-4000-f000-00000000b101', '00000000-0000-4000-e000-00000000b101', 'match', 'Associe a saudação ao momento.', 0,
    '{"pairs":[{"left":"Good morning","right":"Manhã"},{"left":"Good night","right":"Noite"}]}'::jsonb,
    '“Good morning” é usado pela manhã; “Good night” à noite / despedida.')
on conflict (id) do nothing;

-- --- Curso C: Matemática Essencial (student Carla) — 1 módulo, 3 aulas -------
insert into public.courses (id, creator_id, title, slug, description, category, tags, status, visibility) values
  ('00000000-0000-4000-c000-00000000000c', '00000000-0000-4000-a000-000000000004',
   'Matemática Essencial', 'matematica-essencial',
   'Revisão dos conceitos essenciais de matemática.',
   'Matemática', '{"matemática"}', 'published', 'public')
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, description, icon, color, position) values
  ('00000000-0000-4000-d000-00000000c001', '00000000-0000-4000-c000-00000000000c', 'Operações básicas', 'Soma, subtração e mais', '➗', '#06b6d4', 0)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, title, content, position, status) values
  ('00000000-0000-4000-e000-00000000c101', '00000000-0000-4000-d000-00000000c001', 'Soma e subtração', 'Base.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000c102', '00000000-0000-4000-d000-00000000c001', 'Multiplicação', 'Repetindo somas.', 1, 'published'),
  ('00000000-0000-4000-e000-00000000c103', '00000000-0000-4000-d000-00000000c001', 'Divisão', 'Repartindo.', 2, 'published')
on conflict (id) do nothing;

insert into public.questions (id, lesson_id, type, prompt, position, config, explanation) values
  ('00000000-0000-4000-f000-00000000c101', '00000000-0000-4000-e000-00000000c101', 'sum_alternatives', 'Some as alternativas corretas.', 0,
    '{"statements":[{"value":1,"correct":true},{"value":2,"correct":false},{"value":4,"correct":true}],"expected":5}'::jsonb,
    'As alternativas corretas somam 1 + 4 = 5.')
on conflict (id) do nothing;

-- --- Curso D: História da Arte (student Diego) — 2 módulos, 5 aulas ----------
insert into public.courses (id, creator_id, title, slug, description, category, tags, status, visibility) values
  ('00000000-0000-4000-c000-00000000000d', '00000000-0000-4000-a000-000000000005',
   'História da Arte', 'historia-da-arte',
   'Um passeio pelos grandes movimentos artísticos.',
   'Humanidades', '{"arte","história"}', 'published', 'public')
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, description, icon, color, position) values
  ('00000000-0000-4000-d000-00000000d001', '00000000-0000-4000-c000-00000000000d', 'Renascimento', 'Séculos XIV–XVI', '🎨', '#a855f7', 0),
  ('00000000-0000-4000-d000-00000000d002', '00000000-0000-4000-c000-00000000000d', 'Modernismo', 'Séculos XIX–XX', '🖼️', '#f08fb0', 1)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, title, content, position, status) values
  ('00000000-0000-4000-e000-00000000d101', '00000000-0000-4000-d000-00000000d001', 'Leonardo da Vinci', 'Gênio renascentista.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000d102', '00000000-0000-4000-d000-00000000d001', 'Michelangelo', 'Escultura e pintura.', 1, 'published'),
  ('00000000-0000-4000-e000-00000000d103', '00000000-0000-4000-d000-00000000d001', 'Perspectiva', 'A profundidade na arte.', 2, 'published'),
  ('00000000-0000-4000-e000-00000000d201', '00000000-0000-4000-d000-00000000d002', 'Impressionismo', 'Luz e cor.', 0, 'published'),
  ('00000000-0000-4000-e000-00000000d202', '00000000-0000-4000-d000-00000000d002', 'Cubismo', 'Quebrando formas.', 1, 'published')
on conflict (id) do nothing;

-- --- Curso E: rascunho privado (student Elisa) — 1 módulo, 1 aula -----------
-- Serve para testar que rascunhos NÃO aparecem para outros usuários (RLS).
insert into public.courses (id, creator_id, title, slug, description, category, tags, status, visibility) values
  ('00000000-0000-4000-c000-00000000000e', '00000000-0000-4000-a000-000000000006',
   'Meu curso rascunho', 'meu-curso-rascunho',
   'Curso ainda não publicado (teste de RLS).',
   'Geral', '{}', 'draft', 'private')
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, description, icon, color, position) values
  ('00000000-0000-4000-d000-00000000e001', '00000000-0000-4000-c000-00000000000e', 'Rascunho', 'Em construção', '📝', '#eab308', 0)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, title, content, position, status) values
  ('00000000-0000-4000-e000-00000000e101', '00000000-0000-4000-d000-00000000e001', 'Primeira aula', 'WIP.', 0, 'draft')
on conflict (id) do nothing;

-- ===========================================================================
-- 4. MATRÍCULAS (students inscritos em cursos para popular "em andamento")
-- ===========================================================================
insert into public.enrollments (user_id, course_id, status, progress) values
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-c000-00000000000a', 'active', 40),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-c000-00000000000a', 'active', 15),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-c000-00000000000b', 'active', 60),
  ('00000000-0000-4000-a000-000000000007', '00000000-0000-4000-c000-00000000000b', 'active', 10),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-c000-00000000000d', 'completed', 100),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-c000-00000000000c', 'active', 25)
on conflict (course_id, user_id) do nothing;

-- ===========================================================================
-- 5. SALAS (só educators criam) com students como membros
-- ===========================================================================
insert into public.rooms (id, educator_id, course_id, name, access_code, code_active, pac_visibility) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002',
   '00000000-0000-4000-c000-00000000000a', 'Turma de Lógica 2025', 'LOGICA25', true, 'members'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003',
   '00000000-0000-4000-c000-00000000000b', 'Inglês - Turma A', 'INGLES-A', true, 'members')
on conflict (id) do nothing;

-- Membros das salas (students). O educator dono não precisa ser membro.
insert into public.room_members (room_id, user_id, status, progress, xp_internal) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'active', 35, 180),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000005', 'active', 20, 90),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000007', 'active', 5,  20),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000006', 'active', 50, 240),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000004', 'active', 10, 40)
on conflict (room_id, user_id) do nothing;

-- ===========================================================================
-- Como rodar (a partir de codigo-base):
--   supabase db execute --file supabase/seed.sql
-- (ou cole o conteúdo no SQL Editor do painel do Supabase e execute)
--
-- Login de teste: qualquer e-mail acima + senha "test123!".
-- ===========================================================================
