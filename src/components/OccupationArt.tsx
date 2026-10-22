import { useId } from "react";
import type { CareerFamily } from "@/lib/careers/types.ts";

/**
 * Colourful flat illustrations, one scene per career family. Drawn in SVG so they are
 * licence-free, load instantly and stay sharp. If an occupation has a `photo` in the data,
 * a real photo is shown instead (see OccupationImage).
 */

const SKY: Record<CareerFamily, [string, string]> = {
  health: ["#bdeee6", "#f2fbf9"],
  care: ["#ffd9cf", "#fff4ef"],
  education: ["#fde9a6", "#fff9e6"],
  tech: ["#d9d3ff", "#f6f4ff"],
  data: ["#2a3a8f", "#5162d6"],
  engineering: ["#a9d8ff", "#eef7ff"],
  built: ["#b6d2f5", "#ffe3cc"],
  environment: ["#a7eee0", "#e9fbe9"],
  science: ["#e3d2ff", "#ffe2f1"],
  animals: ["#c9f2c4", "#f2fcef"],
  business: ["#c7d6f7", "#f1f5ff"],
  creative: ["#ffc8e3", "#ffe7cc"],
  performing: ["#3b2470", "#7b3fa6"],
  trades: ["#ffd29a", "#fff1d6"],
  workshop: ["#c4d3e3", "#eef3f8"],
  hospitality: ["#ffe1c2", "#fff6ea"],
  safety: ["#1f3b73", "#4a78c7"],
  fitness: ["#c8f5a6", "#e9fff3"],
  transport: ["#a8dcff", "#f0f9ff"],
  agriculture: ["#bfe6ff", "#fff3cf"],
  retail: ["#ffd6e4", "#fff3f7"],
  office: ["#d6e4f5", "#f4f8fd"],
  manufacturing: ["#cfd8e6", "#f2f5fa"],
};

const ground = (fill: string, d = "M0 160 Q80 140 160 152 T320 148 V200 H0Z") => <path d={d} fill={fill} />;
const sun = (cx: number, cy: number, r = 16, fill = "#ffd25e") => <circle cx={cx} cy={cy} r={r} fill={fill} />;
const cloud = (x: number, y: number, s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity="0.9">
    <ellipse cx="0" cy="0" rx="22" ry="10" />
    <ellipse cx="14" cy="-6" rx="14" ry="10" />
    <ellipse cx="-12" cy="-4" rx="12" ry="8" />
  </g>
);
const person = (x: number, y: number, shirt: string, skin = "#f2c4a0", hair = "#3b2a20", s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-11" y="10" width="22" height="34" rx="10" fill={shirt} />
    <circle cx="0" cy="0" r="10" fill={skin} />
    <path d="M-10 -1 Q-9 -12 0 -12 Q10 -12 10 -1 Q6 -7 0 -7 Q-6 -7 -10 -1Z" fill={hair} />
    <rect x="-9" y="42" width="7" height="16" rx="3" fill="#33415c" />
    <rect x="2" y="42" width="7" height="16" rx="3" fill="#33415c" />
  </g>
);

