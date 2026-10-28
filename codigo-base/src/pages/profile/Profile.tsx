import type { User } from "@supabase/supabase-js";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { PROFILE_UPDATED_EVENT } from "../../components/sidebar/SidebarLeft";
import { PageLayout } from "../../components/layout/PageLayout";
import {
  amizadeRepository,
  aulaRepository,
  concluiRepository,
  cursoRepository,
  matriculaRepository,
  medalhaRepository,
  medalhaUsuarioRepository,
  moduloRepository,
  usuarioRepository,
} from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";
import "./Profile.css";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Perfil = Database["public"]["Tables"]["profiles"]["Row"];
type Matricula = Database["public"]["Tables"]["enrollments"]["Row"];
type Medalha = Database["public"]["Tables"]["medals"]["Row"];
type MedalhaUsuario = Database["public"]["Tables"]["user_medals"]["Row"];

type CourseProgress = {
  course: Curso;
  enrollment: Matricula;
  total: number;
  done: number;
  percent: number;
};

type LastLesson = {
  title: string;
  courseId: string;
  courseTitle: string;
  date: Date | null;
};

type IconName =
  | "arrow" | "book" | "bolt" | "calendar" | "check" | "chevron" | "clock"
  | "camera" | "close" | "edit" | "flame" | "mail" | "star" | "target"
  | "trophy" | "user" | "users" | "play";

type ImageKind = "avatar" | "banner";

/** Estado de uma imagem em edição (só é enviada ao clicar em "Salvar"). */
type ImageDraft = { file: File | null; preview: string | null; remove: boolean };
const EMPTY_DRAFT: ImageDraft = { file: null, preview: null, remove: false };

// ---------------------------------------------------------------------------
// XP, nível e streak vêm prontos de "profiles" (xp_global, level, streak_count,
// last_study_date) — são calculados no servidor.
// ---------------------------------------------------------------------------

const FRIENDS_ROUTE = "/amigos";

// ---------------------------------------------------------------------------
// Imagens do perfil (foto e banner).
// Vão para o bucket público "avatars" do Supabase Storage, dentro da pasta do
// usuário (avatars/<user_id>/...), e a URL pública é gravada em
// profiles.avatar_url / profiles.banner_url.
// ---------------------------------------------------------------------------
const AVATAR_BUCKET = "avatars";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const IMAGE_CONFIG: Record<ImageKind, { ratio: number; maxWidth: number; maxMb: number; label: string }> = {
  avatar: { ratio: 1, maxWidth: 512, maxMb: 5, label: "A foto" },
  banner: { ratio: 3, maxWidth: 1500, maxMb: 8, label: "O banner" },
};
const MAX_FEATURED_MEDALS = 3;

/** Recorta a imagem no centro na proporção pedida e reduz para o tamanho máximo (WEBP; JPEG como alternativa). */
async function cropToRatio(file: File, kind: ImageKind): Promise<File> {
  const { ratio, maxWidth } = IMAGE_CONFIG[kind];
  const bitmap = await createImageBitmap(file);

  let cropW = bitmap.width;
  let cropH = cropW / ratio;
  if (cropH > bitmap.height) {
    cropH = bitmap.height;
    cropW = cropH * ratio;
  }
  const sx = (bitmap.width - cropW) / 2;
  const sy = (bitmap.height - cropH) / 2;
  const targetW = Math.round(Math.min(maxWidth, cropW));
  const targetH = Math.round(targetW / ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu processar a imagem.");
  context.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));

  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("Não foi possível processar a imagem.");

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${kind}.${extension}`, { type: blob.type });
}

/** Extrai "<user_id>/arquivo.ext" de uma URL pública do bucket (para apagar a imagem antiga). */
function pathFromUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

async function uploadImage(userId: string, kind: ImageKind, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const path = `${userId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type });
  if (error) throw new Error(error.message);

  return { path, url: supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** Data local de hoje/ontem no formato YYYY-MM-DD (mesmo formato de profiles.last_study_date). */
function localDay(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("sv-SE");
}

const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];

