import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState, makeHabit } from './defaults';
import { amountOf, applyStatus } from './goals';
import { mergeStates } from './merge';
import { importFromPo, poValue, type PoRecord } from './poroshape';

const TODAY = '2026-11-26';
const sets = (n: number) => ({ x: { done: Array.from({ length: n }, () => true) } });
const session = (data: object): PoRecord => ({ col: 'sessions', id: 's', data: { date: TODAY, day: 'B', ex: {}, min: false, ...data } });
const cardio = (id: string, min: number, date = TODAY): PoRecord => ({ col: 'cardio', id, data: { date, min } });
const run = (h: ReturnType<typeof makeHabit>, r: PoRecord[]) => importFromPo([h], r, TODAY, 5)[0];
const linked = (extra: object = {}) => makeHabit({ startDate: '2026-11-01', link: 'workout', ...extra });

test('treino conta com metade das séries ou versão mínima', () => {
  assert.equal(poValue([session({ ex: sets(7) })], 'workout', TODAY), 0);
  assert.equal(poValue([session({ ex: sets(8) })], 'workout', TODAY), 1);
  assert.equal(poValue([session({ min: true })], 'workout', TODAY), 1);
});

test('check-in, foto, passos e soma de cardio', () => {
  const r: PoRecord[] = [{ col: 'days', id: TODAY, data: { water: true, steps: 6000 } }, { col: 'photos', id: 'p', data: { date: TODAY } }, cardio('a', 10), cardio('b', 15)];
  assert.equal(poValue(r, 'water', TODAY), 1);
  assert.equal(poValue(r, 'protein', TODAY), 0);
  assert.equal(poValue(r, 'photo', TODAY), 1);
  assert.equal(poValue(r, 'cardio', TODAY), 25);
  assert.equal(run(linked({ link: 'steps' }), r).log[TODAY], undefined);
});

test('marca uma vez; desmarcar no Ritmo não é desfeito e nada é desmarcado sozinho', () => {
  const r = [session({ min: true })];
  const done = run(linked(), r);
  assert.equal(done.log[TODAY], 'done');
  const undone = applyStatus(done, TODAY, null, 6);
  assert.equal(run(undone, r).log[TODAY], undefined);
  assert.equal(run(done, []).log[TODAY], 'done');
  const same = [done];
  assert.equal(importFromPo(same, r, TODAY, 7), same);
});

test('respeita pulado, início, janela de 7 dias, arquivado e hábito sem vínculo', () => {
  const r = [session({ min: true })];
  assert.equal(run(linked({ log: { [TODAY]: 'skipped' } }), r).log[TODAY], 'skipped');
  assert.equal(run(linked({ startDate: '2026-11-27' }), r).log[TODAY], undefined);
  assert.equal(run(linked({ archived: true }), r).log[TODAY], undefined);
  assert.equal(run(linked({ link: undefined }), r).log[TODAY], undefined);
  assert.equal(run(linked(), [session({ min: true, date: '2026-11-19' })]).log['2026-11-19'], undefined);
  assert.equal(run(linked(), [session({ min: true, date: '2026-11-20' })]).log['2026-11-20'], 'done');
});

test('cardio preenche a meta em minutos sem apagar o que foi somado à mão', () => {
  const h = linked({ link: 'cardio', goal: { target: 30, unit: 'min', step: 5 } });
  const half = run(h, [cardio('a', 20)]);
  assert.equal(amountOf(half, TODAY), 20);
  assert.equal(half.log[TODAY], undefined);
  const full = run(half, [cardio('a', 20), cardio('b', 15)]);
  assert.equal(amountOf(full, TODAY), 30);
  assert.equal(full.log[TODAY], 'done');
  const manual = run({ ...h, amounts: { [TODAY]: 25 } }, [cardio('a', 10)]);
  assert.equal(amountOf(manual, TODAY), 25);
});

test('merge guarda o que cada aparelho já importou', () => {
  const a = linked({ linkSeen: { 'workout:2026-11-25': 1 } });
  const b = { ...a, linkSeen: { 'workout:2026-11-26': 1 } };
  const merged = mergeStates({ ...createInitialState(), habits: [a] }, { habits: [b] }).habits[0];
  assert.equal(Object.keys(merged.linkSeen!).length, 2);
});
