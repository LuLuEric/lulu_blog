import { CARDS, EVENTS, INSTITUTIONS, OFFICIALS, RULES } from './data.js';

export function seedNumber(text) {
  let value = 2166136261;
  for (const letter of String(text)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return value >>> 0 || 1;
}

function random(s) {
  let x = s.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}

function shuffle(s, values) {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function record(s, text, kind = 'normal', player = null) {
  s.log.push({ id: ++s.sequence, round: s.round, text, kind, player });
}

export function owned(s, id) { return s.institutions.filter(i => i.owner === id); }
export function sets(s, id) {
  const groups = owned(s, id).map(i => i.group);
  return ['宣传', '组织', '财政'].filter(g => groups.filter(v => v === g).length === 2).length;
}
export function income(s, id) {
  const p = s.players[id];
  return p.alive ? 2 + Math.floor(p.loyalty / 20) + owned(s, id).length + sets(s, id) : 0;
}
export function suspicion(p) { return Math.ceil(Math.max(0, p.peak - 12) / 3); }
export function forecast(p) { return 3 + suspicion(p); }

function review(s, p) {
  if (!p.alive) return;
  if (p.favor >= RULES.threshold && p.investigation) {
    p.investigation = null;
    record(s, `${p.name}的调查解除。组织决定暂时相信这份检讨。`, 'good', p.id);
  } else if (p.favor < RULES.threshold && !p.investigation) {
    const dueTurn = p.turns + (s.phase === 'start' && s.active === p.id ? 0 : 1);
    p.investigation = { dueTurn };
    record(s, `${p.name}进入调查：完整行动机会结束前，须恢复至 20 宠幸。`, 'danger', p.id);
  }
}

function change(s, p, values, reason) {
  const parts = [];
  const labels = { loyalty: '忠诚', influence: '影响力', favor: '宠幸' };
  for (const [key, delta] of Object.entries(values)) {
    const before = p[key];
    p[key] = Math.max(0, Math.min(key === 'influence' ? 30 : 100, before + delta));
    const actual = p[key] - before;
    if (actual) parts.push(`${labels[key]} ${actual > 0 ? '+' : ''}${actual} → ${p[key]}`);
  }
  p.peak = Math.max(p.peak, p.influence);
  if (parts.length) record(s, `${p.name} · ${reason}：${parts.join('，')}。`, values.favor < 0 ? 'danger' : 'normal', p.id);
  review(s, p);
}

function transferInfluence(s, from, to, amount, reason) {
  const actual = Math.min(amount, from.influence, 30 - to.influence);
  change(s, from, { influence: -actual }, reason);
  change(s, to, { influence: actual }, reason);
}

function draw(s, p, count) {
  let received = 0;
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length) {
      s.deck = shuffle(s, s.discard);
      s.discard = [];
      record(s, '档案重新归档：弃牌堆已洗回牌库。');
    }
    if (!s.deck.length) break;
    p.hand.push(s.deck.pop()); received++;
  }
  record(s, `${p.name}领取 ${received} 张档案。`, 'normal', p.id);
}

function purge(s, p, reason) {
  if (!p.alive) return;
  p.alive = false; p.investigation = null; p.shield = false; p.debts = [];
  s.discard.push(...p.hand); p.hand = [];
  for (const i of owned(s, p.id)) i.owner = null;
  record(s, `${p.name}被清洗。${reason} 会议记录已将其列为“从未出席”。`, 'purge', p.id);
}

