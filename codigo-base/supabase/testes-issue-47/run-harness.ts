// Harness issue 47: somente o PostgreSQL local descartável deste projeto.
// Nunca registra URL, credenciais ou payloads das conexões.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client, type QueryResultRow } from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const harnessPath = join(here, 'harness.sql')
const expectedPort = 55322
const timeoutMs = 30_000

type ReviewSession = QueryResultRow & {
  session_id: string
  items: Array<{ question_id: string; type: string }>
}

type ReviewResult = QueryResultRow & {
  session_id: string
  correct_count: number
  approved: boolean
  bonus_earned: number
  bonus_outcome: string
}

function localDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error('SUPABASE_DB_URL não definido')

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('SUPABASE_DB_URL inválido; esperado PostgreSQL local de ensaio')
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') ||
    host !== '127.0.0.1' ||
    Number(parsed.port) !== expectedPort ||
    parsed.pathname.replace(/^\//, '') !== 'postgres'
  ) {
    throw new Error(
      `Alvo recusado: use somente 127.0.0.1:${expectedPort}/postgres do Supabase local descartável`,
    )
  }
  return raw
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Erro SQL sem mensagem segura disponível'
  const message = error.message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '[URL suprimida]')
    .replace(/password\s*=\s*[^;\s]+/gi, 'password=[suprimido]')
    .slice(0, 1200)
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
  const position =
    'position' in error && (typeof error.position === 'string' || typeof error.position === 'number')
      ? error.position
      : undefined
  const metadata = code ? ` SQLSTATE=${code}${position ? ` position=${position}` : ''}` : ''
  return `${message}${metadata}`
}

function newClient(connectionString: string, applicationName: string): Client {
  return new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: timeoutMs,
    statement_timeout: timeoutMs,
    application_name: applicationName,
  })
}

function claims(userId: string): string {
  return JSON.stringify({ sub: userId, role: 'authenticated' })
}

