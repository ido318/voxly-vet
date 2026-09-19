import { AppError } from "@/lib/errors/app-error";
import type { AuthService } from "@/lib/services/auth.service";
import type { Profile } from "@/types/domain/profile";
import type { User } from "@supabase/supabase-js";

/**
 * Guards /provider-admin/* API routes and pages. Unlike requireAuth(), this
 * also checks profiles.role — a site-wide flag, not clinic_memberships, so
 * this deliberately does NOT use getActorAndServices() (which throws for
 * anyone with zero clinic memberships).
 */
export async function requireProviderAdmin(
  authService: AuthService,
): Promise<{ user: User; profile: Profile }> {
  const userResult = await authService.getSessionUser();
  if (!userResult.ok) throw userResult.error;
  if (!userResult.value) throw AppError.unauthorized();
  const user = userResult.value;

  const profileResult = await authService.getProfile(user.id);
  if (!profileResult.ok) throw profileResult.error;
  if (!profileResult.value || profileResult.value.role !== "provider_admin") {
    throw AppError.forbidden("Provider admin access required");
  }

  return { user, profile: profileResult.value };
}
