import test from "node:test";
import assert from "node:assert/strict";
import { isValidSubTab, getValidSubTab, SUB_TABS } from "./navigation.js";

test("SUB_TABS structure", () => {
  assert.deepEqual(SUB_TABS.character, ["overview", "skills", "achievements", "shop"]);
  assert.ok(SUB_TABS.settings.includes("appearance"));
});

test("isValidSubTab validation", () => {
  assert.equal(isValidSubTab("character", "skills"), true);
  assert.equal(isValidSubTab("character", "appearance"), false);
  assert.equal(isValidSubTab("settings", "appearance"), true);
  assert.equal(isValidSubTab("settings", "skills"), false);
  assert.equal(isValidSubTab("tasks", "any"), false);
  assert.equal(isValidSubTab("character", null), false);
});

test("getValidSubTab defaults and fallbacks", () => {
  assert.equal(getValidSubTab("character", "skills"), "skills");
  assert.equal(getValidSubTab("character", "appearance"), "overview");
  assert.equal(getValidSubTab("settings", "appearance"), "appearance");
  assert.equal(getValidSubTab("settings", "skills"), "appearance");
  assert.equal(getValidSubTab("tasks", "any"), null);
  assert.equal(getValidSubTab("character", null), "overview");
});
