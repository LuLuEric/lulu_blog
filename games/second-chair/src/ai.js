import { CARDS, RULES } from './data.js';
import { forecast, income, owned, sets, seedNumber } from './engine.js';

// Only a redacted observation is accepted: no rival hands, deck or RNG state.
export function chooseAction(view) {
  if (view.finished || !view.legal.length) return null;
  const p = view.players[view.active];
  const remaining = RULES.rounds - view.round;
  const favors = view.players.filter(t => t.alive).map(t => t.favor);
  const leader = Math.max(...favors);
  const projected = p.favor - forecast(p) - p.debts.reduce((n, d) => n + d.amount, 0);
  const urgency = projected < 20 ? 3.8 : projected < 30 ? 2.1 : 1;
  const favorValue = urgency * (p.personality === 'courtier' ? 1.2 : 1) * (1 + view.round / 36);
  const loyaltyValue = (Math.min(remaining, 8) * 0.045 + 0.12) * (p.personality === 'survivor' ? 1.2 : 1);
  const influenceValue = remaining > 3 ? 0.62 : 0.3;
  const own = owned(view, p.id);
  const favorGain = n => Math.min(n, 100 - p.favor) * favorValue;
  const loyaltyGain = n => Math.min(n, 100 - p.loyalty) * loyaltyValue;
  const influenceGain = n => {
    const after = Math.min(30, p.influence + n);
    const extraRisk = Math.ceil(Math.max(0, Math.max(p.peak, after) - 12) / 3) - Math.ceil(Math.max(0, p.peak - 12) / 3);
    return (after - p.influence) * influenceValue - extraRisk * favorValue;
  };
  const attack = (target, damage, blockable = true) => {
    if (target.shield && blockable) return -3;
    const prominence = target.favor === leader ? 0.88 : 0.42;
    const elimination = target.favor - damage < 20 ? 4 : 0;
    return Math.min(target.favor, damage) * prominence + elimination;
  };
  const cardScore = (id, a = {}) => {
    const card = CARDS[id];
    const t = view.players[a.target];
    let value = -card.cost * influenceValue;
    switch (id) {
      case 'loyalty': value += loyaltyGain(15) + (p.loyalty + 15 >= Math.max(...view.players.filter(t => t.alive).map(t => t.loyalty)) ? favorGain(3) : 0); break;
      case 'propaganda': value += favorGain(8) + influenceGain(2); break;
      case 'network': value += influenceGain(own.length ? 8 : 5) + (p.influence < 4 ? 4 : 0); break;
      case 'denounce': value += t ? attack(t, 10) : 5; break;
      case 'levy': value += t ? influenceGain(Math.min(t.influence, sets(view, p.id) ? 8 : 5)) + Math.min(t.influence, 5) * 0.3 : 4; break;
      case 'trade': value += favorGain(5) - 3 * influenceValue + 1; break;
      case 'transfer': {
        const i = view.institutions.find(i => i.id === a.institution);
        const target = i && view.players[i.owner];
        value += target?.shield ? -4 : Math.min(remaining, 7) * 1.4 + 3 + (i && own.some(x => x.group === i.group) ? 3 : 0);
        break;
      }
      case 'shield': value += (projected < 32 ? 8 : 3) + (own.length ? 2 : 0); break;
      case 'chorus': value += favorGain(12) - 2.5; break;
      case 'dossier': value += p.hand.length < 4 ? 7 : 2; break;
      case 'extreme': value += favorGain(18) - 12 * favorValue + (p.investigation && p.favor < 20 ? 6 : 0); break;
      case 'discipline': value += loyaltyGain(5) + Math.min(remaining, 6) * 0.8; break;
      case 'frame': value += (t ? attack(t, 7) : 4) + (t?.shield ? 0 : Math.min(remaining, 6) * 0.35); break;
      case 'alibi': value += favorGain(7) + loyaltyGain(5); break;
      case 'unanimous': value += t ? attack(t, t.loyalty < p.loyalty ? 12 : 5) : 4; break;
      case 'retreat': value += favorGain(4) - 4 * loyaltyValue; break;
    }
    return value;
  };
  function score(a) {
    if (a.type === 'end') return -0.5;
    if (a.type === 'discard') return -100 - cardScore(p.hand[a.index]);
    if (a.type === 'confess') return favorGain(5) - 10 * loyaltyValue - 1;
    if (a.type === 'relinquish') return favorGain(9) - Math.min(remaining, 8) * 1.6 - 2;
    if (a.type === 'appoint') {
      const i = view.institutions.find(i => i.id === a.institution);
      const pair = own.some(x => x.group === i.group);
      return Math.min(remaining, 8) * (pair ? 1.65 : 1.1) - 5 * influenceValue + (p.personality === 'builder' ? 4 : 0) - (income(view, p.id) > 7 ? 2 : 0);
    }
    return cardScore(p.hand[a.index], a);
  }
  // An overfull hand can still play useful cards first; at zero AP it must discard.
  const tieBreak = a => (seedNumber(`${view.round}:${view.active}:${view.actions}:${JSON.stringify(a)}`) % 997) / 9970;
  return view.legal.reduce((best, a) => score(a) + tieBreak(a) > score(best) + tieBreak(best) ? a : best);
}
