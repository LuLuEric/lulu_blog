import { CARDS, EVENTS, RULES } from './data.js';
import { createGame, dispatch, actionError, legalActions, owned, sets, income, forecast, observation, validateState } from './engine.js';
import { chooseAction } from './ai.js';
import { icon, portrait } from './icons.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const SAVE_KEY = 'second-chair:v1';
let storageIssue = '', loaded = false, aiTimer, toastTimer, fast = false, dialogState = null, endingShown = false;
let game = loadGame();

function escape(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function json(value) { return escape(JSON.stringify(value)); }
function loadGame() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) { const state = JSON.parse(saved); validateState(state); loaded = true; return state; }
  } catch { storageIssue = '上次存档无法读取，已准备新会议。'; }
  return createGame('CHAIR-0001');
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); storageIssue = ''; }
  catch { storageIssue = '浏览器未允许保存；当前仍可正常游玩。'; }
}
function notify(message) {
  clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3800);
}
function isHumanTurn() { return !game.finished && game.active === 0; }
function badge(p) {
  if (!p.alive) return '<span class="tag danger">已被清洗</span>';
  if (p.investigation) return '<span class="tag danger">接受调查</span>';
  if (game.active === p.id) return '<span class="tag active">正在行动</span>';
  return `<span class="tag">${escape(p.tag)}</span>`;
}
function stats(p, compact = false) {
  return `<div class="stats ${compact ? 'compact' : ''}">${[
    ['loyalty', '忠诚', 'shield', 'blue', 100], ['influence', '影响力', 'spark', 'gold', 30], ['favor', '宠幸', 'crown', 'red', 100],
  ].map(([key, label, symbol, color, max]) => `<div class="stat ${color}"><span class="stat-label">${icon(symbol)}${label}</span><strong>${p[key]}<small> / ${max}</small></strong><span class="stat-track"><i style="width:${p[key] / max * 100}%"></i></span></div>`).join('')}</div>`;
}
function official(p) {
  return `<article class="official ${p.color} ${game.active === p.id ? 'current' : ''} ${!p.alive ? 'purged' : ''}">
    <div class="official-top"><div class="portrait-frame ${p.color}">${portrait(p.id)}</div><div class="official-identity"><div class="official-title"><h3>${p.name}</h3>${badge(p)}</div><p>${p.title}</p></div></div>
    ${stats(p, true)}<div class="official-bottom"><span>${icon('building')}${owned(game, p.id).length} 处机构</span><span>${icon('file')}${p.hand.length} 张手牌</span><span>${p.shield ? icon('shield') + '有防护' : '下轮收入 +' + income(game, p.id)}</span></div>
  </article>`;
}
function institutionTile(i) {
  const owner = i.owner === null ? null : game.players[i.owner];
  const mine = i.owner === 0;
  return `<button class="institution ${i.color} ${mine ? 'mine' : ''}" data-institution="${i.id}" aria-label="查看机构 ${i.name}${owner ? '，负责人' + owner.name : '，暂无负责人'}">
    <span class="institution-symbol">${icon(i.icon)}</span><span class="institution-copy"><strong>${i.name}</strong><small>${owner ? (mine ? '由你控制' : owner.name + '控制') : '等待任命'}</small></span><span class="institution-value">${owner ? '<span class="owner-dot ' + owner.color + '"></span>' : '5 ' + icon('spark')}<small>${i.group}系统</small></span>
  </button>`;
}
function cardView(id, index, large = false, readOnly = false) {
  const card = CARDS[id];
  const playable = isHumanTurn() && legalActions(game).some(a => a.type === 'play' && a.index === index);
  const tag = readOnly ? 'div' : 'button';
  return `<${tag} class="hand-card ${card.color} ${large ? 'large' : ''} ${!playable && !large && !readOnly ? 'unavailable' : ''}" ${readOnly ? '' : `data-card="${index}" aria-label="查看手牌 ${card.name}，费用 ${card.cost} 影响力"`}>
    <div class="card-top"><span class="card-cost">${card.cost}</span><span class="card-type">${card.type}</span><span class="card-mark">${icon(card.icon)}</span></div>
    <div class="card-illustration"><span class="card-orbit"></span>${icon(card.icon)}</div>
    <div class="card-copy"><h3>${card.name}</h3><p>${card.text}</p></div>
    ${large ? `<div class="card-quote">“${card.quote}”</div>` : '<span class="card-bottom-mark">◆</span>'}
  </${tag}>`;
}
function render() {
  const p = game.players[0], event = EVENTS.find(e => e.id === game.eventId);
  const loss = forecast(p), projected = Math.max(0, p.favor - loss);
  const leader = game.players.filter(p => p.alive).sort((a, b) => b.favor - a.favor || b.loyalty - a.loyalty)[0];
  const activeName = game.active === null ? '' : game.players[game.active].name;
  const myTurn = isHumanTurn();
  app.innerHTML = `<div class="shell">
    <header class="topbar"><a class="brand" href="#" aria-label="第二把椅子">${icon('chair')}<span><strong>第二把椅子</strong><small>权力是一场没有朋友的牌局</small></span></a>
    <nav class="top-actions" aria-label="游戏菜单"><span class="session-status"><i></i>${game.finished ? '本次会议已闭幕' : '最高委员会 · 秘密会议'}</span><button class="button subtle" data-menu="rules">${icon('info')}玩法说明</button><button class="button subtle" data-menu="new">${icon('refresh')}新会议</button></nav></header>
    <div class="meeting-bar"><span class="eyebrow">内部文件 <b>·</b> 阅后不必承认</span><span>${icon('clock')} 第 <strong>${String(game.round).padStart(2, '0')}</strong> / 12 轮</span><span class="save-status">${storageIssue ? escape(storageIssue) : icon('check') + '进度自动保存'}</span></div>
    <div class="layout"><main class="table-area">
      <section class="opponents" aria-label="你的同僚">${game.players.slice(1).map(official).join('')}</section>
      <section class="council" aria-label="继承席位"><div class="council-shade"></div><div class="council-copy"><div class="eyebrow">THE SECOND CHAIR <span>／</span> 继承席位</div><h1>${game.finished ? '名单已经确定。' : '忠诚，是一种表演。'}</h1><p>${game.finished ? '所有决定，均以全票通过。' : '让元首需要你。<br>但不要让他觉得，你可以取代他。'}</p><span class="council-note">${icon('crown')}${leader ? '当前宠幸领先：' + leader.name + ' · ' + leader.favor : '没有合格的继承人'}</span></div><div class="council-stamp"><span>机 密</span><small>仅限与会人员</small></div></section>
      <section class="institutions-section" aria-label="权力机构"><div class="section-title"><h2>${icon('building')}权力版图</h2><span>同系统成套，额外收入 +1 <b>·</b> 任命消耗 1 次行动</span></div><div class="institutions">${game.institutions.map(institutionTile).join('')}</div></section>
      <section class="player-panel ${!p.alive ? 'purged' : ''}" aria-label="你的官员状态"><div class="player-name"><span class="your-seal">${icon('seal')}</span><div><h2>你的办公室 ${badge(p)}</h2><p>特别事务专员 <span>／</span> ${owned(game, 0).length} 处机构 · ${sets(game, 0)} 组完整系统</p></div></div>${stats(p)}<div class="income-note"><span>下轮收入</span><strong>+${income(game, 0)} ${icon('spark')}</strong></div></section>
      <section class="hand-section" aria-label="你的手牌"><div class="section-title"><h2>${icon('file')}手中筹码 <small>${p.hand.length} / 7</small></h2><span>${p.hand.length > 7 ? '<strong class="danger-text">结束前需弃置 ' + (p.hand.length - 7) + ' 张</strong>' : '点击卡牌查看详情并行动'}</span></div><div class="hand-grid">${p.hand.length ? p.hand.map((id, index) => cardView(id, index)).join('') : '<p class="empty-hand">' + (p.alive ? '档案暂时为空。你仍可以经营机构或公开检讨。' : '你的档案已被收走。会议还在继续。') + '</p>'}</div></section>
      <div class="action-bar"><div class="turn-caption"><span class="turn-indicator ${myTurn ? 'yours' : ''}"></span><div><strong>${game.finished ? '会议结束' : myTurn ? '轮到你了，专员。' : !p.alive ? '你已被清洗 · 正在观战' : activeName + '正在行动…'}</strong><small>${myTurn ? '剩余 ' + game.actions + ' 次行动，谨慎使用你的影响力。' : game.finished ? '最终任命书已归档。' : '每一次掌声，都有自己的价码。'}</small></div></div><div class="action-buttons">${game.finished ? '<button class="button gold-button" data-menu="ending">查看任命结果 ' + icon('arrow') + '</button>' : `<button class="button secondary" data-menu="confess" ${!myTurn || game.actions === 0 || p.loyalty < 10 ? 'disabled' : ''}>${icon('file')}公开检讨</button><button class="button gold-button" data-menu="end" ${!myTurn ? 'disabled' : ''}>结束行动 <span>${myTurn ? game.actions + '/2' : '等待'}</span>${icon('arrow')}</button>`}</div></div>
    </main><aside class="sidebar">
      <section class="agenda panel"><div class="section-title"><h2>会议议程</h2><span class="tiny-label">第 ${game.round} 轮</span></div><div class="round-progress">${Array.from({ length: 12 }, (_, i) => `<span class="${i + 1 === game.round ? 'now' : i + 1 < game.round ? 'done' : ''}" title="第 ${i + 1} 轮">${i + 1}</span>`).join('')}</div><div class="turn-order">${game.order.map((id, i) => `<span class="${game.active === id ? 'now' : i < game.cursor || !game.players[id].alive ? 'done' : ''}">${game.players[id].name}${game.active === id ? ' ←' : ''}</span>`).join('<i>›</i>')}</div><button class="speed-button" data-menu="speed">${fast ? '恢复正常节奏' : '加快电脑行动'} <span>${fast ? '× 4' : '× 1'}</span></button></section>
      <section class="event-panel panel"><div class="eyebrow">本轮政治风向 <span>／</span> PUBLIC EVENT</div><div class="event-name">${icon(event.icon)}<h2>${event.name}</h2></div><p>${event.text}</p><blockquote>“${event.quote}”</blockquote><span class="file-number">最高委员会通告 / ${String(game.round).padStart(3, '0')}</span></section>
      <section class="risk-panel panel ${projected < 25 || p.investigation ? 'at-risk' : ''}"><div class="section-title"><h2>${icon('eye')}元首的目光</h2><span>${p.investigation ? '正在调查' : projected < 25 ? '保持警惕' : '暂时安全'}</span></div><div class="risk-numbers"><span>本轮权势峰值<strong>${p.peak}<small> / 30</small></strong></span><span>轮末宠幸预计<strong class="${loss > 3 ? 'danger-text' : ''}">−${loss}</strong></span></div><div class="risk-meter"><i style="width:${p.peak / 30 * 100}%"></i><b style="left:40%"></b></div><p>折旧 3 + 猜忌 ${loss - 3} <span>·</span> 当前预计剩余 <b>${projected}</b> 宠幸</p>${p.investigation ? '<div class="investigation-alert">' + icon('eye') + '须在完整行动机会结束前恢复至 20 宠幸。</div>' : '<small class="muted">影响力超过 12 开始引起猜忌。花掉资源不会降低本轮峰值。</small>'}${p.debts.length ? '<div class="investigation-alert">' + icon('clock') + '待偿还表忠代价：' + p.debts.reduce((n, d) => n + d.amount, 0) + ' 宠幸</div>' : ''}</section>
      <section class="minutes panel"><div class="section-title"><h2>会议记录</h2><button class="text-button" data-menu="log">查看全部 ${icon('arrow')}</button></div><div class="log-list">${game.log.slice(-8).reverse().map(l => `<div class="log-entry ${l.kind}"><span class="log-dot"></span><p>${escape(l.text)}</p></div>`).join('')}</div><div class="minutes-foot">记录员已保证，他什么也没听见。</div></section>
      <p class="sidebar-foot">一个虚构政权的黑色喜剧<br>活到最后，不等于赢到最后。</p>
    </aside></div><footer class="footer"><span>所有人都不可替代，直到下一次人事调整。</span><span>会议编号 ${escape(game.seed)} · 原型 v0.1</span></footer>
  </div>`;
  if (game.finished && !endingShown) { endingShown = true; openDialog({ kind: 'ending' }); }
}

