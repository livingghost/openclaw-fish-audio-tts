import { afterEach, describe, expect, it, vi } from "vitest";
import { fishAudioTTS, isValidFishAudioVoiceId, listFishAudioVoices } from "./tts.js";

describe("Fish Audio TTS client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts any non-empty reference_id string", () => {
    expect(isValidFishAudioVoiceId("voice-demo-01")).toBe(true);
    expect(isValidFishAudioVoiceId("demo voice")).toBe(true);
    expect(isValidFishAudioVoiceId("")).toBe(false);
    expect(isValidFishAudioVoiceId("   ")).toBe(false);
  });

  it("lists voices from the model endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              _id: "voice-demo-01",
              title: "Demo Voice",
              description: "Warm and steady",
              tags: ["warm", "narration"],
              languages: ["en-US", "ja-JP"],
              visibility: "public",
              author: { nickname: "fish" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const voices = await listFishAudioVoices({
      apiKey: "test-token",
      languages: ["en-US"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("/model");
    expect(String(requestUrl)).toContain("language=en-US");
    expect((requestInit as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    expect(voices).toEqual([
      {
        id: "voice-demo-01",
        title: "Demo Voice",
        description: "Warm and steady",
        tags: ["warm", "narration"],
        languages: ["en-US", "ja-JP"],
        visibility: "public",
        author: "fish",
      },
    ]);
  });

  it("synthesizes audio with the documented JSON request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from("audio"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const audioBuffer = await fishAudioTTS({
      text: "Hello from OpenClaw",
      apiKey: "Bearer prebuilt-token",
      voiceId: "voice-demo-01",
      model: "s2-pro",
      format: "mp3",
      sampleRate: 44100,
      mp3Bitrate: 128,
      speed: 1.1,
      temperature: 0.7,
      topP: 0.8,
      latency: "balanced",
      normalize: true,
      chunkLength: 200,
      timeoutMs: 1000,
    });

    expect(audioBuffer.equals(Buffer.from("audio"))).toBe(true);
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect((requestInit as RequestInit).headers).toMatchObject({
      Authorization: "Bearer prebuilt-token",
      "Content-Type": "application/json",
      model: "s2-pro",
    });
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      text: "Hello from OpenClaw",
      reference_id: "voice-demo-01",
      format: "mp3",
      temperature: 0.7,
      top_p: 0.8,
      prosody: {
        speed: 1.1,
      },
      chunk_length: 200,
      normalize: true,
      sample_rate: 44100,
      mp3_bitrate: 128,
      latency: "balanced",
    });
  });

  it("rejects unsupported sample rates for the selected format", async () => {
    await expect(
      fishAudioTTS({
        text: "Hello",
        apiKey: "test-token",
        voiceId: "voice-demo-01",
        model: "s2-pro",
        format: "opus",
        sampleRate: 44100,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("unsupported Fish Audio sampleRate 44100 for opus");
  });

  it("normalizes legacy opus bitrate values before calling the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from("audio"), {
        status: 200,
        headers: { "content-type": "audio/ogg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fishAudioTTS({
      text: "Hello from OpenClaw",
      apiKey: "test-token",
      voiceId: "voice-demo-01",
      model: "s2-pro",
      format: "opus",
      sampleRate: 48000,
      opusBitrate: 32,
      timeoutMs: 1000,
    });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      format: "opus",
      sample_rate: 48000,
      opus_bitrate: 32000,
    });
  });
});
