import { CARDS } from './data.js';
import { actionError, actionCost, decisionActor, dispatch, forecast, nextIncome } from './engine.js';

// Simulate a copy, then expose only public deltas. Random card identities and
// whether a rival holds a response card must never escape through the preview.
export function previewAction(state, action) {
  if (!['play', 'respond', 'appoint', 'relinquish', 'confess'].includes(action.type)) return { error: '此操作不提供出牌预览。' };
  const error = actionError(state, action);
  if (error) return { error };
  const actor = decisionActor(state), before = state.players[actor];
  const card = action.type === 'play' ? before.hand[action.index] : null;
  let after = dispatch(state, action).state;
  if (after.phase === 'reaction') after = dispatch(after, { type: 'respond', block: false }).state;
  const snapshot = (s, p) => ({ loyalty: p.loyalty, influence: p.influence, favor: p.favor, handCount: p.hand.length, peak: p.peak, loss: forecast(p), income: nextIncome(s, p.id), investigation: Boolean(p.investigation), shield: p.shield });
  const players = state.players.map(p => ({ id: p.id, before: snapshot(state, p), after: snapshot(after, after.players[p.id]) }))
    .filter(p => p.id === actor || JSON.stringify(p.before) !== JSON.stringify(p.after));
  const institutions = state.institutions.filter((i, n) => i.owner !== after.institutions[n].owner)
    .map(i => ({ id: i.id, before: i.owner, after: after.institutions.find(t => t.id === i.id).owner }));
  const notes = [];
  if (['denounce', 'transfer', 'frame', 'unanimous'].includes(card)) {
    const target = card === 'transfer' ? state.players[state.institutions.find(i => i.id === action.institution).owner] : state.players[action.target];
    notes.push(target.shield ? '目标已有旧版部署防护，本次攻击会被拦截。' : '以下为未被拦截的效果；目标可能使用手牌中的挡箭牌回应。');
    if (card === 'denounce' && !target.shield) notes.push('如果被拦截，目标不损失宠幸，你的宠幸会减少 4。');
  }
  if (card === 'trade') notes.push(`总费用 ${CARDS.trade.cost} 影响力，包含给目标的 ${CARDS.trade.gift} 点。你交出「${CARDS[before.hand[action.giveIndex]].name}」，换入随机一张；对手手牌内容不公开。`);
  if (card === 'dossier') notes.push(`弃置「${CARDS[before.hand[action.giveIndex]].name}」与本牌，摸入两张未知牌；手牌总数不变，本次机密档案次数用完。`);
  if (card === 'shield') notes.push('受袭时选择使用。');
  if (card === 'extreme' && before.favor > 82) notes.push(`受宠幸上限 100 限制，本次实际获得 ${100 - before.favor} 宠幸，仍须足额支付 20 忠诚。`);
  if (card === 'network' || card === 'levy') {
    const fee = CARDS[card].cost;
    notes.push(`实际到账 ${after.players[actor].influence - before.influence + fee} 影响力${fee ? `，已另扣 ${fee} 点费用` : ''}；峰值只升不降。`);
  }
  if (card === 'loyalty') notes.push(after.players[actor].favor > before.favor ? '加完忠诚后已立即满足最高（含并列）条件，宠幸奖励计入上方结果。' : '忠诚立即比较；本次未获得额外宠幸，或宠幸已达上限。');
  if (card === 'unanimous') notes.push(`未被拦截时，目标宠幸减少 ${state.players[action.target].loyalty < before.loyalty ? 12 : 5}；忠诚相同按 5 点计算。`);
  if (action.type === 'respond') notes.push(action.block ? '弃置一张挡箭牌并支付费用，原行动者继续；你的行动次数不减少。' : '保留挡箭牌与预算，承受这一次攻击。');
  return { actor, cost: actionCost(state, action), actions: { before: state.actions, after: after.actions }, players, institutions, notes };
}