const ICON_PATHS: Record<IconName, ReactNode> = {
  arrow: <path d="m9 18 6-6-6-6" />,
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" />,
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  flame: <path d="M12 2c.8 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.8 1 2.700 2 3C10.500 8 10.500 5 12 2Z" />,
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8Z" />,
  star: <path d="m12 2 3 6 7 .9-5 4.8 1.2 6.8L12 17.3l-6.2 3.2L7 13.7 2 8.9 9 8Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6" />
    </>
  ),
};

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** Ícone da medalha: usa o emoji/texto de medals.icon quando existe. */
function MedalIcon({ medal, className = "size-5" }: { medal: Medalha; className?: string }) {
  return medal.icon ? <span className="text-2xl leading-none">{medal.icon}</span> : <Icon name="star" className={className} />;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="font-ui text-xs font-bold tracking-[0.18em] text-gold">{eyebrow}</div>
        <div className="mt-1 font-display text-2xl text-ink md:text-3xl">{title}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * Layout da página: sidebar à esquerda + conteúdo.
 * Quando o Profile é renderizado dentro do Dashboard (prop onOpenCourse),
 * o Dashboard já tem a sua própria sidebar, então não duplicamos aqui — o
 * conteúdo é renderizado sem a casca. No modo normal, usa o PageLayout padrão.
 */
function PageShell({
  children,
  withSidebar,
}: {
  children: ReactNode;
  withSidebar: boolean;
}) {
  if (!withSidebar) return <>{children}</>;

  return (
    <PageLayout variant="bare" className="bg-canvas">
      {children}
    </PageLayout>
  );
}

interface ProfileProps {
  /** Chamado ao abrir um curso a partir do perfil (usado quando o Profile está dentro do Dashboard). */
  onOpenCourse?: (courseId?: string) => void;
}

export default function Profile({ onOpenCourse }: ProfileProps) {
  const navigate = useNavigate();
  const withSidebar = !onOpenCourse;

  function openCourse(courseId?: string) {
    if (onOpenCourse) onOpenCourse(courseId);
    else navigate(courseId ? `/dashboard?curso=${courseId}` : "/dashboard");
  }

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [totalDoneLessons, setTotalDoneLessons] = useState(0);
  const [lastLesson, setLastLesson] = useState<LastLesson | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [medalCatalog, setMedalCatalog] = useState<Medalha[]>([]);
  const [userMedals, setUserMedals] = useState<MedalhaUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [courseTab, setCourseTab] = useState<"active" | "completed">("active");

  // Edição do perfil (gravada em "profiles")
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formFeatured, setFormFeatured] = useState<string[]>([]);

  // Foto e banner escolhidos (só são enviados ao clicar em "Salvar")
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [avatarDraft, setAvatarDraft] = useState<ImageDraft>(EMPTY_DRAFT);
  const [bannerDraft, setBannerDraft] = useState<ImageDraft>(EMPTY_DRAFT);

  // Libera as URLs temporárias dos previews quando mudam ou o componente sai da tela.
  useEffect(() => {
    const url = avatarDraft.preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [avatarDraft.preview]);

  useEffect(() => {
    const url = bannerDraft.preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [bannerDraft.preview]);

  // Carrega perfil, matrículas, conclusões, amigos e medalhas.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          if (!cancelled) setAuthUser(null);
          return;
        }
        const userId = userData.user.id;

        const [profileRow, courses, enrollments, conclusions, friends, catalog, acquired] = await Promise.all([
          usuarioRepository.obterPorId(userId),
          cursoRepository.listar(),
          matriculaRepository.listarPorUsuario(userId),
          concluiRepository.listarPorUsuario(userId), // já vem ordenado: mais recente primeiro
          amizadeRepository.listarAmigos(userId),
          medalhaRepository.listar(),
          medalhaUsuarioRepository.listarPorUsuario(userId),
        ]);

        const doneLessonIds = new Set(
          conclusions.filter((conclusion) => conclusion.context === "course").map((conclusion) => conclusion.lesson_id),
        );
        const lessonIndex = new Map<string, { title: string; courseId: string; courseTitle: string }>();

        // Só os cursos em que o usuário está matriculado (e não abandonou).
        const enrolledCourses = enrollments
          .filter((enrollment) => enrollment.status !== "dropped")
          .flatMap((enrollment) => {
            const course = courses.find((item) => item.id === enrollment.course_id);
            return course ? [{ course, enrollment }] : [];
          });

        const courseProgress = await Promise.all(
          enrolledCourses.map(async ({ course, enrollment }): Promise<CourseProgress> => {
            const modules = await moduloRepository.listarPorCurso(course.id);
            const lessonsByModule = await Promise.all(
              modules.map((module) => aulaRepository.listarPorModulo(module.id)),
            );
            const lessons = lessonsByModule.flat();
            lessons.forEach((lesson) => {
              lessonIndex.set(lesson.id, { title: lesson.title, courseId: course.id, courseTitle: course.title });
            });
            const done = lessons.filter((lesson) => doneLessonIds.has(lesson.id)).length;
            // o progresso (0 a 100) é calculado pelo servidor em enrollments.progress
            const percent = Math.max(0, Math.min(100, Math.round(enrollment.progress)));
            return { course, enrollment, total: lessons.length, done, percent };
          }),
        );

        // Última aula concluída que conseguimos identificar (as conclusões já vêm da mais recente para a mais antiga).
        const latest = conclusions.find((conclusion) => lessonIndex.has(conclusion.lesson_id));
        const latestLesson = latest ? lessonIndex.get(latest.lesson_id) : undefined;

        if (cancelled) return;
        setAuthUser(userData.user);
        setProfile(profileRow);
        setProgress(courseProgress);
        setTotalDoneLessons(new Set(conclusions.map((conclusion) => conclusion.lesson_id)).size);
        setFriendsCount(friends.length);
        setMedalCatalog(catalog);
        setUserMedals(acquired);
        setLastLesson(latestLesson && latest ? { ...latestLesson, date: new Date(latest.completed_at) } : null);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, []);

  const displayName = profile?.display_name.trim() || authUser?.email?.split("@")[0] || "Estudante";
  const username = profile?.username.trim() ?? "";
  const bio = profile?.bio?.trim() ?? "";
  const avatarUrl = profile?.avatar_url || undefined;
  const bannerUrl = profile?.banner_url || undefined;
  // Imagens exibidas: preview da nova escolha > imagem salva (a menos que marcada para remover)
  const shownAvatar = avatarDraft.preview ?? (avatarDraft.remove ? undefined : avatarUrl);
  const shownBanner = bannerDraft.preview ?? (bannerDraft.remove ? undefined : bannerUrl);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  // XP, nível e streak vêm do servidor.
  const totalXp = profile?.xp_global ?? 0;
  const level = profile?.level ?? 1;
  const studiedToday = profile?.last_study_date === localDay();
  // A sequência só continua viva se a última aula foi hoje ou ontem.
  const streakAlive = studiedToday || profile?.last_study_date === localDay(-1);
  const currentStreak = streakAlive ? (profile?.streak_count ?? 0) : 0;

  const stats = useMemo(() => {
    const active = progress
      .filter((item) => item.enrollment.status === "active")
      .sort((a, b) => b.percent - a.percent);
    const completed = progress.filter((item) => item.enrollment.status === "completed");
    return { active, completed };
  }, [progress]);

  // Medalhas: catálogo do servidor + as que o usuário já conquistou.
  const acquiredCodes = useMemo(() => new Set(userMedals.map((item) => item.medal_code)), [userMedals]);
  const medals = useMemo(
    () => medalCatalog.map((medal) => ({ ...medal, unlocked: acquiredCodes.has(medal.code) })),
    [medalCatalog, acquiredCodes],
  );
  const unlockedCount = medals.filter((medal) => medal.unlocked).length;

  const savedFeatured = userMedals.filter((item) => item.featured).map((item) => item.medal_code);
  const featuredCodes = editing ? formFeatured : savedFeatured;
  const featuredMedals = featuredCodes
    .map((code) => medals.find((medal) => medal.code === code && medal.unlocked))
    .filter((medal): medal is (typeof medals)[number] => Boolean(medal))
    .slice(0, MAX_FEATURED_MEDALS);

  const visibleCourses = courseTab === "active" ? stats.active : stats.completed;
  const nextGoal = stats.active[0];

  function startEditing() {
    setFormName(profile?.display_name ?? "");
    setFormUsername(profile?.username ?? "");
    setFormBio(profile?.bio ?? "");
    setFormFeatured(savedFeatured);
    setSaveMessage("");
    setAvatarDraft(EMPTY_DRAFT);
    setBannerDraft(EMPTY_DRAFT);
    setEditing(true);
  }

  function cancelEditing() {
    setAvatarDraft(EMPTY_DRAFT);
    setBannerDraft(EMPTY_DRAFT);
    setSaveMessage("");
    setEditing(false);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>, kind: ImageKind) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;

    const { maxMb, label } = IMAGE_CONFIG[kind];
    if (!IMAGE_TYPES.includes(file.type)) {
      setSaveMessage("Escolha uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setSaveMessage(`${label} deve ter no máximo ${maxMb} MB.`);
      return;
    }

    setSaveMessage("");

    try {
      const cropped = await cropToRatio(file, kind);
      const draft: ImageDraft = { file: cropped, preview: URL.createObjectURL(cropped), remove: false };
      if (kind === "avatar") setAvatarDraft(draft);
      else setBannerDraft(draft);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    }
  }

  function handleRemoveImage(kind: ImageKind) {
    const draft: ImageDraft = { file: null, preview: null, remove: true };
    if (kind === "avatar") setAvatarDraft(draft);
    else setBannerDraft(draft);
  }

  function toggleFeatured(code: string) {
    setFormFeatured((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (current.length >= MAX_FEATURED_MEDALS) return current;
      return [...current, code];
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    if (!formName.trim() || !formUsername.trim()) {
      setSaveMessage("Preencha o nome de exibição e o nome de usuário.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    // undefined = não mexe | string = nova imagem | null = remove a imagem
    const nextUrls: Record<ImageKind, string | null | undefined> = { avatar: undefined, banner: undefined };
    const uploadedPaths: string[] = [];

    try {
      for (const [kind, draft] of [["avatar", avatarDraft], ["banner", bannerDraft]] as const) {
        if (draft.file) {
          const { path, url } = await uploadImage(profile.id, kind, draft.file);
          uploadedPaths.push(path);
          nextUrls[kind] = url;
        } else if (draft.remove) {
          nextUrls[kind] = null;
        }
      }
    } catch (error) {
      if (uploadedPaths.length > 0) void supabase.storage.from(AVATAR_BUCKET).remove(uploadedPaths);
      setSaving(false);
      setSaveMessage(`Falha ao enviar a imagem: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      return;
    }

    let updatedProfile: Perfil;
    try {
      updatedProfile = await usuarioRepository.atualizar(profile.id, {
        display_name: formName.trim(),
        username: formUsername.trim(),
        bio: formBio.trim() || null,
        ...(nextUrls.avatar !== undefined ? { avatar_url: nextUrls.avatar } : {}),
        ...(nextUrls.banner !== undefined ? { banner_url: nextUrls.banner } : {}),
      });
    } catch (error) {
      // não deixa arquivo órfão no bucket se o perfil não foi salvo
      if (uploadedPaths.length > 0) void supabase.storage.from(AVATAR_BUCKET).remove(uploadedPaths);
      setSaving(false);
      setSaveMessage(`Falha ao salvar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      return;
    }

    // medalhas em destaque: só atualiza as que mudaram
    let nextMedals = userMedals;
    try {
      const changed = userMedals.filter((item) => item.featured !== formFeatured.includes(item.medal_code));
      if (changed.length > 0) {
        const updated = await Promise.all(
          changed.map((item) => medalhaUsuarioRepository.atualizarDestaque(item.id, formFeatured.includes(item.medal_code))),
        );
        nextMedals = userMedals.map((item) => updated.find((u) => u.id === item.id) ?? item);
      }
    } catch (error) {
      setSaving(false);
      setProfile(updatedProfile);
      setSaveMessage(`Perfil salvo, mas as medalhas em destaque falharam: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      return;
    }

    // apaga as imagens antigas do bucket (best-effort) quando foram trocadas ou removidas
    const oldPaths = [
      nextUrls.avatar !== undefined ? pathFromUrl(avatarUrl) : null,
      nextUrls.banner !== undefined ? pathFromUrl(bannerUrl) : null,
    ].filter((path): path is string => Boolean(path));
    if (oldPaths.length > 0) void supabase.storage.from(AVATAR_BUCKET).remove(oldPaths);

    setSaving(false);
    setProfile(updatedProfile);
    setUserMedals(nextMedals);
    setAvatarDraft(EMPTY_DRAFT);
    setBannerDraft(EMPTY_DRAFT);
    setEditing(false);
    // avisa a sidebar para recarregar nome/foto
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }

  if (loading) {
    return (
      <PageShell withSidebar={withSidebar}>
        <div className="grid min-h-svh min-w-0 flex-1 place-items-center bg-canvas font-body text-muted">
          Carregando seu perfil...
        </div>
      </PageShell>
    );
  }

  if (!authUser || !profile) {
    return (
      <PageShell withSidebar={withSidebar}>
        <div className="grid min-h-svh min-w-0 flex-1 place-items-center bg-canvas px-5 text-center font-body text-ink">
          <div>
            <p className="text-muted">{errorMessage || "Você precisa entrar para ver seu perfil."}</p>
            <Link
              to="/login-page"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-gold px-5 font-ui text-sm font-bold text-violet transition hover:bg-gold-light"
            >
              Ir para o login
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const featuredSlots = Array.from({ length: MAX_FEATURED_MEDALS }, (_, index) => featuredMedals[index]);

  return (
    <PageShell withSidebar={withSidebar}>
      <div className="min-w-0 flex-1 bg-canvas pb-20 font-body text-ink">
        <section className="border-b border-line">
          <form onSubmit={(event) => void handleSave(event)}>
            {/* Banner */}
            <div className="relative h-40 overflow-hidden bg-surface md:h-56">
              {shownBanner ? (
                <img src={shownBanner} alt="" className="size-full object-cover" />
              ) : (
                <>
                  <img
                    src="/Athen_ghost.png"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 -top-24 size-96 opacity-[0.08]"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_5%,rgba(164,134,213,0.28),transparent_40%),radial-gradient(circle_at_18%_100%,rgba(255,204,0,0.14),transparent_35%)]" />
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas/70 to-transparent" />

              {editing && (
                <div className="absolute right-4 top-4 flex gap-2">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept={IMAGE_TYPES.join(",")}
                    onChange={(event) => void handleImageChange(event, "banner")}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={saving}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-canvas/80 px-4 font-ui text-xs font-bold text-ink backdrop-blur transition hover:bg-canvas disabled:opacity-60"
                  >
                    <Icon name="camera" className="size-4 text-gold" />
                    Trocar banner
                  </button>
                  {shownBanner && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage("banner")}
                      disabled={saving}
                      aria-label="Remover banner"
                      title="Remover banner"
                      className="grid size-9 place-items-center rounded-full bg-canvas/80 text-violet-pale backdrop-blur transition hover:bg-red-300 hover:text-canvas disabled:opacity-60"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative mx-auto max-w-6xl px-[24px] pb-9 md:px-[56px] md:pb-12">
              <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row md:items-end">
                {/* Foto */}
                <div className="relative w-fit shrink-0">
                  <div className="rounded-[2rem] bg-gradient-to-br from-gold via-gold-light to-violet-mid p-1">
                    <div className="relative grid size-32 place-items-center overflow-hidden rounded-[1.75rem] bg-surface text-violet-pale md:size-40">
                      {shownAvatar ? (
                        <img src={shownAvatar} alt={`Foto de ${displayName}`} className="size-full object-cover" />
                      ) : (
                        <Icon name="user" className="size-16 md:size-20" />
                      )}

                      {editing && (
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={saving}
                          aria-label="Trocar foto de perfil"
                          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-canvas/60 font-ui text-xs font-bold text-ink opacity-0 transition hover:opacity-100 focus:opacity-100 focus:outline-none max-md:opacity-100 disabled:cursor-not-allowed"
                        >
                          <Icon name="camera" className="size-6 text-gold" />
                          Trocar foto
                        </button>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept={IMAGE_TYPES.join(",")}
                        onChange={(event) => void handleImageChange(event, "avatar")}
                        className="hidden"
                      />
                      {shownAvatar && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImage("avatar")}
                          disabled={saving}
                          aria-label="Remover foto de perfil"
                          title="Remover foto"
                          className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full border-4 border-canvas bg-surface text-violet-pale transition hover:bg-red-300 hover:text-canvas disabled:opacity-60"
                        >
                          <Icon name="close" className="size-4" />
                        </button>
                      )}
                    </>
                  )}
                  {authUser.email_confirmed_at && (
                    <div
                      className="absolute -bottom-2 -right-2 grid size-10 place-items-center rounded-full border-4 border-canvas bg-gold text-violet"
                      title="E-mail confirmado"
                    >
                      <Icon name="check" className="size-5" />
                    </div>
                  )}
                </div>

                {/* Identidade */}
                <div className="min-w-0 flex-1 md:pb-1">
                  {editing ? (
                    <div className="grid gap-3 md:max-w-xl">
                      <label className="grid gap-1 font-ui text-xs text-violet-pale">
                        Nome de exibição
                        <input
                          value={formName}
                          onChange={(event) => setFormName(event.target.value)}
                          required
                          className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink focus:border-gold focus:outline-none"
                        />
                      </label>
                      <label className="grid gap-1 font-ui text-xs text-violet-pale">
                        Nome de usuário
                        <input
                          value={formUsername}
                          onChange={(event) => setFormUsername(event.target.value)}
                          required
                          className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink focus:border-gold focus:outline-none"
                        />
                      </label>
                      <label className="grid gap-1 font-ui text-xs text-violet-pale">
                        <span className="flex justify-between">
                          Bio
                          <span className="text-muted">{formBio.length}/240</span>
                        </span>
                        <textarea
                          value={formBio}
                          onChange={(event) => setFormBio(event.target.value)}
                          rows={3}
                          maxLength={240}
                          className="resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                        />
                      </label>
                      <p className="font-ui text-xs text-muted">
                        Escolha até {MAX_FEATURED_MEDALS} medalhas para expor na seção “Medalhas” abaixo.
                      </p>
                      {saveMessage && <p className="font-ui text-xs text-red-300">{saveMessage}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <div className="font-display text-4xl leading-tight text-ink md:text-5xl">{displayName}</div>
                        {username && (
                          <span className="rounded-full border border-violet-mid/30 bg-violet-mid/10 px-3 py-1 font-ui text-xs font-medium text-violet-pale">
                            @{username}
                          </span>
                        )}
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-muted md:text-base">
                        {bio || "Você ainda não escreveu uma bio. Clique em “Editar perfil” para adicionar."}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 font-ui text-xs text-violet-pale">
                        {memberSince && (
                          <span className="inline-flex items-center gap-2">
                            <Icon name="calendar" className="size-4 text-gold" />
                            Na Athen desde {memberSince}
                          </span>
                        )}
                        {authUser.email && (
                          <span className="inline-flex items-center gap-2">
                            <Icon name="mail" className="size-4 text-gold" />
                            {authUser.email}
                          </span>
                        )}
                        <Link
                          to={FRIENDS_ROUTE}
                          className="inline-flex items-center gap-2 transition hover:text-ink"
                        >
                          <Icon name="users" className="size-4 text-gold" />
                          <span>
                            <strong className="text-ink">{friendsCount}</strong>{" "}
                            {friendsCount === 1 ? "amigo" : "amigos"}
                          </span>
                        </Link>
                      </div>

                      {/* Medalhas expostas */}
                      <div className="mt-5 flex items-center gap-3">
                        {featuredSlots.map((medal, index) =>
                          medal ? (
                            <div
                              key={medal.code}
                              title={`${medal.name}: ${medal.description}`}
                              className="grid size-12 place-items-center rounded-2xl border border-gold/25 bg-gold/15 text-gold"
                            >
                              <MedalIcon medal={medal} />
                            </div>
                          ) : (
                            <div
                              key={`empty-${index}`}
                              aria-hidden="true"
                              className="grid size-12 place-items-center rounded-2xl border border-dashed border-line text-line"
                            >
                              <Icon name="star" className="size-4" />
                            </div>
                          ),
                        )}
                        <a href="#medalhas" className="font-ui text-xs text-muted transition hover:text-ink">
                          Ver todas
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {editing ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 font-ui text-sm font-medium text-violet-pale transition hover:border-violet-mid hover:text-ink"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 font-ui text-sm font-bold text-violet transition hover:bg-gold-light disabled:opacity-60"
                    >
                      <Icon name="check" className="size-4" />
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gold px-5 font-ui text-sm font-bold text-violet transition hover:bg-gold-light focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-canvas"
                  >
                    <Icon name="edit" className="size-4" />
                    Editar perfil
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <div className="mx-auto max-w-6xl px-[24px] pt-8 md:px-[56px] md:pt-10">
          {errorMessage && (
            <p className="mb-6 rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-3 font-ui text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          {/* Números principais: XP/nível, streak, aulas/cursos, amigos */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 to-surface p-5">
              <div className="mb-6 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-gold text-violet">
                  <Icon name="bolt" />
                </div>
                <span className="font-ui text-xs font-bold text-gold">NÍVEL {level}</span>
              </div>
              <div className="font-display text-3xl text-ink">{totalXp.toLocaleString("pt-BR")} XP</div>
              <div className="mt-1 font-ui text-xs text-muted">Experiência total acumulada</div>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-6 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-violet text-gold">
                  <Icon name="flame" />
                </div>
                <span className="font-ui text-xs font-bold text-violet-pale">
                  {studiedToday ? "Meta de hoje feita" : "Estude hoje"}
                </span>
              </div>
              <div className="font-display text-3xl text-ink">
                {currentStreak} {currentStreak === 1 ? "dia" : "dias"}
              </div>
              <div className="mt-1 font-ui text-xs text-muted">Sequência atual de estudo</div>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-6 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-violet-mid/20 text-violet-pale">
                  <Icon name="book" />
                </div>
                <span className="font-ui text-xs font-bold text-violet-pale">
                  {stats.active.length} em andamento
                </span>
              </div>
              <div className="font-display text-3xl text-ink">
                {totalDoneLessons} {totalDoneLessons === 1 ? "aula" : "aulas"}
              </div>
              <div className="mt-1 font-ui text-xs text-muted">
                {progress.length} {progress.length === 1 ? "curso" : "cursos"} · {stats.completed.length}{" "}
                {stats.completed.length === 1 ? "concluído" : "concluídos"}
              </div>
            </div>

            <Link
              to={FRIENDS_ROUTE}
              className="group rounded-3xl border border-line bg-surface p-5 transition hover:-translate-y-1 hover:border-violet-mid/40"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-gold-pale text-violet">
                  <Icon name="users" />
                </div>
                <span className="inline-flex items-center gap-1 font-ui text-xs font-bold text-gold">
                  Ver amigos
                  <Icon name="chevron" className="size-3.5 transition group-hover:translate-x-1" />
                </span>
              </div>
              <div className="font-display text-3xl text-ink">
                {friendsCount} {friendsCount === 1 ? "amigo" : "amigos"}
              </div>
              <div className="mt-1 font-ui text-xs text-muted">Estude junto e compare o progresso</div>
            </Link>
          </section>

          {/* Medalhas */}
          <section id="medalhas" className="mt-12 scroll-mt-6">
            <SectionTitle
              eyebrow="SUA COLEÇÃO"
              title="Medalhas"
              action={
                <span className="font-ui text-xs text-muted">
                  {unlockedCount} de {medals.length} desbloqueadas
                </span>
              }
            />

            {editing && (
              <p className="mb-4 font-ui text-xs text-muted">
                Toque nas medalhas desbloqueadas para expor no perfil ({formFeatured.length}/{MAX_FEATURED_MEDALS}).
                Clique em “Salvar” para confirmar.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {medals.map((medal) => {
                const pinned = featuredCodes.includes(medal.code) && medal.unlocked;
                const selectable = editing && medal.unlocked;

                return (
                  <button
                    key={medal.code}
                    type="button"
                    disabled={!selectable}
                    onClick={() => toggleFeatured(medal.code)}
                    aria-pressed={editing && medal.unlocked ? pinned : undefined}
                    className={`flex items-center gap-4 rounded-2xl border bg-surface p-4 text-left transition ${
                      pinned ? "border-gold/60" : "border-line"
                    } ${medal.unlocked ? "" : "opacity-60"} ${
                      selectable ? "cursor-pointer hover:-translate-y-1 hover:border-gold/60" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`grid size-12 shrink-0 place-items-center rounded-2xl border ${
                        medal.unlocked
                          ? "border-gold/25 bg-gold/15 text-gold"
                          : "border-violet-mid/25 bg-violet-mid/10 text-violet-pale"
                      }`}
                    >
                      <MedalIcon medal={medal} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-ui text-sm font-bold text-ink">{medal.name}</div>
                      <div className="mt-1 text-xs text-muted">{medal.description}</div>
                      {pinned && <div className="mt-1 font-ui text-xs font-bold text-gold">Exposta no perfil</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cursos */}
          <section className="mt-12">
            <SectionTitle
              eyebrow="CONTINUE APRENDENDO"
              title="Meus cursos"
              action={
                <div className="flex rounded-full border border-line bg-surface p-1 font-ui text-xs">
                  {(
                    [
                      ["active", "Em andamento"],
                      ["completed", "Concluídos"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCourseTab(tab)}
                      className={`rounded-full px-3 py-2 transition ${
                        courseTab === tab ? "bg-gold font-bold text-violet" : "text-muted hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            />

            {lastLesson && (
              <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-violet-mid/25 bg-gradient-to-r from-violet/50 to-surface p-5 sm:flex-row sm:items-center">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-mid/20 text-violet-pale">
                  <Icon name="play" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-ui text-xs font-bold tracking-widest text-gold">ÚLTIMA AULA CONCLUÍDA</div>
                  <div className="mt-1 truncate font-display text-lg text-ink">{lastLesson.title}</div>
                  <div className="mt-1 font-ui text-xs text-muted">
                    {lastLesson.courseTitle}
                    {lastLesson.date && ` · ${lastLesson.date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openCourse(lastLesson.courseId)}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 font-ui text-sm font-bold text-gold transition hover:bg-gold hover:text-violet"
                >
                  Continuar curso
                  <Icon name="chevron" className="size-4" />
                </button>
              </div>
            )}

            {visibleCourses.length === 0 ? (
              <p className="rounded-3xl border border-line bg-surface px-5 py-10 text-center font-ui text-sm text-muted">
                {courseTab === "active"
                  ? "Você não tem cursos em andamento. Comece uma aula no dashboard!"
                  : "Você ainda não concluiu nenhum curso."}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.map(({ course, total, done, percent }, index) => {
                  const color = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                  const remaining = Math.max(0, total - done);

                  return (
                    <article
                      key={course.id}
                      className="group overflow-hidden rounded-3xl border border-line bg-surface transition hover:-translate-y-1 hover:border-violet-mid/40 hover:shadow-2xl hover:shadow-violet/20"
                    >
                      <div
                        className="relative flex h-36 items-center justify-center overflow-hidden"
                        style={
                          course.cover_url
                            ? { backgroundImage: `url(${course.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                            : { background: `linear-gradient(135deg, ${color}, ${color}88)` }
                        }
                      >
                        {!course.cover_url && (
                          <>
                            <img
                              className="absolute -right-12 -top-16 size-52 opacity-10"
                              src="/Athen_ghost.png"
                              alt=""
                              aria-hidden="true"
                            />
                            <div className="grid size-16 place-items-center rounded-3xl border border-white/20 bg-canvas/20 text-3xl text-white backdrop-blur-sm">
                              <Icon name="book" className="size-8" />
                            </div>
                          </>
                        )}
                        {(course.category || course.slug) && (
                          <span className="absolute left-4 top-4 rounded-full bg-canvas/70 px-3 py-1 font-ui text-[0.65rem] font-bold uppercase tracking-widest text-white backdrop-blur">
                            {course.category || course.slug}
                          </span>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="min-h-14 font-display text-lg leading-7 text-ink">{course.title}</div>
                        <div className="mt-5 flex justify-between font-ui text-xs">
                          <span className="text-muted">{done} de {total} aulas</span>
                          <span className="font-bold text-gold">{percent}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-mid/15">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-mid to-gold transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                          <span className="inline-flex items-center gap-1.5 font-ui text-xs text-muted">
                            <Icon name={percent === 100 ? "check" : "clock"} className="size-4" />
                            {percent === 100
                              ? "Concluído"
                              : `${remaining} ${remaining === 1 ? "aula restante" : "aulas restantes"}`}
                          </span>
                          <button
                            type="button"
                            aria-label={`Continuar ${course.title}`}
                            onClick={() => openCourse(course.id)}
                            className="grid size-9 place-items-center rounded-full bg-gold text-violet transition group-hover:translate-x-1 group-hover:bg-gold-light"
                          >
                            <Icon name="arrow" className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Próximo objetivo */}
          <section className="mt-12 overflow-hidden rounded-3xl border border-violet-mid/25 bg-gradient-to-r from-violet/70 to-surface">
            <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
              <img
                className="pointer-events-none absolute -right-16 -top-24 size-72 opacity-[0.08]"
                src="/Athen_ghost.png"
                alt=""
                aria-hidden="true"
              />
              <div className="grid size-16 shrink-0 place-items-center rounded-3xl bg-gold text-violet">
                <Icon name={nextGoal ? "target" : "trophy"} className="size-8" />
              </div>
              <div className="relative flex-1">
                <div className="font-ui text-xs font-bold tracking-widest text-gold">PRÓXIMO OBJETIVO</div>
                <div className="mt-1 font-display text-2xl text-ink">
                  {nextGoal
                    ? `Conclua ${nextGoal.course.title}`
                    : stats.completed.length > 0
                      ? "Escolha o próximo curso"
                      : "Comece sua primeira trilha"}
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  {nextGoal
                    ? `Faltam ${Math.max(0, nextGoal.total - nextGoal.done)} ${
                        nextGoal.total - nextGoal.done === 1 ? "aula" : "aulas"
                      } para terminar este curso.`
                    : "Abra o dashboard, escolha um curso e conclua sua primeira aula para ganhar XP."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCourse(nextGoal?.course.id)}
                className="relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 font-ui text-sm font-bold text-gold transition hover:bg-gold hover:text-violet"
              >
                {nextGoal ? "Continuar curso" : "Ir para o dashboard"}
                <Icon name="chevron" className="size-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}