function Scene({ family }: { family: CareerFamily }) {
  switch (family) {
    case "health":
      return (
        <>
          {cloud(60, 40)}
          {ground("#8fd9c6")}
          <rect x="105" y="62" width="120" height="96" rx="6" fill="#fff" />
          <rect x="105" y="62" width="120" height="16" rx="6" fill="#e85d75" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={117 + c * 26} y={88 + r * 20} width="16" height="11" rx="2" fill="#bfe9f4" />))}
          <rect x="152" y="134" width="26" height="24" rx="3" fill="#7cc6d9" />
          <g transform="translate(240 50)">
            <rect x="-9" y="-26" width="18" height="52" rx="4" fill="#e85d75" />
            <rect x="-26" y="-9" width="52" height="18" rx="4" fill="#e85d75" />
          </g>
          <polyline points="0,178 70,178 84,160 98,194 112,170 122,178 320,178" fill="none" stroke="#0f9d8a" strokeWidth="5" strokeLinejoin="round" />
        </>
      );
    case "care":
      return (
        <>
          {sun(268, 44, 18, "#ffb38a")}
          {ground("#ffc2ad")}
          <path d="M160 74 C160 52 128 48 124 70 C120 90 160 104 160 116 C160 104 200 90 196 70 C192 48 160 52 160 74Z" fill="#ff6f91" />
          {person(118, 108, "#5b8def", "#e8b48e", "#2b1d16", 1.05)}
          {person(202, 112, "#ffb03b", "#c98b62", "#5a3a1f", 0.98)}
          <path d="M132 128 Q160 140 188 130" stroke="#e8b48e" strokeWidth="7" fill="none" strokeLinecap="round" />
        </>
      );
    case "education":
      return (
        <>
          {ground("#f7d77e", "M0 168 H320 V200 H0Z")}
          <rect x="52" y="34" width="168" height="104" rx="6" fill="#a46a3f" />
          <rect x="60" y="42" width="152" height="88" rx="3" fill="#2f6b55" />
          <path d="M78 70 l10 -16 l10 16 M82 64 h12 M108 54 v16 q10 0 10 -4 q0 -4 -10 -4 q10 0 10 -4 q0 -4 -10 -4 M140 56 q-10 -4 -10 6 q0 10 10 6" stroke="#e8f5ee" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M78 100 h60 M78 112 h90" stroke="#a9d7c2" strokeWidth="3" strokeLinecap="round" />
          <rect x="226" y="132" width="70" height="12" rx="2" fill="#5b8def" />
          <rect x="232" y="120" width="60" height="12" rx="2" fill="#ffb03b" />
          <rect x="228" y="108" width="64" height="12" rx="2" fill="#e85d75" />
          <circle cx="258" cy="96" r="11" fill="#e8434f" />
          <path d="M258 85 q3 -6 8 -6" stroke="#4c9a4f" strokeWidth="3" fill="none" />
          <rect x="70" y="150" width="90" height="8" rx="4" fill="#ffd25e" transform="rotate(-8 115 154)" />
        </>
      );
    case "tech":
      return (
        <>
          {cloud(256, 46, 1.2)}
          {ground("#c6bdfb", "M0 170 H320 V200 H0Z")}
          <rect x="88" y="52" width="144" height="94" rx="8" fill="#2c2a4a" />
          <rect x="96" y="60" width="128" height="78" rx="4" fill="#1d1b33" />
          <path d="M112 78 l-8 8 l8 8 M208 78 l8 8 l-8 8 M170 72 l-18 30" stroke="#7ee0c8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="108" y="112" width="40" height="5" rx="2" fill="#8b7bff" />
          <rect x="152" y="112" width="30" height="5" rx="2" fill="#ff9fc3" />
          <rect x="108" y="122" width="62" height="5" rx="2" fill="#ffd25e" />
          <path d="M70 146 H250 L262 164 H58Z" fill="#46436e" />
          <rect x="24" y="66" width="52" height="38" rx="6" fill="#fff" />
          <rect x="30" y="74" width="30" height="5" rx="2" fill="#8b7bff" />
          <rect x="30" y="84" width="40" height="5" rx="2" fill="#cfc8ff" />
          <rect x="246" y="96" width="54" height="40" rx="6" fill="#fff" />
          <circle cx="262" cy="116" r="8" fill="#7ee0c8" />
          <rect x="274" y="110" width="20" height="5" rx="2" fill="#cfc8ff" />
        </>
      );
    case "data":
      return (
        <>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={20 + i * 47} cy={20 + (i % 3) * 9} r="1.6" fill="#fff" opacity="0.7" />)}
          <rect x="34" y="46" width="160" height="112" rx="10" fill="#fff" opacity="0.96" />
          {[30, 52, 40, 70, 58, 84].map((h, i) => <rect key={i} x={50 + i * 22} y={142 - h} width="14" height={h} rx="3" fill={i === 5 ? "#22c3a6" : "#7d8cff"} />)}
          <polyline points="50,92 72,82 94,88 116,66 138,72 172,52" fill="none" stroke="#ff8a5b" strokeWidth="4" strokeLinejoin="round" />
          <path d="M248 50 L284 62 V96 C284 120 266 134 248 142 C230 134 212 120 212 96 V62Z" fill="#22c3a6" />
          <rect x="236" y="88" width="24" height="20" rx="4" fill="#fff" />
          <path d="M240 88 v-6 a8 8 0 0 1 16 0 v6" stroke="#fff" strokeWidth="4" fill="none" />
          <circle cx="248" cy="97" r="3" fill="#22c3a6" />
        </>
      );
    case "engineering":
      return (
        <>
          {sun(56, 44)}
          {cloud(150, 38, 0.9)}
          {ground("#7fcf8a", "M0 150 Q90 120 180 146 T320 136 V200 H0Z")}
          {ground("#5fb46f", "M0 176 Q120 156 220 172 T320 168 V200 H0Z")}
          {[
            [110, 62, 1],
            [196, 50, 1.2],
            [274, 76, 0.85],
          ].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <path d="M-3 0 L3 0 L5 96 L-5 96Z" fill="#fff" />
              <g fill="#fff">
                <path d="M0 0 L-4 -44 L4 -44Z" transform="rotate(10)" />
                <path d="M0 0 L-4 -44 L4 -44Z" transform="rotate(130)" />
                <path d="M0 0 L-4 -44 L4 -44Z" transform="rotate(250)" />
              </g>
              <circle r="5" fill="#d7e3ee" />
            </g>
          ))}
          <g transform="translate(26 150) skewX(-18)">
            <rect width="60" height="26" rx="2" fill="#2f5d9e" />
            <path d="M20 0 V26 M40 0 V26 M0 13 H60" stroke="#8fb7ef" strokeWidth="1.5" />
          </g>
        </>
      );
    case "built":
      return (
        <>
          {ground("#9fb4d9", "M0 172 H320 V200 H0Z")}
          {[
            [30, 92, 44, "#5b8def"],
            [80, 60, 52, "#3b5fa8"],
            [138, 78, 40, "#ff9d6c"],
            [184, 104, 46, "#6fc8b0"],
          ].map(([x, y, w, c], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width={w as number} height={172 - (y as number)} fill={c as string} />
              {Array.from({ length: Math.floor((172 - (y as number) - 12) / 16) }, (_, r) =>
                [0, 1].map((col) => <rect key={`${r}${col}`} x={(x as number) + 8 + col * ((w as number) / 2)} y={(y as number) + 10 + r * 16} width={(w as number) / 2 - 14} height="7" rx="1.5" fill="#fff" opacity="0.75" />),
              )}
            </g>
          ))}
          <path d="M262 172 V40 M262 44 H310 M262 44 L236 70 M262 60 L286 44" stroke="#f5b82e" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M300 44 V86" stroke="#4a4a4a" strokeWidth="2" />
          <rect x="290" y="86" width="20" height="14" fill="#f5b82e" />
        </>
      );
    case "environment":
      return (
        <>
          {sun(260, 44, 18)}
          {ground("#7ed49a", "M0 140 Q80 112 170 138 T320 128 V200 H0Z")}
          <path d="M120 200 Q150 170 190 166 T320 150 V170 Q230 176 200 186 T160 200Z" fill="#5ec3e6" />
          {[
            [60, 118],
            [92, 126],
            [244, 120],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 3} y={y} width="6" height="22" fill="#8a5a3c" />
              <circle cx={x} cy={y - 8} r="18" fill="#3aa65b" />
              <circle cx={x + 10} cy={y - 2} r="12" fill="#4cbe6c" />
            </g>
          ))}
          <path d="M160 58 C186 52 200 70 196 92 C174 98 152 84 160 58Z" fill="#3aa65b" />
          <path d="M162 60 C172 74 182 84 196 92" stroke="#d9f5e1" strokeWidth="2" fill="none" />
        </>
      );
    case "science":
      return (
        <>
          {ground("#d5c0ff", "M0 172 H320 V200 H0Z")}
          <g fill="#4b3c8f">
            <rect x="88" y="152" width="70" height="12" rx="4" />
            <rect x="116" y="70" width="14" height="70" rx="4" transform="rotate(-18 123 105)" />
            <rect x="100" y="56" width="34" height="18" rx="5" transform="rotate(-18 117 65)" />
            <path d="M140 150 q20 -30 0 -60" stroke="#4b3c8f" strokeWidth="10" fill="none" />
          </g>
          <path d="M210 70 h28 v26 l24 52 q3 10 -8 10 h-60 q-11 0 -8 -10 l24 -52Z" fill="#fff" />
          <path d="M196 132 h56 l7 16 q2 8 -6 8 h-58 q-8 0 -6 -8Z" fill="#ff6fae" />
          {[
            [214, 118, 5],
            [232, 104, 4],
            [244, 124, 3],
          ].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ff6fae" opacity="0.6" />)}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <circle cx={40 + Math.sin(i) * 14} cy={40 + i * 14} r="4" fill="#7d6bff" />
              <circle cx={40 - Math.sin(i) * 14} cy={40 + i * 14} r="4" fill="#ff8ac0" />
            </g>
          ))}
        </>
      );
    case "animals":
      return (
        <>
          {sun(266, 42)}
          {ground("#8fdc7f")}
          <g fill="#6b4b3a">
            <ellipse cx="160" cy="120" rx="34" ry="28" />
            <ellipse cx="118" cy="82" rx="12" ry="16" />
            <ellipse cx="146" cy="66" rx="12" ry="16" />
            <ellipse cx="176" cy="66" rx="12" ry="16" />
            <ellipse cx="203" cy="82" rx="12" ry="16" />
          </g>
          <path d="M160 128 C160 118 146 116 144 126 C142 136 160 142 160 148 C160 142 178 136 176 126 C174 116 160 118 160 128Z" fill="#ff6f91" />
        </>
      );
    case "business":
      return (
        <>
          {ground("#a9bce6", "M0 172 H320 V200 H0Z")}
          {[20, 52, 86, 120, 236, 270].map((x, i) => (
            <rect key={i} x={x} y={90 + ((i * 23) % 50)} width="28" height={82 - ((i * 23) % 50)} fill={i % 2 ? "#7f97cf" : "#94a9dc"} />
          ))}
          <polyline points="40,150 100,118 140,130 210,70" fill="none" stroke="#14b8a6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M196 66 l18 0 l0 18" stroke="#14b8a6" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="150" y="128" width="78" height="52" rx="8" fill="#2e3f73" />
          <rect x="174" y="118" width="30" height="14" rx="4" fill="none" stroke="#2e3f73" strokeWidth="5" />
          <rect x="150" y="146" width="78" height="6" fill="#ffd25e" />
        </>
      );
    case "creative":
      return (
        <>
          {ground("#ffb3c8", "M0 176 H320 V200 H0Z")}
          <path d="M150 50 C210 46 246 82 230 118 C222 136 196 128 186 140 C176 154 190 170 166 172 C110 176 80 136 90 100 C98 70 120 52 150 50Z" fill="#fff" />
          {[
            [122, 82, "#ff5d8f"],
            [152, 70, "#ffb03b"],
            [186, 78, "#5b8def"],
            [206, 104, "#22c3a6"],
            [116, 116, "#a46bff"],
          ].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r="11" fill={c as string} />)}
          <circle cx="152" cy="140" r="12" fill="#ffb3c8" />
          <rect x="246" y="40" width="10" height="96" rx="4" fill="#3b2470" transform="rotate(26 251 88)" />
          <path d="M226 128 l8 20 l8 -16Z" fill="#ffb03b" />
          {["#ff5d8f", "#ffb03b", "#22c3a6"].map((c, i) => <rect key={i} x={24} y={52 + i * 30} width="40" height="24" rx="5" fill={c} />)}
        </>
      );
    case "performing":
      return (
        <>
          <path d="M0 0 H60 Q50 80 64 200 H0Z" fill="#c2304f" />
          <path d="M320 0 H260 Q270 80 256 200 H320Z" fill="#c2304f" />
          <path d="M110 0 L70 200 H250 L210 0Z" fill="#fff2b8" opacity="0.25" />
          <ellipse cx="160" cy="186" rx="110" ry="16" fill="#5a2a86" />
          <g fill="#ffd25e">
            <circle cx="132" cy="120" r="10" />
            <rect x="139" y="74" width="5" height="48" />
            <path d="M144 74 q20 6 18 26 q-4 -12 -18 -12Z" />
            <circle cx="186" cy="104" r="9" />
            <rect x="192" y="62" width="5" height="44" />
          </g>
          <path d="M240 40 l6 14 l15 1 l-12 9 l4 15 l-13 -8 l-13 8 l4 -15 l-12 -9 l15 -1Z" fill="#ffd25e" />
        </>
      );
    case "trades":
      return (
        <>
          {sun(270, 40)}
          {ground("#f4b860", "M0 172 H320 V200 H0Z")}
          <path d="M60 172 V98 L130 50 L200 98 V172" fill="none" stroke="#b5733f" strokeWidth="7" strokeLinejoin="round" />
          {[78, 96, 114, 146, 164, 182].map((x) => <path key={x} d={`M${x} 172 V${x < 130 ? 98 - (x - 60) * 0.55 + 20 : 98 - (200 - x) * 0.55 + 20}`} stroke="#d1955f" strokeWidth="5" />)}
          <path d="M60 120 H200" stroke="#d1955f" strokeWidth="5" />
          <path d="M226 128 a32 28 0 0 1 64 0 Z" fill="#ffc21a" />
          <rect x="218" y="126" width="80" height="10" rx="5" fill="#f2a900" />
          <path d="M252 104 h12 v-4 h-12z" fill="#f2a900" />
          <path d="M40 40 l-14 24 h12 l-6 22 l20 -30 h-12 l8 -16Z" fill="#ffd25e" stroke="#e39b00" strokeWidth="2" />
        </>
      );
    case "workshop":
      return (
        <>
          {ground("#9aaec4", "M0 172 H320 V200 H0Z")}
          <g transform="translate(250 70)">
            <circle r="34" fill="#5d7287" />
            {Array.from({ length: 8 }, (_, i) => <rect key={i} x="-8" y="-46" width="16" height="16" rx="3" fill="#5d7287" transform={`rotate(${i * 45})`} />)}
            <circle r="12" fill="#eef3f8" />
          </g>
          <path d="M40 160 V140 Q46 120 80 116 L110 96 Q130 88 168 90 Q200 92 214 116 L236 120 Q250 124 250 140 V160Z" fill="#e85d50" />
          <path d="M116 100 L106 116 H160 V98 Q140 96 116 100Z M168 98 V116 H204 Q196 100 168 98Z" fill="#cfe7f7" />
          {[86, 206].map((x) => (
            <g key={x}>
              <circle cx={x} cy="162" r="16" fill="#2b2f3a" />
              <circle cx={x} cy="162" r="6" fill="#c4d3e3" />
            </g>
          ))}
          {[[44, 60], [56, 46], [30, 50]].map(([x, y], i) => <path key={i} d={`M60 80 L${x} ${y}`} stroke="#ffb03b" strokeWidth="3" strokeLinecap="round" />)}
        </>
      );
    case "hospitality":
      return (
        <>
          {ground("#ffcf9f", "M0 172 H320 V200 H0Z")}
          <path d="M70 92 a22 22 0 0 1 20 -30 a24 24 0 0 1 44 -4 a22 22 0 0 1 30 26 a18 18 0 0 1 -8 18 V120 H78 V102 A18 18 0 0 1 70 92Z" fill="#fff" />
          <rect x="78" y="118" width="78" height="22" rx="4" fill="#f4f4f4" />
          <path d="M180 120 H284 L274 168 Q272 176 262 176 H202 Q192 176 190 168Z" fill="#e8634a" />
          <rect x="172" y="114" width="120" height="10" rx="5" fill="#c94a33" />
          {[206, 232, 258].map((x) => <path key={x} d={`M${x} 104 q-8 -12 0 -24 q8 -12 0 -24`} stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />)}
          <g transform="translate(40 150) rotate(-30)">
            <circle cx="0" cy="0" r="8" fill="none" stroke="#5b8def" strokeWidth="4" />
            <circle cx="18" cy="0" r="8" fill="none" stroke="#5b8def" strokeWidth="4" />
            <path d="M4 -6 L40 -30 M14 -6 L-20 -30" stroke="#8a97a8" strokeWidth="4" strokeLinecap="round" />
          </g>
        </>
      );
    case "safety":
      return (
        <>
          {[20, 54, 96, 230, 266].map((x, i) => <rect key={i} x={x} y={120 + (i % 3) * 12} width="30" height="80" fill="#2a4f8f" opacity="0.8" />)}
          <path d="M160 32 L212 50 V100 C212 136 186 156 160 168 C134 156 108 136 108 100 V50Z" fill="#ffd25e" />
          <path d="M160 44 L202 58 V100 C202 128 182 146 160 156 C138 146 118 128 118 100 V58Z" fill="#2457b5" />
          <path d="M160 70 l8 17 l19 2 l-14 13 l4 19 l-17 -10 l-17 10 l4 -19 l-14 -13 l19 -2Z" fill="#ffd25e" />
          <circle cx="260" cy="40" r="10" fill="#e8434f" />
          <circle cx="282" cy="40" r="10" fill="#4a90ff" />
        </>
      );
    case "fitness":
      return (
        <>
          {sun(268, 40)}
          <path d="M0 150 Q160 120 320 150 V200 H0Z" fill="#ff8a5b" />
          <path d="M0 162 Q160 134 320 162 M0 176 Q160 150 320 176" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" />
          <g transform="translate(160 84) rotate(-14)">
            <rect x="-56" y="-6" width="112" height="12" rx="6" fill="#3b3f52" />
            {[-56, -44, 36, 48].map((x, i) => <rect key={i} x={x} y={i % 3 === 0 ? -26 : -20} width="10" height={i % 3 === 0 ? 52 : 40} rx="4" fill="#22c3a6" />)}
          </g>
          <path d="M70 56 C70 46 58 44 56 52 C54 60 70 66 70 72 C70 66 86 60 84 52 C82 44 70 46 70 56Z" fill="#ff5d8f" />
        </>
      );
    case "agriculture":
      return (
        <>
          {sun(262, 44, 20)}
          {cloud(80, 46)}
          <path d="M0 118 Q90 96 180 110 T320 104 V200 H0Z" fill="#9fd37a" />
          <path d="M0 140 Q160 120 320 138 V200 H0Z" fill="#e8c35a" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M${-20 + i * 52} 200 Q${40 + i * 46} 160 ${110 + i * 34} 140`} stroke="#c99a34" strokeWidth="3" fill="none" />
          ))}
          <g transform="translate(36 70)">
            <rect x="0" y="22" width="56" height="44" fill="#d9534f" />
            <path d="M-6 24 L28 0 L62 24Z" fill="#a83c39" />
            <rect x="20" y="40" width="16" height="26" fill="#fff" />
            <path d="M20 40 L36 66 M36 40 L20 66" stroke="#d9534f" strokeWidth="2" />
          </g>
          <g transform="translate(176 120)">
            <rect x="0" y="0" width="54" height="30" rx="4" fill="#2f9e5b" />
            <rect x="30" y="-22" width="26" height="26" rx="3" fill="#2f9e5b" />
            <rect x="34" y="-18" width="18" height="14" rx="2" fill="#cfe7f7" />
            <rect x="8" y="-12" width="5" height="14" fill="#555" />
            <circle cx="14" cy="34" r="14" fill="#22252e" />
            <circle cx="14" cy="34" r="6" fill="#ffd25e" />
            <circle cx="52" cy="38" r="10" fill="#22252e" />
            <circle cx="52" cy="38" r="4" fill="#ffd25e" />
          </g>
        </>
      );
    case "retail":
      return (
        <>
          {ground("#f3c7d6", "M0 170 H320 V200 H0Z")}
          <rect x="40" y="58" width="240" height="114" rx="6" fill="#fff" />
          <path d="M34 58 H286 L276 86 H44Z" fill="#ff7aa2" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${44 + i * 40} 86 a20 14 0 0 0 40 0`} fill={i % 2 ? "#ff7aa2" : "#fff"} stroke="#ff7aa2" strokeWidth="2" />)}
          <rect x="58" y="108" width="86" height="56" rx="4" fill="#ffe6ef" />
          <rect x="176" y="108" width="34" height="64" rx="3" fill="#7d5bd6" />
          <circle cx="204" cy="142" r="2.5" fill="#ffd25e" />
          <rect x="226" y="108" width="40" height="40" rx="4" fill="#ffe6ef" />
          <g transform="translate(78 126)">
            <path d="M0 10 H22 L18 34 H4Z" fill="#14b8a6" />
            <path d="M5 10 Q11 -2 17 10" stroke="#0d9488" strokeWidth="2.5" fill="none" />
            <path d="M28 6 H50 L46 34 H32Z" fill="#ffb347" />
            <path d="M33 6 Q39 -6 45 6" stroke="#e08a1d" strokeWidth="2.5" fill="none" />
          </g>
          <g transform="translate(238 118)">
            <rect x="-6" y="0" width="28" height="20" rx="3" fill="#ffd25e" />
            <path d="M0 6 h16 M0 12 h10" stroke="#8a5a00" strokeWidth="2" />
          </g>
        </>
      );
    case "office":
      return (
        <>
          {ground("#b9c9de", "M0 168 H320 V200 H0Z")}
          <rect x="196" y="34" width="96" height="70" rx="6" fill="#fff" />
          {[0, 1, 2].map((i) => <rect key={i} x={206} y={46 + i * 18} width={i === 1 ? 56 : 76} height="8" rx="4" fill="#c9d6ea" />)}
          <rect x="24" y="44" width="70" height="124" rx="4" fill="#8aa6cc" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="30" y={52 + i * 38} width="58" height="32" rx="3" fill="#a9bfdd" />
              <rect x="52" y={64 + i * 38} width="14" height="5" rx="2" fill="#5d7a92" />
            </g>
          ))}
          <rect x="108" y="134" width="176" height="10" rx="3" fill="#7a5c45" />
          <rect x="120" y="144" width="8" height="26" fill="#7a5c45" />
          <rect x="264" y="144" width="8" height="26" fill="#7a5c45" />
          <rect x="146" y="86" width="72" height="46" rx="4" fill="#2e3f73" />
          <rect x="151" y="91" width="62" height="34" rx="2" fill="#cfe7f7" />
          <rect x="176" y="132" width="12" height="4" fill="#2e3f73" />
          <rect x="230" y="118" width="30" height="16" rx="3" fill="#ffd25e" />
          {person(126, 92, "#14b8a6", "#c98e66", "#2b1d16", 0.9)}
        </>
      );
    case "manufacturing":
      return (
        <>
          <path d="M0 50 H320 V200 H0Z" fill="#dfe6f0" />
          <path d="M20 96 V60 L80 82 V60 L140 82 V60 L200 82 V96Z" fill="#94a3b8" />
          <rect x="230" y="30" width="18" height="66" fill="#7b8794" />
          <ellipse cx="246" cy="24" rx="16" ry="8" fill="#fff" opacity="0.8" />
          <rect x="0" y="96" width="320" height="104" fill="#c4cfdd" />
          <rect x="20" y="146" width="280" height="12" rx="6" fill="#3b4558" />
          {[36, 76, 116, 156, 196, 236, 276].map((x) => <circle key={x} cx={x} cy="152" r="5" fill="#7b8794" />)}
          {[50, 128, 206].map((x, i) => <rect key={x} x={x} y="122" width="34" height="24" rx="3" fill={["#ffb347", "#14b8a6", "#7d5bd6"][i]} />)}
          <g transform="translate(250 104)">
            <rect x="0" y="0" width="14" height="40" fill="#f59e0b" />
            <path d="M7 4 L-22 18" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
            <path d="M-22 18 v10" stroke="#3b4558" strokeWidth="4" />
          </g>
          {person(110, 104, "#ff8a5b", "#f2c4a0", "#3b2a20", 0.8)}
          <rect x="101" y="96" width="18" height="6" rx="3" fill="#ffd25e" />
        </>
      );
    case "transport":
      return (
        <>
          {cloud(90, 40)}
          {cloud(250, 62, 0.8)}
          <path d="M20 90 Q120 60 210 46" stroke="#fff" strokeWidth="3" strokeDasharray="8 8" fill="none" />
          <g transform="translate(236 42) rotate(-12)">
            <path d="M-40 0 Q-40 -8 -30 -8 H30 Q44 -8 48 0 Q44 8 30 8 H-30 Q-40 8 -40 0Z" fill="#fff" />
            <path d="M-6 -6 L-20 -30 H-8 L14 -6Z M-6 6 L-20 30 H-8 L14 6Z M-34 -6 L-44 -20 H-36 L-24 -6Z" fill="#5b8def" />
            {[-20, -10, 0, 10, 20].map((x) => <circle key={x} cx={x} cy="-1" r="2.2" fill="#5b8def" />)}
          </g>
          <path d="M0 150 H320 V200 H0Z" fill="#59606f" />
          <path d="M0 174 H320" stroke="#ffd25e" strokeWidth="4" strokeDasharray="22 16" />
          <g transform="translate(70 112)">
            <rect x="0" y="0" width="110" height="48" rx="4" fill="#ff8a5b" />
            <path d="M110 14 H140 L156 30 V48 H110Z" fill="#2e3f73" />
            <path d="M118 20 H138 L148 30 H118Z" fill="#cfe7f7" />
            {[24, 92, 136].map((x) => <circle key={x} cx={x} cy="52" r="10" fill="#22252e" />)}
          </g>
        </>
      );
  }
}