function finish(s) {
  s.phase = 'final'; s.active = null;
  for (const p of s.players.filter(p => p.alive)) {
    const debt = p.debts.reduce((sum, d) => sum + d.amount, 0);
    p.debts = [];
    if (debt) change(s, p, { favor: -debt }, '终局清偿表忠债务');
  }
  for (const p of s.players.filter(p => p.alive && p.favor < RULES.threshold)) purge(s, p, '终局审查未通过。');
  const ranking = s.players.filter(p => p.alive).sort((a, b) => b.favor - a.favor || b.loyalty - a.loyalty);
  s.winners = ranking.length ? ranking.filter(p => p.favor === ranking[0].favor && p.loyalty === ranking[0].loyalty).map(p => p.id) : [];
  s.finished = true; s.actions = 0;
  record(s, s.winners.length ? `一致通过：${s.winners.map(id => s.players[id].name).join('、')}进入党的二号继承席位。请勿表现得过于高兴。` : '元首宣布：本届干部选拔工作取得圆满成功。没有人提出异议。', 'ending');
}

function startTurn(s) {
  const p = s.players[s.active];
  s.phase = 'start'; p.turns++;
  const due = p.debts.filter(d => d.dueTurn <= p.turns);
  p.debts = p.debts.filter(d => d.dueTurn > p.turns);
  if (due.length) change(s, p, { favor: -due.reduce((sum, d) => sum + d.amount, 0) }, '偿还极端表忠');
  draw(s, p, 2);
  s.phase = 'turn'; s.actions = RULES.actions;
  record(s, `轮到${p.name}行动。`, 'turn', p.id);
}

function beginRound(s) {
  s.round++; s.phase = 'round-start'; s.active = null;
  const alive = s.players.filter(p => p.alive);
  for (const p of alive) { p.peak = p.influence; p.shield = false; }
  if (!s.eventDeck.length) s.eventDeck = shuffle(s, EVENTS.map(e => e.id));
  s.eventId = s.eventDeck.pop();
  const event = EVENTS.find(e => e.id === s.eventId);
  record(s, `第 ${s.round} 轮 · ${event.name}。${event.text}`, 'event');
  const lowest = Math.min(...alive.map(p => p.loyalty));
  for (const p of alive) {
    const effects = {
      praise: { favor: 4 }, census: { favor: p.loyalty === lowest ? -5 : 0 },
      funding: { influence: 3 }, austerity: { influence: -2 }, insomnia: { favor: -4 },
      audit: { favor: -2 * owned(s, p.id).length }, anniversary: { loyalty: 8 },
      purge: { favor: -5 - (p.loyalty === lowest ? 3 : 0) },
    };
    change(s, p, effects[event.id], event.name);
  }
  for (const p of alive) change(s, p, { influence: income(s, p.id) }, '本轮收入（仅此一次）');
  const firstSeat = seedNumber(s.seed + ':first') % 4;
  s.order = Array.from({ length: 4 }, (_, n) => (firstSeat + s.round - 1 + n) % 4).filter(id => s.players[id].alive);
  s.cursor = 0; s.active = s.order[0]; startTurn(s);
}

function endRound(s) {
  s.phase = 'round-end'; s.active = null;
  record(s, `第 ${s.round} 轮结束，元首开始审阅名单。`, 'event');
  for (const p of s.players.filter(p => p.alive)) {
    const risk = suspicion(p);
    change(s, p, { favor: -(3 + risk), loyalty: -5 }, `恩宠折旧 3 + 猜忌 ${risk}（峰值 ${p.peak}）`);
  }
  if (s.round === RULES.rounds) finish(s);
  else beginRound(s);
}

function endTurn(s) {
  const p = s.players[s.active];
  if (p.investigation && p.turns >= p.investigation.dueTurn && p.favor < RULES.threshold) purge(s, p, '调查期限已到。');
  if (!s.players.some(p => p.alive)) { finish(s); return; }
  do { s.cursor++; } while (s.cursor < s.order.length && !s.players[s.order[s.cursor]].alive);
  if (s.cursor >= s.order.length) endRound(s);
  else { s.active = s.order[s.cursor]; startTurn(s); }
}

