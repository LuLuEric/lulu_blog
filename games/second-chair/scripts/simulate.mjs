import { createGame, dispatch, observation, validateState } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';

const count = Number(process.argv[2] || 500);
const symmetric = process.argv.includes('--symmetric');
if (!Number.isInteger(count) || count < 1 || count > 20000) throw new Error('Count must be 1..20000');
const wins = [0, 0, 0, 0], purges = [0, 0, 0, 0];
let ties = 0, noWinner = 0, rounds = 0, actions = 0, appointments = 0;
for (let index = 0; index < count; index++) {
  let s = createGame(`SIMULATION-${index}`), steps = 0;
  if (symmetric) for (const p of s.players) p.personality = 'balanced';
  while (!s.finished) {
    if (steps++ > 600) throw new Error(`Game ${index} did not terminate`);
    const action = chooseAction(observation(s));
    if (action.type === 'appoint') appointments++;
    const result = dispatch(s, action);
    if (!result.ok) throw new Error(result.error);
    s = result.state; validateState(s);
  }
  if (!s.winners.length) noWinner++;
  if (s.winners.length > 1) ties++;
  for (const id of s.winners) wins[id] += 1 / s.winners.length;
  for (const p of s.players) if (!p.alive) purges[p.id]++;
  rounds += s.round; actions += steps;
}
console.log(JSON.stringify({ games: count, symmetric, fractionalWins: wins, winPercent: wins.map(n => +(n / count * 100).toFixed(2)), purges, ties, noWinner, averageRounds: rounds / count, averageOperations: actions / count, averageAppointments: appointments / count }, null, 2));