export function OccupationArt({ family, className, label }: { family: CareerFamily; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  const [top, bottom] = SKY[family];
  return (
    <svg viewBox="0 0 320 200" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#sky${id})`} />
      <Scene family={family} />
    </svg>
  );
}

/** A real photo when the career has one (data: `photo`), otherwise its family illustration. */
export function OccupationImage({
  family,
  title,
  photo,
  className,
}: {
  family: CareerFamily;
  title: string;
  photo?: { src: string; credit?: string };
  className?: string;
}) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo.src} alt={`${title} at work`} className={className} loading="lazy" />;
  }
  return <OccupationArt family={family} className={className} label={`Illustration for ${title}`} />;
}

/** The left-rail scene: students walking towards a harbour city. */
export function HarbourScene({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 560" className={className} aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`hs${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfeef9" />
          <stop offset="0.55" stopColor="#eaf8ff" />
          <stop offset="1" stopColor="#bfe7f5" />
        </linearGradient>
      </defs>
      <rect width="200" height="560" fill={`url(#hs${id})`} />
      {[
        [6, 250, 16, 56],
        [24, 230, 14, 76],
        [40, 262, 18, 44],
        [58, 240, 12, 66],
      ].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill="#9cc3dc" opacity="0.8" />)}
      <path d="M40 306 Q120 214 210 306" stroke="#5d7a92" strokeWidth="7" fill="none" />
      <path d="M40 306 Q120 236 210 306" stroke="#5d7a92" strokeWidth="3" fill="none" />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 48 + i * 14;
        const t = (x - 40) / 170;
        const yTop = 306 - 4 * 92 * t * (1 - t);
        return <path key={i} d={`M${x} ${yTop} V306`} stroke="#5d7a92" strokeWidth="1.5" />;
      })}
      <rect x="30" y="300" width="180" height="7" fill="#5d7a92" />
      <rect x="34" y="296" width="12" height="24" fill="#8aa1b5" />
      <path d="M0 320 H200 V380 H0Z" fill="#7cc9e6" />
      {[334, 348, 362].map((y) => <path key={y} d={`M${10 + (y % 20)} ${y} h30 M${90 + (y % 13)} ${y} h40`} stroke="#fff" strokeWidth="2" opacity="0.6" strokeLinecap="round" />)}
      <path d="M0 380 H200 V560 H0Z" fill="#e7e2d6" />
      <path d="M0 380 Q60 372 120 386 T200 382 V396 H0Z" fill="#7fcf8a" />
      {[
        [56, 440, "#5b8def", "#2b1d16"],
        [104, 452, "#22c3a6", "#5a3a1f"],
        [150, 436, "#ff8a5b", "#1a1a1a"],
      ].map(([x, y, c, h], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(1.6)`}>
          <circle cx="0" cy="0" r="9" fill={h as string} />
          <rect x="-11" y="9" width="22" height="34" rx="9" fill={c as string} />
          <rect x="-8" y="12" width="16" height="22" rx="5" fill="#2e3f73" opacity="0.85" />
          <rect x="-9" y="42" width="7" height="22" rx="3" fill="#33415c" />
          <rect x="2" y="42" width="7" height="22" rx="3" fill="#33415c" />
        </g>
      ))}
    </svg>
  );
}
