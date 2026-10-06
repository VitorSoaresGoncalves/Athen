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
import type { User } from "@supabase/supabase-js";
import {
  aulaRepository,
  concluiRepository,
  cursoRepository,
  moduloRepository,
} from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";
import { SidebarLeft } from "../../components/sidebar/SidebarLeft";
import "./Profile.css";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];

type CourseProgress = {
  course: Curso;
  total: number;
  done: number;
  percent: number;
};

type IconName =
  | "arrow" | "book" | "bolt" | "calendar" | "check" | "chevron" | "clock"
  | "camera" | "close" | "edit" | "mail" | "star" | "target" | "trophy" | "user";

// ---------------------------------------------------------------------------
// Regras de gamificação.
// Ainda não existe coluna de XP no banco, então o XP é derivado das aulas
// concluídas (tabela "conclui"). Quando houver XP real, troque `totalXp`.
// ---------------------------------------------------------------------------
const XP_POR_AULA = 20;
const XP_POR_NIVEL = 200;

// ---------------------------------------------------------------------------
// Foto de perfil.
// O arquivo vai para o bucket público "avatars" do Supabase Storage, dentro da
// pasta do usuário (avatars/<user_id>/...), e a URL pública é gravada em
// user_metadata.avatar_url (o mesmo campo que o Profile já lia).
// ---------------------------------------------------------------------------
const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_MB = 5; // limite da foto original; depois do recorte ela fica bem menor
const AVATAR_SIZE = 512; // a foto salva é sempre quadrada (1:1), no máximo 512x512
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Recorta a imagem no centro em 1:1 e reduz para no máximo AVATAR_SIZE px (WEBP; JPEG se o navegador não suportar). */
async function cropToSquare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const target = Math.min(AVATAR_SIZE, side);

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu processar a imagem.");
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));

  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("Não foi possível processar a imagem.");

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `avatar.${extension}`, { type: blob.type });
}

/** Extrai "<user_id>/arquivo.ext" de uma URL pública do bucket (para apagar a foto antiga). */
function avatarPathFromUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];

function normalizeColor(color: string | null | undefined, index: number) {
  const candidate = color?.trim();
  return candidate && /^#[0-9a-fA-F]{3,8}$/.test(candidate)
    ? candidate
    : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

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
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </>
  ),
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
 * o Dashboard já tem a sua própria sidebar, então não duplicamos aqui.
 */
