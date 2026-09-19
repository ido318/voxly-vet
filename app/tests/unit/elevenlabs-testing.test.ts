import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockUpdateAgent = vi.fn();
const mockRunTests = vi.fn();
const mockGetInvocation = vi.fn();

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: vi.fn().mockImplementation(function () {
    return {
      conversationalAi: {
        agents: {
          get: mockGetAgent,
          update: mockUpdateAgent,
          runTests: mockRunTests,
        },
        tests: {
          invocations: {
            get: mockGetInvocation,
          },
        },
      },
    };
  }),
}));

process.env.ELEVENLABS_API_KEY = "test-key";
process.env.ELEVENLABS_AGENT_ID = "test-agent";
process.env.ELEVENLABS_TEST_IDS = "test-1,test-2";

import { publishPrompt, runRegressionTests } from "@/lib/learning/elevenlabsTesting";

beforeEach(() => {
  mockGetAgent.mockReset();
  mockUpdateAgent.mockReset();
  mockRunTests.mockReset();
  mockGetInvocation.mockReset();
});

describe("publishPrompt", () => {
  it("preserves the live agent's tools, knowledgeBase, and rag when publishing a new prompt", async () => {
    mockGetAgent.mockResolvedValue({
      agentId: "test-agent",
      name: "Tomer",
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "old prompt",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledgeBase: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usageMode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agentId: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledgeBase: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usageMode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
    });
    expect(mockGetAgent).toHaveBeenCalledWith("test-agent");
  });

  it("still publishes with undefined tools/knowledgeBase/rag when the live agent has none set", async () => {
    mockGetAgent.mockResolvedValue({
      agentId: "test-agent",
      name: "Tomer",
      conversationConfig: { agent: { prompt: { prompt: "old prompt" } } },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agentId: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: undefined,
            knowledgeBase: undefined,
            rag: undefined,
          },
        },
      },
    });
    expect(mockGetAgent).toHaveBeenCalledWith("test-agent");
  });
});

describe("runRegressionTests", () => {
  it("includes the live agent's platformSettings in the override — ElevenLabs 422s without it", async () => {
    mockGetAgent.mockResolvedValue({
      agentId: "test-agent",
      conversationConfig: { agent: { prompt: { prompt: "old prompt" } } },
      platformSettings: { widget: { variant: "compact" } },
    });
    mockRunTests.mockResolvedValue({ id: "inv-1", testRuns: [{ status: "pending" }, { status: "pending" }] });
    mockGetInvocation.mockResolvedValue({
      id: "inv-1",
      testRuns: [{ status: "passed" }, { status: "passed" }],
    });

    const result = await runRegressionTests("candidate prompt");

    expect(mockGetAgent).toHaveBeenCalledWith("test-agent");
    expect(mockRunTests).toHaveBeenCalledWith("test-agent", {
      tests: [{ testId: "test-1" }, { testId: "test-2" }],
      agentConfigOverride: {
        conversationConfig: { agent: { prompt: { prompt: "candidate prompt" } } },
        platformSettings: { widget: { variant: "compact" } },
      },
    });
    expect(result.allPassed).toBe(true);
  });

  it("polls the invocation until no test run is left pending, then returns allPassed=false on any failure", async () => {
    vi.useFakeTimers();
    try {
      mockGetAgent.mockResolvedValue({ agentId: "test-agent", conversationConfig: {}, platformSettings: { widget: { variant: "compact" } } });
      mockRunTests.mockResolvedValue({ id: "inv-2", testRuns: [{ status: "pending" }] });
      mockGetInvocation
        .mockResolvedValueOnce({ id: "inv-2", testRuns: [{ status: "pending" }] })
        .mockResolvedValueOnce({ id: "inv-2", testRuns: [{ status: "passed" }, { status: "failed" }] });

      const resultPromise = runRegressionTests("candidate prompt");
      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(mockGetInvocation).toHaveBeenCalledTimes(2);
      expect(result.allPassed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns allPassed=null when a test run status is unrecognized", async () => {
    mockGetAgent.mockResolvedValue({ agentId: "test-agent", conversationConfig: {}, platformSettings: { widget: { variant: "compact" } } });
    mockRunTests.mockResolvedValue({ id: "inv-3", testRuns: [{ status: "pending" }] });
    mockGetInvocation.mockResolvedValue({ id: "inv-3", testRuns: [{ status: "errored" }] });

    const result = await runRegressionTests("candidate prompt");

    expect(result.allPassed).toBeNull();
  });
});
