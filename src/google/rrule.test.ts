import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Frequency } from '../core/types';
import { firstOccurrence, frequencyToRRule, parseRRule } from './rrule';

test('frequência diária e semanal viram RRULE', () => {
  assert.equal(frequencyToRRule({ type: 'daily' }, null), 'RRULE:FREQ=DAILY');
  assert.equal(frequencyToRRule({ type: 'weekdays', days: [3, 1] }, null), 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE');
});

test('meta final vira UNTIL em UTC', () => {
  const r = frequencyToRRule({ type: 'daily' }, '2026-12-31');
  assert.match(r, /^RRULE:FREQ=DAILY;UNTIL=\d{8}T\d{6}Z$/);
});

test('RRULE do Google volta para frequência do app', () => {
  assert.deepEqual(parseRRule(['RRULE:FREQ=DAILY'], '2026-11-02'), { frequency: { type: 'daily' }, targetDate: null });
  assert.deepEqual(parseRRule(['RRULE:FREQ=WEEKLY;BYDAY=WE,MO'], '2026-11-02')?.frequency, { type: 'weekdays', days: [1, 3] });
  // semanal sem BYDAY usa o dia da semana do início (02/11/2026 é segunda)
  assert.deepEqual(parseRRule(['RRULE:FREQ=WEEKLY'], '2026-11-02')?.frequency, { type: 'weekdays', days: [1] });
});

test('recorrências que o app não representa são recusadas', () => {
  assert.equal(parseRRule(['RRULE:FREQ=MONTHLY;BYMONTHDAY=5'], '2026-11-02'), null);
  assert.equal(parseRRule(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO'], '2026-11-02'), null);
  assert.equal(parseRRule(['RRULE:FREQ=DAILY;COUNT=10'], '2026-11-02'), null);
  assert.equal(parseRRule(undefined, '2026-11-02'), null);
});

test('ida e volta preserva a frequência', () => {
  const freq: Frequency = { type: 'weekdays', days: [0, 2, 4] };
  const rule = frequencyToRRule(freq, null);
  assert.deepEqual(parseRRule([rule], '2026-11-01')?.frequency, freq);
});

test('firstOccurrence acha o primeiro dia previsto', () => {
  // 06/11/2026 é sexta; próxima segunda é 09/11
  assert.equal(firstOccurrence({ type: 'weekdays', days: [1] }, '2026-11-06'), '2026-11-09');
  assert.equal(firstOccurrence({ type: 'daily' }, '2026-11-06'), '2026-11-06');
});
