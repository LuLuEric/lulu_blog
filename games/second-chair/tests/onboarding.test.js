import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, actionError, observation } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';
import { readGuide, teachingAction, contextLesson, investigationDeadline } from '../src/onboarding.js';

test('missing or damaged guide preferences start the brief without affecting a game save', () => {
  for (const raw of [null, '', '{', 'null', 'false', '[]', '{}']) {
    assert.deepEqual(readGuide(raw), { introDone: false, enabled: false, coach: 'done', seen: {} });
  }
});

test('guide preferences preserve skipping and progress, and reject unknown stages', () => {
  assert.deepEqual(readGuide('{"introDone":true,"enabled":false,"coach":"card"}'), { introDone: true, enabled: false, coach: 'done', seen: {} });
  assert.deepEqual(readGuide('{"introDone":true,"enabled":true,"coach":"card","seen":{"end":true,"investigation":false,"foreign":true}}'), { introDone: true, enabled: true, coach: 'card', seen: { end: true } });
  assert.equal(readGuide('{"introDone":true,"enabled":true,"coach":"broken"}').coach, 'done');
});

test('teaching recommendations are legal, deterministic and never change state or initiative', () => {
  for (let seed = 0; seed < 80; seed++) {
    let game = createGame(`guide-${seed}`);
    const start = structuredClone(game);
    if (game.active !== 0) assert.equal(teachingAction(game), null);
    assert.deepEqual(game, start);
    let steps = 0;
    while (game.active !== 0 && !game.finished && steps++ < 100) game = dispatch(game, chooseAction(observation(game))).state;
    assert.equal(game.active, 0);
    const before = structuredClone(game), action = teachingAction(game);
    assert.ok(action);
    assert.equal(actionError(game, action), null);
    assert.deepEqual(teachingAction(game), action);
    assert.deepEqual(game, before);
  }
});

test('recommendations handle empty hands, no budget, exhausted actions and finished games', () => {
  const game = createGame('CHAIR-0003'), p = game.players[0];
  p.hand = [];
  assert.equal(teachingAction(game).type, 'appoint');
  p.influence = 0;
  assert.equal(teachingAction(game).type, 'confess');
  p.loyalty = 0;
  assert.deepEqual(teachingAction(game), { type: 'end' });
  game.actions = 0;
  assert.deepEqual(teachingAction(game), { type: 'end' });
  game.finished = true;
  assert.equal(teachingAction(game), null);
});

test('danger guidance prioritizes investigation, appears once, and respects skipping', () => {
  const game = createGame('CHAIR-0003');
  const guide = { enabled: true, coach: 'card', seen: {} };
  game.players[0].peak = 15;
  assert.equal(contextLesson(game, guide), 'suspicion');
  game.players[0].favor = 12;
  game.players[0].investigation = { dueTurn: 2 };
  assert.equal(contextLesson(game, guide), 'investigation');
  guide.seen.investigation = true;
  assert.equal(contextLesson(game, guide), 'suspicion');
  guide.seen.suspicion = true;
  assert.equal(contextLesson(game, guide), null);
  guide.seen = {}; guide.coach = 'stats';
  assert.equal(contextLesson(game, guide), null);
  guide.coach = 'card'; guide.enabled = false;
  assert.equal(contextLesson(game, guide), null);
});

test('investigation copy distinguishes the current full turn, next turn and final review', () => {
  const game = createGame('CHAIR-0003'), p = game.players[0];
  assert.equal(investigationDeadline(game), '当前没有调查。');
  p.investigation = { dueTurn: p.turns + 1 };
  assert.match(investigationDeadline(game), /下一次轮到你时/);
  p.investigation.dueTurn = p.turns;
  assert.match(investigationDeadline(game), /本次行动结束前/);
  game.active = 1;
  assert.match(investigationDeadline(game), /下一次轮到你时/);
  game.round = 12;
  assert.match(investigationDeadline(game), /闭幕最终审查不再延后/);
});
