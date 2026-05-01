import { test, expect, mock } from "bun:test"

import type { ChatCompletionsPayload } from "../src/services/copilot/create-chat-completions"

import { state } from "../src/lib/state"
import { createChatCompletions } from "../src/services/copilot/create-chat-completions"

// Mock state
state.copilotToken = "test-token"
state.vsCodeVersion = "1.0.0"
state.accountType = "individual"

// Helper to mock fetch
const fetchMock = mock(
  (_url: string, opts: { body?: string; headers: Record<string, string> }) => {
    return {
      ok: true,
      json: () => ({ id: "123", object: "chat.completion", choices: [] }),
      headers: opts.headers,
    }
  },
)
// @ts-expect-error - Mock fetch doesn't implement all fetch properties
;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock

function getLastFetchOptions() {
  const lastCall = fetchMock.mock.calls.at(-1)
  if (!lastCall) {
    throw new Error("fetch was not called")
  }
  return lastCall[1] as { body?: string; headers: Record<string, string> }
}

test("sets X-Initiator to agent if tool/assistant present", async () => {
  const payload: ChatCompletionsPayload = {
    messages: [
      { role: "user", content: "hi" },
      { role: "tool", content: "tool call" },
    ],
    model: "gpt-test",
  }
  await createChatCompletions(payload)
  expect(fetchMock).toHaveBeenCalled()
  const { headers } = getLastFetchOptions()
  expect(headers["X-Initiator"]).toBe("agent")
})

test("sets X-Initiator to user if only user present", async () => {
  const payload: ChatCompletionsPayload = {
    messages: [
      { role: "user", content: "hi" },
      { role: "user", content: "hello again" },
    ],
    model: "gpt-test",
  }
  await createChatCompletions(payload)
  expect(fetchMock).toHaveBeenCalled()
  const { headers } = getLastFetchOptions()
  expect(headers["X-Initiator"]).toBe("user")
})

test("normalizes adaptive thinking before forwarding to Copilot", async () => {
  const payload: ChatCompletionsPayload = {
    messages: [{ role: "user", content: "hi" }],
    model: "claude-sonnet-4",
    thinking: { type: "adaptive" },
  }

  await createChatCompletions(payload)

  const { body } = getLastFetchOptions()
  const forwardedPayload = JSON.parse(body ?? "{}") as ChatCompletionsPayload
  expect(forwardedPayload.thinking).toEqual({ type: "enabled" })
})
