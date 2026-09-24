export type MembershipRecord = {
  userId: string;
  schoolId: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
};

export type SchoolContext = {
  userId: string;
  schoolId: string;
  role: string;
};

/** Accept only a membership loaded from the database for the authenticated user. */
export function resolveSchoolContext(input: {
  authenticatedUserId: string;
  requestedSchoolId: string;
  membership: MembershipRecord | null;
  schoolStatus: "ACTIVE" | "INACTIVE" | null;
}): SchoolContext {
  const { authenticatedUserId, requestedSchoolId, membership, schoolStatus } =
    input;

  if (
    !membership ||
    membership.userId !== authenticatedUserId ||
    membership.schoolId !== requestedSchoolId ||
    membership.status !== "ACTIVE" ||
    schoolStatus !== "ACTIVE"
  ) {
    throw new Error("School access denied");
  }

  return {
    userId: authenticatedUserId,
    schoolId: membership.schoolId,
    role: membership.role,
  };
}