function closeDialog() { modal.close(); }
function openDialog(context) {
  clearTimeout(aiTimer); dialogState = context;
  drawDialog();
  if (!modal.open) modal.showModal();
}
function dialogHeader(title, eyebrow = '最高委员会 · 内部档案') {
  return `<div class="dialog-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-menu="close" aria-label="关闭窗口">${icon('close')}</button></div>`;
}
function actionPreview(action) {
  const error = !isHumanTurn() ? '请等到你的行动机会。' : actionError(game, action);
  if (error) return `<p class="action-error">${icon('info')}${error}</p>`;
  const after = dispatch(game, action).state.players[0], before = game.players[0];
  return `<div class="action-preview"><strong>执行后预览</strong><div>${[['loyalty', '忠诚'], ['influence', '影响力'], ['favor', '宠幸']].map(([key, label]) => `<span>${label}<b>${before[key]} → ${after[key]}</b></span>`).join('')}</div><p>本轮峰值 ${after.peak} · 轮末预计损失 ${forecast(after)} 宠幸</p></div>`;
}
function confirmation(action, label = '执行此行动') {
  const error = !isHumanTurn() ? '不是你的行动机会' : actionError(game, action);
  return `${actionPreview(action)}<button class="button gold-button wide" data-confirm="${json(action)}" ${error ? 'disabled' : ''}>${label} ${icon('arrow')}</button>`;
}
function drawDialog() {
  const d = dialogState, p = game.players[0];
  modal.className = d.kind === 'rules' || d.kind === 'log' ? 'wide-dialog' : '';
  if (d.kind === 'card') {
    const id = p.hand[d.index], c = CARDS[id];
    if (!c) { closeDialog(); return; }
    let options = '', action = { type: 'play', index: d.index };
    if (c.target) {
      const targets = c.target === 'rival' ? game.players.filter(t => t.id !== 0 && t.alive) : game.institutions.filter(i => i.owner !== null && i.owner !== 0);
      options = `<h3 class="choice-label">${c.target === 'rival' ? '选择一名同僚' : '选择要接管的机构'}</h3><div class="target-options">${targets.map(t => {
        const owner = c.target === 'rival' ? t : game.players[t.owner];
        const selected = d.target === t.id;
        return `<button class="target-option ${selected ? 'selected' : ''}" data-target="${t.id}"><span><strong>${t.name}</strong><small>${c.target === 'rival' ? '宠幸 ' + t.favor + ' · 忠诚 ' + t.loyalty : owner.name + '控制 · ' + t.group + '系统'}${owner.shield ? ' · 有挡箭牌' : ''}</small></span>${icon(selected ? 'check' : c.target === 'rival' ? 'eye' : 'building')}</button>`;
      }).join('') || '<p class="muted">当前没有可选择的目标。</p>'}</div>`;
      action = { ...action, ...(c.target === 'rival' ? { target: d.target } : { institution: d.target }) };
    }
    modal.innerHTML = `${dialogHeader(c.name, '你的手牌 · 消耗 1 次行动')}<div class="card-dialog-layout">${cardView(id, d.index, true, true)}<div class="card-dialog-controls"><p class="dialog-intro">${c.text}</p>${options}${confirmation(action, `打出卡牌 · ${c.cost} 影响力`)}</div></div>`;
  } else if (d.kind === 'institution') {
    const i = game.institutions.find(i => i.id === d.id);
    const action = { type: i.owner === 0 ? 'relinquish' : 'appoint', institution: i.id };
    modal.innerHTML = `${dialogHeader(i.name, i.group + '系统 · 机构档案')}<div class="institution-dialog-symbol ${i.color}">${icon(i.icon)}</div><p class="dialog-intro">${i.subtitle}。</p><div class="rule-note">持有后，从下一轮开始每轮提供 1 影响力。同系统两处机构组成一组，再获得 1 影响力。每人最多控制 3 处。</div>${i.owner === 0 ? '<p>主动交出这个机构，立即获得 9 宠幸；本轮影响力峰值保持不变。</p>' : i.owner !== null ? '<p>现任负责人：<strong>' + game.players[i.owner].name + '</strong>。需要打出「人事调动」才能接管。</p>' : '<p>任命费用：<strong>5 影响力 + 1 次行动</strong>。</p>'}${i.owner === null || i.owner === 0 ? confirmation(action, i.owner === 0 ? '主动交权 · 宠幸 +9' : '接受任命 · 影响力 −5') : '<button class="button secondary wide" data-menu="close">关闭档案</button>'}`;
  } else if (d.kind === 'confess') {
    modal.innerHTML = `${dialogHeader('公开检讨')}<blockquote class="large-quote">“组织从未怀疑你的忠诚。组织只是决定重新核实。”</blockquote><p>消耗 <strong>10 忠诚</strong>，换取 <strong>5 宠幸</strong>，占用 <strong>1 次行动</strong>。忠诚降低会影响未来收入。</p>${confirmation({ type: 'confess' }, '提交检讨')}`;
  } else if (d.kind === 'discard') {
    const excess = p.hand.length - 7;
    modal.innerHTML = `${dialogHeader('归档多余文件', '结束行动 · 手牌上限 7 张')}<p>还需弃置 <strong>${excess}</strong> 张牌。不消耗行动，点击下方卡牌直接弃置。</p><div class="discard-options">${p.hand.map((id, index) => `<button class="target-option" data-discard="${index}"><span><strong>${CARDS[id].name}</strong><small>${CARDS[id].text}</small></span><b>${CARDS[id].cost}</b></button>`).join('')}</div>`;
  } else if (d.kind === 'new') {
    modal.innerHTML = `${dialogHeader('召开新会议')}<p>开始新的一局将替换当前浏览器中的对局进度。</p><label class="input-label" for="seed-input">会议编号 <small>同编号与相同行动可重现对局</small></label><input id="seed-input" maxlength="80" value="CHAIR-${Date.now().toString(36).toUpperCase()}" autocomplete="off"><div class="new-game-summary"><span>1 位玩家 + 3 位电脑</span><span>12 轮</span><span>最高宠幸获胜</span></div><button class="button gold-button wide" data-menu="start">开始会议 ${icon('arrow')}</button>`;
  } else if (d.kind === 'ending') {
    const won = game.winners.includes(0), ranking = [...game.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.favor - a.favor || b.loyalty - a.loyalty);
    modal.innerHTML = `${dialogHeader('最终任命书', '最高委员会 · 全票通过')}<div class="ending-emblem">${icon('chair')}</div><h3 class="ending-title">${won ? '第二把椅子，属于你。' : game.winners.length ? game.winners.map(id => game.players[id].name).join('与') + '获任继承人。' : '元首，独自获胜。'}</h3><p class="ending-quote">${won ? '你开始练习，如何显得对此毫无准备。' : game.winners.length ? '会议记录显示，你对此表示了热烈祝贺。' : '本届干部选拔取得圆满成功。没有人提出异议。'}</p><div class="ending-ranking">${ranking.map((t, index) => `<div class="${game.winners.includes(t.id) ? 'winner' : ''}"><span>${index + 1}</span><strong>${t.name}${t.id === 0 ? ' · 玩家' : ''}</strong><span>${t.alive ? '宠幸 ' + t.favor + ' / 忠诚 ' + t.loyalty : '已被清洗'}</span></div>`).join('')}</div><p class="muted">已结清全部表忠债务并执行终局审查。宠幸同分时比较忠诚。</p><button class="button gold-button wide" data-menu="new">再开一场会议 ${icon('refresh')}</button>`;
  } else if (d.kind === 'log') {
    modal.innerHTML = `${dialogHeader('会议记录', '按时间倒序 · 所有数值变动均有据可查')}<div class="full-log">${game.log.slice().reverse().map(l => `<div class="log-entry ${l.kind}"><span class="log-round">${String(l.round).padStart(2, '0')}</span><p>${escape(l.text)}</p></div>`).join('')}</div>`;
  } else {
    modal.innerHTML = `${dialogHeader('如何坐上第二把椅子', '玩法说明 · 原型规则 v0.1')}<div class="rules-intro">忠诚换取权力。权力购买机会。<br><strong>但元首，不喜欢太有能力的人。</strong></div><div class="rules-columns"><section><h3>01 / 你的目标</h3><p>与 3 名电脑竞争 12 轮。存活者中宠幸最高者获胜；同分看忠诚，再相同则并列。所有人被清洗则元首独自获胜。</p><h3>02 / 每轮做什么</h3><p>公开事件 → 全员收入 → 轮换顺序行动 → 轮末猜忌与衰减。你的行动开始时摸 2 张牌，可以执行 2 次行动，结束时弃至 7 张。</p><p>出牌、任命机构、交权、公开检讨各占 1 次行动。可以提前结束行动。点击卡牌或机构选择目标并确认。</p><h3>03 / 三项数值</h3><p><b>忠诚</b>决定收入，每轮结束下降 5。<b>影响力</b>支付费用，上限 30。<b>宠幸</b>决定生死与胜负，上限 100。</p><div class="rule-note">每轮收入 = 2 + ⌊忠诚 ÷ 20⌋ + 机构数 + 完整机构组数。</div></section><section><h3>04 / 树大招风</h3><p>记录本轮影响力最高值，花掉影响力也不会抹去记录。轮末宠幸固定下降 3，再加上峰值带来的猜忌。</p><div class="rule-note">猜忌 = ⌈max(0, 峰值 − 12) ÷ 3⌉。例如峰值 19，轮末共损失 6 宠幸。</div><h3>05 / 清洗与自救</h3><p>宠幸低于 20 进入调查。获得一次完整行动机会后，仍未恢复至 20 就被清洗。轮末事件不会跳过宽限期。</p><p>公开检讨消耗 10 忠诚，获得 5 宠幸；交出机构获得 9 宠幸。第 12 轮结束必须清偿全部延迟债务；宠幸仍低于 20 者无法继承。</p><h3>06 / 机构与防护</h3><p>无主机构可用 5 影响力任命，下轮才开始收入；同系统成套额外 +1。每人最多 3 处。「挡箭牌」防 1 次定向政治攻击，下一轮开始过期。</p></section></div><details class="card-catalog"><summary>查看全部 16 种行动牌</summary><div class="catalog-grid">${Object.entries(CARDS).map(([id, c]) => `<div><strong>${icon(c.icon)}${c.name}<b>${c.cost}</b></strong><p>${c.text}</p></div>`).join('')}</div></details><p class="muted">电脑与玩家使用相同规则，不读取对手手牌。进度保存在当前浏览器；刷新可以继续。本作人物、国家和机构均属虚构。</p>`;
  }
}

