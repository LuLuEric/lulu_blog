import { createGame, dispatch, observation, validateState, decisionActor } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';
import { CARDS } from '../src/data.js';

const games = Number(process.argv[2] || 300);
const symmetric = process.argv.includes('--symmetric');
if (!Number.isInteger(games) || games < 1 || games > 20000) throw new Error('Games must be 1..20000');
const cards = Object.fromEntries(Object.keys(CARDS).map(id => [id, { plays: 0, early: 0, late: 0, discards: 0, available: new Set(), selected: new Set() }]));
const wins = [0, 0, 0, 0];
let operations = 0, purges = 0, favor = 0, survivors = 0, responses = 0, blocked = 0;
for (let n = 0; n < games; n++) {
  let s = createGame(`DECK-AUDIT-20260913-${n}`), steps = 0;
  if (symmetric) for (const p of s.players) p.personality = 'balanced';
  while (!s.finished) {
    if (++steps > 700) throw new Error(`Nonterminating game ${n}`);
    const p = s.players[decisionActor(s)], view = observation(s);
    const phase = `${n}:${s.round}:${p.id}:${p.turns}`;
    const response = `${phase}:response:${steps}`;
    for (const id of new Set(view.legal.filter(a => a.type === 'play').map(a => p.hand[a.index]))) cards[id].available.add(phase);
    if (s.phase === 'reaction') { responses++; cards.shield.available.add(response); }
    const action = chooseAction(view);
    const id = action.type === 'play' || action.type === 'discard' ? p.hand[action.index] : action.type === 'respond' && action.block ? 'shield' : null;
    if (action.type === 'play' || (action.type === 'respond' && action.block)) {
      const c = cards[id]; c.plays++; c.selected.add(action.type === 'respond' ? response : phase);
      if (s.round <= 4) c.early++;
      if (s.round >= 9) c.late++;
      if (action.type === 'respond') blocked++;
    } else if (action.type === 'discard') cards[id].discards++;
    const result = dispatch(s, action);
    if (!result.ok) throw new Error(result.error);
    s = result.state; validateState(s);
  }
  operations += steps;
  for (const id of s.winners) wins[id] += 1 / s.winners.length;
  for (const p of s.players) if (p.alive) { survivors++; favor += p.favor; } else purges++;
}
console.log(JSON.stringify({ games, symmetric, seedPrefix: 'DECK-AUDIT-20260913-', operations, wins, winPercent: wins.map(n => +(n / games * 100).toFixed(2)), purges, meanFinalFavor: +(favor / survivors).toFixed(2), responses, blocked,
  opportunityDefinition: 'Normal cards: personal phases with a legal play. Shield: incoming response decisions. Rates describe this AI policy, not human balance.',
  cards: Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, { name: CARDS[id].name, plays: c.plays, early: c.early, late: c.late, discards: c.discards, available: c.available.size, selected: c.selected.size, usePercent: +(100 * c.selected.size / (c.available.size || 1)).toFixed(1) }])) }, null, 2));
