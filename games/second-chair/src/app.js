import { CARDS, EVENTS, RULES, cardCostText } from './data.js';
import { createGame, dispatch, actionError, legalActions, owned, sets, nextIncome, forecast, observation, upgradeState, decisionActor } from './engine.js';
import { previewAction } from './preview.js';
import { chooseAction } from './ai.js';
import { icon, portrait } from './icons.js';
import { GUIDE_KEY, CONCEPTS, readGuide, teachingAction, contextLesson, investigationDeadline } from './onboarding.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const SAVE_KEY = 'second-chair:v2';
let storageIssue = '', loaded = false, aiTimer, toastTimer, fast = false, dialogState = null, endingShown = false;
let game = loadGame();
let guide = loadGuide();

function escape(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function json(value) { return escape(JSON.stringify(value)); }
function loadGame() {
  try {
    const saved = localStorage.getItem(SAVE_KEY) || localStorage.getItem('second-chair:v1');
    if (saved) { const state = upgradeState(JSON.parse(saved)); loaded = true; return state; }
  } catch { storageIssue = '上次存档无法读取，已准备新会议。'; }
  return createGame('CHAIR-0001');
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); storageIssue = ''; }
  catch { storageIssue = '浏览器未允许保存；当前仍可正常游玩。'; }
}
function loadGuide() {
  try { return readGuide(localStorage.getItem(GUIDE_KEY)); }
  catch { return readGuide(null); }
}
function saveGuide() {
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guide)); }
  catch { notify('本次引导可继续；浏览器未允许保存引导进度。'); }
}
function concepts() {
  return `<div class="concept-grid">${Object.values(CONCEPTS).map(c => `<section class="concept ${c.color}"><span>${icon(c.icon)}${c.name}</span><h3>${c.role}</h3><p>${c.text}</p></section>`).join('')}</div>`;
}
function conceptFlow() {
  return '<div class="concept-flow" aria-label="资源关系">忠诚提高收入 <span>→</span> 获得影响力 <span>→</span> 打牌、经营机构 <span>→</span> 争取宠幸</div><p class="muted">权势也会招来猜忌：影响力不是越多越好，记得看右侧“元首的目光”。</p>';
}
function guidedCard(index) {
  const action = guide.enabled && guide.coach === 'card' ? teachingAction(game) : null;
  return action?.type === 'play' && action.index === index;
}
function coachPanel() {
  if (!guide.enabled || guide.coach === 'done' || game.finished || !game.players[0].alive) return '';
  const p = game.players[0], action = teachingAction(game);
  let title, text, button = '';
  if (guide.coach === 'stats') {
    title = '先看你的三项数值';
    text = `宠幸 ${p.favor} 是你争夺席位的分数；影响力 ${p.influence} 是可花的预算；忠诚 ${p.loyalty} 帮你领收入。数字上方的名称都可以点击解释。会议已暂停，读完再继续。`;
    button = '<button class="button gold-button" data-guide="stats">我看懂了，选一张牌 ' + icon('arrow') + '</button>';
  } else if (!isHumanTurn()) {
    title = '同僚先行动，随后轮到你';
    text = '先手由会议编号决定。等你的行动开始，会标出一张当前可用的牌；你也可以自行选择。';
  } else if (guide.coach === 'card' && action?.type === 'play') {
    title = `试着查看「${CARDS[p.hand[action.index]].name}」`;
    text = '点击金色边框的手牌，先读效果，再看“执行后预览”。普通牌占 1 次行动；机密档案不占行动，挡箭牌在受袭时使用。你也可以选择其他牌。';
  } else if (guide.coach === 'card' && action?.type === 'appoint') {
    title = '暂时没有能打的牌，可以经营机构';
    text = '点击一个无主机构，查看任命的费用与下一轮收入。也可以直接结束行动。';
  } else if (guide.coach === 'card' && action?.type === 'confess') {
    title = '暂时没有能打的牌，可以公开检讨';
    text = '点击下方“公开检讨”，查看用忠诚换取宠幸的代价。也可以直接结束行动。';
  } else {
    title = game.actions ? '你已完成一次行动' : '本次行动已用完';
    text = `现在剩余 ${game.actions} 次行动。${game.actions ? '还可以继续打牌、经营机构，也可以提前结束。' : ''}准备好后点击“结束行动”，让会议继续；全部官员行动结束，才统一结算这一轮。`;
  }
  return `<section class="coach-panel" id="coach-panel" tabindex="-1" aria-label="操作引导"><div><span class="eyebrow">专员入职手册 · ${guide.coach === 'stats' ? '认数值' : guide.coach === 'card' ? '做一次行动' : '结束与结算'}</span><h2>${title}</h2><p>${text}</p></div><div class="coach-actions">${button}<button class="text-button" data-guide="stop">隐藏操作提示</button></div></section>`;
}
function focusCoach() {
  const panel = document.querySelector('#coach-panel');
  panel?.scrollIntoView({ block: 'center' }); panel?.focus({ preventScroll: true });
}
function finishIntro(enabled) {
  guide = { introDone: true, enabled, coach: enabled && !game.finished && game.players[0].alive ? 'stats' : 'done', seen: {} };
  saveGuide(); modal.close(); render(); focusCoach(); maybeContext(); scheduleAI();
}
function maybeContext() {
  if (modal.open || game.phase === 'reaction') return;
  const lesson = contextLesson(game, guide);
  if (lesson) { guide.seen[lesson] = true; saveGuide(); openDialog({ kind: 'lesson', lesson }); }
}
function endHumanTurn() {
  if (!isHumanTurn()) return;
  if (game.players[0].hand.length > RULES.handLimit) openDialog({ kind: 'discard' });
  else takeAction({ type: 'end' });
}
function notify(message) {
  clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3800);
}
function isHumanTurn() { return !game.finished && game.phase === 'turn' && game.active === 0; }
function isHumanResponse() { return !game.finished && game.phase === 'reaction' && decisionActor(game) === 0; }
function badge(p) {
  if (!p.alive) return '<span class="tag danger">已被清洗</span>';
  if (p.investigation) return '<span class="tag danger">接受调查</span>';
  if (game.phase === 'reaction' && decisionActor(game) === p.id) return '<span class="tag active">正在回应</span>';
  if (game.active === p.id) return '<span class="tag active">正在行动</span>';
  return `<span class="tag">${escape(p.tag)}</span>`;
}
function stats(p, compact = false) {
  return `<div class="stats ${compact ? 'compact' : ''}">${[
    ['loyalty', '忠诚', 'shield', 'blue', 100], ['influence', '影响力', 'spark', 'gold', 30], ['favor', '宠幸', 'crown', 'red', 100],
  ].map(([key, label, symbol, color, max]) => `<div class="stat ${color}">${compact ? `<span class="stat-label">${icon(symbol)}${label}</span>` : `<button class="stat-label stat-help" data-stat="${key}" aria-label="了解${label}">${icon(symbol)}${label}<small>?</small></button>`}<strong>${p[key]}<small> / ${max}</small></strong><span class="stat-track"><i style="width:${p[key] / max * 100}%"></i></span></div>`).join('')}</div>`;
}
function official(p) {
  return `<article class="official ${p.color} ${game.active === p.id ? 'current' : ''} ${!p.alive ? 'purged' : ''}">
    <div class="official-top"><div class="portrait-frame ${p.color}">${portrait(p.id)}</div><div class="official-identity"><div class="official-title"><h3>${p.name}</h3>${badge(p)}</div><p>${p.title}</p></div></div>
    ${stats(p, true)}<div class="official-bottom"><span>${icon('building')}${owned(game, p.id).length} 处机构</span><span>${icon('file')}${p.hand.length} 张手牌</span><span title="已扣轮末 5 忠诚，未计后续事件与其他行动">${p.shield ? icon('shield') + '已部署防护' : game.round === 12 ? '闭幕前不再发收入' : '下轮预计 +' + nextIncome(game, p.id)}</span></div>
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
  const heldResponse = id === 'shield' && game.players[0].alive && game.players[0].influence >= card.cost;
  return `<${tag} class="hand-card ${card.color} ${large ? 'large' : ''} ${!large && !readOnly && guidedCard(index) ? 'guide-highlight' : ''} ${!playable && !heldResponse && !large && !readOnly ? 'unavailable' : ''}" ${readOnly ? '' : `data-card="${index}" aria-label="查看手牌 ${card.name}，${cardCostText(id)}"`}>
    <div class="card-top"><span class="card-cost">${card.cost}</span><span class="card-type">${card.type}</span><span class="card-mark">${icon(card.icon)}</span></div>
    <div class="card-illustration"><span class="card-orbit"></span>${icon(card.icon)}</div>
    <div class="card-copy"><h3>${card.name}</h3><span class="card-budget">${card.loyaltyCost ? '另付 ' + card.loyaltyCost + ' 忠诚 · ' : ''}${id === 'shield' ? '受袭时使用 · 不占行动' : card.actions === 0 ? '不占行动 · 每次轮到自己限一张' : '消耗 1 次行动'}</span><p>${card.text}</p></div>
    ${large ? `<div class="card-quote">“${card.quote}”</div>` : '<span class="card-bottom-mark">◆</span>'}
  </${tag}>`;
}
function render() {
  const p = game.players[0], event = EVENTS.find(e => e.id === game.eventId);
  const loss = forecast(p), projected = Math.max(0, p.favor - loss);
  const leader = game.players.filter(p => p.alive).sort((a, b) => b.favor - a.favor || b.loyalty - a.loyalty)[0];
  const activeName = game.active === null ? '' : game.players[decisionActor(game)].name;
  const myTurn = isHumanTurn();
  app.innerHTML = `<div class="shell">
    <header class="topbar"><a class="brand" href="#" aria-label="第二把椅子">${icon('chair')}<span><strong>第二把椅子</strong><small>权力是一场没有朋友的牌局</small></span></a>
    <nav class="top-actions" aria-label="游戏菜单"><span class="session-status"><i></i>${game.finished ? '本次会议已闭幕' : '最高委员会 · 秘密会议'}</span><button class="button subtle" data-menu="guide">${icon('chair')}新手引导</button><button class="button subtle" data-menu="rules">${icon('info')}玩法说明</button><button class="button subtle" data-menu="new">${icon('refresh')}新会议</button></nav></header>
    <div class="meeting-bar"><span class="eyebrow">内部文件 <b>·</b> 阅后不必承认</span><span>${icon('clock')} 第 <strong>${String(game.round).padStart(2, '0')}</strong> / 12 轮</span><span class="save-status">${storageIssue ? escape(storageIssue) : icon('check') + '进度自动保存'}</span></div>
    <div class="layout"><main class="table-area">
      <section class="opponents" aria-label="你的同僚">${game.players.slice(1).map(official).join('')}</section>
      <section class="council" aria-label="继承席位"><div class="council-shade"></div><div class="council-copy"><div class="eyebrow">THE SECOND CHAIR <span>／</span> 继承席位</div><h1>${game.finished ? '名单已经确定。' : '忠诚，是一种表演。'}</h1><p>${game.finished ? '所有决定，均以全票通过。' : '让元首需要你。<br>但不要让他觉得，你可以取代他。'}</p><span class="council-note">${icon('crown')}${leader ? '当前宠幸领先：' + leader.name + ' · ' + leader.favor : '没有合格的继承人'}</span></div><div class="council-stamp"><span>机 密</span><small>仅限与会人员</small></div></section>
      <section class="institutions-section" aria-label="权力机构"><div class="section-title"><h2>${icon('building')}权力版图</h2><span>同系统成套，额外收入 +1 <b>·</b> 任命消耗 1 次行动</span></div><div class="institutions">${game.institutions.map(institutionTile).join('')}</div></section>
      <p class="victory-reminder">${icon('chair')}你的目标：撑过最终审查，在第 12 轮结束时拥有最高宠幸。</p>
      <section class="player-panel ${guide.enabled && guide.coach === 'stats' ? 'guide-highlight' : ''} ${!p.alive ? 'purged' : ''}" aria-label="你的官员状态"><div class="player-name"><span class="your-seal">${icon('seal')}</span><div><h2>你的办公室 ${badge(p)}</h2><p>特别事务专员 <span>／</span> ${owned(game, 0).length} 处机构 · ${sets(game, 0)} 组完整系统</p></div></div>${stats(p)}<div class="income-note" title="已扣轮末 5 忠诚，未计后续事件与其他行动"><span>${game.round === 12 ? '闭幕前不再发收入' : '下轮预计收入'}</span><strong>+${nextIncome(game, 0)} ${icon('spark')}</strong></div></section>
      ${game.migrated ? '<p class="version-note">已沿用旧会议进度，现在使用新版卡牌；既有表忠欠款仍需偿还。</p>' : ''}
      ${coachPanel()}
      <section class="hand-section" aria-label="你的手牌"><div class="section-title"><h2>${icon('file')}手中筹码 <small>${p.hand.length} / 7</small></h2><span>${p.hand.length > 7 ? '<strong class="danger-text">结束前需弃置 ' + (p.hand.length - 7) + ' 张</strong>' : '点击卡牌查看详情并行动'}</span></div><div class="hand-grid">${p.hand.length ? p.hand.map((id, index) => cardView(id, index)).join('') : '<p class="empty-hand">' + (p.alive ? '档案暂时为空。你仍可以经营机构或公开检讨。' : '你的档案已被收走。会议还在继续。') + '</p>'}</div></section>
      <div class="action-bar"><div class="turn-caption"><span class="turn-indicator ${myTurn || isHumanResponse() ? 'yours' : ''}"></span><div><strong>${game.finished ? '会议结束' : isHumanResponse() ? '有人向你发难，请决定如何回应。' : game.phase === 'reaction' ? activeName + '正在回应攻击…' : myTurn ? '轮到你了，专员。' : !p.alive ? '你已被清洗 · 正在观战' : activeName + '正在行动…'}</strong><small>${myTurn ? '剩余 ' + game.actions + ' 次行动；机密档案不占行动。' : game.finished ? '最终任命书已归档。' : '每一次掌声，都有自己的价码。'}</small></div></div><div class="action-buttons">${game.finished ? '<button class="button gold-button" data-menu="ending">查看任命结果 ' + icon('arrow') + '</button>' : `<button class="button secondary" data-menu="confess" ${!myTurn || game.actions === 0 || p.loyalty < 10 ? 'disabled' : ''}>${icon('file')}公开检讨</button><button class="button gold-button" data-menu="end" ${!myTurn ? 'disabled' : ''}>结束行动 <span>${myTurn ? game.actions + '/2' : '等待'}</span>${icon('arrow')}</button>`}</div></div>
    </main><aside class="sidebar">
      <section class="agenda panel"><div class="section-title"><h2>会议议程</h2><span class="tiny-label">第 ${game.round} 轮</span></div><div class="round-progress">${Array.from({ length: 12 }, (_, i) => `<span class="${i + 1 === game.round ? 'now' : i + 1 < game.round ? 'done' : ''}" title="第 ${i + 1} 轮">${i + 1}</span>`).join('')}</div><div class="turn-order">${game.order.map((id, i) => `<span class="${game.active === id ? 'now' : i < game.cursor || !game.players[id].alive ? 'done' : ''}">${game.players[id].name}${game.active === id ? ' ←' : ''}</span>`).join('<i>›</i>')}</div><button class="speed-button" data-menu="speed">${fast ? '恢复正常节奏' : '加快电脑行动'} <span>${fast ? '× 4' : '× 1'}</span></button></section>
      <section class="event-panel panel"><div class="eyebrow">本轮政治风向 <span>／</span> PUBLIC EVENT</div><div class="event-name">${icon(event.icon)}<h2>${event.name}</h2></div><p>${event.text}</p><blockquote>“${event.quote}”</blockquote><span class="file-number">最高委员会通告 / ${String(game.round).padStart(3, '0')}</span></section>
      <section class="risk-panel panel ${projected < 25 || p.investigation ? 'at-risk' : ''}"><div class="section-title"><h2>${icon('eye')}元首的目光</h2><span>${p.investigation ? '正在调查' : projected < 25 ? '保持警惕' : '暂时安全'}</span></div><div class="risk-numbers"><span>本轮权势峰值<strong>${p.peak}<small> / 30</small></strong></span><span>轮末宠幸预计<strong class="${loss > 3 ? 'danger-text' : ''}">−${loss}</strong></span></div><div class="risk-meter"><i style="width:${p.peak / 30 * 100}%"></i><b style="left:40%"></b></div><p>折旧 3 + 猜忌 ${loss - 3} <span>·</span> 当前预计剩余 <b>${projected}</b> 宠幸</p>${p.investigation ? '<div class="investigation-alert">' + icon('eye') + investigationDeadline(game) + '</div>' : '<small class="muted">影响力超过 12 开始引起猜忌。花掉资源不会降低本轮峰值。</small>'}${p.debts.length ? '<div class="investigation-alert">' + icon('clock') + '待偿还表忠代价：' + p.debts.reduce((n, d) => n + d.amount, 0) + ' 宠幸</div>' : ''}</section>
      <section class="minutes panel"><div class="section-title"><h2>会议记录</h2><button class="text-button" data-menu="log">查看全部 ${icon('arrow')}</button></div><div class="log-list">${game.log.slice(-8).reverse().map(l => `<div class="log-entry ${l.kind}"><span class="log-dot"></span><p>${escape(l.text)}</p></div>`).join('')}</div><div class="minutes-foot">记录员已保证，他什么也没听见。</div></section>
      <p class="sidebar-foot">一个虚构政权的黑色喜剧<br>活到最后，不等于赢到最后。</p>
    </aside></div><footer class="footer"><span>所有人都不可替代，直到下一次人事调整。</span><span>会议编号 ${escape(game.seed)} · 牌组 v0.2.0</span></footer>
  </div>`;
  if (guide.enabled && guide.coach === 'end' && myTurn) document.querySelector('[data-menu="end"]')?.classList.add('guide-highlight');
  if (game.finished && !endingShown) { endingShown = true; openDialog({ kind: 'ending' }); }
}

function closeDialog() {
  if (dialogState?.kind === 'reaction' && isHumanResponse()) { notify('请明确选择拦截或承受这次攻击。'); return; }
  if (dialogState?.kind === 'guide') { finishIntro(false); return; }
  modal.close();
}
function openDialog(context) {
  clearTimeout(aiTimer); dialogState = context;
  if (context.kind === 'guide') dialogState.step = context.step || 0;
  if (guide.enabled && ['institution', 'discard'].includes(context.kind) && !guide.seen[context.kind]) {
    dialogState.firstTip = true; guide.seen[context.kind] = true; saveGuide();
  }
  drawDialog();
  if (!modal.open) modal.showModal();
}
function dialogHeader(title, eyebrow = '最高委员会 · 内部档案') {
  return `<div class="dialog-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-menu="close" aria-label="关闭窗口">${icon('close')}</button></div>`;
}
function actionPreview(action) {
  if (!(isHumanTurn() || isHumanResponse())) return '<p class="action-error">请等到你的行动机会。</p>';
  const preview = previewAction(game, action);
  if (preview.error) return `<p class="action-error">${icon('info')}${escape(preview.error)}</p>`;
  const rows = preview.players.map(row => {
    const fields = [['loyalty', '忠诚'], ['influence', '影响力'], ['favor', '宠幸'], ['handCount', '手牌'], ['income', '下轮预计收入']];
    const values = fields.filter(([key]) => row.before[key] !== row.after[key] || (row.id === 0 && ['loyalty', 'influence', 'favor'].includes(key)));
    const review = row.after.investigation ? `仍处于调查，距 20 宠幸还差 ${Math.max(0, 20 - row.after.favor)} 点。` : row.before.investigation ? '宠幸已达到安全线，调查立即解除。' : '';
    return `<section class="preview-player"><strong>${row.id === 0 ? '你' : escape(game.players[row.id].name)}</strong><div class="preview-values">${values.map(([key, label]) => `<span>${label}<b>${row.before[key]} → ${row.after[key]}</b></span>`).join('')}</div>${row.before.peak !== row.after.peak ? `<p>本轮峰值 ${row.before.peak} → ${row.after.peak}；轮末预计损失 ${row.before.loss} → ${row.after.loss} 宠幸</p>` : ''}${review ? `<p class="${row.after.investigation ? 'danger-text' : ''}">${review}</p>` : ''}</section>`;
  }).join('');
  const institutions = preview.institutions.map(i => `<p class="preview-transfer">${icon('building')}${game.institutions.find(t => t.id === i.id).name}：${i.before === null ? '无主' : game.players[i.before].name} → ${i.after === null ? '无主' : game.players[i.after].name}</p>`).join('');
  const cost = preview.cost, own = preview.players.find(p => p.id === 0);
  return `<div class="action-preview"><strong>执行后预览</strong><p class="action-budget">总成本：${cost.influence} 影响力${cost.loyalty ? ' + ' + cost.loyalty + ' 忠诚' : ''} · ${cost.actions ? cost.actions + ' 次行动' : '不占行动'}</p>${rows}${institutions}<p>${action.type === 'respond' ? '原行动者剩余行动保持 ' + preview.actions.after + ' 次' : '你的剩余行动：' + preview.actions.before + ' → ' + preview.actions.after + ' 次'}${own ? ' · 你的轮末预计损失 ' + own.after.loss + ' 宠幸' : ''}</p>${preview.notes.map(n => `<p class="preview-note">${escape(n)}</p>`).join('')}<small class="muted">下轮收入已考虑轮末忠诚 −5；未计后续事件和其他官员行动。</small></div>`;
}
function confirmation(action, label = '执行此行动') {
  const error = !(isHumanTurn() || isHumanResponse()) ? '不是你的行动机会' : actionError(game, action);
  return `${actionPreview(action)}<button class="button gold-button wide" data-confirm="${json(action)}" ${error ? 'disabled' : ''}>${label} ${icon('arrow')}</button>`;
}
function drawDialog() {
  const d = dialogState, p = game.players[0];
  modal.className = ['rules', 'log', 'guide'].includes(d.kind) ? 'wide-dialog' : '';
  if (d.kind === 'reaction') {
    const attack = game.pending, block = d.block !== false;
    const action = { type: 'respond', block };
    modal.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">你的回应 · 不消耗行动</span><h2 id="modal-title">有人把你的名字写进了报告。</h2></div></div><p class="guide-lead">${game.players[attack.actor].name}对你使用了「${CARDS[attack.card].name}」。</p><blockquote class="large-quote">“文件上的签字，恰好不是你的。”</blockquote><div class="response-options"><button class="target-option ${block ? 'selected' : ''}" data-response-choice="block"><span><strong>使用挡箭牌</strong><small>支付 2 影响力，弃置一张挡箭牌，拦截这次攻击。</small></span></button><button class="target-option ${!block ? 'selected' : ''}" data-response-choice="accept"><span><strong>承受本次攻击</strong><small>保留手牌和影响力，承受下方预览中的损失。</small></span></button></div>${confirmation(action, block ? '确认拦截 · 2 影响力 · 不占行动' : '确认承受本次攻击')}<p class="muted">会议在此等待你的决定。刷新后仍可继续选择。</p>`;
  } else if (d.kind === 'guide') {
    const pages = [
      `${dialogHeader('你要争夺的，是第二把椅子。', '专员入职简报 · 1 / 3 · 先明白目标')}<blockquote class="large-quote">“组织不允许野心。组织只接受随时准备接班。”</blockquote><p class="guide-lead">你是一名官员，与三名同僚争权。<strong>十二轮会议结束后，通过最终审查、宠幸最高的人获胜。</strong></p><div class="guide-goal"><span>${icon('chair')}</span><p>积累办事的权力，同时保住元首的信任。<br>权势太大招猜忌，宠幸太低可能遭清洗。</p></div><p class="muted">会议已暂停。先花一分钟弄清楚目标和数值，再完成一次真实行动。</p>`,
      `${dialogHeader('先记住这三件事', '专员入职简报 · 2 / 3 · 认识资源')}${concepts()}${conceptFlow()}`,
      `${dialogHeader('一次行动，先看两笔账', '专员入职简报 · 3 / 3 · 准备动手')}<p class="guide-lead">轮到你时，摸 2 张牌，最多行动 2 次。<strong>影响力是预算，行动次数是本次能办几件事。</strong></p><div class="guide-example"><span class="eyebrow">示例 · 忠诚表态</span><h3>花 2 影响力，占 1 次行动</h3><div><span>影响力 <b>10 → 8</b></span><span>剩余行动 <b>2 → 1</b></span></div><p>立即获得 15 忠诚；随后立刻比较，忠诚最高（含并列）再得 3 宠幸。这只是示例，实际结果会按你的对局预览。</p></div><ol class="guide-steps"><li>点击一张手牌，读效果和费用。</li><li>需要目标时先选同僚或机构，检查数值预览。</li><li>确认出牌；准备好后点击“结束行动”。</li></ol><p class="muted">机构经营、轮末结算、弃牌和调查，会在遇到时解释。右上角随时可重看引导。</p>`,
    ];
    modal.innerHTML = `${pages[d.step]}<div class="guide-footer"><button class="text-button" data-guide="skip">我已了解，直接开始</button><div>${d.step ? '<button class="button secondary" data-guide="back">上一步</button>' : ''}<button class="button gold-button" data-guide="${d.step === 2 ? 'learn' : 'next'}">${d.step === 2 ? '带我完成一次行动' : d.step === 0 ? '认识三项数值' : '看看怎么行动'} ${icon('arrow')}</button></div></div>`;
  } else if (d.kind === 'stat') {
    const c = CONCEPTS[d.key];
    const detail = d.key === 'loyalty' ? `每轮收入 = 2 + ⌊忠诚 ÷ 20⌋ + 机构数 + 完整机构组数。忠诚每轮结束下降 5。已计这次下降、未计未来事件时，你下轮预计收入 ${nextIncome(game, 0)} 影响力；第 12 轮之后不再发收入。` : d.key === 'influence' ? `影响力上限 30。本轮峰值 ${p.peak}，轮末目前预计损失 ${forecast(p)} 宠幸；花掉资源不会降低已记录的峰值。猜忌 = ⌈max(0, 峰值 − 12) ÷ 3⌉，再加固定损失 3。` : `宠幸上限 100；普通轮末至少下降 3。${p.investigation ? investigationDeadline(game) : '低于 20 进入调查，得到完整行动机会后仍未达标会被清洗。'}最终先完成轮末结算和审查，再按宠幸排名；同分比较忠诚。旧会议已有的表忠欠款仍须清偿。`;
    modal.innerHTML = `${dialogHeader(`${c.name}：${c.role}`)}<p class="guide-lead">${c.text}</p><p class="guide-current ${c.color}">你当前的${c.name} <strong>${p[d.key]}</strong></p><details class="rule-detail"><summary>查看具体规则与当前计算</summary><p>${detail}</p></details><button class="button gold-button wide" data-menu="close">明白了</button>`;
  } else if (d.kind === 'lesson') {
    const loss = forecast(p);
    const copy = d.lesson === 'end' ? {
      title: '结束你的行动，会议仍在继续', quote: '“散会之前，请先结清掌声的费用。”',
      text: `${game.actions ? '现在剩余 ' + game.actions + ' 次行动，可以提前结束。' : '本次行动次数已用完。'}所有存活官员都结束后，才统一结算这一轮：每人忠诚 −5，宠幸扣除固定损失与猜忌。`,
      note: `按当前峰值 ${p.peak}，你本轮预计损失 ${loss} 宠幸（固定 3 + 猜忌 ${loss - 3}）。同僚接下来的行动仍可能改变结果。下一轮先发生公共事件，再发收入。`,
    } : d.lesson === 'investigation' ? {
      title: '你被调查了，先保住席位', quote: '“你仍然受到信任，只是需要证明这一点。”',
      text: `你当前只有 ${p.favor} 宠幸，还差 ${Math.max(0, RULES.threshold - p.favor)} 点达到安全线。${investigationDeadline(game)}`,
      note: '优先找增加宠幸的牌；公开检讨用 10 忠诚换 5 宠幸，交出一处机构换 9 宠幸，两者都占 1 次行动。看到预览达标后再确认。',
    } : {
      title: '影响力太高，也是一笔代价', quote: '“元首欣赏能干的人，尤其欣赏他们不太能干的时候。”',
      text: `你的本轮影响力峰值已达到 ${p.peak}，超过 12 开始招来猜忌。轮末目前预计扣 ${loss} 宠幸（固定 3 + 猜忌 ${loss - 3}）。`,
      note: '峰值记录本轮曾经拥有的最高影响力。花掉资源可以办事，但不能抹去这份记录；需要同时用卡牌和行动保住宠幸。',
    };
    modal.innerHTML = `${dialogHeader(copy.title, '遇到再讲 · ' + (d.lesson === 'end' ? '轮末结算' : d.lesson === 'investigation' ? '调查与自救' : '权势与猜忌'))}<blockquote class="large-quote">${copy.quote}</blockquote><p class="guide-lead">${copy.text}</p><div class="rule-note">${copy.note}</div>${d.lesson === 'end' ? '<div class="guide-footer"><button class="button secondary" data-menu="close">返回，继续行动</button><button class="button gold-button" data-guide="end">继续结束行动 ' + icon('arrow') + '</button></div>' : '<button class="button gold-button wide" data-menu="close">明白了，回到会议</button>'}`;
  } else if (d.kind === 'card') {
    const id = p.hand[d.index], c = CARDS[id];
    if (!c) { closeDialog(); return; }
    let options = '', selection = '', action = { type: 'play', index: d.index };
    if (c.selection) {
      selection = `<h3 class="choice-label">${c.selection === 'give' ? '选择要交出的其他手牌' : '选择要弃置的其他手牌'}</h3><div class="hand-choices">${p.hand.map((card, index) => index === d.index ? '' : `<button class="target-option ${d.giveIndex === index ? 'selected' : ''}" data-give-index="${index}"><span><strong>${CARDS[card].name}</strong><small>${CARDS[card].text}</small></span>${icon(d.giveIndex === index ? 'check' : 'file')}</button>`).join('') || '<p class="action-error">你还需要另一张手牌。</p>'}</div>`;
      action.giveIndex = d.giveIndex;
    }
    if (c.target) {
      const targets = c.target === 'rival' ? game.players.filter(t => t.id !== 0 && t.alive) : game.institutions.filter(i => i.owner !== null && i.owner !== 0);
      options = `<h3 class="choice-label">${c.target === 'rival' ? '选择一名同僚' : '选择要接管的机构'}</h3><div class="target-options">${targets.map(t => {
        const owner = c.target === 'rival' ? t : game.players[t.owner];
        const selected = d.target === t.id;
        return `<button class="target-option ${selected ? 'selected' : ''}" data-target="${t.id}"><span><strong>${t.name}</strong><small>${c.target === 'rival' ? '宠幸 ' + t.favor + ' · 忠诚 ' + t.loyalty : owner.name + '控制 · ' + t.group + '系统'}${owner.shield ? ' · 有挡箭牌' : ''}</small></span>${icon(selected ? 'check' : c.target === 'rival' ? 'eye' : 'building')}</button>`;
      }).join('') || '<p class="muted">当前没有可选择的目标。</p>'}</div>`;
      action = { ...action, ...(c.target === 'rival' ? { target: d.target } : { institution: d.target }) };
    }
    modal.innerHTML = `${dialogHeader(c.name, '你的手牌 · ' + cardCostText(id))}<div class="card-dialog-layout">${cardView(id, d.index, true, true)}<div class="card-dialog-controls">${guide.enabled && guide.coach === 'card' ? '<div class="learn-note">先看费用：<b>' + cardCostText(id) + '</b>。下方预览包含双方效果；确认后才真正执行。</div>' : ''}<p class="dialog-intro">${c.text}</p>${selection}${options}${id === 'shield' ? '<div class="rule-note">保留这张牌和至少 2 影响力。受到指定攻击时，会议会暂停，让你决定是否使用。它不抵挡公共事件、轮末衰减或专项摊派。</div>' : confirmation(action, `打出卡牌 · ${cardCostText(id)}`)}</div></div>`;
  } else if (d.kind === 'institution') {
    const i = game.institutions.find(i => i.id === d.id);
    const action = { type: i.owner === 0 ? 'relinquish' : 'appoint', institution: i.id };
    modal.innerHTML = `${dialogHeader(i.name, i.group + '系统 · 机构档案')}${d.firstTip ? '<div class="learn-note"><b>机构就是你的产业。</b>先花预算拿下职位，以后每轮领收入，再用资源打牌争宠。你也能通过卡牌向同僚征收利益或夺取机构。</div>' : ''}<div class="institution-dialog-symbol ${i.color}">${icon(i.icon)}</div><p class="dialog-intro">${i.subtitle}。</p><div class="rule-note">持有后，从下一轮开始每轮提供 1 影响力。同系统两处机构组成一组，再获得 1 影响力。每人最多控制 3 处。</div>${i.owner === 0 ? '<p>主动交出这个机构，立即获得 9 宠幸；本轮影响力峰值保持不变。</p>' : i.owner !== null ? '<p>现任负责人：<strong>' + game.players[i.owner].name + '</strong>。需要打出「人事调动」才能接管。</p>' : '<p>任命费用：<strong>5 影响力 + 1 次行动</strong>。</p>'}${i.owner === null || i.owner === 0 ? confirmation(action, i.owner === 0 ? '主动交权 · 宠幸 +9' : '接受任命 · 影响力 −5') : '<button class="button secondary wide" data-menu="close">关闭档案</button>'}`;
  } else if (d.kind === 'confess') {
    modal.innerHTML = `${dialogHeader('公开检讨')}<blockquote class="large-quote">“组织从未怀疑你的忠诚。组织只是决定重新核实。”</blockquote><p>消耗 <strong>10 忠诚</strong>，换取 <strong>5 宠幸</strong>，占用 <strong>1 次行动</strong>。忠诚降低会影响未来收入。</p>${confirmation({ type: 'confess' }, '提交检讨')}`;
  } else if (d.kind === 'discard') {
    const excess = p.hand.length - 7;
    modal.innerHTML = `${dialogHeader('归档多余文件', '结束行动 · 手牌上限 7 张')}${d.firstTip ? '<div class="learn-note"><b>手牌可以暂时超过上限。</b>只有结束行动时才必须留到 7 张。弃掉暂时用不上的牌；这不是出牌，不触发效果，也不花行动次数。</div>' : ''}<p>还需弃置 <strong>${excess}</strong> 张牌。不消耗行动，点击下方卡牌直接弃置。弃至 7 张后自动结束行动。</p><div class="discard-options">${p.hand.map((id, index) => `<button class="target-option" data-discard="${index}"><span><strong>${CARDS[id].name}</strong><small>${CARDS[id].text}</small></span><b>${CARDS[id].cost}</b></button>`).join('')}</div>`;
  } else if (d.kind === 'new') {
    modal.innerHTML = `${dialogHeader('召开新会议')}<p>开始新的一局将替换当前浏览器中的对局进度。</p><label class="input-label" for="seed-input">会议编号 <small>同版本、同编号与相同行动可重现对局</small></label><input id="seed-input" maxlength="80" value="CHAIR-${Date.now().toString(36).toUpperCase()}" autocomplete="off"><div class="new-game-summary"><span>1 位玩家 + 3 位电脑</span><span>12 轮</span><span>最高宠幸获胜</span></div><button class="button gold-button wide" data-menu="start">开始会议 ${icon('arrow')}</button>`;
  } else if (d.kind === 'ending') {
    const won = game.winners.includes(0), ranking = [...game.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.favor - a.favor || b.loyalty - a.loyalty);
    modal.innerHTML = `${dialogHeader('最终任命书', '最高委员会 · 全票通过')}<div class="ending-emblem">${icon('chair')}</div><h3 class="ending-title">${won ? '第二把椅子，属于你。' : game.winners.length ? game.winners.map(id => game.players[id].name).join('与') + '获任继承人。' : '元首，独自获胜。'}</h3><p class="ending-quote">${won ? '你开始练习，如何显得对此毫无准备。' : game.winners.length ? '会议记录显示，你对此表示了热烈祝贺。' : '本届干部选拔取得圆满成功。没有人提出异议。'}</p><div class="ending-ranking">${ranking.map((t, index) => `<div class="${game.winners.includes(t.id) ? 'winner' : ''}"><span>${index + 1}</span><strong>${t.name}${t.id === 0 ? ' · 玩家' : ''}</strong><span>${t.alive ? '宠幸 ' + t.favor + ' / 忠诚 ' + t.loyalty : '已被清洗'}</span></div>`).join('')}</div><p class="muted">已完成轮末结算与终局审查。宠幸同分时比较忠诚。</p><button class="button gold-button wide" data-menu="new">再开一场会议 ${icon('refresh')}</button>`;
  } else if (d.kind === 'log') {
    modal.innerHTML = `${dialogHeader('会议记录', '按时间倒序 · 所有数值变动均有据可查')}<div class="full-log">${game.log.slice().reverse().map(l => `<div class="log-entry ${l.kind}"><span class="log-round">${String(l.round).padStart(2, '0')}</span><p>${escape(l.text)}</p></div>`).join('')}</div>`;
  } else {
    modal.innerHTML = `${dialogHeader('如何坐上第二把椅子', '玩法说明 · 先理解目标，再查细节')}<p class="guide-lead">与 3 名电脑竞争 12 轮。<strong>通过最终审查后，宠幸最高的存活者获胜。</strong></p>${concepts()}${conceptFlow()}<section class="rules-basics"><h3>轮到你，现在做什么</h3><ol class="guide-steps"><li>获得 2 张手牌和 2 次行动。点击手牌看效果、费用，必要时选择目标，确认后执行。</li><li>普通牌、任命和公开检讨各占 1 次行动。机密档案不占行动，每次轮到自己限一次；挡箭牌在受袭时选择使用。</li><li>不必用完行动，点击“结束行动”交给下一位。手牌超过 7 张时先选择弃牌。</li></ol></section><details class="rule-detail"><summary>一轮如何结算 · 收入、行动与衰减</summary><p>公开事件 → 全员收入 → 按轮换顺序行动 → 轮末结算。每人行动结束不等于一轮结束；全部存活官员完成后才统一扣除忠诚和宠幸。</p><p>每轮收入 = 2 + ⌊忠诚 ÷ 20⌋ + 机构数 + 完整机构组数。忠诚每轮结束 −5；影响力上限 30，忠诚与宠幸上限 100。</p></details><details class="rule-detail"><summary>为什么权力大了反而失宠 · 峰值与猜忌</summary><p>本轮影响力最高值超过 12 会招来猜忌，花掉影响力也不会抹去峰值。轮末宠幸固定 −3，再扣猜忌。</p><div class="rule-note">猜忌 = ⌈max(0, 峰值 − 12) ÷ 3⌉。例如峰值 19，轮末共损失 6 宠幸。</div></details><details class="rule-detail"><summary>机构如何经营 · 任命、成套、征收与交权</summary><p>无主机构任命花 5 影响力与 1 次行动，从下一轮开始每轮收入 +1。同系统两处成套再 +1，每人最多 3 处。使用「专项摊派」向同僚征收资源，「人事调动」接管对手机构。</p><p>主动交出一处机构获得 9 宠幸，占 1 次行动。「挡箭牌」保留在手中，受袭时可付 2 影响力弃置本牌，拦截一次举报、夺权、栽赃或一致通过，不占行动。公共事件、轮末损失和经济征收不被拦截。</p></details><details class="rule-detail"><summary>宠幸过低怎么自救 · 调查与终局</summary><p>宠幸低于 20 进入调查。获得完整行动机会后，期限结束仍未恢复到 20 就被清洗。调查提示会标明你的实际期限。</p><p>公开检讨消耗 10 忠诚，获得 5 宠幸；交权获得 9 宠幸；也可使用自保或宣传牌。第 12 轮先完成轮末结算，再审查，宠幸低于 20 无法继承。新版「极端表忠」立即支付 20 忠诚换 18 宠幸；旧会议已经产生的欠款仍会在到期或闭幕时清偿。</p><p>最终宠幸相同看忠诚，再同分则并列。所有人被清洗，元首独自获胜。</p></details><details class="card-catalog"><summary>查看全部 16 种卡牌与总费用</summary><div class="catalog-grid">${Object.entries(CARDS).map(([id, c]) => `<div><strong>${icon(c.icon)}${c.name}<b>${c.cost}</b></strong><small class="catalog-cost">${cardCostText(id)}</small><p>${c.text}</p></div>`).join('')}</div></details><p class="muted">电脑与玩家使用相同规则，不读取对手手牌。进度保存在当前浏览器；刷新可以继续。本作人物、国家和机构均属虚构。</p>`;
  }
}

