import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, EVENTS } from '../src/data.js';
import { createGame, dispatch, income, observation, owned, forecast, legalActions, validateState } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';

function act(s, a) {
  const result = dispatch(s, a);
  assert.equal(result.ok, true, result.error);
  validateState(result.state);
  return result.state;
}
function fixture() {
  const s = createGame('UNIT-TEST-1');
  for (const p of s.players) {
    Object.assign(p, { loyalty: 40, favor: 50, influence: 20, peak: 20, investigation: null });
    s.deck.push(...p.hand.filter(id => id === 'shield')); p.hand = p.hand.filter(id => id !== 'shield');
  }
  return s;
}
function hand(s, playerId, ids) {
  const p = s.players[playerId];
  s.deck.push(...p.hand); p.hand = [];
  for (const id of ids) {
    const pools = [s.deck, s.discard, ...s.players.filter(t => t.id !== playerId).map(t => t.hand)];
    const pool = pools.find(pool => pool.includes(id));
    assert.ok(pool, `Missing card ${id}`);
    pool.splice(pool.indexOf(id), 1); p.hand.push(id);
  }
}
function end(s) {
  while (s.players[s.active].hand.length > 7) s = act(s, { type: 'discard', index: 0 });
  return act(s, { type: 'end' });
}
function until(s, condition) {
  let guard = 0;
  while (!condition(s) && !s.finished && guard++ < 60) s = end(s);
  assert.ok(condition(s));
  return s;
}

test('initial deck, public content counts and deterministic seed', () => {
  const s = createGame('IDENTICAL');
  assert.equal(Object.keys(CARDS).length, 16); assert.equal(EVENTS.length, 8);
  assert.equal(s.players[s.active].hand.length, 7); assert.equal(s.institutions.length, 6);
  assert.deepEqual(s, createGame('IDENTICAL')); assert.notDeepEqual(s.deck, createGame('OTHER').deck);
  validateState(s);
});

test('invalid actor, index, insufficient funds and unknown operation leave state unchanged', () => {
  const s = fixture(); hand(s, 0, ['transfer']); s.players[0].influence = 0;
  const original = structuredClone(s);
  for (const a of [{ type: 'confess', actor: 2 }, { type: 'play', index: -1 }, { type: 'play', index: 0 }, { type: 'appoint', institution: 'radio' }, { type: 'cheat' }]) {
    const r = dispatch(s, a); assert.equal(r.ok, false); assert.equal(r.state, s); assert.deepEqual(s, original);
  }
});

test('new institution pays no immediate income and exactly once next round', () => {
  let s = fixture();
  s = act(s, { type: 'appoint', institution: 'radio' });
  assert.equal(s.players[0].influence, 15);
  s.eventDeck = ['praise'];
  s = until(s, s => s.round === 2);
  assert.equal(s.players[0].influence, 19);
  assert.equal(income(s, 0), 4);
  assert.equal(s.log.filter(l => l.round === 2 && l.player === 0 && l.text.includes('本轮收入')).length, 1);
});

test('complete institution pair adds only one bonus income; ownership cap enforced', () => {
  let s = fixture();
  for (const i of s.institutions.slice(0, 3)) i.owner = 0;
  assert.equal(income(s, 0), 8);
  assert.equal(dispatch(s, { type: 'appoint', institution: 'academy' }).ok, false);
  hand(s, 0, ['transfer']); s.institutions[3].owner = 1;
  assert.equal(dispatch(s, { type: 'play', index: 0, institution: 'academy' }).ok, false);
});

test('spending and relinquishing never erase the influence peak', () => {
  let s = fixture(); s.players[0].influence = 19; s.players[0].peak = 19;
  s = act(s, { type: 'appoint', institution: 'radio' });
  assert.equal(s.players[0].peak, 19); assert.equal(forecast(s.players[0]), 8);
  s = act(s, { type: 'relinquish', institution: 'radio' });
  assert.equal(s.players[0].peak, 19); assert.equal(s.players[0].favor, 59);
});

test('new resources update peak even when immediately spent', () => {
  let s = fixture(); hand(s, 0, ['network', 'loyalty']);
  s.players[0].influence = 10; s.players[0].peak = 10;
  s = act(s, { type: 'play', index: 0 }); assert.equal(s.players[0].peak, 15);
  s = act(s, { type: 'play', index: 0 }); assert.equal(s.players[0].influence, 13); assert.equal(s.players[0].peak, 15);
  assert.equal(dispatch(s, { type: 'confess' }).ok, false);
});

