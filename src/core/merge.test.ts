import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState, makeHabit, makeTask } from './defaults';
import { canonical, mergeStates, shareable } from './merge';
import type { AppState } from './types';

const base = (patch: Partial<AppState> = {}): AppState => ({ ...createInitialState(), ...patch });

test('itens que existem só de um lado são unidos', () => {
  const a = makeHabit({ id: 'a', name: 'A' });
  const b = makeHabit({ id: 'b', name: 'B' });
  const m = mergeStates(base({ habits: [a] }), { habits: [b] });
  assert.deepEqual(m.habits.map((h) => h.id).sort(), ['a', 'b']);
});

test('no mesmo item vence a edição mais recente; empate fica com o local', () => {
  const l = makeHabit({ id: 'x', name: 'local', updatedAt: 100 });
  const r = makeHabit({ id: 'x', name: 'remoto', updatedAt: 200 });
  assert.equal(mergeStates(base({ habits: [l] }), { habits: [r] }).habits[0].name, 'remoto');
  const tie = makeHabit({ id: 'x', name: 'remoto', updatedAt: 100 });
  assert.equal(mergeStates(base({ habits: [l] }), { habits: [tie] }).habits[0].name, 'local');
});

test('log é mesclado dia a dia: dias diferentes se somam', () => {
  const l = makeHabit({ id: 'x', updatedAt: 100, log: { '2026-11-01': 'done' }, logAt: { '2026-11-01': 10 } });
  const r = makeHabit({ id: 'x', updatedAt: 100, log: { '2026-11-02': 'done' }, logAt: { '2026-11-02': 20 } });
  const m = mergeStates(base({ habits: [l] }), { habits: [r] }).habits[0];
  assert.deepEqual(Object.keys(m.log).sort(), ['2026-11-01', '2026-11-02']);
});

test('desmarcar um dia em um aparelho se propaga (carimbo mais novo vence a presença)', () => {
  const marked = makeHabit({ id: 'x', updatedAt: 100, log: { '2026-11-01': 'done' }, logAt: { '2026-11-01': 10 } });
  const unmarked = makeHabit({ id: 'x', updatedAt: 100, log: {}, logAt: { '2026-11-01': 50 } });
  const m1 = mergeStates(base({ habits: [marked] }), { habits: [unmarked] }).habits[0];
  assert.equal(m1.log['2026-11-01'], undefined);
  const m2 = mergeStates(base({ habits: [unmarked] }), { habits: [marked] }).habits[0];
  assert.equal(m2.log['2026-11-01'], undefined);
});

test('conflito no mesmo dia: vence o carimbo mais recente', () => {
  const l = makeHabit({ id: 'x', log: { '2026-11-01': 'done' }, logAt: { '2026-11-01': 10 } });
  const r = makeHabit({ id: 'x', log: { '2026-11-01': 'skipped' }, logAt: { '2026-11-01': 20 } });
  assert.equal(mergeStates(base({ habits: [l] }), { habits: [r] }).habits[0].log['2026-11-01'], 'skipped');
});

test('dados antigos sem carimbo: o dia marcado não some', () => {
  const l = makeHabit({ id: 'x', log: { '2026-11-01': 'done' } });
  const r = makeHabit({ id: 'x', log: {} });
  assert.equal(mergeStates(base({ habits: [r] }), { habits: [l] }).habits[0].log['2026-11-01'], 'done');
});

test('lápide impede que item apagado volte do outro aparelho', () => {
  const deletedAt = Date.now();
  const h = makeHabit({ id: 'x', updatedAt: deletedAt - 1000 });
  const local = base({ habits: [], tombstones: { x: deletedAt } });
  assert.equal(mergeStates(local, { habits: [h] }).habits.length, 0);
  // e a lápide vinda do remoto apaga o item local
  const m = mergeStates(base({ habits: [h] }), { habits: [], tombstones: { x: deletedAt } });
  assert.equal(m.habits.length, 0);
  assert.equal(m.tombstones.x, deletedAt);
});

test('edição depois da exclusão ressuscita o item', () => {
  const deletedAt = Date.now() - 5000;
  const h = makeHabit({ id: 'x', updatedAt: deletedAt + 1000 });
  assert.equal(mergeStates(base({ tombstones: { x: deletedAt } }), { habits: [h] }).habits.length, 1);
});

test('lápides antigas (mais de 90 dias) são descartadas', () => {
  const old = Date.now() - 100 * 86_400_000;
  assert.deepEqual(mergeStates(base({ tombstones: { x: old } }), {}).tombstones, {});
});

test('tarefas e categorias seguem a mesma regra', () => {
  const t1 = makeTask({ id: 't', title: 'velha', updatedAt: 1 });
  const t2 = makeTask({ id: 't', title: 'nova', updatedAt: 2, done: true });
  const m = mergeStates(base({ tasks: [t1] }), { tasks: [t2] });
  assert.equal(m.tasks[0].title, 'nova');
  const cats = [{ id: 'c', name: 'Local', emoji: '⭐', color: '#fff', updatedAt: 1 }];
  const m2 = mergeStates(base({ categories: cats }), { categories: [{ ...cats[0], name: 'Remota', updatedAt: 9 }] });
  assert.equal(m2.categories.find((c) => c.id === 'c')?.name, 'Remota');
});

test('sessões são unidas sem duplicar e limitadas a 200', () => {
  const mk = (n: number) => ({ id: `s${n}`, startedAt: n, seconds: 60, habitId: null });
  const local = base({ sessions: Array.from({ length: 150 }, (_, i) => mk(i)) });
  const remote = { sessions: Array.from({ length: 150 }, (_, i) => mk(i + 100)) };
  const m = mergeStates(local, remote);
  assert.equal(m.sessions.length, 200);
  assert.equal(new Set(m.sessions.map((s) => s.id)).size, 200);
  assert.equal(m.sessions[0].id, 's249'); // mais recente primeiro
});

test('campos do aparelho (timer, google) não são sobrescritos', () => {
  const local = base();
  local.timer = { ...local.timer, status: 'running', endsAt: 123 };
  local.google = { ...local.google, connected: true };
  const m = mergeStates(local, { timer: { ...local.timer, status: 'idle' } } as Partial<AppState>);
  assert.equal(m.timer.status, 'running');
  assert.equal(m.google.connected, true);
});

test('merge é idempotente e comutativo no conteúdo compartilhado', () => {
  const a = base({ habits: [makeHabit({ id: 'a', updatedAt: 5, log: { '2026-11-01': 'done' }, logAt: { '2026-11-01': 5 } })], tombstones: { z: Date.now() } });
  const b = base({ habits: [makeHabit({ id: 'a', updatedAt: 7, log: { '2026-11-02': 'done' }, logAt: { '2026-11-02': 7 } }), makeHabit({ id: 'b', updatedAt: 1 })] });
  const ab = mergeStates(a, shareable(b));
  const ba = mergeStates(b, shareable(a));
  assert.equal(canonical(shareable(ab)), canonical(shareable(ba)));
  assert.equal(canonical(shareable(mergeStates(ab, shareable(b)))), canonical(shareable(ab)));
});

test('canonical ignora a ordem das chaves', () => {
  assert.equal(canonical({ a: 1, b: { d: 1, c: 2 } }), canonical({ b: { c: 2, d: 1 }, a: 1 }));
});