function takeAction(action, showToast = true) {
  const previous = game;
  const result = dispatch(game, { ...action, actor: game.active });
  if (!result.ok) { notify(result.error); return false; }
  game = result.state; saveGame();
  if (showToast && previous.active === 0) {
    const label = action.type === 'play' ? CARDS[previous.players[0].hand[action.index]].name : { appoint: '接受任命', confess: '公开检讨', relinquish: '主动交权', discard: '文件已归档', end: '行动结束' }[action.type];
    if (label) notify(label + (action.type === 'end' ? '，会议继续。' : ' · 已记录在案'));
  }
  render(); scheduleAI(); return true;
}
function scheduleAI() {
  clearTimeout(aiTimer);
  if (game.finished || game.active === 0 || modal.open) return;
  aiTimer = setTimeout(() => {
    const action = chooseAction(observation(game));
    if (!action || !takeAction(action, false)) notify('电脑无法继续行动，请保留当前会议编号用于排查。');
  }, fast ? 180 : 850);
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.menu) {
    const menu = button.dataset.menu;
    if (menu === 'close') closeDialog();
    else if (menu === 'speed') { fast = !fast; render(); scheduleAI(); }
    else if (menu === 'end') {
      if (game.players[0].hand.length > 7) openDialog({ kind: 'discard' });
      else takeAction({ type: 'end' });
    } else if (menu === 'start') {
      const seed = document.querySelector('#seed-input').value.trim() || 'CHAIR-0001';
      clearTimeout(aiTimer); closeDialog(); game = createGame(seed); endingShown = false; saveGame(); render(); scheduleAI(); notify('新会议开始。请谨慎选择你的第一句话。');
    } else openDialog({ kind: menu });
  } else if (button.dataset.card !== undefined) openDialog({ kind: 'card', index: Number(button.dataset.card) });
  else if (button.dataset.institution) openDialog({ kind: 'institution', id: button.dataset.institution });
  else if (button.dataset.target !== undefined) {
    const target = button.dataset.target;
    dialogState.target = CARDS[game.players[0].hand[dialogState.index]].target === 'rival' ? Number(target) : target;
    drawDialog();
  } else if (button.dataset.confirm) {
    const action = JSON.parse(button.dataset.confirm);
    if (!isHumanTurn()) { notify('现在不是你的行动机会。'); return; }
    closeDialog(); takeAction(action);
  } else if (button.dataset.discard !== undefined) {
    if (!isHumanTurn()) return;
    takeAction({ type: 'discard', index: Number(button.dataset.discard) });
    if (game.players[0].hand.length <= 7) { closeDialog(); takeAction({ type: 'end' }); }
    else drawDialog();
  }
});
modal.addEventListener('close', () => { dialogState = null; scheduleAI(); });
modal.addEventListener('click', event => { if (event.target === modal) closeDialog(); });
window.addEventListener('pagehide', () => saveGame());
render(); scheduleAI();
if (storageIssue) notify(storageIssue);
else if (loaded) notify('已恢复上次会议。记录员什么也没忘记。');
else { saveGame(); notify('会议已开始。点击手牌出牌，或点击机构接受任命。'); }