test('opponent attack grants a full turn before purge and rescue clears review', () => {
  let s = fixture(); hand(s, 0, ['denounce']); s.players[1].favor = 25;
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.players[1].favor, 15); assert.equal(s.players[1].investigation.dueTurn, 1); assert.equal(s.players[1].alive, true);
  s = end(s); assert.equal(s.active, 1);
  s = act(s, { type: 'confess' }); assert.equal(s.players[1].favor, 20); assert.equal(s.players[1].investigation, null);
  s = end(s); assert.equal(s.players[1].alive, true);
});

test('unrescued review purges exactly at deadline and releases cards and institutions', () => {
  let s = fixture(); hand(s, 0, ['denounce']); s.players[1].favor = 25; s.institutions[0].owner = 1;
  s = act(s, { type: 'play', index: 0, target: 1 }); s = end(s); s = end(s);
  assert.equal(s.players[1].alive, false); assert.equal(s.players[1].hand.length, 0); assert.equal(s.institutions[0].owner, null);
});

test('review born during own action expires after next full turn, not this one', () => {
  let s = fixture(); hand(s, 0, ['denounce']); s.players[0].favor = 21; s.players[1].shield = true;
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.players[0].investigation.dueTurn, 2);
  s = end(s); assert.equal(s.players[0].alive, true);
  s = until(s, s => s.active === 0);
  assert.equal(s.players[0].turns, 2);
  s = end(s); assert.equal(s.players[0].alive, false);
});

test('legacy deployed shield blocks one hostile effect then is consumed', () => {
  let s = fixture(); hand(s, 0, ['denounce', 'frame']); s.players[1].shield = true;
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.players[1].favor, 50); assert.equal(s.players[0].favor, 46); assert.equal(s.players[1].shield, false);
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.players[1].favor, 43); assert.equal(s.players[1].loyalty, 25);
});

test('legacy deployed shield expires at next round and takeover respects defense', () => {
  let s = fixture(); hand(s, 0, ['transfer']); s.players[1].shield = true; s.institutions[0].owner = 1;
  s = act(s, { type: 'play', index: 0, institution: 'radio' }); assert.equal(s.institutions[0].owner, 1);
  s.players[2].shield = true; s = until(s, s => s.round === 2); assert.equal(s.players[2].shield, false);
});

test('trade charges exact cost, preserves exchanged hand sizes and resource transfer', () => {
  let s = fixture(); hand(s, 0, ['trade', 'loyalty']); hand(s, 1, ['alibi']);
  s = act(s, { type: 'play', index: 0, target: 1, giveIndex: 1 });
  assert.equal(s.players[0].influence, 17); assert.equal(s.players[1].influence, 22);
  assert.deepEqual(s.players[0].hand, ['alibi']); assert.deepEqual(s.players[1].hand, ['loyalty']);
  assert.equal(s.players[0].favor, 55);
});

test('trade rejects missing second card and target without capacity before mutation', () => {
  const s = fixture(); hand(s, 0, ['trade']);
  assert.equal(dispatch(s, { type: 'play', index: 0, target: 1 }).ok, false);
  hand(s, 0, ['trade', 'loyalty']); s.players[1].influence = 29; s.players[1].peak = 29;
  assert.equal(dispatch(s, { type: 'play', index: 0, target: 1, giveIndex: 1 }).ok, false);
});

test('levy conserves transfer at the influence cap', () => {
  let s = fixture(); hand(s, 0, ['levy']); s.players[0].influence = 29; s.players[0].peak = 29;
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.players[0].influence, 30); assert.equal(s.players[1].influence, 16);
});

test('draw and discard respect hand limit and action count', () => {
  let s = fixture(); hand(s, 0, ['dossier', 'loyalty', 'loyalty', 'network', 'alibi', 'frame', 'shield', 'trade', 'retreat']);
  s = act(s, { type: 'play', index: 0, giveIndex: 3 }); assert.equal(s.players[0].hand.length, 9);
  assert.equal(dispatch(s, { type: 'end' }).ok, false);
  s = act(s, { type: 'discard', index: 0 }); s = act(s, { type: 'discard', index: 0 });
  assert.equal(s.actions, 2); assert.equal(dispatch(s, { type: 'discard', index: 0 }).ok, false);
  s = end(s); assert.equal(s.active, 1);
});

