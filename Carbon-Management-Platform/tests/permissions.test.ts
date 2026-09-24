import assert from "node:assert/strict";
import test from "node:test";
import { SCHOOL_ROLES, canSchool } from "../src/shared/permissions";

test("school permissions follow the agreed role matrix", () => {
  assert.equal(canSchool("MODEL_EDITOR", "model.write"), true);
  assert.equal(canSchool("MODEL_EDITOR", "model.publish"), false);
  assert.equal(canSchool("ACCOUNTANT", "accounting.write"), true);
  assert.equal(canSchool("ACCOUNTANT", "accounting.review"), false);
  assert.equal(canSchool("REVIEWER", "accounting.review"), true);
  assert.equal(canSchool("REVIEWER", "accounting.write"), false);
  assert.equal(canSchool("VIEWER", "report.export"), false);
  assert.equal(canSchool("SCHOOL_ADMIN", "report.review"), true);
});

test("platform role never becomes a school role", () => {
  assert.equal(SCHOOL_ROLES.includes("SUPER_ADMIN" as never), false);
  assert.equal(canSchool("SUPER_ADMIN", "model.write"), false);
});
