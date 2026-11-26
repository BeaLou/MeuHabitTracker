import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeHabit } from './defaults';
import { amountOf, applyStatus, tapGoal } from './goals';
import { cellStatus, computeStats, isDue } from './habits';
import { habitLevel, heatWeeks, overallLevel } from './heatmap';
import { mergeStates, shareSignature } from './merge';
import { createInitialState } from './defaults';

const KEY = '2026-11-26';
const water = () => makeHabit({ startDate: '2026-11-01', goal: { target: 5, unit: 'copos', step: 2 } });

test('meta: toques somam até o alvo, concluem e o toque seguinte desfaz um passo', () => {
  let h = tapGoal(water(), KEY, 1);
  assert.equal(amountOf(h, KEY), 2);
  assert.equal(h.log[KEY], undefined);
  h = tapGoal(tapGoal(h, KEY, 2), KEY, 3);
  assert.equal(amountOf(h, KEY), 5);
  assert.equal(h.log[KEY], 'done');
  h = tapGoal(h, KEY, 4);
  assert.equal(amountOf(h, KEY), 3);
  assert.equal(h.log[KEY], undefined);
});

test('meta: concluir pelo calendário completa, desmarcar zera, histórico antigo vale meta cheia', () => {
  const done = applyStatus(water(), KEY, 'done', 1);
  assert.equal(amountOf(done, KEY), 5);
  assert.equal(amountOf(applyStatus(done, KEY, null, 2), KEY), 0);
  assert.equal(amountOf(makeHabit({ goal: { target: 8, unit: '', step: 1 }, log: { [KEY]: 'done' } }), KEY), 8);
});

// 2026-11-01, 08, 15 e 22 são domingos
const gym = (days: string[]) =>
  makeHabit({ startDate: '2026-11-08', weeklyTimes: 3, log: Object.fromEntries(days.map((d) => [d, 'done' as const])) });

test('semanal: deixa de cobrar depois da meta e não marca falta em dia isolado', () => {
  const h = gym(['2026-11-22', '2026-11-23', '2026-11-24']);
  assert.equal(isDue(h, '2026-11-24'), true); // feito no dia continua visível
  assert.equal(isDue(h, KEY), false);
  assert.equal(isDue(h, '2026-11-29'), true); // semana nova
  assert.equal(cellStatus(gym([]), '2026-11-24', KEY), 'off');
  assert.equal(cellStatus(gym([]), KEY, KEY), 'pending');
});

test('semanal: sequência conta semanas e a semana atual incompleta não zera', () => {
  const two = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-16', '2026-11-17', '2026-11-18'];
  const open = computeStats(gym([...two, '2026-11-23']), KEY);
  assert.equal(open.currentStreak, 2);
  assert.equal(open.rate, 100);
  const broken = computeStats(gym(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-16']), KEY);
  assert.equal(broken.currentStreak, 0);
  assert.equal(broken.bestStreak, 1);
  assert.equal(broken.rate, 67);
});

test('mapa de constância: níveis e semanas', () => {
  const a = makeHabit({ startDate: '2026-11-01', log: { [KEY]: 'done' } });
  const b = makeHabit({ startDate: '2026-11-01' });
  assert.equal(overallLevel([a, b], KEY), 2);
  assert.equal(overallLevel([a, gym([])], KEY), 4);
  assert.equal(habitLevel(tapGoal(water(), KEY, 1), KEY), 2);
  const weeks = heatWeeks(KEY, () => 1);
  assert.equal(weeks.length, 17);
  assert.equal(weeks[16][4].key, KEY);
  assert.equal(weeks[16][5].level, null);
});

test('merge: a quantidade mais recente vence e muda a assinatura de sincronização', () => {
  const base = water();
  const phone = tapGoal(base, KEY, 100);
  const laptop = tapGoal(tapGoal(base, KEY, 50), KEY, 200);
  const state = { ...createInitialState(), habits: [phone] };
  const merged = mergeStates(state, { habits: [laptop] }).habits[0];
  assert.equal(amountOf(merged, KEY), 4);
  assert.notEqual(shareSignature(state), shareSignature({ ...state, habits: [tapGoal(phone, KEY, 300)] }));
  const plain = { ...createInitialState(), habits: [makeHabit({})] };
  assert.equal('amounts' in mergeStates(plain, { habits: plain.habits }).habits[0], false);
});
