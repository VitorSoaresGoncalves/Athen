import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect } from '@playwright/test'

const localDatabaseUrl = () => {
  const raw = process.env.SUPABASE_DB_URL
  if (!raw) throw new Error('SUPABASE_DB_URL é necessário para preparar a fixture PostgreSQL local.')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('SUPABASE_DB_URL inválido para a fixture local.')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('A jornada de revisão aceita somente PostgreSQL local.')
  }
  if (url.hostname !== '127.0.0.1' || Number(url.port) !== 55322 || url.pathname !== '/postgres') {
    throw new Error('Fixture recusada: use somente o projeto Supabase local descartável athen-issue47.')
  }
  return raw
}

for (const mode of ['normal', 'suppressed', 'delivered']) {
const bonus = mode !== 'normal'
const delivered = mode === 'delivered'
test(`revisão real ${delivered ? 'por aviso entregue e lido' : bonus ? 'bonificada sem aviso, reprovação e nova intenção' : 'normal sem XP'} persiste resultado`, async ({ page, browser }) => {
  const connectionString = localDatabaseUrl()
  const suffix = randomUUID().replaceAll('-', '')
  const email = `review-live-${suffix}@example.test`
  const password = `Review-${randomUUID()}`
  const username = `review_${suffix.slice(0, 18)}`
  const ids = {
    course: randomUUID(),
    module: randomUUID(),
    lesson: randomUUID(),
    question: randomUUID(),
  }
  const db = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
    application_name: 'athen-issue47-live-review',
  })
  let userId: string | undefined
  let fixtureReady = false
  let beforeXp: number
  let sessionId: string | undefined
  let occurrenceId: string | undefined
  let failedSession: string | null = null
  let otherUserId: string | undefined

  try {
    await db.connect()
    const target = await db.query<{
      database: string
      port: number
      has0042: boolean
      has0043: boolean
      has0044: boolean
      has0045: boolean
    }>(`
      select current_database() as database, inet_server_port() as port,
        exists(select 1 from supabase_migrations.schema_migrations where version='0042') as "has0042",
        exists(select 1 from supabase_migrations.schema_migrations where version='0043') as "has0043",
        exists(select 1 from supabase_migrations.schema_migrations where version='0044') as "has0044",
        exists(select 1 from supabase_migrations.schema_migrations where version='0045') as "has0045"
    `)
    const server = target.rows[0]
    if (!server || server.database !== 'postgres' || server.port !== 5432
      || !server.has0042 || !server.has0043 || !server.has0044 || !server.has0045) {
      throw new Error('Banco local não corresponde ao projeto de ensaio com migrações 0042–0045.')
    }

    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = '.trail-node--active { animation: none !important; }'
        document.head.appendChild(style)
      })
    })
    await page.goto('/register-page')
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByLabel('Cargo', { exact: true }).selectOption('student')
    await page.getByLabel('Nome de usuário', { exact: true }).fill(username)
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
    await expect(page.getByText('Cadastro realizado com sucesso!', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Ir para o login', exact: true }).click()
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/dashboard')

    const registered = await db.query<{ id: string }>('select id from auth.users where email=$1', [email])
    userId = registered.rows[0]?.id
    if (!userId) throw new Error('Auth local não persistiu a conta de ensaio.')

    await db.query('begin')
    try {
      await db.query(
        `insert into public.courses(id,creator_id,title,slug,description,category,tags,status,visibility)
         values($1,$2,$3,$4,'Fixture isolada da jornada real','Tecnologia','{}','published','public')`,
        [ids.course, userId, `Revisão live ${suffix.slice(0, 8)}`, `review-live-${suffix}`],
      )
      await db.query(
        `insert into public.modules(id,course_id,title,description,icon,color,position)
         values($1,$2,'Módulo real','Fixture de teste','book','#06b6d4',0)`,
        [ids.module, ids.course],
      )
      await db.query(
        `insert into public.lessons(id,module_id,title,content,position,status)
         values($1,$2,'Aula de revisão','Conteúdo da fixture',0,'published')`,
        [ids.lesson, ids.module],
      )
      await db.query(
        `insert into public.questions(id,lesson_id,type,prompt,position,config,explanation)
         values($1,$2,'multiple_choice','Qual opção é correta?',0,
           '{"options":[{"id":"a","text":"Resposta correta","correct":true},
                       {"id":"b","text":"Resposta incorreta","correct":false}]}'::jsonb,
           'Correção oficial do servidor')`,
        [ids.question, ids.lesson],
      )
      await db.query(
        `insert into public.enrollments(user_id,course_id,status,progress)
         values($1,$2,'active',100)`,
        [userId, ids.course],
      )
      // A conclusão individual é apenas setup SQL da fixture; a revisão,
      // correção e resultado abaixo passam pelas RPCs/PostgREST reais.
      await db.query(
        `insert into public.completions(user_id,lesson_id,context,attempt_id)
         values($1,$2,'course',null)`,
        [userId, ids.lesson],
      )
      const profile = await db.query<{ xp_global: number }>(
        `select xp_global from public.profiles where id=$1`,
        [userId],
      )
      if (!profile.rows[0]) throw new Error('Perfil da conta de ensaio não foi criado.')
      beforeXp = profile.rows[0].xp_global
      if (bonus) {
        await db.query("update public.profiles set notification_preferences=jsonb_build_object('revisao_curso',$2::boolean) where id=$1", [userId, delivered])
        await db.query("update public.course_review_schedules set anchor_at=clock_timestamp()-interval '8 days',anchor_source='rollout',first_course_completed_at=null where user_id=$1", [userId])
        await db.query('select * from public.tick_course_reviews()')
        const occurrence = await db.query<{ id: string; delivery_state: string; notification_id: string | null }>(
          'select id,delivery_state,notification_id from public.course_review_occurrences where user_id=$1', [userId])
        expect(occurrence.rows).toHaveLength(1)
        expect(occurrence.rows[0].delivery_state).toBe(delivered ? 'delivered' : 'suppressed')
        if (delivered) expect(occurrence.rows[0].notification_id).toBeTruthy()
        else expect(occurrence.rows[0].notification_id).toBeNull()
        occurrenceId = occurrence.rows[0].id
        if (delivered) {
          // Reproduz duas simulações no mesmo usuário: a ocorrência antiga
          // ainda não expirou, mas somente o novo período da agenda é atual.
          await db.query("update public.notifications set created_at=clock_timestamp()-interval '1 minute' where id=$1", [occurrence.rows[0].notification_id])
          await db.query("update public.course_review_schedules set anchor_at=clock_timestamp()-interval '15 days' where user_id=$1", [userId])
          await db.query('select * from public.tick_course_reviews()')
          const latest = await db.query<{ id: string }>('select id from public.course_review_occurrences where user_id=$1 and period_index=2', [userId])
          occurrenceId = latest.rows[0]?.id
          expect(occurrenceId).toBeTruthy()
        }
        expect((await db.query("select id from public.notifications where recipient_id=$1 and type='revisao_curso'", [userId])).rowCount).toBe(delivered ? 2 : 0)
      }
      await db.query('commit')
      fixtureReady = true
    } catch (error) {
      await db.query('rollback').catch(() => undefined)
      throw error
    }

    await page.goto(`/dashboard?curso=${ids.course}`)
    await page.locator('.course-review-entry__trigger').click()
    await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
    if (delivered) {
      await page.goto('/notificacoes')
      await expect(page.getByText('Revisão de curso disponível', { exact: true })).toHaveCount(2)
      await page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true }).last().click()
      await expect(page.getByText('Revisão de curso disponível', { exact: true })).toHaveCount(1)
      await expect.poll(async () => (await db.query("select is_read from public.notifications where recipient_id=$1 and type='revisao_curso'", [userId])).rows[0]?.is_read).toBe(true)
      await page.reload()
      await page.getByText('Revisão de curso disponível', { exact: true }).click()
    } else {
      await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
    }
    await expect(page).toHaveURL(`/dashboard?revisao=${bonus ? occurrenceId : 'normal'}`)
    if (bonus) {
      await expect(page.getByText(/Revisão com bônus.*Meta: 70%/)).toBeVisible()
    } else {
      await expect(page.getByText('Sem bônus de revisão')).toBeVisible()
    }
    await expect(page.getByText('1 questão · 20% por módulo, arredondado para cima.')).toBeVisible()
    await page.getByRole('button', { name: 'Começar revisão' }).click()
    await expect(page.getByRole('heading', { name: 'Qual opção é correta?' })).toBeVisible()
    if (bonus && !delivered) {
      failedSession = new URL(page.url()).searchParams.get('sessao')
      expect(failedSession).toBeTruthy()
      await page.getByRole('checkbox', { name: 'Resposta incorreta', exact: true }).click()
      await page.getByRole('button', { name: 'Verificar', exact: true }).click()
      await page.getByRole('button', { name: 'Finalizar revisão', exact: true }).click()
      await expect(page.getByText(/Meta não atingida\./)).toBeVisible()
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Qual opção é correta?' })).toBeVisible()
    }
    const sessionParam = new URL(page.url()).searchParams.get('sessao')
    if (!sessionParam) throw new Error('A sessão real não foi registrada na URL.')
    sessionId = sessionParam
    if (bonus && !delivered) expect(sessionId).not.toBe(failedSession)

    await page.getByRole('checkbox', { name: 'Resposta correta', exact: true }).click()
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByText('Correto!', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Finalizar revisão' }).click()
    await expect(page.getByRole('heading', { name: 'Revisão finalizada' })).toBeVisible()
    await expect(page.getByText('Bônus de revisão recebido!')).toHaveCount(bonus ? 1 : 0)
    await expect(page.getByText(bonus ? '+10' : '+0', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Voltar à trilha' }).click()
    await page.locator('.course-review-entry__trigger').click()

    const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
    await expect(card.getByText(`Última revisão · ${bonus ? 'Com bônus' : 'Prática normal'}`)).toBeVisible()
    await expect(card).toContainText(`1/1 acertos · +${bonus ? 10 : 0} XP`)
    await page.reload()
    await page.locator('.course-review-entry__trigger').click()
    await expect(card).toContainText(`1/1 acertos · +${bonus ? 10 : 0} XP`)
    await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toHaveCount(1)

    await page.goto(`/dashboard?curso=${ids.course}&revisao=${bonus ? occurrenceId : 'normal'}&sessao=${sessionId}`)
    await expect(page.getByRole('heading', { name: 'Revisão finalizada' })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('1/1', { exact: true })).toBeVisible()

    const persisted = await db.query<{
      mode: string
      correct_count: number
      total_count: number
      bonus_earned: number
      bonus_outcome: string
      attempt_count: string
      xp_global: number
    }>(`
      select s.mode,s.correct_count,s.total_count,s.bonus_earned,s.bonus_outcome,
        (select count(*)::text from public.attempts a where a.user_id=s.user_id) as attempt_count,
        p.xp_global
      from public.course_review_sessions s join public.profiles p on p.id=s.user_id
      where s.id=$1 and s.user_id=$2
    `, [sessionId, userId])
    const result = persisted.rows[0]
    expect(result).toMatchObject({
      mode: bonus ? 'bonus' : 'normal',
      correct_count: 1,
      total_count: 1,
      bonus_earned: bonus ? 10 : 0,
      bonus_outcome: bonus ? 'awarded' : 'not_applicable',
      attempt_count: '0',
      xp_global: beforeXp + (bonus ? 10 : 0),
    })
    if (delivered) {
      await page.goto('/notificacoes')
      await page.getByRole('button', { name: 'Limpar lidas', exact: true }).click()
      await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toBeVisible()
      await db.query('select * from public.tick_course_reviews()')
      expect((await db.query("select id from public.notifications where recipient_id=$1 and type='revisao_curso'", [userId])).rowCount).toBe(0)
      await page.goto(`/dashboard?curso=${ids.course}`)
    await page.locator('.course-review-entry__trigger').click()
      await expect(card).toContainText('1/1 acertos · +10 XP')
    }
    if (bonus && !delivered) {
      await page.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}&sessao=${failedSession}`)
      await expect(page.getByText(/Meta não atingida\./)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toHaveCount(0)
      const facts = await db.query('select bonus_earned,bonus_outcome from public.course_review_sessions where id=$1', [failedSession])
      expect(facts.rows[0]).toMatchObject({ bonus_earned: 0, bonus_outcome: 'below_target' })
      expect((await db.query("select id from public.xp_events where user_id=$1 and origin='review_bonus'", [userId])).rowCount).toBe(1)

      const otherContext = await browser.newContext({
        baseURL: new URL(page.url()).origin,
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      })
      try {
        const otherPage = await otherContext.newPage()
        const otherEmail = `review-other-${suffix}@example.test`
        await otherPage.goto('/register-page')
        await otherPage.getByLabel('E-mail', { exact: true }).fill(otherEmail)
        await otherPage.getByLabel('Senha', { exact: true }).fill(password)
        await otherPage.getByLabel('Cargo', { exact: true }).selectOption('student')
        await otherPage.getByLabel('Nome de usuário', { exact: true }).fill(`other_${suffix.slice(0,18)}`)
        await otherPage.getByRole('button', { name: 'Cadastrar', exact: true }).click()
        await expect(otherPage.getByText('Cadastro realizado com sucesso!', { exact: true })).toBeVisible()
        otherUserId = (await db.query<{ id: string }>('select id from auth.users where email=$1', [otherEmail])).rows[0]?.id
        await otherPage.getByRole('link', { name: 'Ir para o login', exact: true }).click()
        await otherPage.getByLabel('E-mail', { exact: true }).fill(otherEmail)
        await otherPage.getByLabel('Senha', { exact: true }).fill(password)
        await otherPage.getByRole('button', { name: 'Entrar', exact: true }).click()
        await expect(otherPage).toHaveURL('/dashboard')
        await otherPage.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}&sessao=${sessionId}`)
        await expect(otherPage.getByText('Você não tem acesso a esta revisão.', { exact: true })).toBeVisible()
        await expect(otherPage.getByRole('heading', { name: 'Qual opção é correta?' })).toHaveCount(0)
      } finally { await otherContext.close() }
    }
  } finally {
    if (fixtureReady && userId) {
      await db.query('begin').catch(() => undefined)
      try {
        await db.query('update public.course_review_occurrences set reward_session_id=null,rewarded_at=null,xp_event_id=null where user_id=$1', [userId])
        await db.query(`delete from public.courses where id=$1`, [ids.course])
        await db.query(`delete from auth.users where id=$1`, [userId])
        await db.query('commit')
      } catch {
        await db.query('rollback').catch(() => undefined)
        console.error('Live review fixture cleanup failed; no credentials or SQL payload were logged.')
      }
    } else if (userId) {
      await db.query(`delete from public.courses where id=$1`, [ids.course]).catch(() => undefined)
      await db.query(`delete from auth.users where id=$1`, [userId]).catch(() => undefined)
    }
    if (otherUserId) await db.query('delete from auth.users where id=$1', [otherUserId]).catch(() => undefined)
    await db.end().catch(() => undefined)
  }
})
}
