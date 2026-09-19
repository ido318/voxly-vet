// Provide minimum env vars so modules that call getEnv() at load time don't crash.
process.env["NODE_ENV"] = "test";
process.env["LOG_LEVEL"] = "silent";
process.env["PUBLIC_BASE_URL"] = "https://test.example.com";
process.env["TWILIO_ACCOUNT_SID"] = "ACtest00000000000000000000000000";
process.env["TWILIO_AUTH_TOKEN"] = "test_auth_token";
process.env["TWILIO_PHONE_NUMBER"] = "+972500000000";
process.env["TWILIO_VALIDATE_SIGNATURE"] = "false";
process.env["ELEVENLABS_API_KEY"] = "test_elevenlabs_key";
process.env["ELEVENLABS_AGENT_ID"] = "agent_test";
process.env["ELEVENLABS_WEBHOOK_SECRET"] = "test-secret";
process.env["SUPABASE_URL"] = "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test_service_role_key";
process.env["AGENT_CLINIC_ID"] = "00000000-0000-4000-8000-000000000001";
process.env["JOBS_BEARER_TOKEN"] = "test-bearer-token-1234567";
process.env["TOOLS_BEARER_TOKEN"] = "test-tools-token-1234567";
process.env["ANTHROPIC_API_KEY"] = "test-anthropic-key";
