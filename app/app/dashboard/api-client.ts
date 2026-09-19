import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export async function dashboardApiFetch<T>(path: string): Promise<T | null> {
  const env = getEnv();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const response = await fetch(`${env.APP_BASE_URL}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}