export function createGame(seed = 'SECOND-CHAIR') {
  seed = String(seed).slice(0, 80);
  const s = {
    version: 1, seed: String(seed).slice(0, 80), rng: seedNumber(seed), round: 0, phase: 'setup',
    players: OFFICIALS.map(p => ({ ...p, loyalty: RULES.loyalty, influence: RULES.influence, favor: RULES.favor, peak: RULES.influence, hand: [], alive: true, turns: 0, shield: false, investigation: null, debts: [] })),
    institutions: INSTITUTIONS.map(i => ({ ...i, owner: null })), deck: [], discard: [], eventDeck: [],
    eventId: null, order: [], cursor: 0, active: null, actions: 0, finished: false, winners: [], log: [], history: [], sequence: 0,
  };
  s.deck = shuffle(s, Object.keys(CARDS).flatMap(id => [id, id, id]));
  for (const p of s.players) draw(s, p, 5);
  beginRound(s);
  return s;
}

export function actionError(s, a) {
  if (!a || typeof a !== 'object') return '无效操作。';
  if (s.finished) return '会议已经结束。';
  if (s.phase !== 'turn' || s.active == null) return '请等待行动阶段。';
  if (a.actor !== undefined && a.actor !== s.active) return '现在不是该官员的行动机会。';
  const p = s.players[s.active];
  if (a.type === 'end') return p.hand.length > RULES.handLimit ? '请先将手牌弃至 7 张。' : null;
  if (a.type === 'discard') return p.hand.length <= RULES.handLimit ? '只有超过 7 张时才需要弃牌。' : (!Number.isInteger(a.index) || !p.hand[a.index] ? '该手牌不存在。' : null);
  if (s.actions <= 0) return '本次行动次数已用完。';
  if (a.type === 'confess') return p.loyalty < 10 ? '公开检讨需要 10 忠诚。' : null;
  if (a.type === 'appoint' || a.type === 'relinquish') {
    const i = s.institutions.find(i => i.id === a.institution);
    if (!i) return '请选择一个机构。';
    if (a.type === 'relinquish') return i.owner === p.id ? null : '只能交出自己的机构。';
    if (i.owner !== null) return '该机构已有负责人。';
    if (owned(s, p.id).length >= RULES.institutionLimit) return '最多控制 3 处机构。';
    return p.influence < RULES.institutionCost ? '任命需要 5 影响力。' : null;
  }
  if (a.type !== 'play' || !Number.isInteger(a.index) || !p.hand[a.index]) return '该手牌不存在。';
  const id = p.hand[a.index], card = CARDS[id];
  if (p.influence < card.cost) return '影响力不足。';
  if (id === 'retreat' && p.loyalty < 4) return '暂避锋芒需要 4 忠诚。';
  if (id === 'shield' && p.shield) return '已有挡箭牌，不能叠加。';
  if (card.target === 'rival') {
    const target = s.players.find(t => t.id === a.target);
    if (!target || !target.alive || target.id === p.id) return '请选择一名存活的其他官员。';
    if (id === 'trade' && (p.influence < 5 || p.hand.length < 2 || !target.hand.length || target.influence > 27)) return '交易需要合计 5 影响力、另一张手牌，且目标有手牌并能接收 3 影响力。';
  }
  if (card.target === 'institution') {
    const i = s.institutions.find(i => i.id === a.institution);
    if (!i || i.owner === null || i.owner === p.id || !s.players[i.owner].alive) return '请选择对手控制的机构。';
    if (owned(s, p.id).length >= RULES.institutionLimit) return '最多控制 3 处机构。';
  }
  return null;
}

export function legalActions(s) {
  if (s.finished || s.active == null) return [];
  const p = s.players[s.active];
  const actions = [{ type: 'end' }, { type: 'confess' }];
  for (const i of s.institutions) {
    actions.push({ type: 'appoint', institution: i.id }, { type: 'relinquish', institution: i.id });
  }
  p.hand.forEach((id, index) => {
    actions.push({ type: 'discard', index });
    if (CARDS[id].target === 'rival') for (const target of s.players) actions.push({ type: 'play', index, target: target.id });
    else if (CARDS[id].target === 'institution') for (const i of s.institutions) actions.push({ type: 'play', index, institution: i.id });
    else actions.push({ type: 'play', index });
  });
  return actions.filter(a => !actionError(s, a));
}

