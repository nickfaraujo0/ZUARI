// Generates stylised construction-stage "site photos" for demo data (no external assets needed).
import sharp from "sharp";

const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export async function scene(phase: number, seed: number): Promise<Buffer> {
  const r = rng(seed * 7919 + phase * 104729);
  const W = 1200, H = 900, gy = 640;
  const mood = [["#cfe0dc", "#f1e4c8"], ["#a9c3cf", "#e8eef0"], ["#b9c4c0", "#dfe5e0"], ["#e8c9a0", "#f6ead2"]][Math.floor(r() * 4)];
  const floors = phase === 0 ? 0 : phase === 1 ? 2 + Math.floor(r() * 2) : 3;
  const fh = 130, x0 = 250 + r() * 40, bw = 620 + r() * 60, cols = 5;
  const cx = (i: number) => x0 + (bw / (cols - 1)) * i;
  const o: string[] = [];
  // palms & hills
  o.push(`<path d="M0 ${gy - 150} Q 260 ${gy - 260} 520 ${gy - 170} T 1200 ${gy - 200} V ${gy} H0Z" fill="#5d7f76" opacity=".55"/>`);
  o.push(`<path d="M0 ${gy - 80} Q 300 ${gy - 140} 640 ${gy - 90} T 1200 ${gy - 110} V ${gy} H0Z" fill="#3f6868" opacity=".7"/>`);
  for (const px of [90 + r() * 60, 1090 - r() * 60]) {
    o.push(`<path d="M${px} ${gy} Q ${px + 18} ${gy - 220} ${px + 6} ${gy - 380}" stroke="#4a3a2c" stroke-width="12" fill="none"/>`);
    for (let a = 0; a < 7; a++) { const ang = -Math.PI * (0.05 + a * 0.15); o.push(`<path d="M${px + 6} ${gy - 380} q ${Math.cos(ang) * 90} ${Math.sin(ang) * 70 - 10} ${Math.cos(ang) * 150} ${Math.sin(ang) * 40 + 70}" stroke="#264a3a" stroke-width="9" fill="none" stroke-linecap="round"/>`); }
  }
  o.push(`<rect y="${gy}" width="${W}" height="${H - gy}" fill="#a3684d"/><rect y="${gy}" width="${W}" height="14" fill="#8a563f"/>`);
  // building by phase
  if (phase === 0) {
    o.push(`<rect x="${x0 - 30}" y="${gy + 20}" width="${bw + 60}" height="150" fill="#6f4530"/>`);
    for (let i = 0; i < cols; i++) o.push(`<rect x="${cx(i) - 34}" y="${gy + 60}" width="68" height="20" fill="#b9b8b0"/>`);
    for (let x = x0 - 20; x <= x0 + bw + 20; x += 26) o.push(`<line x1="${x}" y1="${gy + 92}" x2="${x}" y2="${gy + 160}" stroke="#2b2b28" stroke-width="3"/>`);
    for (let y = gy + 96; y <= gy + 160; y += 22) o.push(`<line x1="${x0 - 20}" y1="${y}" x2="${x0 + bw + 20}" y2="${y}" stroke="#2b2b28" stroke-width="3"/>`);
    for (let i = 0; i < cols; i++) for (let k = -1; k <= 1; k += 2) o.push(`<line x1="${cx(i) + k * 12}" y1="${gy + 60}" x2="${cx(i) + k * 12}" y2="${gy - 90}" stroke="#3a3a36" stroke-width="4"/>`);
  } else {
    for (let f = 0; f < floors; f++) {
      const y = gy - (f + 1) * fh, top = f === floors - 1;
      if (phase >= 2) {
        const fill = phase === 2 ? "url(#brick)" : phase === 5 ? "#f2ece0" : "#d9d3c4";
        const done = phase === 2 ? (f < floors - 1 || r() > 0.5) : true;
        if (done) o.push(`<rect x="${cx(0)}" y="${y + 16}" width="${bw}" height="${fh - 16}" fill="${fill}"/>`);
        else o.push(`<rect x="${cx(0)}" y="${y + 70}" width="${bw * (0.4 + r() * 0.3)}" height="${fh - 70}" fill="url(#brick)"/>`);
      }
      for (let i = 0; i < cols; i++) o.push(`<rect x="${cx(i) - 15}" y="${y}" width="30" height="${fh}" fill="#a9a8a0"/>`);
      o.push(`<rect x="${cx(0) - 30}" y="${y - 6}" width="${bw + 60}" height="22" fill="#bdbcb4"/><rect x="${cx(0) - 30}" y="${y + 16}" width="${bw + 60}" height="4" fill="#8f8e86"/>`);
      if (phase === 1 && top) for (let i = 0; i < cols; i++) for (let k = -1; k <= 1; k += 2) o.push(`<line x1="${cx(i) + k * 8}" y1="${y - 6}" x2="${cx(i) + k * 8}" y2="${y - 70}" stroke="#3a3a36" stroke-width="4"/>`);
      if (phase === 1 && top) for (let x = cx(0) - 20; x < cx(0) + bw + 20; x += 40) o.push(`<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${gy}" stroke="#a5754a" stroke-width="5" opacity=".55"/>`);
      if (phase === 3) for (let k = 0; k < 3; k++) { const yy = y + 40 + k * 26; o.push(`<line x1="${cx(0) + 20}" y1="${yy}" x2="${cx(cols - 1) - 20}" y2="${yy}" stroke="#f5f5f0" stroke-width="5"/>`); o.push(`<rect x="${cx(1 + k) - 9}" y="${yy - 9}" width="18" height="18" fill="#2f3b39"/>`); for (const v of [cx(1) + 60, cx(3) - 40]) o.push(`<line x1="${v}" y1="${y + 20}" x2="${v}" y2="${y + fh}" stroke="#f5f5f0" stroke-width="5"/>`); }
      if (phase === 4) for (const [v, c] of [[cx(1) + 40, "#4f86a8"], [cx(1) + 64, "#b87333"], [cx(3) - 30, "#4f86a8"]] as const) { o.push(`<line x1="${v}" y1="${y + 20}" x2="${v}" y2="${y + fh}" stroke="${c}" stroke-width="9"/>`); o.push(`<line x1="${v}" y1="${y + 60}" x2="${v + 150}" y2="${y + 60}" stroke="${c}" stroke-width="9"/>`); }
      if (phase === 5) for (let i = 0; i < cols - 1; i++) o.push(`<rect x="${cx(i) + 34}" y="${y + 40}" width="${bw / 4 - 68}" height="62" fill="#7ea7a1" stroke="#f5f2ea" stroke-width="6" opacity=".92"/>`);
    }
    if (phase === 5) o.push(`<path d="M${cx(0) - 50} ${gy - floors * fh - 6} L ${cx(0) + bw / 2} ${gy - floors * fh - 90} L ${cx(cols - 1) + 50} ${gy - floors * fh - 6}Z" fill="#9a6047"/>`);
    if (phase <= 2) for (let x = cx(0) - 40; x < cx(cols - 1) + 40; x += 90) o.push(`<line x1="${x}" y1="${gy}" x2="${x}" y2="${gy - Math.max(1, floors) * fh}" stroke="#8b6a45" stroke-width="4" opacity=".6"/>`);
  }
  o.push(`<rect x="${1000 - r() * 80}" y="${gy + 40}" width="110" height="26" fill="#c8c6bc" transform="rotate(${r() * 8 - 4} 1050 ${gy + 50})"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mood[0]}"/><stop offset="1" stop-color="${mood[1]}"/></linearGradient>
<pattern id="brick" width="34" height="18" patternUnits="userSpaceOnUse"><rect width="34" height="18" fill="#b5694a"/><path d="M0 9H34M17 0V9M0 9V18M34 9V18" stroke="#d9b9a0" stroke-width="2"/></pattern>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b1a17" stop-opacity=".45"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .18 0"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${200 + r() * 700}" cy="${120 + r() * 60}" r="70" fill="#fff8e6" opacity=".7"/>
${o.join("\n")}
<rect width="${W}" height="${H}" filter="url(#grain)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>
<text x="${W - 24}" y="${H - 20}" text-anchor="end" font-family="sans-serif" font-size="15" letter-spacing="3" fill="#fff" opacity=".55">ZUARI DEMO IMAGE</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
}
