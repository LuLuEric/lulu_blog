import { RULES } from './data.js';
import { legalActions } from './engine.js';

export const GUIDE_KEY = 'second-chair:guide:v1';
export const CONCEPTS = Object.freeze({
  favor: { name: '宠幸', role: '你的胜负与生死', icon: 'crown', color: 'red', text: '元首有多信任你。十二轮结束，通过最终审查后，宠幸最高的人获胜。低于 20 会进入调查，要及时自救。' },
  influence: { name: '影响力', role: '办事用的预算', icon: 'spark', color: 'gold', text: '打牌、任命机构都可能花费影响力。它让你有能力争权；但本轮拥有过的影响力超过 12，就会额外损失宠幸。' },
  loyalty: { name: '忠诚', role: '下轮收入的来源', icon: 'shield', color: 'blue', text: '组织给你的忠诚评价。忠诚越高，每轮领到的影响力越多。它不是元首的私人信任，不能代替宠幸保命。' },
});

export function readGuide(raw) {
  const fresh = { introDone: false, enabled: false, coach: 'done', seen: {} };
  try {
    const value = JSON.parse(raw);
    if (!value || value.introDone !== true) return fresh;
    const enabled = value.enabled === true;
    const coach = enabled && ['stats', 'card', 'end', 'done'].includes(value.coach) ? value.coach : 'done';
    const seen = Object.fromEntries(['institution', 'end', 'discard', 'suspicion', 'investigation'].filter(key => value.seen?.[key] === true).map(key => [key, true]));
    return { introDone: true, enabled, coach, seen };
  } catch { return fresh; }
}

// Only inspect the player's own hand and currently legal choices; never advance the game.
export function teachingAction(game) {
  if (game.finished || game.phase !== 'turn' || game.active !== 0 || !game.players[0].alive) return null;
  const actions = legalActions(game);
  for (const id of ['loyalty', 'alibi', 'propaganda', 'chorus', 'retreat', 'network', 'dossier']) {
    const action = actions.find(a => a.type === 'play' && game.players[0].hand[a.index] === id);
    if (action) return action;
  }
  return actions.find(a => a.type === 'play') || actions.find(a => a.type === 'appoint') || actions.find(a => a.type === 'confess') || actions.find(a => a.type === 'end') || null;
}

export function contextLesson(game, guide) {
  const p = game.players[0];
  if (!guide.enabled || game.finished || !p.alive || guide.coach === 'stats') return null;
  if (p.investigation && !guide.seen.investigation) return 'investigation';
  if (p.peak > 12 && !guide.seen.suspicion) return 'suspicion';
  return null;
}

export function investigationDeadline(game) {
  const p = game.players[0];
  if (!p.investigation) return '当前没有调查。';
  const deadline = game.active === 0 && p.turns >= p.investigation.dueTurn ? '本次行动结束前' : '下一次轮到你时，行动结束前';
  return `须在${deadline}恢复到至少 ${RULES.threshold} 宠幸。${game.round === RULES.rounds ? '本轮就是最后一轮；闭幕最终审查不再延后，必须在闭幕前达标。' : ''}`;
}
