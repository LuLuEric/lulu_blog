const paths = {
  chair: '<path d="M8 4h8v10H8zM5 14h14v4H5zm2 4v4m10-4v4M12 0v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 11 3 3 5-6"/>',
  speaker: '<path d="M4 9h5l10-5v16L9 15H4zm3 6 2 6h3l-2-6M22 9v6"/>',
  building: '<path d="m2 8 10-5 10 5zM4 21h16M6 11v7m6-7v7m6-7v7M3 18h18"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  coins: '<ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v5c0 4 12 4 12 0V6M3 11v5c0 4 12 4 12 0v-5M17 10c6 0 6 6 0 6m0 0v5c5 0 5-4 5-6v-2"/>',
  handshake: '<path d="m2 8 5-3 5 2 5-2 5 3-3 10-5 3-9-6Z"/><path d="m7 5 3 5 3-2 6 6M8 14l5 4m-3-7 7 6"/>',
  star: '<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z"/>',
  file: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8m-8 4h8m-8 3h5"/>',
  flame: '<path d="M13 2s2 5-2 9c-2-1-3-3-3-3s-5 5-4 9c2 7 14 7 16-1 1-6-5-10-7-14Z"/><path d="M12 14c-4 4-2 7 1 7s5-4-1-7Z"/>',
  gavel: '<path d="m10 3 9 9-4 4-9-9ZM4 20l8-8m2 9h8M5 8l6-6m3 15 6-6"/>',
  seal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8m-7-6 2 2 4-4"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  refresh: '<path d="M20 9A8 8 0 1 0 20 16M20 3v6h-6"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  spark: '<path d="m12 2 2 7 8 3-8 2-2 8-2-8-8-2 8-3Z"/>',
  crown: '<path d="m3 7 5 4 4-7 4 7 5-4-2 12H5ZM5 22h14"/>',
};
export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}
export function portrait(id) {
  const faces = [
    '<path d="M29 29c1-18 31-18 33 0l-4 29-13 8-12-8Z"/><path d="m29 29 7-13 24 5 3 12-8-9-22 9"/>',
    '<path d="m27 25 4 33 14 10 14-10 4-33Z"/><path d="M22 22 45 9l25 13-4 9H26Z"/><path d="M37 49h17m-14 5h10"/>',
    '<path d="M27 29c0-21 38-24 38 5l-5 24-14 11-15-11Z"/><path d="M27 41 20 63l13 5-1-26 7-23 26 18-3-14-17-10-17 9Z"/>',
    '<path d="M29 29c-1-22 33-21 33 0l-3 29-13 11-15-11Z"/><path d="m29 32 3-12 23-3 7 15M31 38h12v8H31zm17 0h12v8H48zm-5 3h5M41 54h10"/>',
  ];
  return `<svg viewBox="0 0 92 100" class="portrait" aria-hidden="true"><path class="bust" d="m30 59 15 10 16-10 21 16 8 25H2l7-25Z"/>${faces[id]}<path d="m30 64 15 18 16-18M45 83v17m-31-8h18m28 0h18"/></svg>`;
}
