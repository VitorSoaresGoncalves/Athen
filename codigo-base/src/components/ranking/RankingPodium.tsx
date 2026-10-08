import { useId, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Tipos (exportados para as páginas que forem montar a lista de jogadores)
// ---------------------------------------------------------------------------
export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "legendary";
export type PodiumHeight = "first" | "second" | "third" | "fourth" | "fifth";

export type PodiumPlayer = {
  position: string;     // texto exibido na pílula, ex.: "1º"
  name: string;
  detail?: string;      // ex.: "96% · 14 aulas"
  tier: Tier;           // define cor e emblema
  height: PodiumHeight; // define a altura do degrau
  isYou?: boolean;      // destaca o usuário logado
};

type RankingPodiumProps = {
  players: PodiumPlayer[];
  compact?: boolean;
  width?: "default" | "compact" | "room";
  ariaLabel?: string;
};

type Variant = "default" | "room" | "compact";

// Junta classes ignorando valores falsos.
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Cores de cada nível.
// O Tailwind só gera classes que aparecem escritas por inteiro no código, então
// `bg-${tier}` não funciona. Por isso as cores ficam aqui e chegam ao JSX como
// variáveis CSS (--tier, --tier-rgb) ou como atributos do SVG.
// ---------------------------------------------------------------------------
const tierTheme: Record<
  Tier,
  { label: string; color: string; rgb: string; light: string; dark: string; symbol: string }
> = {
  bronze:    { label: "Bronze",   color: "#c2763a", rgb: "194, 118, 58",  light: "#e4a36f", dark: "#70401f", symbol: "#ffffff" },
  silver:    { label: "Prata",    color: "#cbd5e1", rgb: "203, 213, 225", light: "#f4f7fa", dark: "#7d8a9d", symbol: "#25324a" },
  gold:      { label: "Ouro",     color: "#eab308", rgb: "234, 179, 8",   light: "#fde56f", dark: "#8f6800", symbol: "#4d3500" },
  platinum:  { label: "Platina",  color: "#5eead4", rgb: "94, 234, 212",  light: "#c5fff5", dark: "#198f82", symbol: "#123f44" },
  diamond:   { label: "Diamante", color: "#38bdf8", rgb: "56, 189, 248",  light: "#bdecff", dark: "#116a9a", symbol: "#103c5e" },
  master:    { label: "Mestre",   color: "#c084fc", rgb: "192, 132, 252", light: "#e7c7ff", dark: "#7135ab", symbol: "#ffffff" },
  legendary: { label: "Lendário", color: "#f43f5e", rgb: "244, 63, 94",   light: "#ff9bab", dark: "#95152f", symbol: "#ffffff" },
};

// Tamanho do wrapper e alturas (px) de cada degrau, por variante.
const variantConfig: Record<
  Variant,
  { wrapper: string; metaHeight: number; steps: Record<PodiumHeight, number> }
> = {
  default: {
    wrapper: "max-w-[560px] h-[292px]",
    metaHeight: 82,
    steps: { first: 190, second: 156, third: 129, fourth: 106, fifth: 87 },
  },
  room: {
    wrapper: "max-w-[600px] h-[280px]",
    metaHeight: 82,
    steps: { first: 178, second: 146, third: 121, fourth: 100, fifth: 82 },
  },
  compact: {
    wrapper: "max-w-[340px] h-[250px]",
    metaHeight: 70,
    steps: { first: 164, second: 134, third: 112, fourth: 92, fifth: 75 },
  },
};

// ---------------------------------------------------------------------------
// Emblema (faixa) — um símbolo diferente para cada nível
// ---------------------------------------------------------------------------
function BadgeSymbol({ tier }: { tier: Tier }) {
  if (tier === "bronze") {
    return <circle cx="50" cy="48" r="10" />;
  }

  if (tier === "silver") {
    return <path d="M31 57 50 38l19 19-7 7-12-12-12 12Z" />;
  }

  if (tier === "gold") {
    return (
      <path d="m50 28 6.3 12.9 14.2 2-10.3 10 2.5 14.1L50 60.3 37.3 67l2.5-14.1-10.3-10 14.2-2Z" />
    );
  }

  if (tier === "platinum") {
    return (
      <path d="m31 48 19-18 19 18-7 6-12-11-12 11Zm0 17 19-18 19 18-7 6-12-11-12 11Z" />
    );
  }

  if (tier === "diamond") {
    return (
      <path
        d="m27 43 9-12h28l9 12-23 29Zm10-2 13 25 13-25-6-6H43Zm0 0h26M50 66V35"
        fillRule="evenodd"
      />
    );
  }

  if (tier === "master") {
    return <path d="m28 63-4-25 15 10 11-20 11 20 15-10-4 25Zm2 6h40v-8H30Z" />;
  }

  return (
    <path d="M50 22c2 16 7 22 22 25-15 3-20 9-22 25-2-16-7-22-22-25 15-3 20-9 22-25Zm22 2c1 7 3 10 10 11-7 1-9 4-10 11-1-7-3-10-10-11 7-1 9-4 10-11Z" />
  );
}

export function RankBadge({ tier, size = 44 }: { tier: Tier; size?: 34 | 44 }) {
  // useId gera ":r1:"; os dois pontos quebram o url(#id) do SVG.
  const gradientId = useId().replaceAll(":", "");
  const theme = tierTheme[tier];

  return (
    <span
      role="img"
      aria-label={`Faixa ${theme.label}`}
      className={cx(
        "inline-flex flex-none",
        size === 34 ? "size-[34px]" : "size-[44px]",
        tier === "legendary"
          ? "drop-shadow-[0_0_8px_rgba(244,63,94,0.72)]"
          : "drop-shadow-[0_5px_8px_rgba(4,1,12,0.28)]",
      )}
    >
      <svg viewBox="0 0 100 96" aria-hidden="true" className="block size-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={theme.light} />
            <stop offset=".48" stopColor={theme.color} />
            <stop offset="1" stopColor={theme.dark} />
          </linearGradient>
        </defs>
        <path
          d="M50 3 93 34 77 87 50 94 23 87 7 34Z"
          fill={`url(#${gradientId})`}
          stroke={theme.light}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d="m50 11 35 26-14 44-21 6-21-6-14-44Z"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <g
          fill={theme.symbol}
          stroke={theme.symbol}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <BadgeSymbol tier={tier} />
        </g>
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Degrau do pódio
// ---------------------------------------------------------------------------
type PodiumStepProps = {
  player: PodiumPlayer;
  index: number;
  compact: boolean;
  metaHeight: number;
  stepHeight: number;
};

function PodiumStep({ player, index, compact, metaHeight, stepHeight }: PodiumStepProps) {
  const theme = tierTheme[player.tier];
  const isFirst = player.height === "first";

  const slotStyle = {
    height: metaHeight + stepHeight,
    "--tier": theme.color,
    "--tier-rgb": theme.rgb,
  } as CSSProperties;

  return (
    <div className="flex min-w-0 flex-col self-end" style={slotStyle}>
      {/* Posição, nome e detalhe */}
      <div
        className={cx(
          "relative flex min-w-0 flex-none flex-col items-center justify-start text-center",
          compact ? "h-[70px] gap-[3px] px-0.5" : "h-[82px] gap-1 px-[5px]",
        )}
      >
        <span className="inline-flex h-5 min-w-[31px] items-center justify-center rounded-full border border-[rgba(var(--tier-rgb),0.2)] bg-[rgba(var(--tier-rgb),0.16)] px-2 text-[10px] font-black text-(--tier)">
          {player.position}
        </span>

        <span
          title={player.name}
          className={cx(
            "block w-full truncate font-bold leading-[1.2] text-[#f4eeff]",
            compact ? "text-[12px]" : isFirst ? "text-[15px]" : "text-[13px]",
          )}
        >
          {player.name}
        </span>

        {player.isYou ? (
          <span className="absolute top-[42px] z-2 rounded-[4px] bg-(--tier) px-[5px] py-0.5 text-[7px] font-black leading-[1.2] tracking-[0.12em] text-[#140a2b]">
            VOCÊ
          </span>
        ) : null}

        {player.detail ? (
          <span
            className={cx(
              "block w-full truncate leading-[1.2] text-[#a49ab7]",
              compact ? "text-[8px]" : "text-[9px]",
              player.isYou && "mt-3",
            )}
          >
            {player.detail}
          </span>
        ) : null}
      </div>

      {/* Degrau */}
      <div
        className={cx(
          "relative flex min-h-0 flex-1 flex-col items-center rounded-t-xl bg-[linear-gradient(180deg,rgba(131,78,200,0.62),rgba(62,34,108,0.55))]",
          compact ? "gap-[7px] px-0.5 pt-[15px] pb-1.5" : "gap-2.5 px-[5px] pt-[22px] pb-2",
          player.isYou
            ? "border border-t-[3px] border-(--tier) shadow-[0_0_22px_rgba(var(--tier-rgb),0.26),inset_0_0_18px_rgba(var(--tier-rgb),0.08)]"
            : cx(
                "border-t-[3px] border-r border-t-(--tier) border-r-[rgba(193,150,255,0.13)]",
                index > 0 && "border-l border-l-[rgba(20,10,43,0.5)]",
              ),
        )}
      >
        <RankBadge tier={player.tier} size={compact ? 34 : 44} />
        <span
          className={cx(
            "w-full truncate text-center font-black uppercase leading-[1.2] text-(--tier)",
            compact ? "text-[9px] tracking-[0.07em]" : "text-[10px] tracking-[0.12em]",
          )}
        >
          {theme.label}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pódio
//
// ATENÇÃO: os jogadores aparecem na ordem do array, da esquerda para a direita.
// Para o formato clássico de pódio, passe na ordem visual: 4º, 2º, 1º, 3º, 5º.
// ---------------------------------------------------------------------------
export function RankingPodium({
  players,
  compact = false,
  width = "default",
  ariaLabel = "Pódio de ranking",
}: RankingPodiumProps) {
  const variant: Variant = compact || width === "compact" ? "compact" : width;
  const config = variantConfig[variant];
  const isCompact = variant === "compact";

  const gridColumns =
    players.length === 1 ? "grid-cols-1 w-[23%]" : players.length === 3 ? "grid-cols-3 w-[64%]" : "grid-cols-5 w-full";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        "relative mx-auto box-border flex w-full items-center justify-center **:box-border",
        config.wrapper,
      )}
    >
      {players.length === 0 ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[rgba(193,150,255,0.22)] bg-[rgba(193,150,255,0.025)] text-[13px] font-medium text-[#a49ab7]">
          <span className="grid size-[42px] place-items-center rounded-full bg-[rgba(193,150,255,0.07)] text-[#766b8a]">
            <svg
              viewBox="0 0 40 40"
              aria-hidden="true"
              className="w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 31h16M15 28V17l5-8 5 8v11M11 17h18" />
            </svg>
          </span>
          <span>Ninguém no pódio ainda.</span>
        </div>
      ) : (
        <div
          className={cx(
            "grid h-full items-end border-b border-b-[rgba(193,150,255,0.14)] pt-1",
            gridColumns,
          )}
        >
          {players.map((player, index) => (
            <PodiumStep
              key={`${player.position}-${player.name}-${index}`}
              player={player}
              index={index}
              compact={isCompact}
              metaHeight={config.metaHeight}
              stepHeight={config.steps[player.height]}
            />
          ))}
        </div>
      )}
    </div>
  );
}