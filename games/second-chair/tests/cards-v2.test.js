import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, validateState, observation, legalActions, decisionActor, upgradeState, nextIncome } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';
import { previewAction } from '../src/preview.js';

function fixture() {
  const s = createGame('UNIT-TEST-1');
  for (const p of s.players) {
    Object.assign(p, { loyalty: 40, favor: 50, influence: 20, peak: 20, investigation: null });
    s.deck.push(...p.hand); p.hand = [];
  }
  return s;
}
function hand(s, player, ids) {
  const p = s.players[player]; s.deck.push(...p.hand); p.hand = [];
  for (const id of ids) {
    const pool = [s.deck, s.discard, ...s.players.filter(t => t.id !== player).map(t => t.hand)].find(pool => pool.includes(id));
    assert.ok(pool, `Missing ${id}`); pool.splice(pool.indexOf(id), 1); p.hand.push(id);
  }
}
function act(s, a) {
  const r = dispatch(s, a); assert.equal(r.ok, true, r.error); validateState(r.state); return r.state;
}
function reject(s, a) {
  const before = structuredClone(s), r = dispatch(s, a);
  assert.equal(r.ok, false); assert.deepEqual(s, before); assert.equal(r.state, s);
}

test('loyalty pays its tied-leading bonus immediately, without issuing income', () => {
  let s = fixture(); hand(s, 0, ['loyalty']); s.players[1].loyalty = 55;
  s = act(s, { type: 'play', index: 0 });
  assert.equal(s.round, 1); assert.equal(s.actions, 1);
  assert.equal(s.players[0].loyalty, 55); assert.equal(s.players[0].favor, 53); assert.equal(s.players[0].influence, 18);
});

test('a hand shield is a response only; the defender owns the pending decision', () => {
  let s = fixture(); hand(s, 0, ['denounce', 'shield']); hand(s, 1, ['shield']);
  reject(s, { type: 'play', index: 1 });
  s = act(s, { type: 'play', index: 0, target: 1 });
  assert.equal(s.phase, 'reaction'); assert.equal(s.active, 0); assert.equal(decisionActor(s), 1);
  assert.equal(s.actions, 1); assert.equal(s.players[0].influence, 16); assert.equal(s.players[1].favor, 50);
  for (const a of [{ type: 'end' }, { type: 'respond', block: true, actor: 0 }, { type: 'respond', block: 1 }, { type: 'confess' }]) reject(s, a);
  const view = observation(s);
  assert.deepEqual(view.players[1].hand, ['shield']); assert.equal(Object.hasOwn(view.players[0], 'hand'), false);
  assert.deepEqual(view.legal.map(a => a.type), ['respond', 'respond']);
  s = act(s, { type: 'respond', block: true, actor: 1 });
  assert.equal(s.phase, 'turn'); assert.equal(s.pending, null); assert.equal(s.actions, 1);
  assert.equal(s.players[1].influence, 18); assert.equal(s.players[1].hand.length, 0);
  assert.equal(s.players[0].favor, 46); assert.equal(s.players[1].favor, 50);
  reject(s, { type: 'respond', block: true, actor: 1 });
});

test('each supported attack can be blocked or explicitly accepted exactly once', () => {
  for (const card of ['denounce', 'frame', 'unanimous', 'transfer']) for (const block of [true, false]) {
    let s = fixture(); hand(s, 0, [card]); hand(s, 1, ['shield']); s.players[0].loyalty = 60; s.institutions[0].owner = 1;
    s = act(s, card === 'transfer' ? { type: 'play', index: 0, institution: 'radio' } : { type: 'play', index: 0, target: 1 });
    assert.equal(s.phase, 'reaction');
    const saved = JSON.parse(JSON.stringify(s)); validateState(saved);
    const restored = act(saved, { type: 'respond', block });
    s = act(s, { type: 'respond', block }); assert.deepEqual(restored, s);
    assert.equal(s.actions, 1); assert.equal(s.players[1].hand.length, block ? 0 : 1);
    assert.equal(s.players[1].influence, block ? 18 : 20);
    if (card === 'transfer') assert.equal(s.institutions[0].owner, block ? 1 : 0);
    else assert.equal(s.players[1].favor, block ? 50 : 50 - ({ denounce: 10, frame: 7, unanimous: 12 }[card]));
    if (card === 'frame') assert.equal(s.players[1].loyalty, block ? 40 : 25);
  }
});

