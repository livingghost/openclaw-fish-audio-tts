import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFishAudioSpeechProvider } from "./speech-provider.js";

describe("Fish Audio speech provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads nested provider config from messages.tts.providers", () => {
    const provider = buildFishAudioSpeechProvider();
    const config = provider.resolveConfig?.({
      cfg: {} as never,
      rawConfig: {
        providers: {
          "fish-audio": {
            apiKey: "secret-token",
            baseUrl: "https://api.fish.audio/",
            voiceId: "voice-demo-01",
            model: "s2-pro",
            latency: "balanced",
            speed: 1.1,
            normalize: true,
            sampleRate: 44100,
          },
        },
      },
      timeoutMs: 1000,
    });

    expect(config).toEqual({
      apiKey: "secret-token",
      baseUrl: "https://api.fish.audio",
      voiceId: "voice-demo-01",
      model: "s2-pro",
      latency: "balanced",
      speed: 1.1,
      temperature: undefined,
      topP: undefined,
      normalize: true,
      chunkLength: undefined,
      sampleRate: 44100,
      mp3Bitrate: undefined,
      opusBitrate: undefined,
      maxNewTokens: undefined,
      repetitionPenalty: undefined,
      minChunkLength: undefined,
      conditionOnPreviousChunks: undefined,
      earlyStopThreshold: undefined,
      languages: undefined,
    });
  });

  it("requires both API key and voiceId for auto-selection", () => {
    const provider = buildFishAudioSpeechProvider();
    expect(
      provider.isConfigured?.({
        cfg: undefined,
        providerConfig: { apiKey: "token" },
        timeoutMs: 1000,
      }),
    ).toBe(false);

    vi.stubEnv("FISH_AUDIO_API_KEY", "env-token");
    expect(
      provider.isConfigured?.({
        cfg: undefined,
        providerConfig: { voiceId: "voice-demo-01" },
        timeoutMs: 1000,
      }),
    ).toBe(true);
  });

  it("uses voice-note defaults for synthesis and pcm 8000 for telephony", async () => {
    const provider = buildFishAudioSpeechProvider();
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(Buffer.from("audio"), { status: 200 })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const synthesis = await provider.synthesize?.({
      text: "hello",
      cfg: {} as never,
      providerConfig: {
        apiKey: "token",
        voiceId: "voice-demo-01",
        model: "s2-pro",
      },
      target: "voice-note",
      timeoutMs: 1000,
    });
    const telephony = await provider.synthesizeTelephony?.({
      text: "hello",
      cfg: {} as never,
      providerConfig: {
        apiKey: "token",
        voiceId: "voice-demo-01",
        model: "s2-pro",
      },
      timeoutMs: 1000,
    });

    expect(synthesis).toMatchObject({
      outputFormat: "opus",
      fileExtension: ".opus",
      voiceCompatible: true,
    });
    expect(telephony).toMatchObject({
      outputFormat: "pcm",
      sampleRate: 8000,
    });

    const voiceNoteBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const telephonyBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(voiceNoteBody).toMatchObject({
      format: "opus",
      sample_rate: 48000,
      opus_bitrate: 32,
    });
    expect(telephonyBody).toMatchObject({
      format: "pcm",
      sample_rate: 8000,
    });
  });

  it("maps talk.speak normalize strings onto provider overrides", () => {
    const provider = buildFishAudioSpeechProvider();
    const overrides = provider.resolveTalkOverrides?.({
      params: {
        voiceId: "voice-demo-01",
        modelId: "s2-pro",
        speed: 0.95,
        normalize: "on",
      },
    });

    expect(overrides).toMatchObject({
      voiceId: "voice-demo-01",
      model: "s2-pro",
      speed: 0.95,
      normalize: true,
    });
  });
});
