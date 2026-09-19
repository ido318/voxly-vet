import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

const baseEnv = {
  APP_ENV: "test",
  APP_BASE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("getEnv", () => {
  afterEach(() => {
    resetEnvCache();
  });

  it("parses valid environment variables", () => {
    Object.assign(process.env, baseEnv);
    resetEnvCache();

    const env = getEnv();

    expect(env.APP_ENV).toBe("test");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("derives APP_BASE_URL from VERCEL_URL when it is not set explicitly", () => {
    Object.assign(process.env, baseEnv);
    delete process.env.APP_BASE_URL;
    process.env.VERCEL_URL = "my-app-git-some-branch.vercel.app";
    resetEnvCache();

    expect(getEnv().APP_BASE_URL).toBe("https://my-app-git-some-branch.vercel.app");

    delete process.env.VERCEL_URL;
  });

  it("prefers an explicit APP_BASE_URL over VERCEL_URL", () => {
    Object.assign(process.env, baseEnv);
    process.env.VERCEL_URL = "my-app-git-some-branch.vercel.app";
    resetEnvCache();

    expect(getEnv().APP_BASE_URL).toBe("http://localhost:3000");

    delete process.env.VERCEL_URL;
  });

  it("throws when required variables are missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetEnvCache();

    expect(() => getEnv()).toThrow(/Invalid server environment variables/);
  });
});