async function cleanupConcurrentFixture(
  connectionString: string,
  userId: string,
  courseIds: string[],
): Promise<void> {
  const client = newClient(connectionString, 'athen-issue47-concurrency-cleanup')
  try {
    await client.connect()
    await client.query('begin')
    await client.query(
      `update public.course_review_occurrences
          set reward_session_id=null,rewarded_at=null,xp_event_id=null
        where user_id=$1`,
      [userId],
    )
    await client.query(`delete from public.course_review_sessions where user_id=$1`, [userId])
    await client.query(`delete from public.course_review_occurrences where user_id=$1`, [userId])
    await client.query(`delete from public.course_review_schedules where user_id=$1`, [userId])
    await client.query(`delete from public.courses where id = any($1::uuid[])`, [courseIds])
    await client.query(`delete from auth.users where id=$1`, [userId])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function setupConcurrentFixture(connectionString: string): Promise<{
  userId: string
  reviewCourseId: string
  missionCourseId: string
  questionLessonId: string
  emptyLessonId: string
  repeatedEmptyLessonId: string
  questionId: string
  sessionIds: string[]
  attemptIds: string[]
  beforeXp: number
}> {
  const userId = randomUUID()
  const reviewCourseId = randomUUID()
  const missionCourseId = randomUUID()
  const reviewModuleId = randomUUID()
  const missionModuleId = randomUUID()
  const questionLessonId = randomUUID()
  const emptyLessonId = randomUUID()
  const repeatedEmptyLessonId = randomUUID()
  const questionId = randomUUID()
  const requestIds = [randomUUID(), randomUUID(), randomUUID()]
  const occurrenceIds = [randomUUID(), randomUUID(), randomUUID()]
  const attemptIds = [randomUUID(), randomUUID()]
  const email = `issue47-${userId}@example.invalid`
  const username = `issue47_${userId.replaceAll('-', '').slice(0, 16)}`
  const client = newClient(connectionString, 'athen-issue47-concurrency-setup')
  let transactionOpen = false

  try {
    await client.connect()
    await client.query('begin')
    transactionOpen = true

    // Conta e cursos exclusivos: exclusão em finally remove também seus fatos
    // dependentes. As três RPCs concorrentes abaixo sempre usam outro backend.
    await client.query(
      `insert into auth.users (
         instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
         raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
         confirmation_token,recovery_token,email_change_token_new,email_change
       ) values (
         '00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'',
         clock_timestamp(),'{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('username',$3::text,'display_name','Issue 47 concurrency','role','student'),
         clock_timestamp(),clock_timestamp(),'','','',''
       )`,
      [userId, email, username],
    )

    await client.query(
      `insert into public.courses
         (id,creator_id,title,slug,description,category,tags,status,visibility)
       values
         ($1,$3,'Issue 47 review fixture',$4,'local SQL harness','General','{}','published','public'),
         ($2,$3,'Issue 47 mission fixture',$5,'local SQL harness','General','{}','published','public')`,
      [reviewCourseId, missionCourseId, userId, `issue47-review-${userId}`, `issue47-mission-${userId}`],
    )
    await client.query(
      `insert into public.modules (id,course_id,title,description,icon,color,position)
       values
         ($1,$3,'Review','fixture','book','#123456',0),
         ($2,$4,'Mission','fixture','book','#123456',0)`,
      [reviewModuleId, missionModuleId, reviewCourseId, missionCourseId],
    )
    await client.query(
      `insert into public.lessons (id,module_id,title,content,position,status)
       values
         ($1,$3,'Question lesson','fixture',0,'published'),
         ($2,$4,'Empty mission lesson','fixture',0,'published'),
         ($5,$4,'Repeated empty mission lesson','fixture',1,'published')`,
      [questionLessonId, emptyLessonId, reviewModuleId, missionModuleId, repeatedEmptyLessonId],
    )
    await client.query(
      `insert into public.questions (id,lesson_id,type,prompt,position,config,explanation)
       values ($1,$2,'multiple_choice','Fixture question',0,
         '{"options":[{"id":"correct","text":"Correct","correct":true},
                      {"id":"wrong","text":"Wrong","correct":false}]}'::jsonb,
         null)`,
      [questionId, questionLessonId],
    )
    await client.query(
      `insert into public.enrollments (user_id,course_id,status,progress)
       values ($1,$2,'active',100),($1,$3,'active',0)`,
      [userId, reviewCourseId, missionCourseId],
    )
    // Course review is eligible independently of the empty lesson in the
    // separate mission course. This completion also creates the global anchor.
    await client.query(
      `insert into public.completions (user_id,lesson_id,context,attempt_id)
       values ($1,$2,'course',null)`,
      [userId, questionLessonId],
    )
    await client.query(
      `insert into public.course_review_occurrences (
         id,user_id,period_index,due_at,expires_at,selection_state,course_id,
         course_title,assigned_at,bonus_xp,delivery_state
       ) values
         ($1,$4,101,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day',
          'assigned',$5,'Issue 47 review fixture',clock_timestamp(),10,'suppressed'),
         ($2,$4,102,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day',
          'assigned',$5,'Issue 47 review fixture',clock_timestamp(),10,'suppressed'),
         ($3,$4,103,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day',
          'assigned',$5,'Issue 47 review fixture',clock_timestamp(),10,'suppressed')`,
      [...occurrenceIds, userId, reviewCourseId],
    )

    await client.query('commit')
    transactionOpen = false

    const sessionIds: string[] = []
    for (let index = 0; index < occurrenceIds.length; index += 1) {
      const rpc = newClient(connectionString, `athen-issue47-session-${index + 1}`)
      try {
        await rpc.connect()
        await rpc.query('begin')
        await rpc.query(`select set_config('request.jwt.claims',$1,true)`, [claims(userId)])
        await rpc.query('set local role authenticated')
        const started = await rpc.query<ReviewSession>(
          `select * from public.start_course_review($1,$2,$3)`,
          [reviewCourseId, requestIds[index], occurrenceIds[index]],
        )
        const session = started.rows[0]
        if (!session || session.items.length !== 1 || session.items[0]?.type !== 'multiple_choice') {
          throw new Error('Amostra concorrente não corresponde à questão fixture')
        }
        await rpc.query(
          `select * from public.submit_course_review_answer($1,$2,$3::jsonb)`,
          [session.session_id, questionId, JSON.stringify({ selected: ['correct'] })],
        )
        await rpc.query('commit')
        sessionIds.push(session.session_id)
      } catch (error) {
        await rpc.query('rollback').catch(() => undefined)
        throw error
      } finally {
        await rpc.end().catch(() => undefined)
      }
    }

    const attemptSetup = await newClient(connectionString, 'athen-issue47-attempt-setup')
    let attemptsOpen = false
    try {
      await attemptSetup.connect()
      await attemptSetup.query('begin')
      attemptsOpen = true
      for (const attemptId of attemptIds) {
        await attemptSetup.query(
          `insert into public.attempts (id,user_id,lesson_id,course_id)
           values ($1,$2,$3,$4)`,
          [attemptId, userId, questionLessonId, reviewCourseId],
        )
        await attemptSetup.query(
          `insert into public.answers (attempt_id,question_id,submitted)
           values ($1,$2,'{"selected":["correct"]}'::jsonb)`,
          [attemptId, questionId],
        )
      }
      await attemptSetup.query('commit')
      attemptsOpen = false
    } finally {
      if (attemptsOpen) await attemptSetup.query('rollback').catch(() => undefined)
      await attemptSetup.end().catch(() => undefined)
    }

    const profile = await client.query<{ xp_global: number }>(
      `select xp_global from public.profiles where id=$1`,
      [userId],
    )
    const beforeXp = profile.rows[0]?.xp_global
    if (beforeXp === undefined) throw new Error('Fixture profile ausente após criar auth.users')
    return {
      userId,
      reviewCourseId,
      missionCourseId,
      questionLessonId,
      emptyLessonId,
      repeatedEmptyLessonId,
      questionId,
      sessionIds,
      attemptIds,
      beforeXp,
    }
  } catch (error) {
    if (transactionOpen) await client.query('rollback').catch(() => undefined)
    else {
      try {
        await cleanupConcurrentFixture(connectionString, userId, [reviewCourseId, missionCourseId])
      } catch (cleanupError) {
        console.error(`HARNESS ISSUE 47: limpeza de fixture falhou — ${safeErrorMessage(cleanupError)}`)
      }
    }
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function userRpc<T extends QueryResultRow>(
  connectionString: string,
  userId: string,
  sql: string,
  values: unknown[],
  applicationName: string,
): Promise<T> {
  const client = newClient(connectionString, applicationName)
  try {
    await client.connect()
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims',$1,true)`, [claims(userId)])
    await client.query('set local role authenticated')
    const result = await client.query<T>(sql, values)
    await client.query('commit')
    const row = result.rows[0]
    if (!row) throw new Error(`RPC sem linha de retorno: ${applicationName}`)
    return row
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function runConcurrentLockOrderRegressions(
  connectionString: string,
): Promise<void> {
  const fixture = await setupConcurrentFixture(connectionString)
  try {
    const emptyLesson = (lessonId: string) =>
      userRpc(
        connectionString,
        fixture.userId,
        `select public.complete_empty_lesson($1) as completed`,
        [lessonId],
        'athen-issue47-empty-lesson',
      )
    const finishReview = (index: number) =>
      userRpc<ReviewResult>(
        connectionString,
        fixture.userId,
        `select bonus_earned,bonus_outcome
           from public.finalize_course_review($1)`,
        [fixture.sessionIds[index]],
        `athen-issue47-review-finalize-${index + 1}`,
      )
    const finishAttempt = (index: number) =>
      userRpc(
        connectionString,
        fixture.userId,
        `select correct_count,total_count,xp_earned
           from public.finalize_attempt($1)`,
        [fixture.attemptIds[index]],
        `athen-issue47-attempt-finalize-${index + 1}`,
      )
    const concurrent = async (name: string, promises: Promise<unknown>[]) => {
      const results = await Promise.allSettled(promises)
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (rejected) throw new Error(`${name}: ${safeErrorMessage(rejected.reason)}`)
      const review = results.find(
        (result): result is PromiseFulfilledResult<ReviewResult> =>
          result.status === 'fulfilled' &&
          typeof result.value === 'object' &&
          result.value !== null &&
          'bonus_outcome' in result.value,
      )?.value
      if (!review || review.bonus_earned !== 10 || review.bonus_outcome !== 'awarded') {
        throw new Error(`${name}: a revisão concorrente não recebeu seu prêmio único`)
      }
    }

    // RPCs verdadeiras em conexões independentes. Nenhum lock em profiles é
    // adquirido pelo harness; somente os efeitos normais das funções são usados.
    await concurrent('conclusão de aula vazia com missão × revisão bônus', [
      emptyLesson(fixture.emptyLessonId),
      finishReview(0),
    ])
    await concurrent('duas finalizações da mesma aula × revisão bônus', [
      finishAttempt(0),
      finishAttempt(1),
      finishReview(1),
    ])
    await concurrent('repetição de aula vazia × revisão bônus', [
      emptyLesson(fixture.repeatedEmptyLessonId),
      emptyLesson(fixture.repeatedEmptyLessonId),
      finishReview(2),
    ])

    const client = newClient(connectionString, 'athen-issue47-concurrency-assertions')
    try {
      await client.connect()
      const result = await client.query<{
        event_count: string
        event_total: number
        mission_event_count: string
        xp_global: number
      }>(
        `select
           (select count(*)::text from public.xp_events
             where user_id=$1 and origin='review_bonus'
               and idempotency_key like 'xp:course-review:%') as event_count,
           (select coalesce(sum(amount),0)::integer from public.xp_events
             where user_id=$1 and origin='review_bonus'
               and idempotency_key like 'xp:course-review:%') as event_total,
           (select count(*)::text from public.xp_events
             where user_id=$1 and origin='mission_bonus' and amount > 0) as mission_event_count,
           p.xp_global
         from public.profiles p where p.id=$1`,
        [fixture.userId],
      )
      const row = result.rows[0]
      if (
        !row ||
        Number(row.event_count) !== 3 ||
        row.event_total !== 30 ||
        Number(row.mission_event_count) < 1 ||
        row.xp_global < fixture.beforeXp + 30
      ) {
        throw new Error('Concorrência: bônus de revisão/XP ou prêmio da missão da aula vazia ausente')
      }
    } finally {
      await client.end().catch(() => undefined)
    }
    console.warn('HARNESS ISSUE 47: concorrência 0044 passou (3 pares de RPC reais)')
  } finally {
    try {
      await cleanupConcurrentFixture(connectionString, fixture.userId, [
        fixture.reviewCourseId,
        fixture.missionCourseId,
      ])
    } catch (error) {
      console.error(`HARNESS ISSUE 47: limpeza concorrente falhou — ${safeErrorMessage(error)}`)
      process.exitCode = 1
    }
  }
}


async function runReviewContractRegressions(connectionString: string): Promise<void> {
  const fixture = await setupConcurrentFixture(connectionString)
  const owner = newClient(connectionString, 'athen-issue47-contract-owner')
  const check = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message)
  }
  const rpc = <T extends QueryResultRow>(sql: string, values: unknown[] = []) =>
    userRpc<T>(connectionString, fixture.userId, sql, values, 'athen-issue47-contract-rpc')
  const start = (requestId = randomUUID(), occurrenceId?: string) =>
    rpc<ReviewSession>('select * from public.start_course_review($1,$2,$3)',
      [fixture.reviewCourseId, requestId, occurrenceId ?? null])
  const answer = async (session: ReviewSession, correctCount: number) => {
    for (const [index, item] of session.items.entries()) {
      await rpc('select * from public.submit_course_review_answer($1,$2,$3::jsonb)',
        [session.session_id, item.question_id, JSON.stringify({ selected: [index < correctCount ? 'correct' : 'wrong'] })])
    }
  }
  const finish = (id: string) =>
    rpc<ReviewResult>('select * from public.finalize_course_review($1)', [id])
  const expectError = async (action: () => Promise<unknown>, message: string) => {
    try { await action() } catch (error) {
      check(error instanceof Error && error.message === message, 'Erro esperado: ' + message)
      return
    }
    throw new Error('Operação deveria falhar: ' + message)
  }
  try {
    await owner.connect()
    // Anchors established by the official completion observer are stable.
    const anchor = (await owner.query(
      'select anchor_at,anchor_source,first_course_completed_at from public.course_review_schedules where user_id=$1',
      [fixture.userId])).rows[0]
    check(anchor?.anchor_source === 'first_completion'
      && anchor.first_course_completed_at.getTime() === anchor.anchor_at.getTime(), 'Primeiro marco oficial ausente')
    await rpc('select public.complete_empty_lesson($1) as done', [fixture.emptyLessonId])
    await rpc('select public.complete_empty_lesson($1) as done', [fixture.repeatedEmptyLessonId])
    await owner.query('update public.completions set completed_at=clock_timestamp() where user_id=$1', [fixture.userId])
    const unchanged = (await owner.query('select anchor_at from public.course_review_schedules where user_id=$1', [fixture.userId])).rows[0]
    check(unchanged.anchor_at.getTime() === anchor.anchor_at.getTime(), 'Segundo curso/repetição moveu âncora')

    await owner.query("update public.profiles set notification_preferences='{\"revisao_curso\":false}'::jsonb where id=$1", [fixture.userId])
    await owner.query("update public.course_review_schedules set anchor_at=clock_timestamp()-interval '6 days',anchor_source='rollout',first_course_completed_at=null where user_id=$1", [fixture.userId])
    await owner.query('select * from public.tick_course_reviews()')
    check((await owner.query('select id from public.course_review_occurrences where user_id=$1 and period_index<100', [fixture.userId])).rowCount === 0, 'Atividade antes de sete dias')

    // A period without candidates can later choose once, without extending expiry.
    await owner.query("update public.enrollments set status='dropped' where user_id=$1", [fixture.userId])
    await owner.query("update public.course_review_schedules set anchor_at=clock_timestamp()-interval '8 days' where user_id=$1", [fixture.userId])
    await owner.query('select * from public.tick_course_reviews()')
    const empty = (await owner.query('select * from public.course_review_occurrences where user_id=$1 and period_index=1', [fixture.userId])).rows[0]
    check(empty?.selection_state === 'no_candidates' && empty.bonus_xp === 0, 'Sem candidatos deve produzir período sem prêmio')
    await owner.query("update public.enrollments set status='active' where user_id=$1", [fixture.userId])
    // Make the two completed courses genuine candidates; retain the selected one.
    await owner.query('insert into public.questions(lesson_id,type,prompt,position,config) select $1,type,prompt,0,config from public.questions where id=$2',
      [fixture.emptyLessonId, fixture.questionId])
    const tick = async () => {
      const client = newClient(connectionString, 'athen-issue47-concurrent-tick')
      try {
        await client.connect()
        return await client.query('select * from public.tick_course_reviews()')
      } finally { await client.end().catch(() => undefined) }
    }
    await Promise.all([tick(), tick()])
    const occurrence = (await owner.query('select * from public.course_review_occurrences where user_id=$1 and period_index=1', [fixture.userId])).rows[0]
    check(occurrence?.selection_state === 'assigned'
      && [fixture.reviewCourseId, fixture.missionCourseId].includes(occurrence.course_id)
      && occurrence.delivery_state === 'suppressed' && occurrence.notification_id === null
      && occurrence.expires_at.getTime() === empty.expires_at.getTime(), 'Tick concorrente/opt-out/sorteio inválido')
    await owner.query("update public.profiles set notification_preferences='{\"revisao_curso\":true}'::jsonb where id=$1", [fixture.userId])
    await owner.query('select * from public.tick_course_reviews()')
    const replayTick = (await owner.query('select * from public.course_review_occurrences where id=$1', [occurrence.id])).rows[0]
    check(replayTick.course_id === occurrence.course_id && replayTick.notification_id === null
      && (await owner.query("select id from public.notifications where recipient_id=$1 and type='revisao_curso'", [fixture.userId])).rowCount === 0,
      'Tick alterou curso ou reenviou após supressão')
    const current = await rpc('select * from public.my_current_course_review() where occurrence_id=$1', [occurrence.id])
    check(current.occurrence_id === occurrence.id && current.state === 'available', 'Bônus sem aviso não descoberto pela RPC')

    // Delivery failure is isolated from assignment and can be retried once.
    await owner.query("update public.course_review_schedules set anchor_at=clock_timestamp()-interval '15 days' where user_id=$1", [fixture.userId])
    await owner.query("create function public.issue47_test_fail_notice() returns trigger language plpgsql as $$ begin if new.recipient_id = TG_ARGV[0]::uuid and new.type='revisao_curso' then raise exception 'ISSUE47_NOTICE_FAILURE'; end if; return new; end $$")
    try {
      await owner.query("create trigger issue47_test_fail_notice before insert on public.notifications for each row execute function public.issue47_test_fail_notice('" + fixture.userId + "')")
      await owner.query('select * from public.tick_course_reviews()')
      const failedNotice = (await owner.query('select * from public.course_review_occurrences where user_id=$1 and period_index=2', [fixture.userId])).rows[0]
      check(failedNotice.selection_state === 'assigned' && failedNotice.delivery_state === 'failed'
        && failedNotice.notification_id === null, 'Falha de aviso desfez a atividade bonificável')
      const available = await rpc('select * from public.my_course_review_occurrence($1)', [failedNotice.id])
      check(available.state === 'available', 'Falha de entrega bloqueou autorização de bônus')
    } finally {
      await owner.query('drop trigger if exists issue47_test_fail_notice on public.notifications')
      await owner.query('drop function if exists public.issue47_test_fail_notice()')
    }
    await owner.query('select * from public.tick_course_reviews()')
    await owner.query('select * from public.tick_course_reviews()')
    const delivered = (await owner.query('select * from public.course_review_occurrences where user_id=$1 and period_index=2', [fixture.userId])).rows[0]
    check(delivered.delivery_state === 'delivered' && delivered.notification_id !== null
      && (await owner.query("select id from public.notifications where recipient_id=$1 and type='revisao_curso'", [fixture.userId])).rowCount === 1,
      'Retry de entrega não produziu exatamente um aviso')

    // Start requests serialize by intent, even without a bonus occurrence.
    const requestId = randomUUID()
    const [sameA, sameB] = await Promise.all([start(requestId), start(requestId)])
    check(sameA.session_id === sameB.session_id && JSON.stringify(sameA.items) === JSON.stringify(sameB.items), 'Mesmo pedido criou duas amostras')

    const racingAnswer = await start()
    const item = racingAnswer.items[0]
    const answerRace = await Promise.allSettled(['correct', 'wrong'].map(choice =>
      rpc('select * from public.submit_course_review_answer($1,$2,$3::jsonb)',
        [racingAnswer.session_id, item.question_id, JSON.stringify({ selected: [choice] })])))
    check(answerRace.filter(r => r.status === 'fulfilled').length === 1
      && answerRace.some(r => r.status === 'rejected' && r.reason instanceof Error && r.reason.message === 'REVIEW_ANSWER_LOCKED'),
      'Respostas concorrentes distintas devem aceitar somente a primeira')
    const closing = await start()
    const closeRace = await Promise.allSettled([
      answer(closing, 1), finish(closing.session_id),
    ])
    for (const result of closeRace) {
      if (result.status === 'rejected') {
        check(result.reason instanceof Error && result.reason.message === 'REVIEW_INCOMPLETE', 'Resposta/finalização falhou fora da serialização prevista')
      }
    }
    check((await finish(closing.session_id)).approved, 'Finalização após corrida não preservou resposta')
    await expectError(() => answer(closing, 0), 'REVIEW_FINISHED')

    // Fifty questions give exactly ten sampled questions for an exact 70% test.
    await owner.query("insert into public.questions(lesson_id,type,prompt,position,config) select $1,'multiple_choice','Boundary fixture',i, '{\"options\":[{\"id\":\"correct\",\"correct\":true},{\"id\":\"wrong\",\"correct\":false}]}'::jsonb from generate_series(1,49) i", [fixture.questionLessonId])
    const bonusOccurrence = (await owner.query('select occurrence_id from public.course_review_sessions where id=$1', [fixture.sessionIds[0]])).rows[0].occurrence_id
    const failed = await start(randomUUID(), bonusOccurrence)
    check(failed.items.length === 10, 'Amostra da fronteira deve conter dez questões')
    await answer(failed, 6)
    const failedResult = await finish(failed.session_id)
    check(!failedResult.approved && failedResult.correct_count === 6 && failedResult.bonus_outcome === 'below_target', '60% deveria reprovar sem consumir bônus')
    const winnerA = await start(randomUUID(), bonusOccurrence)
    const winnerB = await start(randomUUID(), bonusOccurrence)
    await answer(winnerA, 7)
    await answer(winnerB, 10)
    const unrelatedFacts = async () => {
      const facts = []
      for (const table of ['completions', 'enrollments', 'mission_assignments', 'season_entries', 'user_medals']) {
        facts.push((await owner.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) facts from public.${table} t where user_id=$1`, [fixture.userId])).rows[0].facts)
      }
      facts.push((await owner.query('select streak_count,last_study_date from public.profiles where id=$1', [fixture.userId])).rows[0])
      return JSON.stringify(facts)
    }
    const beforeFacts = await unrelatedFacts()
    const before = (await owner.query('select xp_global from public.profiles where id=$1', [fixture.userId])).rows[0].xp_global
    const results = await Promise.all([finish(winnerA.session_id), finish(winnerB.session_id)])
    check(results.filter(r => r.bonus_outcome === 'awarded' && r.bonus_earned === 10).length === 1
      && results.filter(r => r.bonus_outcome === 'already_awarded' && r.bonus_earned === 0).length === 1
      && results.every(r => r.approved), 'Duas sessões da mesma ocorrência devem conceder um único prêmio')
    check(JSON.stringify(await finish(failed.session_id)) === JSON.stringify(failedResult), 'Reprovação foi alterada após outra sessão ganhar')
    const accounting = (await owner.query("select p.xp_global,(select count(*)::integer from public.xp_events where idempotency_key=$2) event_count from public.profiles p where p.id=$1",
      [fixture.userId, 'xp:course-review:' + bonusOccurrence])).rows[0]
    check(accounting.xp_global === before + 10 && accounting.event_count === 1, 'Ledger/saldo duplicados na corrida do prêmio')
    check(await unrelatedFacts() === beforeFacts, 'Revisão alterou conclusões/matrícula/missões/temporada/medalhas/streak')
    const seasonCredit = await owner.query("select count(*)::integer n from public.xp_events where user_id=$1 and idempotency_key=$2 and (origin<>'review_bonus' or context<>'course' or amount<>10 or attempt_id is not null or room_id is not null or mission_id is not null)", [fixture.userId, 'xp:course-review:' + bonusOccurrence])
    check(seasonCredit.rows[0].n === 0, 'Bônus contaminou origem/contexto ou outros efeitos do ledger')
    await expectError(() => start(randomUUID(), bonusOccurrence), 'REVIEW_BONUS_ALREADY_AWARDED')

    // A failure after the balance update must roll back ledger and consumption.
    const rollbackOccurrence = (await owner.query('select occurrence_id from public.course_review_sessions where id=$1', [fixture.sessionIds[1]])).rows[0].occurrence_id
    const rollbackSession = fixture.sessionIds[1]
    await owner.query("create function public.issue47_test_fail_result() returns trigger language plpgsql as $$ begin if new.id = TG_ARGV[0]::uuid and new.finished_at is not null then raise exception 'ISSUE47_INJECTED_FAILURE'; end if; return new; end $$")
    try {
      await owner.query("create trigger issue47_test_fail_result before update on public.course_review_sessions for each row execute function public.issue47_test_fail_result('" + rollbackSession + "')")
      await expectError(() => finish(rollbackSession), 'ISSUE47_INJECTED_FAILURE')
      const rollback = (await owner.query("select o.rewarded_at,s.finished_at,p.xp_global,(select count(*)::integer from public.xp_events where idempotency_key=$3) events from public.course_review_occurrences o join public.course_review_sessions s on s.occurrence_id=o.id join public.profiles p on p.id=o.user_id where o.id=$1 and s.id=$2",
        [rollbackOccurrence, rollbackSession, 'xp:course-review:' + rollbackOccurrence])).rows[0]
      check(rollback.rewarded_at === null && rollback.finished_at === null && rollback.events === 0
        && rollback.xp_global === before + 10, 'Falha parcial não reverteu prêmio/ledger/saldo')
    } finally {
      await owner.query('drop trigger if exists issue47_test_fail_result on public.course_review_sessions')
      await owner.query('drop function if exists public.issue47_test_fail_result()')
    }
    check((await finish(rollbackSession)).bonus_earned === 10, 'Retry após rollback não concedeu prêmio')

    const expiringOccurrence = (await owner.query('select occurrence_id from public.course_review_sessions where id=$1', [fixture.sessionIds[2]])).rows[0].occurrence_id
    await owner.query("update public.course_review_occurrences set due_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp() where id=$1", [expiringOccurrence])
    await expectError(() => finish(fixture.sessionIds[2]), 'REVIEW_OCCURRENCE_EXPIRED')
    await expectError(() => start(randomUUID(), expiringOccurrence), 'REVIEW_OCCURRENCE_EXPIRED')
    await owner.query("update public.course_review_occurrences set due_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp() where id=$1", [bonusOccurrence])
    for (const result of results) {
      check(JSON.stringify(await finish(result.session_id)) === JSON.stringify(result), 'Expiração alterou resultado congelado')
    }

    // Reconciliation of a missing historical schedule must not fabricate dates.
    await owner.query('begin')
    try {
      await owner.query('update public.course_review_occurrences set reward_session_id=null,rewarded_at=null,xp_event_id=null where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_sessions where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_occurrences where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_schedules where user_id=$1', [fixture.userId])
      // Exercise the actual migration backfill against a completed legacy fixture.
      // Roll back this transaction so other users' missing schedules stay untouched.
      const migration = readFileSync(join(here, '../migrations/0043_course_reviews.sql'), 'utf8')
      const rolloutSql = migration.match(/-- One rollout instant[\s\S]*?end \$\$;/)?.[0]
      if (!rolloutSql) throw new Error('Bloco de rollout ausente na migração versionada')
      await owner.query(rolloutSql)
      const rollout = (await owner.query('select * from public.course_review_schedules where user_id=$1', [fixture.userId])).rows[0]
      check(rollout.anchor_source === 'rollout' && rollout.first_course_completed_at === null,
        'Rollout inventou data histórica de conclusão')
      await owner.query(rolloutSql)
      const repeatedRollout = (await owner.query('select anchor_at from public.course_review_schedules where user_id=$1', [fixture.userId])).rows[0]
      check(repeatedRollout.anchor_at.getTime() === rollout.anchor_at.getTime(), 'Reexecução do rollout deslocou a âncora')
      await owner.query('select * from public.tick_course_reviews()')
      check((await owner.query('select id from public.course_review_occurrences where user_id=$1', [fixture.userId])).rowCount === 0,
        'Rollout criou períodos retroativos')
      await owner.query('delete from public.course_review_schedules where user_id=$1', [fixture.userId])
      await owner.query('select * from public.tick_course_reviews()')
      const legacy = (await owner.query('select * from public.course_review_schedules where user_id=$1', [fixture.userId])).rows[0]
      check(legacy.anchor_source === 'legacy_observed' && legacy.first_course_completed_at === null,
        'Reconciliação inventou primeira conclusão histórica')
      check((await owner.query('select id from public.course_review_occurrences where user_id=$1', [fixture.userId])).rowCount === 0,
        'Reconciliação criou períodos retroativos')
    } finally { await owner.query('rollback') }

    // Two independent official completions establish one new first-course anchor.
    await owner.query('begin')
    try {
      await owner.query('update public.course_review_occurrences set reward_session_id=null,rewarded_at=null,xp_event_id=null where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_sessions where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_occurrences where user_id=$1', [fixture.userId])
      await owner.query('delete from public.course_review_schedules where user_id=$1', [fixture.userId])
      await owner.query('delete from public.completions where user_id=$1', [fixture.userId])
      await owner.query('delete from public.questions where lesson_id=$1', [fixture.emptyLessonId])
      await owner.query('commit')
    } catch (error) { await owner.query('rollback'); throw error }
    await Promise.all([fixture.emptyLessonId, fixture.repeatedEmptyLessonId].map(id =>
      rpc('select public.complete_empty_lesson($1) as done', [id])))
    const firstCompletion = await owner.query('select anchor_source,first_course_completed_at,anchor_at from public.course_review_schedules where user_id=$1', [fixture.userId])
    check(firstCompletion.rowCount === 1 && firstCompletion.rows[0].anchor_source === 'first_completion'
      && firstCompletion.rows[0].anchor_at.getTime() === firstCompletion.rows[0].first_course_completed_at.getTime(),
      'Primeiras conclusões concorrentes não produziram um único marco confirmado')
    console.warn('HARNESS ISSUE 47: calendário/opt-out/fronteira/corridas/reprovação/rollback/expiração passaram')
  } finally {
    await owner.end().catch(() => undefined)
    await cleanupConcurrentFixture(connectionString, fixture.userId, [fixture.reviewCourseId, fixture.missionCourseId])
  }
}

async function main(): Promise<void> {
  let connectionString: string
  try {
    connectionString = localDatabaseUrl(process.env.SUPABASE_DB_URL)
  } catch (error) {
    console.error(`HARNESS ISSUE 47: configuração recusada — ${safeErrorMessage(error)}`)
    process.exitCode = 2
    return
  }

  const client = newClient(connectionString, 'athen-issue47-harness')
  let transactionOpen = false

  try {
    await client.connect()
    const target = await client.query<{
      database: string
      port: number
    }>(`
      select current_database() as database,
             inet_server_port() as port
    `)
    const server = target.rows[0]
    if (
      !server ||
      server.database !== 'postgres' ||
      // A porta publicada no host é 55322; dentro do container Supabase é 5432.
      server.port !== 5432
    ) {
      throw new Error('Servidor conectado não corresponde ao banco local descartável esperado')
    }

    // Antes de qualquer fixture persistida, confirmar a migração que corrige
    // a ordem de locks no projeto local apontado pelo config.toml.
    const migration = await client.query<{ version: string }>(`
      select version
        from supabase_migrations.schema_migrations
       where version = '0044'
    `)
    if (migration.rowCount !== 1) {
      throw new Error('Banco local não confirma a migração 0044; nenhuma fixture foi iniciada')
    }

    await client.query('begin')
    transactionOpen = true
    await client.query('set local plpgsql.check_asserts = on')
    await client.query(readFileSync(harnessPath, 'utf8'))
    await client.query('rollback')
    transactionOpen = false
    console.warn('HARNESS ISSUE 47: PASSOU (contrato/ACL/RPCs; rollback aplicado)')
  } catch (error) {
    console.error('HARNESS ISSUE 47: FALHOU')
    console.error(safeErrorMessage(error))
    process.exitCode = 1
  } finally {
    if (transactionOpen) {
      await client.query('rollback').catch(() => undefined)
    }
    await client.end().catch(() => undefined)
  }

  if (process.exitCode !== 1 && process.exitCode !== 2) {
    try {
      await runConcurrentLockOrderRegressions(connectionString)
      await runReviewContractRegressions(connectionString)
    } catch (error) {
      console.error('HARNESS ISSUE 47: FALHOU (regressão concorrente 0044)')
      console.error(safeErrorMessage(error))
      process.exitCode = 1
    }
  }
}

void main()
