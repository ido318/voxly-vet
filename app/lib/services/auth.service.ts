import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { ClinicRepository } from "@/lib/repositories/clinic.repository";
import type { ProfileRepository } from "@/lib/repositories/profile.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { MeResponse } from "@/types/api/me";
import type { Profile } from "@/types/domain/profile";

export class AuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly profileRepository: ProfileRepository,
    private readonly clinicRepository: ClinicRepository,
  ) {}

  async getSessionUser(): Promise<Result<User | null>> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      return err(AppError.unauthorized());
    }

    return ok(data.user ?? null);
  }

  async getProfile(userId: string): Promise<Result<Profile | null>> {
    return this.profileRepository.findByUserId(userId);
  }

  async getCurrentContext(): Promise<Result<MeResponse>> {
    const userResult = await this.getSessionUser();

    if (!userResult.ok) {
      return userResult;
    }

    if (!userResult.value) {
      return err(AppError.unauthorized());
    }

    const user = userResult.value;

    const profileResult = await this.profileRepository.findByUserId(user.id);

    if (!profileResult.ok) {
      return profileResult;
    }

    const membershipsResult =
      await this.clinicRepository.findMembershipsByUserId(user.id);

    if (!membershipsResult.ok) {
      return membershipsResult;
    }

    const profile = profileResult.value;

    return ok({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile: {
        id: user.id,
        fullName: profile?.fullName ?? null,
        phone: profile?.phone ?? null,
        defaultClinicId: profile?.defaultClinicId ?? null,
        role: profile?.role ?? "clinic_user",
      },
      memberships: membershipsResult.value.map((membership) => ({
        clinicId: membership.clinicId,
        clinicName: membership.clinic.name,
        clinicSlug: membership.clinic.slug,
        role: membership.role,
      })),
    });
  }

  async signOut(): Promise<Result<void>> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      return err(AppError.externalProvider("Failed to sign out", error));
    }

    return ok(undefined);
  }

  toServiceActor(context: MeResponse): ServiceActor {
    return {
      userId: context.user.id,
      clinicIds: context.memberships.map((membership) => membership.clinicId),
      defaultClinicId: context.profile.defaultClinicId,
      memberships: context.memberships.map((membership) => ({
        clinicId: membership.clinicId,
        role: membership.role,
      })),
    };
  }
}
