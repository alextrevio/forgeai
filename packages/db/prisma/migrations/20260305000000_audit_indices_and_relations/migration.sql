-- Add missing indices for performance
CREATE INDEX IF NOT EXISTS "Notification_projectId_idx" ON "Notification"("projectId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "Skill_authorId_idx" ON "Skill"("authorId");

-- Fix Skill.authorId onDelete behavior (SetNull instead of Restrict)
ALTER TABLE "Skill" DROP CONSTRAINT IF EXISTS "Skill_authorId_fkey";
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