function PageShell({
  children,
  avatar,
  withSidebar,
}: {
  children: ReactNode;
  avatar?: string;
  withSidebar: boolean;
}) {
  if (!withSidebar) return <>{children}</>;

  return (
    <div className="flex min-h-svh bg-canvas">
      <SidebarLeft avatar={avatar} />
      {children}
    </div>
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

  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [totalDoneLessons, setTotalDoneLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [courseTab, setCourseTab] = useState<"active" | "completed">("active");

  // Edição do perfil (gravada em user_metadata do Supabase Auth)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formBio, setFormBio] = useState("");

  // Foto escolhida (só é enviada ao clicar em "Salvar")
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Libera a URL temporária do preview quando ela muda ou o componente sai da tela.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Carrega usuário, cursos, progresso e conclusões.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          if (!cancelled) setUser(null);
          return;
        }

        const [courses, conclusions] = await Promise.all([
          cursoRepository.listar(),
          concluiRepository.listar(),
        ]);

        const doneLessonIds = new Set(conclusions.map((conclusion) => conclusion.fk_Aula_ID));

        const courseProgress = await Promise.all(
          courses.map(async (course): Promise<CourseProgress> => {
            const modules = await moduloRepository.listarPorCurso(course.ID);
            const lessonsByModule = await Promise.all(
              modules.map((module) => aulaRepository.listarPorModulo(module.ID)),
            );
            const lessons = lessonsByModule.flat();
            const done = lessons.filter((lesson) => doneLessonIds.has(lesson.ID)).length;
            const percent = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;
            return { course, total: lessons.length, done, percent };
          }),
        );

        if (cancelled) return;
        setUser(userData.user);
        setProgress(courseProgress);
        setTotalDoneLessons(doneLessonIds.size);
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

  // Dados do perfil vindos do cadastro (RegisterPage grava full_name e username).
  const metadata = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const displayName = metadata.full_name?.trim() || user?.email?.split("@")[0] || "Estudante";
  const username = metadata.username?.trim() || "";
  const bio = metadata.bio?.trim() || "";
  const avatarUrl = metadata.avatar_url;
  // Foto exibida: preview da nova escolha > foto salva (a menos que marcada para remover)
  const shownAvatar = avatarPreview ?? (removeAvatar ? undefined : avatarUrl);
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  // Estatísticas derivadas do banco.
  const stats = useMemo(() => {
    const started = progress.filter((item) => item.done > 0);
    const active = started.filter((item) => item.percent < 100).sort((a, b) => b.percent - a.percent);
    const completed = started.filter((item) => item.percent === 100);

    const totalXp = totalDoneLessons * XP_POR_AULA;
    const level = Math.floor(totalXp / XP_POR_NIVEL) + 1;
    const xpInLevel = totalXp % XP_POR_NIVEL;

    return {
      started,
      active,
      completed,
      totalXp,
      level,
      xpInLevel,
      levelPercent: Math.round((xpInLevel / XP_POR_NIVEL) * 100),
      xpToNext: XP_POR_NIVEL - xpInLevel,
    };
  }, [progress, totalDoneLessons]);

  const achievements = useMemo(() => {
    const items: { icon: IconName; title: string; description: string; current: number; target: number }[] = [
      { icon: "check", title: "Primeiro passo", description: "Conclua sua primeira aula", current: totalDoneLessons, target: 1 },
      { icon: "book", title: "Mente curiosa", description: "Inicie 3 cursos", current: stats.started.length, target: 3 },
      { icon: "trophy", title: "Diploma na mão", description: "Conclua um curso", current: stats.completed.length, target: 1 },
      { icon: "bolt", title: "Maratonista", description: "Conclua 25 aulas", current: totalDoneLessons, target: 25 },
    ];
    return items.map((item) => ({ ...item, unlocked: item.current >= item.target }));
  }, [stats, totalDoneLessons]);

  const visibleCourses = courseTab === "active" ? stats.active : stats.completed;
  const nextGoal = stats.active[0];

  function startEditing() {
    setFormName(metadata.full_name ?? "");
    setFormUsername(metadata.username ?? "");
    setFormBio(metadata.bio ?? "");
    setSaveMessage("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setEditing(true);
  }

  function cancelEditing() {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setSaveMessage("");
    setEditing(false);
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      setSaveMessage("Escolha uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      setSaveMessage(`A foto deve ter no máximo ${AVATAR_MAX_MB} MB.`);
      return;
    }

    setSaveMessage("");

    try {
      const squared = await cropToSquare(file);
      setRemoveAvatar(false);
      setAvatarFile(squared);
      setAvatarPreview(URL.createObjectURL(squared));
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    }
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formName.trim() || !formUsername.trim()) {
      setSaveMessage("Preencha o nome de exibição e o nome de usuário.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    // undefined = não mexe na foto | string = nova foto | null = remove a foto
    let newAvatarUrl: string | null | undefined;
    let uploadedPath: string | null = null;

    if (avatarFile && user) {
      const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, avatarFile, { cacheControl: "3600", contentType: avatarFile.type });

      if (uploadError) {
        setSaving(false);
        setSaveMessage(`Falha ao enviar a foto: ${uploadError.message}`);
        return;
      }

      uploadedPath = path;
      newAvatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    } else if (removeAvatar) {
      newAvatarUrl = null;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: formName.trim(),
        username: formUsername.trim(),
        bio: formBio.trim(),
        ...(newAvatarUrl !== undefined ? { avatar_url: newAvatarUrl } : {}),
      },
    });

    setSaving(false);

    if (error) {
      // não deixa arquivo órfão no bucket se o perfil não foi salvo
      if (uploadedPath) void supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]);
      setSaveMessage(`Falha ao salvar: ${error.message}`);
      return;
    }

    // apaga a foto antiga do bucket (best-effort) quando foi trocada ou removida
    if (newAvatarUrl !== undefined) {
      const oldPath = avatarPathFromUrl(avatarUrl);
      if (oldPath) void supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    setUser(data.user);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setEditing(false);
  }

  if (loading) {
    return (
      <PageShell withSidebar={withSidebar} avatar={avatarUrl}>
        <main className="grid min-h-svh min-w-0 flex-1 place-items-center bg-canvas font-body text-muted">
          Carregando seu perfil...
        </main>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell withSidebar={withSidebar} avatar={avatarUrl}>
        <main className="grid min-h-svh min-w-0 flex-1 place-items-center bg-canvas px-5 text-center font-body text-ink">
          <div>
            <p className="text-muted">{errorMessage || "Você precisa entrar para ver seu perfil."}</p>
            <Link
              to="/login-page"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-gold px-5 font-ui text-sm font-bold text-violet transition hover:bg-gold-light"
            >
              Ir para o login
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell withSidebar={withSidebar} avatar={avatarUrl}>
      <main className="min-w-0 flex-1 bg-canvas pb-20 font-body text-ink">
        <section className="relative overflow-hidden border-b border-line">
          <img
            src="/Athen_ghost.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-96 opacity-[0.08]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_5%,rgba(164,134,213,0.2),transparent_34%),radial-gradient(circle_at_18%_100%,rgba(255,204,0,0.1),transparent_30%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pb-9 pt-10 md:px-8 md:pb-12 md:pt-14">
            <form
              onSubmit={(event) => void handleSave(event)}
              className="flex flex-col gap-6 md:flex-row md:items-end"
            >
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
                      accept={AVATAR_TYPES.join(",")}
                      onChange={(event) => void handleAvatarChange(event)}
                      className="hidden"
                    />
                    {shownAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
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
                {user.email_confirmed_at && (
                  <div
                    className="absolute -bottom-2 -right-2 grid size-10 place-items-center rounded-full border-4 border-canvas bg-gold text-violet"
                    title="E-mail confirmado"
                  >
                    <Icon name="check" className="size-5" />
                  </div>
                )}
              </div>

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
                      Bio
                      <textarea
                        value={formBio}
                        onChange={(event) => setFormBio(event.target.value)}
                        rows={3}
                        maxLength={240}
                        className="resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                      />
                    </label>
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
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-ui text-xs text-violet-pale">
                      {memberSince && (
                        <span className="inline-flex items-center gap-2">
                          <Icon name="calendar" className="size-4 text-gold" />
                          Na Athen desde {memberSince}
                        </span>
                      )}
                      {user.email && (
                        <span className="inline-flex items-center gap-2">
                          <Icon name="mail" className="size-4 text-gold" />
                          {user.email}
                        </span>
                      )}
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
            </form>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-5 pt-8 md:px-8 md:pt-10">
          {errorMessage && (
            <p className="mb-6 rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-3 font-ui text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 to-surface p-5">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-gold text-violet">
                  <Icon name="bolt" />
                </div>
                <span className="font-ui text-xs font-bold text-gold">{XP_POR_AULA} XP por aula</span>
              </div>
              <div className="font-display text-3xl text-ink">{stats.totalXp.toLocaleString("pt-BR")} XP</div>
              <div className="mt-1 font-ui text-xs text-muted">Experiência total</div>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-violet text-gold">
                  <Icon name="check" />
                </div>
              </div>
              <div className="font-display text-3xl text-ink">
                {totalDoneLessons} {totalDoneLessons === 1 ? "aula" : "aulas"}
              </div>
              <div className="mt-1 font-ui text-xs text-muted">Concluídas até agora</div>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-violet-mid/20 text-violet-pale">
                  <Icon name="book" />
                </div>
                <span className="font-ui text-xs font-bold text-violet-pale">
                  {stats.active.length} em andamento
                </span>
              </div>
              <div className="font-display text-3xl text-ink">
                {stats.started.length} {stats.started.length === 1 ? "curso" : "cursos"}
              </div>
              <div className="mt-1 font-ui text-xs text-muted">
                {stats.completed.length} {stats.completed.length === 1 ? "concluído" : "concluídos"}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="mb-5 flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-gold-pale text-violet">
                  <Icon name="star" />
                </div>
                <span className="font-ui text-xs font-bold text-gold">NÍVEL {stats.level}</span>
              </div>
              <div className="mb-2 flex items-end justify-between font-ui text-xs">
                <span className="text-muted">{stats.xpInLevel} / {XP_POR_NIVEL} XP</span>
                <span className="font-bold text-ink">{stats.levelPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-violet-mid/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-mid to-gold transition-all"
                  style={{ width: `${stats.levelPercent}%` }}
                />
              </div>
              <div className="mt-3 font-ui text-xs text-muted">{stats.xpToNext} XP para o próximo nível</div>
            </div>
          </section>

          <section className="mt-12">
            <SectionTitle eyebrow="SUA COLEÇÃO" title="Conquistas" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {achievements.map((achievement) => (
                <article
                  key={achievement.title}
                  className={`flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-1 hover:border-violet-mid/40 ${
                    achievement.unlocked ? "" : "opacity-60"
                  }`}
                >
                  <div
                    className={`grid size-12 shrink-0 place-items-center rounded-2xl border ${
                      achievement.unlocked
                        ? "border-gold/25 bg-gold/15 text-gold"
                        : "border-violet-mid/25 bg-violet-mid/10 text-violet-pale"
                    }`}
                  >
                    <Icon name={achievement.icon} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-ui text-sm font-bold text-ink">{achievement.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {achievement.unlocked
                        ? achievement.description
                        : `${achievement.description} (${achievement.current}/${achievement.target})`}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

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

            {visibleCourses.length === 0 ? (
              <p className="rounded-3xl border border-line bg-surface px-5 py-10 text-center font-ui text-sm text-muted">
                {courseTab === "active"
                  ? "Você não tem cursos em andamento. Comece uma aula no dashboard!"
                  : "Você ainda não concluiu nenhum curso."}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.map(({ course, total, done, percent }, index) => {
                  const color = normalizeColor(course.Cor_Capa, index);
                  const remaining = total - done;

                  return (
                    <article
                      key={course.ID}
                      className="group overflow-hidden rounded-3xl border border-line bg-surface transition hover:-translate-y-1 hover:border-violet-mid/40 hover:shadow-2xl hover:shadow-violet/20"
                    >
                      <div
                        className="relative flex h-36 items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
                      >
                        <img
                          className="absolute -right-12 -top-16 size-52 opacity-10"
                          src="/Athen_ghost.png"
                          alt=""
                          aria-hidden="true"
                        />
                        <div className="grid size-16 place-items-center rounded-3xl border border-white/20 bg-canvas/20 text-3xl text-white backdrop-blur-sm">
                          {course.Icone || <Icon name="book" className="size-8" />}
                        </div>
                        {(course.Categoria || course.Slug) && (
                          <span className="absolute left-4 top-4 rounded-full bg-canvas/70 px-3 py-1 font-ui text-[0.65rem] font-bold uppercase tracking-widest text-white backdrop-blur">
                            {course.Categoria || course.Slug}
                          </span>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="min-h-14 font-display text-lg leading-7 text-ink">{course.Titulo}</div>
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
                            aria-label={`Continuar ${course.Titulo}`}
                            onClick={() => openCourse(course.ID)}
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
                    ? `Conclua ${nextGoal.course.Titulo}`
                    : stats.completed.length > 0
                      ? "Escolha o próximo curso"
                      : "Comece sua primeira trilha"}
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  {nextGoal
                    ? `Faltam ${nextGoal.total - nextGoal.done} ${
                        nextGoal.total - nextGoal.done === 1 ? "aula" : "aulas"
                      } (${(nextGoal.total - nextGoal.done) * XP_POR_AULA} XP) para terminar este curso.`
                    : "Abra o dashboard, escolha um curso e conclua sua primeira aula para ganhar XP."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCourse(nextGoal?.course.ID)}
                className="relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 font-ui text-sm font-bold text-gold transition hover:bg-gold hover:text-violet"
              >
                {nextGoal ? "Continuar curso" : "Ir para o dashboard"}
                <Icon name="chevron" className="size-4" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </PageShell>
  );
}