test('legacy extreme debt is paid before next turn and grants rescue opportunity', () => {
  let s = fixture(); s.players[0].favor = 43; s.players[0].debts = [{ dueTurn: 2, amount: 12 }];
  s.eventDeck = ['praise']; s = end(s); s = until(s, s => s.active === 0);
  assert.equal(s.players[0].debts.length, 0);
  assert.ok(s.log.some(l => l.text.includes('偿还极端表忠') && l.player === 0));
  assert.equal(s.actions, 2);
});

test('last round pays legacy deferred debt before ranking and purges ineligible candidates', () => {
  let s = fixture(); s.round = 12; s.order = [1, 2, 3, 0]; s.cursor = 3;
  s.players[0].favor = 30; s.players[0].debts = [{ dueTurn: 2, amount: 12 }];
  s = end(s);
  assert.equal(s.finished, true); assert.equal(s.players[0].alive, false); assert.equal(s.players[0].debts.length, 0);
  assert.ok(!s.winners.includes(0));
});

test('identical favor and loyalty produce shared victory; all purged yields no winner', () => {
  let s = fixture(); s.round = 12; s.order = [1, 2, 3, 0]; s.cursor = 3;
  s = end(s); assert.deepEqual(s.winners, [0, 1, 2, 3]);
  let failed = fixture(); failed.round = 12; failed.order = [1, 2, 3, 0]; failed.cursor = 3;
  for (const p of failed.players) p.favor = 21;
  failed = end(failed); assert.deepEqual(failed.winners, []); assert.ok(failed.players.every(p => !p.alive));
});

test('turn order rotates and hidden data is absent from AI observation', () => {
  let s = fixture(); const view = observation(s);
  assert.ok(Array.isArray(view.players[0].hand));
  for (const p of view.players.slice(1)) assert.equal(Object.hasOwn(p, 'hand'), false);
  for (const key of ['deck', 'discard', 'rng', 'seed', 'eventDeck']) assert.equal(Object.hasOwn(view, key), false);
  s = until(s, s => s.round === 2); assert.deepEqual(s.order, [1, 2, 3, 0]);
});

test('all legal actions in a starting position are accepted', () => {
  const s = fixture();
  for (const a of legalActions(s)) act(s, a);
});

test('100 seeded full AI games obey invariants, conserve cards and terminate', () => {
  for (let i = 0; i < 100; i++) {
    let s = createGame(`REGRESSION-${i}`), steps = 0;
    while (!s.finished) {
      assert.ok(steps++ < 600, `Game ${i} did not terminate`);
      s = act(s, chooseAction(observation(s)));
    }
    assert.ok(s.round <= 12);
    assert.ok(s.winners.every(id => s.players[id].alive && s.players[id].favor >= 20));
  }
});

test('recorded actions replay exactly including RNG, logs and ending', () => {
  let s = createGame('REPLAY');
  while (!s.finished) s = act(s, chooseAction(observation(s)));
  let replay = createGame(s.seed);
  for (const action of s.history) replay = act(replay, action);
  assert.deepEqual(replay, s);
});

test('seeded first seat varies and long seed normalization preserves replay', () => {
  const seats = new Set(Array.from({ length: 32 }, (_, i) => createGame(`SEAT-${i}`).active));
  assert.equal(seats.size, 4);
  const long = createGame('x'.repeat(120));
  assert.deepEqual(long, createGame(long.seed));
});

test('saved state rejects corrupted cards, versions and active player', () => {
  const s = fixture(); validateState(JSON.parse(JSON.stringify(s)));
  const card = structuredClone(s); card.deck.push('network'); assert.throws(() => validateState(card));
  const version = structuredClone(s); version.version = 999; assert.throws(() => validateState(version));
  const turn = structuredClone(s); turn.active = 9; assert.throws(() => validateState(turn));
});

test('empty draw pile recycles discards but keeps the resolving dossier out until complete', () => {
  let s = fixture(); hand(s, 0, ['dossier', 'network']);
  s.discard.push(...s.deck); s.deck = [];
  s = act(s, { type: 'play', index: 0, giveIndex: 1 });
  assert.equal(s.players[0].hand.length, 2);
  assert.deepEqual(s.discard, ['network', 'dossier']);
  assert.ok(s.log.some(l => l.text.includes('弃牌堆已洗回牌库')));
});
