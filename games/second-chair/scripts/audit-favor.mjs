import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const games = Number(process.argv[2] || 300);
const symmetric = process.argv.includes('--symmetric');
const sourceIndex = process.argv.indexOf('--source');
if (!Number.isInteger(games) || games < 1 || games > 20000) throw new Error('Games must be 1..20000');
if (sourceIndex >= 0 && (!process.argv[sourceIndex + 1] || process.argv[sourceIndex + 1].startsWith('--'))) throw new Error('--source needs a project directory');
const root = sourceIndex >= 0 ? resolve(process.argv[sourceIndex + 1]) : fileURLToPath(new URL('../', import.meta.url));
const { createGame, dispatch, observation, validateState, decisionActor } = await import(pathToFileURL(resolve(root, 'src/engine.js')));
const { chooseAction } = await import(pathToFileURL(resolve(root, 'src/ai.js')));
const { CARDS, RULES } = await import(pathToFileURL(resolve(root, 'src/data.js')));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const seedPrefix = 'FAVOR-AUDIT-20260913-';
const roundEnd = Array.from({ length: RULES.rounds + 1 }, () => []);
const sources = {}, cardPlays = {}, finalFavor = [], firstHits = [], wins = [0, 0, 0, 0], examples = {};
let operations = 0, anyHitGames = 0, allEverGames = 0, allAtOnceGames = 0, hitOfficials = 0;
let purges = 0, investigations = 0, resolvedInvestigations = 0, selfRescues = 0, finalFavorTies = 0;
let attacks = 0, blockedFavorAttacks = 0, officialRounds = 0, noWinnerGames = 0;

for (let n = 0; n < games; n++) {
  const seed = seedPrefix + n;
  let s = createGame(seed), steps = 0, simultaneous = false;
  if (symmetric) for (const p of s.players) p.personality = 'balanced';
  while (!s.finished) {
    if (++steps > 700) throw new Error(`Nonterminating game ${seed}`);
    const actor = decisionActor(s), a = chooseAction(observation(s));
    if (a.type === 'play') {
      const id = s.players[actor].hand[a.index];
      cardPlays[id] = (cardPlays[id] || 0) + 1;
      if (['denounce', 'frame', 'unanimous'].includes(id)) attacks++;
    }
    if (a.type === 'respond' && a.block && s.pending.card !== 'transfer') blockedFavorAttacks++;
    const r = dispatch(s, a);
    if (!r.ok) throw new Error(`${seed}: ${r.error}`);
    const next = r.state; validateState(next);
    if (['play', 'confess', 'relinquish'].includes(a.type) && s.players[actor].investigation && !next.players[actor].investigation && next.players[actor].alive) {
      selfRescues++;
      examples.selfRescue ||= { seed, round: s.round, actor, action: a };
    }
    s = next;
    if (s.players.every(p => p.alive && p.favor === 100)) simultaneous = true;
  }
  operations += steps;
  const hits = new Map(), ledger = s.players.map(() => ({ favor: RULES.favor, alive: true }));
  let ledgerRound = 0, positive = 0, negative = 0;
  const captureRound = () => { if (ledgerRound) roundEnd[ledgerRound].push(...ledger.filter(p => p.alive).map(p => p.favor)); };
  for (const e of s.log) {
    if (e.round > ledgerRound) {
      captureRound(); ledgerRound = e.round;
      officialRounds += ledger.filter(p => p.alive).length;
    }
    if (e.text.includes('进入调查：')) { investigations++; examples.investigation ||= { seed, round: e.round, actor: e.player }; }
    if (e.text.includes('的调查解除。')) resolvedInvestigations++;
    if (e.kind === 'purge') { ledger[e.player].alive = false; examples.purge ||= { seed, round: e.round, actor: e.player }; }
    const m = e.text.match(/宠幸 ([+-]\d+) → (\d+)/);
    if (!m) continue;
    const delta = Number(m[1]), value = Number(m[2]);
    ledger[e.player].favor = value;
    const raw = e.text.split(' · ')[1]?.split('：')[0] || 'unknown';
    const reason = raw.startsWith('恩宠折旧') ? 'round-end' : raw.startsWith('主动交出') ? 'relinquish' : raw;
    const stat = sources[reason] ||= { positive: 0, negative: 0, count: 0 };
    stat.count++;
    if (delta > 0) { stat.positive += delta; positive += delta; }
    else { stat.negative -= delta; negative -= delta; }
    if (value === 100 && !hits.has(e.player)) hits.set(e.player, e.round);
  }
  captureRound();
  if (RULES.favor * 4 + positive - negative !== s.players.reduce((sum, p) => sum + p.favor, 0)) throw new Error(`Favor accounting mismatch: ${seed}`);
  if (ledger.some((p, id) => p.favor !== s.players[id].favor || p.alive !== s.players[id].alive)) throw new Error(`Round ledger mismatch: ${seed}`);
  if (hits.size) anyHitGames++;
  if (hits.size === 4) allEverGames++;
  if (simultaneous) allAtOnceGames++;
  hitOfficials += hits.size; firstHits.push(...hits.values());
  const alive = s.players.filter(p => p.alive);
  purges += 4 - alive.length; finalFavor.push(...alive.map(p => p.favor));
  const top = Math.max(...alive.map(p => p.favor));
  if (alive.filter(p => p.favor === top).length > 1) finalFavorTies++;
  if (!s.winners.length) noWinnerGames++;
  for (const id of s.winners) wins[id] += 1 / s.winners.length;
}

const pct = (a, b) => b ? +(100 * a / b).toFixed(2) : null;
const avg = values => values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null;
const totalPositive = Object.values(sources).reduce((n, x) => n + x.positive, 0);
const totalNegative = Object.values(sources).reduce((n, x) => n + x.negative, 0);
console.log(JSON.stringify({ version, games, symmetric, seedPrefix, operations, officialRounds, wins, winPercent: wins.map(n => pct(n, games)), noWinnerGames,
  anyHitGames, allEverGames, allAtOnceGames, hitOfficials, hitOfficialPercent: pct(hitOfficials, games * 4), meanFirstCapRound: avg(firstHits),
  meanFinalFavor: avg(finalFavor), finalHigh90Percent: pct(finalFavor.filter(v => v >= 90).length, finalFavor.length), maxFinalFavor: finalFavor.length ? Math.max(...finalFavor) : null,
  finalFavorTies, purges, investigations, resolvedInvestigations, selfRescues, attacks, blockedFavorAttacks, totalPositive, totalNegative,
  averageActualGainPerOfficialRound: +(totalPositive / officialRounds).toFixed(2), averageActualLossPerOfficialRound: +(totalNegative / officialRounds).toFixed(2),
  byRound: roundEnd.slice(1).map((values, i) => ({ round: i + 1, survivors: values.length, meanEndFavor: avg(values), high90Percent: pct(values.filter(v => v >= 90).length, values.length) })),
  sources: Object.entries(sources).sort((a, b) => b[1].positive - a[1].positive).map(([reason, x]) => ({ reason, ...x, shareOfGain: pct(x.positive, totalPositive) })),
  cardPlays: Object.fromEntries(Object.entries(cardPlays).map(([id, n]) => [CARDS[id].name, n])), examples,
  scope: 'Seeded AI policy measurements, not human balance. Round distributions include survivors; cap counts include all initial officials. Self rescues exclude help from other officials and public events.'
}, null, 2));
