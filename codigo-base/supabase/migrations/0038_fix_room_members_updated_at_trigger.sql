-- 0038_fix_room_members_updated_at_trigger.sql
-- Correção: remove o trigger set_updated_at de public.room_members.
--
-- Bug (pré-existente, de 0012): o 0012 anexa o trigger genérico set_updated_at
-- (que faz `new.updated_at := now()`) a uma lista de tabelas que INCLUI
-- room_members — porém room_members NÃO tem a coluna updated_at (usa joined_at/
-- removed_at). Enquanto nada atualizava room_members o bug ficava latente.
--
-- A issue 42 expôs o bug: finalize_attempt em contexto de SALA executa
--   update public.room_members set xp_internal = xp_internal + ...
-- o que dispara o trigger `before update`, que tenta `new.updated_at` e falha
-- com: "record \"new\" has no field \"updated_at\"" (SQLSTATE 42703). Isso
-- quebrava a conclusão de aula em sala pelo dashboard e pela página de salas.
--
-- Correção mínima e correta: remover o trigger de room_members (a coluna
-- updated_at não faz parte do design dessa tabela). As demais tabelas da lista
-- de 0012 têm updated_at e seguem com o trigger normalmente.

drop trigger if exists set_updated_at on public.room_members;