function blocked(s, p, target, id) {
  if (!target.shield) return false;
  target.shield = false;
  record(s, `${target.name}的挡箭牌拦截了${p.name}的「${CARDS[id].name}」。`, 'good', target.id);
  if (id === 'denounce') change(s, p, { favor: -4 }, '举报反噬');
  return true;
}

function play(s, p, a) {
  const [id] = p.hand.splice(a.index, 1);
  const card = CARDS[id];
  change(s, p, { influence: -card.cost }, `${card.name}费用`);
  record(s, `${p.name}打出「${card.name}」。`, 'card', p.id);
  const target = s.players[a.target];
  switch (id) {
    case 'loyalty':
      change(s, p, { loyalty: 15 }, card.name);
      if (s.players.filter(t => t.alive).every(t => p.loyalty >= t.loyalty)) change(s, p, { favor: 3 }, '忠诚领先');
      break;
    case 'propaganda': change(s, p, { favor: 8, influence: 2 }, card.name); break;
    case 'network': change(s, p, { influence: owned(s, p.id).length ? 8 : 5 }, card.name); break;
    case 'denounce': if (!blocked(s, p, target, id)) change(s, target, { favor: -10 }, card.name); break;
    case 'levy': transferInfluence(s, target, p, sets(s, p.id) ? 8 : 5, card.name); break;
    case 'trade': {
      transferInfluence(s, p, target, 3, card.name);
      const mine = Math.floor(random(s) * p.hand.length), theirs = Math.floor(random(s) * target.hand.length);
      [p.hand[mine], target.hand[theirs]] = [target.hand[theirs], p.hand[mine]];
      record(s, `${p.name}与${target.name}交换了各 1 张未公开档案。`);
      change(s, p, { favor: 5 }, card.name); break;
    }
    case 'transfer': {
      const i = s.institutions.find(i => i.id === a.institution);
      const owner = s.players[i.owner];
      if (!blocked(s, p, owner, id)) { i.owner = p.id; record(s, `${p.name}接管${i.name}，原负责人${owner.name}被通知“另有任用”。`, 'card', p.id); }
      break;
    }
    case 'shield': p.shield = true; record(s, `${p.name}部署了本轮的一次挡箭牌。`, 'good', p.id); break;
    case 'chorus': for (const t of s.players.filter(t => t.alive)) change(s, t, { favor: t.id === p.id ? 12 : 3 }, card.name); break;
    case 'dossier': draw(s, p, 3); break;
    case 'extreme': p.debts.push({ dueTurn: p.turns + 1, amount: 12 }); change(s, p, { favor: 18 }, card.name); break;
    case 'discipline': for (const t of s.players.filter(t => t.alive)) change(s, t, { loyalty: t.id === p.id ? 5 : -8 }, card.name); break;
    case 'frame': if (!blocked(s, p, target, id)) change(s, target, { favor: -7, loyalty: -8 }, card.name); break;
    case 'alibi': change(s, p, { favor: 7, loyalty: 5 }, card.name); break;
    case 'unanimous': if (!blocked(s, p, target, id)) change(s, target, { favor: target.loyalty < p.loyalty ? -12 : -5 }, card.name); break;
    case 'retreat': change(s, p, { loyalty: -4, favor: 4 }, card.name); break;
  }
  s.discard.push(id);
}

export function dispatch(state, action) {
  const error = actionError(state, action);
  if (error) return { ok: false, error, state };
  const s = structuredClone(state), p = s.players[s.active];
  s.history.push({ ...action, actor: p.id });
  if (action.type === 'end') endTurn(s);
  else if (action.type === 'discard') {
    const [card] = p.hand.splice(action.index, 1); s.discard.push(card);
    record(s, `${p.name}弃置了「${CARDS[card].name}」。`, 'normal', p.id);
  } else {
    s.actions--;
    if (action.type === 'play') play(s, p, action);
    else if (action.type === 'confess') change(s, p, { loyalty: -10, favor: 5 }, '公开检讨');
    else {
      const i = s.institutions.find(i => i.id === action.institution);
      if (action.type === 'appoint') {
        change(s, p, { influence: -RULES.institutionCost }, '机构任命费用'); i.owner = p.id;
        record(s, `${p.name}出任${i.name}负责人，下轮开始获得收入。`, 'good', p.id);
      } else { i.owner = null; change(s, p, { favor: 9 }, `主动交出${i.name}`); }
    }
  }
  return { ok: true, state: s };
}