test('no hand shield or no response budget resolves directly; economic effects bypass it', () => {
  for (const influence of [0, 1, 2]) {
    let s = fixture(); hand(s, 0, ['denounce']); if (influence < 2) hand(s, 1, ['shield']); s.players[1].influence = influence;
    s = act(s, { type: 'play', index: 0, target: 1 });
    assert.equal(s.phase, 'turn'); assert.equal(s.players[1].favor, 40);
  }
  for (const card of ['levy', 'discipline']) {
    let s = fixture(); hand(s, 0, [card]); hand(s, 1, ['shield']);
    s = act(s, { type: 'play', index: 0, target: 1 }); assert.equal(s.phase, 'turn'); assert.deepEqual(s.players[1].hand, ['shield']);
  }
});

test('last acting seat can still be answered before final review', () => {
  let s = fixture(); s.round = 12; s.order = [1, 2, 3, 0]; s.cursor = 3;
  hand(s, 0, ['denounce']); hand(s, 1, ['shield']); s.players[1].favor = 30;
  s = act(s, { type: 'play', index: 0, target: 1 }); assert.equal(s.finished, false);
  s = act(s, { type: 'respond', block: true }); assert.equal(s.players[1].favor, 30);
  s = act(s, { type: 'end' }); assert.equal(s.finished, true); assert.equal(s.players[1].alive, true);
});

test('accepted response damage and reporter backlash preserve the full rescue deadline', () => {
  let s = fixture(); hand(s, 0, ['denounce']); hand(s, 1, ['shield']); s.players[1].favor = 25;
  s = act(s, { type: 'play', index: 0, target: 1 }); s = act(s, { type: 'respond', block: false });
  assert.equal(s.players[1].investigation.dueTurn, 1); assert.equal(s.players[1].alive, true);
  s = act(s, { type: 'end' }); s = act(s, { type: 'confess' }); assert.equal(s.players[1].investigation, null);
  s = fixture(); hand(s, 0, ['denounce']); hand(s, 1, ['shield']); s.players[0].favor = 21;
  s = act(s, { type: 'play', index: 0, target: 1 }); s = act(s, { type: 'respond', block: true });
  assert.equal(s.players[0].investigation.dueTurn, 2);
});

test('trade chooses the outgoing card on either side of its original index and pays total three', () => {
  for (const index of [0, 2]) {
    let s = fixture(); hand(s, 0, index === 0 ? ['trade', 'loyalty', 'network'] : ['loyalty', 'network', 'trade']); hand(s, 1, ['alibi']);
    const giveIndex = index === 0 ? 1 : 0;
    s = act(s, { type: 'play', index, target: 1, giveIndex });
    assert.equal(s.players[0].influence, 17); assert.equal(s.players[1].influence, 22); assert.equal(s.players[0].favor, 55);
    assert.deepEqual(s.players[0].hand, ['alibi', 'network']); assert.deepEqual(s.players[1].hand, ['loyalty']);
  }
});

test('trade requires another chosen card, three total influence and room for the full gift', () => {
  const s = fixture(); hand(s, 0, ['trade', 'loyalty']); hand(s, 1, ['alibi']);
  for (const giveIndex of [undefined, 0, -1, 2, 0.5]) reject(s, { type: 'play', index: 0, target: 1, giveIndex });
  s.players[0].influence = 2; reject(s, { type: 'play', index: 0, target: 1, giveIndex: 1 });
  s.players[0].influence = 3; s.players[1].influence = 29; s.players[1].peak = 29;
  reject(s, { type: 'play', index: 0, target: 1, giveIndex: 1 });
  s.players[1].influence = 28;
  const next = act(s, { type: 'play', index: 0, target: 1, giveIndex: 1 });
  assert.equal(next.players[0].influence, 0); assert.equal(next.players[1].influence, 30);
});

test('dossier replaces itself plus a selected card, costs no action, and cannot loop', () => {
  let s = fixture(); hand(s, 0, ['dossier', 'network', 'dossier']); s.actions = 0;
  s = act(s, { type: 'play', index: 0, giveIndex: 1 });
  assert.equal(s.players[0].hand.length, 3); assert.equal(s.players[0].influence, 19); assert.equal(s.actions, 0);
  assert.equal(s.players[0].dossierUsed, true); assert.ok(s.discard.includes('network'));
  reject(s, { type: 'play', index: 0, giveIndex: 1 });
  while (s.active === 0) s = act(s, { type: 'end' });
  while (s.active !== 0) s = act(s, { type: 'end' });
  assert.equal(s.players[0].dossierUsed, false);
});

test('dossier keeps both spent cards out of a recycled draw pile until drawing ends', () => {
  let s = fixture(); hand(s, 0, ['dossier', 'network']); s.discard.push(...s.deck); s.deck = [];
  s = act(s, { type: 'play', index: 0, giveIndex: 1 });
  assert.equal(s.players[0].hand.length, 2); assert.deepEqual(s.discard, ['network', 'dossier']);
});

