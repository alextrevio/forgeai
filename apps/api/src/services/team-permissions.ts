import { prisma, TeamRole } from "@forgeai/db";

// ═══════════════════════════════════════════════════════════════════
// TEAM PERMISSION HELPERS
// Role hierarchy: viewer < member < admin < owner
// ═══════════════════════════════════════════════════════════════════

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

/** Get a user's team membership (or null) */
export async function getTeamMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

/** Check if a user has at least `minRole` in a team */
export async function hasTeamRole(
  teamId: string,
  userId: string,
  minRole: TeamRole
): Promise<boolean> {
  const membership = await getTeamMembership(teamId, userId);
  if (!membership) return false;
  return ROLE_HIERARCHY[membership.role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if a user can access a project.
 * True if: direct owner, ProjectMember, or team member (when project has teamId).
 */
export async function canAccessProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, teamId: true },
  });
  if (!project) return false;

  // Direct owner
  if (project.userId === userId) return true;

  // Project member (shared individually)
  const projectMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (projectMember) return true;

  // Team member (when project belongs to a team)
  if (project.teamId) {
    const teamMember = await getTeamMembership(project.teamId, userId);
    if (teamMember) return true;
  }

  return false;
}

/**
 * Get effective role for a user on a project.
 * Returns: "owner" | "admin" | "editor" | "viewer" | null
 *
 * Mapping: team owner/admin → "admin", team member → "editor", team viewer → "viewer"
 */
export async function getProjectRole(
  projectId: string,
  userId: string
): Promise<"owner" | "admin" | "editor" | "viewer" | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, teamId: true },
  });
  if (!project) return null;

  // Direct owner
  if (project.userId === userId) return "owner";

  // Project member (shared individually)
  const projectMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (projectMember) {
    return projectMember.role === "editor" ? "editor" : "viewer";
  }

  // Team member
  if (project.teamId) {
    const teamMember = await getTeamMembership(project.teamId, userId);
    if (teamMember) {
      switch (teamMember.role) {
        case "owner":
        case "admin":
          return "admin";
        case "member":
          return "editor";
        case "viewer":
          return "viewer";
      }
    }
  }

  return null;
}
