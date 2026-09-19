import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type TestDatabase = {
  public: {
    Tables: Record<string, TestTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type TestSupabaseClient = SupabaseClient<TestDatabase>;

export function createTestSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
): TestSupabaseClient {
  return createClient<TestDatabase>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
