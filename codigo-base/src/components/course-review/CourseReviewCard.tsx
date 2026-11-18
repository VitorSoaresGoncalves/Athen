import { useEffect, useState, type Ref } from 'react';
import { revisaoRepository, type DisponibilidadeRevisao, type OcorrenciaRevisao, type UltimaRevisaoCurso } from '../../data/repositories';
import { supabase } from '../../lib/supabase';
import './CourseReviewCard.css';

type Props = {
  courseId: string;
  courseTitle: string;
  refreshKey: number;
  triggerRef: Ref<HTMLButtonElement>;
  onReview: (occurrenceId?: string) => void;
};

export function CourseReviewCard({ courseId, courseTitle, refreshKey, triggerRef, onReview }: Props) {
  const [status, setStatus] = useState<DisponibilidadeRevisao | null>(null);
  const [occurrence, setOccurrence] = useState<OcorrenciaRevisao | null>(null);
  const [lastReview, setLastReview] = useState<UltimaRevisaoCurso | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryError, setEntryError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') return;
      setStatus(null);
      setOccurrence(null);
      setLastReview(null);
      setLoading(true);
      setReload(value => value + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    async function load() {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      setLoading(true);
      const results = await Promise.allSettled([
        revisaoRepository.obterDisponibilidade(courseId),
        revisaoRepository.obterOcorrenciaAtual(),
        revisaoRepository.obterUltimaFinalizada(courseId),
      ]);
      if (cancelled) return;
      const [availability, current, history] = results;
      setStatus(availability.status === 'fulfilled' ? availability.value : null);
      setOccurrence(current.status === 'fulfilled' && current.value?.course_id === courseId ? current.value : null);
      setEntryError(availability.status === 'rejected' || current.status === 'rejected'
        ? 'Não foi possível consultar a revisão deste curso.' : '');
      setLastReview(history.status === 'fulfilled' ? history.value : null);
      setHistoryError(history.status === 'rejected' ? 'Não foi possível consultar a última revisão.' : '');
      setNow(Date.now());
      setLoading(false);
      running = false;
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const onVisible = () => { void load(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [courseId, refreshKey, reload]);

  useEffect(() => {
    if (!occurrence) return;
    const delay = Date.parse(occurrence.expires_at) - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(delay, 2147483647));
    return () => window.clearTimeout(timer);
  }, [occurrence]);

  const bonus = occurrence?.state === 'available' && Date.parse(occurrence.expires_at) > now;
  const result = lastReview?.result;
  return (
    <aside className="course-review-card" aria-label="Revisão do curso" aria-busy={loading}>
      <div className="course-review-card__heading">
        <h2>Revisão do curso</h2>
        {(entryError || historyError) && <button type="button" className="course-review-card__refresh" aria-label="Atualizar revisão" disabled={loading} onClick={() => setReload(value => value + 1)}>↻</button>}
      </div>
      <p className="course-review-card__course">{courseTitle}</p>
      <div className="course-review-card__body">
      {loading ? <p role="status">Consultando revisão...</p> : <>
        {historyError ? <p role="alert">{historyError}</p> : result ? (
          <div className="course-review-card__result">
            <p>Última revisão · {lastReview.mode === 'bonus' ? 'Com bônus' : 'Prática normal'}</p>
            <p><strong>{Math.floor(result.correct_count * 10000 / result.total_count) / 100}%</strong> · {result.correct_count}/{result.total_count} acertos · +{result.bonus_earned} XP</p>
            <p>{result.approved ? 'Meta atingida' : 'Meta não atingida'}</p>
            <time dateTime={result.finished_at}>{new Date(result.finished_at).toLocaleString('pt-BR')}</time>
          </div>
        ) : <p>Nenhuma revisão finalizada neste curso.</p>}
        {entryError ? <p role="alert">{entryError}</p> : <>
          {status?.reason === 'REVIEW_EMPTY' ? <p>Este curso não tem questões para revisão</p>
            : !status?.can_review && <p>Conclua todas as aulas para revisar este curso.</p>}
          {bonus && <p className="course-review-card__bonus">Bônus disponível · +10 XP · Meta: 70%<br />Até {new Date(occurrence.expires_at).toLocaleString('pt-BR')}</p>}
        </>}
      </>}
      </div>
      <button ref={triggerRef} className="course-review-card__action" type="button"
        disabled={loading || Boolean(entryError) || !status?.can_review}
        onClick={() => onReview(bonus ? occurrence.occurrence_id : undefined)}>Revisar curso</button>
    </aside>
  );
}
