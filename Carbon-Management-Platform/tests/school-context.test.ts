import assert from "node:assert/strict";
import test from "node:test";
import { resolveSchoolContext } from "../src/server/auth/school-context";

const membership = {
  userId: "user-a",
  schoolId: "school-a",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE" as const,
};

test("accepts an active membership in the requested school", () => {
  assert.deepEqual(
    resolveSchoolContext({
      authenticatedUserId: "user-a",
      requestedSchoolId: "school-a",
      membership,
      schoolStatus: "ACTIVE",
    }),
    { userId: "user-a", schoolId: "school-a", role: "SCHOOL_ADMIN" },
  );
});

test("rejects another school's ID and another user's membership", () => {
  for (const [authenticatedUserId, requestedSchoolId] of [
    ["user-a", "school-b"],
    ["user-b", "school-a"],
  ]) {
    assert.throws(() =>
      resolveSchoolContext({
        authenticatedUserId,
        requestedSchoolId,
        membership,
        schoolStatus: "ACTIVE",
      }),
    );
  }
});

test("rejects inactive memberships and schools", () => {
  assert.throws(() =>
    resolveSchoolContext({
      authenticatedUserId: "user-a",
      requestedSchoolId: "school-a",
      membership: { ...membership, status: "INACTIVE" },
      schoolStatus: "ACTIVE",
    }),
  );
  assert.throws(() =>
    resolveSchoolContext({
      authenticatedUserId: "user-a",
      requestedSchoolId: "school-a",
      membership,
      schoolStatus: "INACTIVE",
    }),
  );
});