test('extreme pays loyalty immediately, never creates debt, and cannot spend missing loyalty', () => {
  let s = fixture(); hand(s, 0, ['extreme']); s.players[0].loyalty = 19;
  reject(s, { type: 'play', index: 0 });
  s.players[0].loyalty = 20; s.players[0].favor = 95;
  s = act(s, { type: 'play', index: 0 });
  assert.equal(s.players[0].loyalty, 0); assert.equal(s.players[0].influence, 19); assert.equal(s.players[0].favor, 100); assert.deepEqual(s.players[0].debts, []);
});

test('version one migration preserves resources, old shield and outstanding debt', () => {
  const old = fixture(); old.version = 1; delete old.pending;
  for (const p of old.players) delete p.dossierUsed;
  old.players[0].debts = [{ dueTurn: 2, amount: 12 }]; old.players[1].shield = true;
  const original = structuredClone(old); const s = upgradeState(old);
  assert.deepEqual(old, original); assert.equal(s.version, 2); assert.equal(s.pending, null);
  assert.deepEqual(s.players[0].debts, original.players[0].debts); assert.equal(s.players[1].shield, true); validateState(s);
  assert.deepEqual(upgradeState(s), s);
  assert.throws(() => upgradeState({ ...old, version: 999 }));
});

test('pending save validation rejects a missing defender, invalid card and mismatched phase', () => {
  let s = fixture(); hand(s, 0, ['denounce']); hand(s, 1, ['shield']); s = act(s, { type: 'play', index: 0, target: 1 });
  for (const change of [s => { s.pending.target = 0; }, s => { s.pending.card = 'loyalty'; }, s => { s.pending = null; }, s => { s.phase = 'turn'; }]) {
    const bad = structuredClone(s); change(bad); assert.throws(() => validateState(bad));
  }
});

test('previews show targets and institutions, preserve state, and do not reveal response hands', () => {
  const s = fixture(); hand(s, 0, ['denounce']); hand(s, 1, ['shield']);
  const original = structuredClone(s), action = { type: 'play', index: 0, target: 1 };
  const withShield = previewAction(s, action);
  const noShield = structuredClone(s); hand(noShield, 1, ['network']);
  assert.deepEqual(withShield, previewAction(noShield, action)); assert.deepEqual(s, original);
  assert.equal(withShield.players.find(p => p.id === 1).after.favor, 40);
  const t = fixture(); hand(t, 0, ['transfer']); t.institutions[0].owner = 1;
  assert.deepEqual(previewAction(t, { type: 'play', index: 0, institution: 'radio' }).institutions.map(i => [i.id, i.before, i.after]), [['radio', 1, 0]]);
});

test('random draw and trade previews disclose counts but never future card identities', () => {
  for (const card of ['dossier', 'trade']) {
    const s = fixture(); hand(s, 0, [card, 'network']); hand(s, 1, ['alibi', 'loyalty']);
    const action = { type: 'play', index: 0, giveIndex: 1, target: 1 }, original = structuredClone(s);
    const before = previewAction(s, action); const changed = structuredClone(s); changed.rng = 17; changed.deck.reverse();
    assert.deepEqual(before, previewAction(changed, action)); assert.deepEqual(s, original);
    assert.equal(JSON.stringify(before).includes('alibi'), false);
    assert.ok(before.players.every(p => !Object.hasOwn(p.after, 'hand') && !Object.hasOwn(p.before, 'hand')));
    assert.equal(before.cost.actions, card === 'dossier' ? 0 : 1); assert.equal(before.cost.influence, card === 'dossier' ? 1 : 3);
  }
});

test('next income includes loyalty decay, excludes unknown events and is zero after closing', () => {
  const s = fixture(); s.players[0].loyalty = 40;
  assert.equal(nextIncome(s, 0), 3); s.players[0].loyalty = 55; assert.equal(nextIncome(s, 0), 4);
  s.round = 12; assert.equal(nextIncome(s, 0), 0);
});

test('AI decisions cannot distinguish hidden shields, future draws or other hands', () => {
  const s = fixture(); hand(s, 0, ['denounce', 'trade', 'dossier']); hand(s, 1, ['shield']);
  const before = chooseAction(observation(s)); const changed = structuredClone(s); hand(changed, 1, ['network']); changed.rng = 42; changed.deck.reverse();
  assert.deepEqual(chooseAction(observation(changed)), before);
  for (const action of legalActions(s)) act(s, action);
});
