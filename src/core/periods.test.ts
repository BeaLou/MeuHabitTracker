import assert from 'node:assert/strict';
import { test } from 'node:test';
import { periodOf } from './habits';

test('períodos do dia, incluindo as bordas e hábito sem horário', () => {
  assert.equal(periodOf('00:00'), 'morning');
  assert.equal(periodOf('11:59'), 'morning');
  assert.equal(periodOf('12:00'), 'afternoon');
  assert.equal(periodOf('17:59'), 'afternoon');
  assert.equal(periodOf('18:00'), 'evening');
  assert.equal(periodOf(null), 'anytime');
});
