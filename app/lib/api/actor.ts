import { AppError } from "@/lib/errors/app-error";
import type { ServiceActor } from "@/lib/services/service-context";
import { createServices } from "@/lib/services/factory";

export async function getActorAndServices(): Promise<
  Awaited<ReturnType<typeof createServices>> & { actor: ServiceActor }
> {
  const services = await createServices();
  const contextResult = await services.auth.getCurrentContext();
  if (!contextResult.ok) {
    throw contextResult.error;
  }

  const actor = services.auth.toServiceActor(contextResult.value);
  if (actor.clinicIds.length === 0) {
    throw AppError.forbidden("No clinic memberships found");
  }

  return { ...services, actor };
}
