import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, diffDays, monthGrid, startOfWeek, weekday } from './dates';
import { makeHabit } from './defaults';
import { cellStatus, computeStats, isDue, lastSevenDays, nextStatus } from './habits';

const TODAY = '2026-11-06'; // sexta-feira

test('datas: semana começa no domingo e diffDays é exato', () => {
  assert.equal(weekday(TODAY), 5);
  assert.equal(startOfWeek(TODAY), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-11-01', TODAY), 5);
  const grid = monthGrid(2026, 10); // novembro de 2026
  assert.equal(grid.length, 42);
  assert.equal(grid[0], '2026-11-01');
});

test('isDue respeita início, meta e dias da semana', () => {
  const h = makeHabit({ startDate: '2026-11-02', targetDate: '2026-11-20', frequency: { type: 'weekdays', days: [1, 3] } });
  assert.equal(isDue(h, '2026-11-02'), true); // segunda
  assert.equal(isDue(h, '2026-11-03'), false); // terça
  assert.equal(isDue(h, '2026-11-01'), false); // antes do início
  assert.equal(isDue(h, '2026-11-23'), false); // depois da meta
});

test('cellStatus: concluído, perdido, pendente, fora', () => {
  const h = makeHabit({ startDate: '2026-11-01', log: { '2026-11-02': 'done', '2026-11-03': 'skipped' } });
  assert.equal(cellStatus(h, '2026-11-02', TODAY), 'done');
  assert.equal(cellStatus(h, '2026-11-03', TODAY), 'skipped');
  assert.equal(cellStatus(h, '2026-11-04', TODAY), 'missed');
  assert.equal(cellStatus(h, TODAY, TODAY), 'pending');
  assert.equal(cellStatus(h, '2026-10-30', TODAY), 'off');
});

test('ciclo de toque: nada → feito → pulado → nada', () => {
  assert.equal(nextStatus(undefined), 'done');
  assert.equal(nextStatus('done'), 'skipped');
  assert.equal(nextStatus('skipped'), null);
});

test('sequência: dia perdido zera, dia pulado não quebra, hoje pendente não penaliza', () => {
  const h = makeHabit({
    startDate: '2026-11-01',
    log: {
      '2026-11-01': 'done',
      '2026-11-02': 'done',
      '2026-11-03': 'done',
      // 04: perdido
      '2026-11-05': 'skipped',
    },
  });
  const s = computeStats(h, TODAY);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.currentStreak, 0); // o dia 04 perdido zerou; 05 pulado e 06 pendente não somam
  assert.equal(s.doneTotal, 3);
  assert.equal(s.rate, 75); // 3 feitos, 1 perdido (pulado e hoje ficam de fora)
});

test('sequência continua quando o dia seguinte foi pulado', () => {
  const h = makeHabit({
    startDate: '2026-11-03',
    log: { '2026-11-03': 'done', '2026-11-04': 'skipped', '2026-11-05': 'done', '2026-11-06': 'done' },
  });
  const s = computeStats(h, TODAY);
  assert.equal(s.currentStreak, 3);
  assert.equal(s.bestStreak, 3);
});

test('contagens de semana/mês/ano/total', () => {
  const h = makeHabit({
    startDate: '2026-01-01',
    log: { '2026-01-05': 'done', '2026-10-30': 'done', '2026-11-01': 'done', '2026-11-05': 'done' },
  });
  const s = computeStats(h, TODAY);
  assert.equal(s.doneWeek, 2); // 01 e 05/11 (semana começa em 01/11)
  assert.equal(s.doneMonth, 2);
  assert.equal(s.doneYear, 4);
  assert.equal(s.doneTotal, 4);
});

test('pontuação sobe com constância e cai com faltas', () => {
  const keys = Array.from({ length: 30 }, (_, i) => addDays('2026-10-07', i));
  const good = makeHabit({ startDate: '2026-10-07', log: Object.fromEntries(keys.map((k) => [k, 'done' as const])) });
  const sGood = computeStats(good, '2026-11-05');
  const bad = makeHabit({ startDate: '2026-10-07', log: {} });
  const sBad = computeStats(bad, '2026-11-05');
  // meia-vida de 13 ocorrências: 30 dias seguidos => 1 - 0.5^(30/13) ≈ 80
  assert.equal(sGood.score, 80);
  assert.equal(sBad.score, 0);
  // 60 dias seguidos aproxima de 100 sem passar
  const longKeys = Array.from({ length: 60 }, (_, i) => addDays('2026-09-07', i));
  const long = makeHabit({ startDate: '2026-09-07', log: Object.fromEntries(longKeys.map((k) => [k, 'done' as const])) });
  const sLong = computeStats(long, '2026-11-05');
  assert.ok(sLong.score > 95 && sLong.score <= 100, `veio ${sLong.score}`);
});

test('hábito que ainda não começou não gera estatística', () => {
  const h = makeHabit({ startDate: '2026-12-01' });
  const s = computeStats(h, TODAY);
  assert.deepEqual([s.score, s.rate, s.currentStreak, s.bestStreak], [0, 0, 0, 0]);
});

test('lastSevenDays termina em hoje', () => {
  const d = lastSevenDays(TODAY);
  assert.equal(d.length, 7);
  assert.equal(d[0], '2026-10-31');
  assert.equal(d[6], TODAY);
});
