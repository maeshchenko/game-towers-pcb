// Comic prologue panel art — dense hand-authored SVG illustrations (no external assets).
// Each panel is a full scene with lighting, depth layers and micro-detail; tiny SMIL
// animations (blinking source, crawling infection, firing tower) keep the panels alive.

/** Deterministic star field (seeded LCG — same sky every boot). */
function stars(n: number, w: number, h: number, seed = 7): string {
  let s = seed
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = (rnd() * w).toFixed(1)
    const y = (rnd() * h * 0.75).toFixed(1)
    const r = (0.4 + rnd() * 1.1).toFixed(2)
    const o = (0.25 + rnd() * 0.75).toFixed(2)
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#cfeee0" opacity="${o}"/>`
  }
  return out
}

const G = '#2bd06a', GD = '#1a4534', R = '#ff4d4d', C = '#36e0e0'

export function comicPanelArt(n: number): string {
  const open = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">`
  const close = `</svg>`
  switch (n) {
    // ── P1: Vega-9 listens to the void ─────────────────────────────────────
    case 0: return `${open}
      <defs>
        <radialGradient id="p1neb" cx="80%" cy="15%" r="70%">
          <stop offset="0%" stop-color="#173028"/><stop offset="100%" stop-color="#060c09"/>
        </radialGradient>
        <linearGradient id="p1gnd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#122019"/><stop offset="100%" stop-color="#0a130e"/>
        </linearGradient>
      </defs>
      <rect width="220" height="130" fill="url(#p1neb)"/>
      ${stars(90, 220, 130)}
      <ellipse cx="185" cy="22" rx="26" ry="10" fill="rgba(43,208,106,0.06)"/>
      <!-- ridge line + station hull -->
      <path d="M0 104 Q40 96 80 102 T220 100 V130 H0 Z" fill="url(#p1gnd)"/>
      <rect x="12" y="88" width="34" height="16" rx="2" fill="#0e1a13" stroke="${GD}"/>
      <rect x="17" y="92" width="5" height="4" fill="${G}" opacity="0.85"><animate attributeName="opacity" values="0.85;0.3;0.85" dur="2.2s" repeatCount="indefinite"/></rect>
      <rect x="26" y="92" width="5" height="4" fill="${G}" opacity="0.4"/>
      <rect x="35" y="92" width="5" height="4" fill="${G}" opacity="0.6"/>
      <!-- dish: tripod mount + bowl aimed at the red source (axis rotated -34°) -->
      <path d="M97 106 L104 80 L111 106 Z" fill="#0e1a13" stroke="${GD}"/>
      <g transform="translate(104 70) rotate(-34)">
        <path d="M0 -24 Q-18 0 0 24 Z" fill="#0f241a" stroke="${G}" stroke-width="1.4"/>
        <ellipse cx="0" cy="0" rx="6.5" ry="24" fill="rgba(20,48,37,0.92)" stroke="${G}" stroke-width="1.6"/>
        <ellipse cx="0" cy="0" rx="3.8" ry="15" fill="none" stroke="rgba(43,208,106,0.35)"/>
        <line x1="0" y1="-24" x2="22" y2="0" stroke="rgba(43,208,106,0.45)"/>
        <line x1="0" y1="24" x2="22" y2="0" stroke="rgba(43,208,106,0.45)"/>
        <line x1="6.5" y1="0" x2="22" y2="0" stroke="${G}" stroke-width="1.4"/>
        <circle cx="22" cy="0" r="2.8" fill="${G}"/>
      </g>
      <!-- incoming signal: dashed beam into the feed + wavefronts centered on the source -->
      <g opacity="0.9">
        <line x1="191" y1="17" x2="124" y2="59" stroke="${R}" stroke-width="1" stroke-dasharray="3 4" opacity="0.6"/>
        <path d="M192.9 24.3 A12 12 0 0 1 185.1 11.7" stroke="${R}" fill="none" opacity="0.55"/>
        <path d="M190.5 30.9 A19 19 0 0 1 178.1 11" stroke="${R}" fill="none" opacity="0.42"/>
        <path d="M188.1 37.4 A26 26 0 0 1 171.1 10.3" stroke="${R}" fill="none" opacity="0.3"/>
        <circle cx="197" cy="13" r="2.6" fill="${R}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle>
        <circle cx="197" cy="13" r="6" fill="none" stroke="${R}" opacity="0.5"><animate attributeName="r" values="3;10" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0" dur="1.1s" repeatCount="indefinite"/></circle>
      </g>
      ${close}`

    // ── P2: the terminal — PAYLOAD RUNNING ────────────────────────────────
    case 1: return `${open}
      <defs>
        <radialGradient id="p2glow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stop-color="#12251b"/><stop offset="100%" stop-color="#05090702"/>
        </radialGradient>
      </defs>
      <rect width="220" height="130" fill="#070d0a"/>
      <ellipse cx="110" cy="66" rx="95" ry="62" fill="url(#p2glow)"/>
      <!-- desk -->
      <rect x="8" y="104" width="204" height="6" rx="2" fill="#101a14"/>
      <rect x="8" y="104" width="204" height="2" fill="rgba(43,208,106,0.18)"/>
      <!-- monitor body + stand -->
      <rect x="52" y="14" width="116" height="78" rx="7" fill="#1c211e" stroke="#2a332d"/>
      <rect x="60" y="21" width="100" height="60" rx="4" fill="#081710"/>
      <rect x="60" y="21" width="100" height="60" rx="4" fill="none" stroke="rgba(43,208,106,0.35)"/>
      <rect x="98" y="92" width="24" height="8" fill="#161b18"/>
      <rect x="88" y="100" width="44" height="4" rx="2" fill="#161b18"/>
      <!-- screen log -->
      <g font-family="monospace" font-size="7.4">
        <text x="66" y="33" fill="${G}">> VEGA-9 RX CHAIN OK</text>
        <text x="66" y="43" fill="${G}">> CARRIER DETECTED</text>
        <text x="66" y="53" fill="${R}">! PAYLOAD EXECUTABLE</text>
        <text x="66" y="63" fill="${R}" font-weight="bold">! PAYLOAD RUNNING<animate attributeName="opacity" values="1;0.25;1" dur="0.9s" repeatCount="indefinite"/></text>
        <text x="66" y="74" fill="${G}">>&#160;<tspan fill="#bfffd9">_</tspan><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></text>
      </g>
      <!-- screen scanlines + reflection on the desk -->
      <rect x="60" y="21" width="100" height="60" rx="4" fill="rgba(0,0,0,0.16)" style="mix-blend-mode:multiply"/>
      <ellipse cx="110" cy="107" rx="52" ry="3" fill="rgba(43,208,106,0.10)"/>
      <!-- keyboard, mug, cable -->
      <rect x="70" y="110" width="62" height="9" rx="2" fill="#18231c" stroke="#2c3c33" stroke-width="0.6"/>
      <g fill="#2a3a30">${Array.from({length: 3}).map((_, r) => Array.from({length: 12}).map((_, c) => `<rect x="${73 + c * 4.7}" y="${111.5 + r * 2.4}" width="3.4" height="1.7" rx="0.4"/>`).join('')).join('')}</g>
      <path d="M168 90 q22 4 28 14" stroke="#22302a" fill="none" stroke-width="2"/>
      <g>
        <rect x="30" y="93" width="13" height="11" rx="1.5" fill="#131a15" stroke="#26332b"/>
        <path d="M43 95.5 q5.5 0.2 5.5 4 q0 3.8 -5.5 4" stroke="#26332b" fill="none" stroke-width="1.2"/>
        <path d="M33.5 90 q1.6 -3 0 -6 M38.5 90 q1.6 -3 0 -6" stroke="rgba(200,255,220,0.25)" fill="none">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.6s" repeatCount="indefinite"/>
        </path>
      </g>
      ${close}`

    // ── P3: infection crawls the boards ───────────────────────────────────
    case 2: return `${open}
      <defs><clipPath id="p3clip"><rect x="10" y="8" width="200" height="114" rx="5"/></clipPath></defs>
      <rect width="220" height="130" fill="#08120c"/>
      <!-- board substrate + grid -->
      <rect x="10" y="8" width="200" height="114" rx="5" fill="#0c1a12" stroke="${GD}" stroke-width="1.5"/>
      <g stroke="rgba(43,208,106,0.07)">${Array.from({length: 13}).map((_, i) => `<line x1="${18 + i * 15}" y1="10" x2="${18 + i * 15}" y2="120"/>`).join('')}${Array.from({length: 8}).map((_, i) => `<line x1="12" y1="${16 + i * 14}" x2="208" y2="${16 + i * 14}"/>`).join('')}</g>
      <!-- healthy copper (green) with pads at the ends -->
      <g stroke="${G}" stroke-width="1.6" fill="none" opacity="0.75">
        <path d="M18 110 H70 V88 H110"/>
        <path d="M204 116 H160 V96"/>
        <path d="M204 24 H176 V44 H150"/>
      </g>
      <g fill="none" stroke="${G}" opacity="0.75">
        <circle cx="110" cy="88" r="2.4" stroke-width="1.4"/>
        <circle cx="160" cy="96" r="2.4" stroke-width="1.4"/>
      </g>
      <g stroke="${GD}" stroke-width="1" fill="none">
        <path d="M18 118 H90 M130 118 H204"/>
        <circle cx="90" cy="118" r="1.8"/><circle cx="130" cy="118" r="1.8"/>
      </g>
      <!-- ICs and parts -->
      <g>
        <rect x="92" y="52" width="34" height="24" rx="2" fill="#141b16" stroke="#26332b"/>
        <g fill="#3c4a42">${Array.from({length: 5}).map((_, i) => `<rect x="${96 + i * 6}" y="48" width="3" height="4"/><rect x="${96 + i * 6}" y="76" width="3" height="4"/>`).join('')}</g>
        <text x="98" y="66" font-family="monospace" font-size="6" fill="#57695f">LM324N</text>
        <rect x="50" y="98" width="18" height="9" rx="4" fill="#2c2318" stroke="#4a3b28"/>
        <rect x="150" y="100" width="18" height="9" rx="4" fill="#2c2318" stroke="#4a3b28"/>
        <circle cx="186" cy="70" r="7" fill="#101b26" stroke="#26414f"/>
      </g>
      <!-- infected copper: red web fanning from the top-left corner -->
      <g stroke="${R}" stroke-width="1.8" fill="none">
        <path d="M10 14 H58 V36 H96 V52"/>
        <path d="M10 26 H40 V64 H70 V88"/>
        <path d="M58 14 V22 H120 V36 H150 V44"/>
      </g>
      <!-- infection reaching green nets: red vias where the web ends -->
      <circle cx="70" cy="88" r="2.6" fill="${R}"/>
      <circle cx="150" cy="44" r="2.6" fill="${R}"><animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite"/></circle>
      <!-- crawling packets -->
      <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" fill="${R}">
        <animateMotion dur="2.4s" repeatCount="indefinite" path="M14 14 H58 V36 H96 V52"/>
      </rect>
      <rect x="-2" y="-2" width="4" height="4" rx="1" fill="#ff8a8a">
        <animateMotion dur="3.1s" repeatCount="indefinite" path="M14 26 H40 V64 H70 V88"/>
      </rect>
      <!-- corrupted zone: flickering glow, clipped to the board -->
      <circle cx="24" cy="18" r="16" fill="rgba(255,77,77,0.13)" clip-path="url(#p3clip)">
        <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="128" y="20" font-family="monospace" font-size="7" fill="${R}" opacity="0.85">SECTOR 7: LOST<animate attributeName="opacity" values="0.85;0.3;0.85" dur="1.4s" repeatCount="indefinite"/></text>
      ${close}`

    // ── P4: the engineer answers — first tower online ─────────────────────
    default: return `${open}
      <rect width="220" height="130" fill="#08120c"/>
      <rect x="10" y="8" width="200" height="114" rx="5" fill="#0c1a12" stroke="${GD}" stroke-width="1.5"/>
      <g stroke="rgba(43,208,106,0.07)">${Array.from({length: 13}).map((_, i) => `<line x1="${18 + i * 15}" y1="10" x2="${18 + i * 15}" y2="120"/>`).join('')}</g>
      <!-- enemy lane -->
      <path d="M14 66 H206" stroke="#123322" stroke-width="10" fill="none"/>
      <path d="M14 66 H206" stroke="${G}" stroke-width="1" opacity="0.5" fill="none"/>
      <g fill="none" stroke="rgba(120,255,180,0.5)">${Array.from({length: 9}).map((_, i) => `<path d="M${28 + i * 20} 63 l5 3 l-5 3"/>`).join('')}</g>
      <!-- red packets marching in -->
      <g>
        <rect x="176" y="61" width="9" height="9" rx="2" fill="${R}"/>
        <rect x="196" y="61" width="9" height="9" rx="2" fill="${R}" opacity="0.8"/>
        <rect x="156" y="61" width="9" height="9" rx="2" fill="#ff8a8a">
          <animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite"/>
        </rect>
      </g>
      <!-- tower chip (game-accurate: dark body, gold pins, cyan core) -->
      <g transform="translate(0 -5)">
        <rect x="58" y="26" width="34" height="34" rx="4" fill="#16202b" stroke="#26414f"/>
        <g fill="#c9a45a">${Array.from({length: 4}).map((_, i) => `<rect x="${63 + i * 8}" y="21" width="4" height="5"/><rect x="${63 + i * 8}" y="60" width="4" height="5"/>`).join('')}</g>
        <circle cx="75" cy="43" r="9" fill="none" stroke="${C}" stroke-width="2"/>
        <circle cx="75" cy="43" r="3.6" fill="${C}"/>
        <circle cx="75" cy="43" r="13" fill="rgba(54,224,224,0.12)"/>
      </g>
      <!-- firing beam + impact -->
      <line x1="84" y1="41" x2="158" y2="64" stroke="${C}" stroke-width="2.2">
        <animate attributeName="opacity" values="1;0.15;1" dur="0.5s" repeatCount="indefinite"/>
      </line>
      <circle cx="160" cy="65" r="6" fill="none" stroke="${C}" opacity="0.7">
        <animate attributeName="r" values="3;9" dur="0.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0" dur="0.5s" repeatCount="indefinite"/>
      </circle>
      <!-- second pad being built + engineer's crate -->
      <g stroke="#c9a45a" fill="none" opacity="0.8">
        <path d="M120 92 h6 M120 92 v6 M148 92 h-6 M148 92 v6 M120 114 v-6 M120 114 h6 M148 114 h-6 M148 114 v-6"/>
        <path d="M130 103 h8 M134 99 v8" stroke-width="1.4"/>
      </g>
      <rect x="26" y="92" width="26" height="18" rx="2" fill="#141b16" stroke="#31423a"/>
      <path d="M26 98 h26" stroke="#31423a"/>
      <rect x="31" y="101" width="7" height="6" fill="#16202b" stroke="#26414f" stroke-width="0.7"/>
      <rect x="41" y="101" width="7" height="6" fill="#16202b" stroke="#26414f" stroke-width="0.7"/>
      <!-- green status LEDs + caption -->
      <circle cx="188" cy="18" r="2.6" fill="${G}"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
      <text x="100" y="20" font-family="monospace" font-size="7" fill="${G}" font-weight="bold">DEFENSE GRID ONLINE</text>
      ${close}`
  }
}
