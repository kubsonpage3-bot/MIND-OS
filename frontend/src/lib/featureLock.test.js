import test from 'node:test';
import assert from 'node:assert/strict';
import { isFeatureLocked, getFeatureLocks } from './featureLock.js';

test('isFeatureLocked rank comparisons', () => {
  // F vs D
  assert.equal(isFeatureLocked('F', 'D'), true);
  assert.equal(isFeatureLocked('D', 'D'), false);
  assert.equal(isFeatureLocked('C', 'D'), false);

  // F/D vs C
  assert.equal(isFeatureLocked('F', 'C'), true);
  assert.equal(isFeatureLocked('D', 'C'), true);
  assert.equal(isFeatureLocked('C', 'C'), false);
  assert.equal(isFeatureLocked('B', 'C'), false);
});

test('getFeatureLocks with null/undefined profile fallback to F', () => {
  const locks = getFeatureLocks(null);
  assert.equal(locks.currentRank, 'F');
  assert.equal(locks.skillsLocked, true);
  assert.equal(locks.alliesLocked, true);
  assert.equal(locks.mutatorsLocked, true);
});

test('getFeatureLocks for Rank F profile', () => {
  const profile = { rank_info: { current_id: 'F' } };
  const locks = getFeatureLocks(profile);
  assert.equal(locks.skillsLocked, true);
  assert.equal(locks.alliesLocked, true);
  assert.equal(locks.mutatorsLocked, true);
});

test('getFeatureLocks for Rank D profile', () => {
  const profile = { rank_info: { current_id: 'D' } };
  const locks = getFeatureLocks(profile);
  assert.equal(locks.skillsLocked, false);
  assert.equal(locks.alliesLocked, true);
  assert.equal(locks.mutatorsLocked, true);
});

test('getFeatureLocks for Rank C profile', () => {
  const profile = { rank_info: { current_id: 'C' } };
  const locks = getFeatureLocks(profile);
  assert.equal(locks.skillsLocked, false);
  assert.equal(locks.alliesLocked, false);
  assert.equal(locks.mutatorsLocked, false);
});

test('getFeatureLocks for high-rank profiles (S, SSS, ASC)', () => {
  const profileS = { rank_info: { current_id: 'S' } };
  const locksS = getFeatureLocks(profileS);
  assert.equal(locksS.skillsLocked, false);
  assert.equal(locksS.alliesLocked, false);
  assert.equal(locksS.mutatorsLocked, false);

  const profileAsc = { rank_info: { current_id: 'ASC' } };
  const locksAsc = getFeatureLocks(profileAsc);
  assert.equal(locksAsc.skillsLocked, false);
  assert.equal(locksAsc.alliesLocked, false);
  assert.equal(locksAsc.mutatorsLocked, false);
});
