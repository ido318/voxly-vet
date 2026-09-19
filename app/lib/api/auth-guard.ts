import { AppError } from "@/lib/errors/app-error";
import type { AuthService } from "@/lib/services/auth.service";

export async function requireAuth(authService: AuthService) {
  const result = await authService.getSessionUser();

  if (!result.ok) {
    throw result.error;
  }

  if (!result.value) {
    throw AppError.unauthorized();
  }

  return result.value;
}
