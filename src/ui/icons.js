import { svg } from 'lit-html';

const PATHS = {
  door: svg`
    <rect x="22" y="10" width="56" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M14 90h72" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    <circle cx="64" cy="52" r="5.5" fill="currentColor"/>
  `,
  ball: svg`
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M23 24c14 14 14 38 0 52M77 24c-14 14-14 38 0 52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
  `,
  bowl: svg`
    <path d="M12 46h76l-10 32a10 10 0 0 1-9.5 7h-37A10 10 0 0 1 22 78L12 46Z" fill="currentColor"/>
    <ellipse cx="50" cy="40" rx="34" ry="8" fill="none" stroke="currentColor" stroke-width="6"/>
  `,
  water: svg`
    <path d="M50 10C50 10 20 46 20 66a30 30 0 0 0 60 0C80 46 50 10 50 10Z" fill="currentColor"/>
  `,
  bone: svg`
    <path d="M25 32a11 11 0 1 1 12 10h26a11 11 0 1 1 12-10 11 11 0 1 1 0 36 11 11 0 1 1-12-10H37a11 11 0 1 1-12 10 11 11 0 1 1 0-36Z" fill="currentColor"/>
  `,
  paw: svg`
    <ellipse cx="50" cy="64" rx="22" ry="18" fill="currentColor"/>
    <ellipse cx="24" cy="39" rx="9.5" ry="12.5" fill="currentColor"/>
    <ellipse cx="41" cy="26" rx="9.5" ry="13" fill="currentColor"/>
    <ellipse cx="59" cy="26" rx="9.5" ry="13" fill="currentColor"/>
    <ellipse cx="76" cy="39" rx="9.5" ry="12.5" fill="currentColor"/>
  `,
  star: svg`
    <polygon points="50,10 61.8,36.2 90.5,39.4 69,58.8 75,87 50,72.5 25,87 31,58.8 9.5,39.4 38.2,36.2" fill="currentColor"/>
  `,
  circle: svg`
    <circle cx="50" cy="50" r="36" fill="currentColor"/>
  `,
  triangle: svg`
    <polygon points="50,12 88,84 12,84" fill="currentColor" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
  `,
  hexagon: svg`
    <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="currentColor"/>
  `,
  frisbee: svg`
    <ellipse cx="56" cy="44" rx="34" ry="14" transform="rotate(-14 56 44)" fill="currentColor"/>
    <ellipse cx="55" cy="41" rx="20" ry="6.5" transform="rotate(-14 55 41)" fill="none" stroke="var(--pad-bg, #071324)" stroke-width="4"/>
    <path d="M12 62l22-6M16 74l28-7M28 84l22-5" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
  `,
  come: svg`
    <circle cx="50" cy="74" r="13" fill="currentColor"/>
    <path d="M50 12v36M32 32l18 18 18-18" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 74a28 28 0 0 1 8-19M78 74a28 28 0 0 0-8-19" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
  `,
  sit: svg`
    <circle cx="62" cy="24" r="11" fill="currentColor"/>
    <path d="M55 16l-6-8 10 3Z" fill="currentColor"/>
    <path d="M68 22h11a5 5 0 0 1 0 10h-9Z" fill="currentColor"/>
    <path d="M56 34L36 62c-5 7-2 18 8 18h22v-12H52l12-18v30h10V42a10 10 0 0 0-18-8Z" fill="currentColor"/>
    <path d="M18 86h64" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
  `,
  stay: svg`
    <path d="M33 48V22a5.5 5.5 0 0 1 11 0v22M44 44V16a5.5 5.5 0 0 1 11 0v28M55 44V20a5.5 5.5 0 0 1 11 0v26M66 46V30a5.5 5.5 0 0 1 11 0v28c0 16-11 28-26 28h-4c-14 0-25-10-25-24V46a6 6 0 0 1 11-2v6" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  up: svg`
    <polygon points="50,12 86,50 65,50 65,88 35,88 35,50 14,50" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  `,
  down: svg`
    <polygon points="50,88 14,50 35,50 35,12 65,12 65,50 86,50" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  `,
  ok: svg`
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M30 51l14 15 27-30" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  no: svg`
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M24 24l52 52" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
  `,
  tune: svg`
    <path d="M16 28h68M16 50h68M16 72h68" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <circle cx="36" cy="28" r="9" fill="currentColor"/>
    <circle cx="66" cy="50" r="9" fill="currentColor"/>
    <circle cx="44" cy="72" r="9" fill="currentColor"/>
  `,
  lock: svg`
    <rect x="22" y="44" width="56" height="44" rx="8" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M34 44V30a16 16 0 0 1 32 0v14" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    <circle cx="50" cy="65" r="6" fill="currentColor"/>
  `,
  unlock: svg`
    <rect x="22" y="44" width="56" height="44" rx="8" fill="none" stroke="currentColor" stroke-width="8"/>
    <path d="M34 44V28a16 16 0 0 1 30-7" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  `,
  mic: svg`
    <rect x="36" y="12" width="28" height="46" rx="14" fill="currentColor"/>
    <path d="M22 48a28 28 0 0 0 56 0M50 76v14M34 90h32" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
  `,
  play: svg`
    <polygon points="28,18 82,50 28,82" fill="currentColor"/>
  `,
  stop: svg`
    <rect x="24" y="24" width="52" height="52" rx="8" fill="currentColor"/>
  `,
  plus: svg`
    <path d="M50 20v60M20 50h60" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
  `,
  swap: svg`
    <path d="M20 34h56l-14-14M80 66H24l14 14" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  chart: svg`
    <path d="M18 84V52M42 84V28M66 84V42M86 84H12" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  `,
  trash: svg`
    <path d="M20 26h60M38 26V16h24v10M28 26l4 58h36l4-58" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  volume: svg`
    <polygon points="16,38 34,38 54,20 54,80 34,62 16,62" fill="currentColor"/>
    <path d="M66 34a22 22 0 0 1 0 32M78 22a38 38 0 0 1 0 56" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
  `,
};

export function renderIcon(iconId, className = 'svg-icon') {
  const content = PATHS[iconId] || PATHS.paw;
  return svg`<svg class=${className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">${content}</svg>`;
}