export function observation(s) {
  return {
    round: s.round, active: s.active, actions: s.actions, eventId: s.eventId, finished: s.finished,
    players: s.players.map(p => {
      const { hand, ...publicState } = p;
      return { ...structuredClone(publicState), handCount: hand.length, ...(p.id === s.active ? { hand: [...hand] } : {}) };
    }),
    institutions: structuredClone(s.institutions), legal: legalActions(s),
  };
}

export function validateState(s) {
  if (!s || s.version !== 1 || typeof s.seed !== 'string' || !Number.isInteger(s.rng) || s.rng <= 0 || s.rng > 0xffffffff) throw new Error('Invalid state identity');
  if (!Array.isArray(s.players) || s.players.length !== 4 || !Number.isInteger(s.round) || s.round < 1 || s.round > RULES.rounds) throw new Error('Invalid round or players');
  if (!Number.isInteger(s.actions) || s.actions < 0 || s.actions > 2 || !Array.isArray(s.history) || !Array.isArray(s.log)) throw new Error('Invalid action state');
  if (!s.finished && (s.phase !== 'turn' || !s.players[s.active]?.alive || s.order[s.cursor] !== s.active)) throw new Error('Invalid active player');
  if (!EVENTS.some(e => e.id === s.eventId) || !Array.isArray(s.eventDeck) || s.eventDeck.some(id => !EVENTS.some(e => e.id === id))) throw new Error('Invalid event deck');
  for (const [index, p] of s.players.entries()) {
    if (p.id !== index || typeof p.alive !== 'boolean' || typeof p.shield !== 'boolean' || !Number.isInteger(p.turns) || p.turns < 0) throw new Error('Invalid player identity');
    for (const k of ['loyalty', 'favor', 'influence', 'peak']) if (!Number.isInteger(p[k]) || p[k] < 0 || p[k] > (k === 'loyalty' || k === 'favor' ? 100 : 30)) throw new Error(`Invalid ${k}`);
    if (p.peak < p.influence || owned(s, p.id).length > 3 || !Array.isArray(p.hand)) throw new Error('Invalid player resources');
    if (p.investigation && (!Number.isInteger(p.investigation.dueTurn) || p.investigation.dueTurn < p.turns || p.favor >= 20)) throw new Error('Invalid investigation');
    if (!Array.isArray(p.debts) || p.debts.some(d => d.amount !== 12 || !Number.isInteger(d.dueTurn) || d.dueTurn <= p.turns)) throw new Error('Invalid debt');
    if (!p.alive && (p.hand.length || owned(s, p.id).length)) throw new Error('Purged player owns resources');
  }
  if (!Array.isArray(s.institutions) || s.institutions.length !== 6 || INSTITUTIONS.some(i => s.institutions.filter(x => x.id === i.id).length !== 1)) throw new Error('Invalid institutions');
  for (const i of s.institutions) if (i.owner !== null && !s.players[i.owner]?.alive) throw new Error('Invalid institution owner');
  const allCards = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  if (allCards.length !== 48 || allCards.some(id => !CARDS[id]) || Object.keys(CARDS).some(id => allCards.filter(c => c === id).length !== 3)) throw new Error('Card conservation violated');
  if (s.finished && (s.active !== null || s.phase !== 'final' || s.players.some(p => p.alive && (p.favor < 20 || p.debts.length)))) throw new Error('Invalid final state');
  return true;
}
