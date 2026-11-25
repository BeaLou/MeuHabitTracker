import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeChallenge, challengeDates, challengeDayNumber, challengeHabits, doneCount } from './challenge';
import { createInitialState } from './defaults';
import { mergeStates } from './merge';

test('desafio: 6 hábitos, 75 dias', () => {
  const hs = challengeHabits('2026-11-25');
  assert.equal(hs.length, 6);
  const dates = challengeDates(hs);
  assert.equal(dates.length, 75);
  assert.equal(dates[74], hs[0].targetDate);
});

test('desafio: contagem do dia e número do dia', () => {
  const hs = challengeHabits('2026-11-25');
  hs[0].log['2026-11-25'] = 'done';
  hs[1].log['2026-11-25'] = 'skipped';
  assert.equal(doneCount(hs, '2026-11-25'), 1);
  assert.equal(challengeDayNumber('2026-11-25', '2026-11-20'), 1);
  assert.equal(challengeDayNumber('2026-11-25', '2026-11-27'), 3);
  assert.equal(challengeDayNumber('2026-11-25', '2027-06-01'), 75);
});

test('desafio: arquivado sai e o vínculo sobrevive ao merge', () => {
  const hs = challengeHabits('2026-11-25');
  const merged = mergeStates(createInitialState(), { habits: hs });
  assert.equal(activeChallenge(merged.habits).length, 6);
  assert.equal(activeChallenge(hs.map((h) => ({ ...h, archived: true }))).length, 0);
});
