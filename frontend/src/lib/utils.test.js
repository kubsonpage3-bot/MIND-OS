import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGold } from './utils.js';

test('normalizeGold rounds floating-point values to whole gold amounts', () => {
  assert.equal(normalizeGold(4.00000012), 4);
  assert.equal(normalizeGold(4.6), 5);
  assert.equal(normalizeGold(0.1), 0);
  assert.equal(normalizeGold(undefined), 0);
});