function takeAction(action, showToast = true) {
  const previous = game;
  const result = dispatch(game, { ...action, actor: decisionActor(game) });
  if (!result.ok) { notify(result.error); return false; }
  game = result.state; saveGame();
  if (previous.phase === 'turn' && previous.active === 0 && guide.enabled && guide.coach !== 'done') {
    if (action.type === 'end') guide.coach = 'done';
    else if (['play', 'appoint', 'confess', 'relinquish'].includes(action.type)) guide.coach = 'end';
    saveGuide();
  }
  if (showToast && decisionActor(previous) === 0) {
    const label = action.type === 'play' ? CARDS[previous.players[0].hand[action.index]].name : action.type === 'respond' ? (action.block ? '挡箭牌已拦截攻击' : '已承受本次攻击') : { appoint: '接受任命', confess: '公开检讨', relinquish: '主动交权', discard: '文件已归档', end: '行动结束' }[action.type];
    if (label) notify(label + (action.type === 'end' ? '，会议继续。' : ' · 已记录在案'));
  }
  render(); maybeContext(); scheduleAI(); return true;
}
function aiPaused() { return game.finished || decisionActor(game) === 0 || modal.open || (guide.enabled && guide.coach === 'stats'); }
function scheduleAI() {
  clearTimeout(aiTimer);
  if (isHumanResponse() && !modal.open && !(guide.enabled && guide.coach === 'stats')) { openDialog({ kind: 'reaction' }); return; }
  if (aiPaused()) return;
  aiTimer = setTimeout(() => {
    if (aiPaused()) return;
    const action = chooseAction(observation(game));
    if (!action || !takeAction(action, false)) notify('电脑无法继续行动，请保留当前会议编号用于排查。');
  }, fast ? 180 : 850);
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.guide) {
    const command = button.dataset.guide;
    if (command === 'next' || command === 'back') { dialogState.step += command === 'next' ? 1 : -1; drawDialog(); }
    else if (command === 'skip' || command === 'learn') finishIntro(command === 'learn');
    else if (command === 'stats' || command === 'stop') {
      guide.coach = command === 'stats' ? 'card' : 'done'; saveGuide(); render(); focusCoach(); maybeContext(); scheduleAI();
    } else if (command === 'end') { modal.close(); endHumanTurn(); }
  } else if (button.dataset.stat) openDialog({ kind: 'stat', key: button.dataset.stat });
  else if (button.dataset.menu) {
    const menu = button.dataset.menu;
    if (menu === 'close') closeDialog();
    else if (menu === 'speed') { fast = !fast; render(); scheduleAI(); }
    else if (menu === 'end') {
      if (guide.enabled && !guide.seen.end) { guide.seen.end = true; saveGuide(); openDialog({ kind: 'lesson', lesson: 'end' }); }
      else endHumanTurn();
    } else if (menu === 'start') {
      const seed = document.querySelector('#seed-input').value.trim() || 'CHAIR-0001';
      clearTimeout(aiTimer); closeDialog(); game = createGame(seed); endingShown = false;
      if (guide.enabled && guide.coach !== 'done') { guide.coach = 'stats'; saveGuide(); }
      saveGame(); render(); maybeContext(); scheduleAI(); notify('新会议开始。请谨慎选择你的第一句话。');
    } else openDialog({ kind: menu });
  } else if (button.dataset.card !== undefined) openDialog({ kind: 'card', index: Number(button.dataset.card) });
  else if (button.dataset.institution) openDialog({ kind: 'institution', id: button.dataset.institution });
  else if (button.dataset.giveIndex !== undefined) {
    dialogState.giveIndex = Number(button.dataset.giveIndex); drawDialog();
  } else if (button.dataset.responseChoice) {
    dialogState.block = button.dataset.responseChoice === 'block'; drawDialog();
  } else if (button.dataset.target !== undefined) {
    const target = button.dataset.target;
    dialogState.target = CARDS[game.players[0].hand[dialogState.index]].target === 'rival' ? Number(target) : target;
    drawDialog();
  } else if (button.dataset.confirm) {
    const action = JSON.parse(button.dataset.confirm);
    if (!(action.type === 'respond' ? isHumanResponse() : isHumanTurn())) { notify('现在不是你的行动机会。'); return; }
    modal.close(); takeAction(action);
  } else if (button.dataset.discard !== undefined) {
    if (!isHumanTurn()) return;
    takeAction({ type: 'discard', index: Number(button.dataset.discard) });
    if (game.players[0].hand.length <= 7) { closeDialog(); takeAction({ type: 'end' }); }
    else drawDialog();
  }
});
modal.addEventListener('close', () => { if (!modal.open) { dialogState = null; maybeContext(); scheduleAI(); } });
modal.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
modal.addEventListener('click', event => { if (event.target === modal) closeDialog(); });
window.addEventListener('pagehide', () => saveGame());
render();
if (!guide.introDone && !game.finished) openDialog({ kind: 'guide' });
else { maybeContext(); scheduleAI(); }
if (storageIssue) notify(storageIssue);
else if (loaded) { saveGame(); notify(game.migrated ? '旧会议已恢复，使用新版卡牌；既有表忠欠款仍需偿还。' : '已恢复上次会议。记录员什么也没忘记。'); }
else { saveGame(); if (guide.introDone) notify('会议已开始。点击手牌出牌，或点击机构接受任命。'); }
