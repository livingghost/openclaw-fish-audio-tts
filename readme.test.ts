import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import { buildFishAudioSpeechProvider } from "./speech-provider.js";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.join(extensionRoot, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const provider = buildFishAudioSpeechProvider();

function extractFenceAfterHeading(readmeText: string, heading: string): string {
  const headingIndex = readmeText.indexOf(heading);
  if (headingIndex < 0) {
    throw new Error(`missing heading: ${heading}`);
  }
  const fenceStart = readmeText.indexOf("```", headingIndex);
  if (fenceStart < 0) {
    throw new Error(`missing code fence after heading: ${heading}`);
  }
  const bodyStart = readmeText.indexOf("\n", fenceStart);
  if (bodyStart < 0) {
    throw new Error(`missing code fence body after heading: ${heading}`);
  }
  const fenceEnd = readmeText.indexOf("\n```", bodyStart);
  if (fenceEnd < 0) {
    throw new Error(`missing fence terminator after heading: ${heading}`);
  }
  return readmeText.slice(bodyStart + 1, fenceEnd).trim();
}

function parseJson5Fence<T>(heading: string): T {
  return JSON5.parse(extractFenceAfterHeading(readme, heading)) as T;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

describe("fish-audio README examples", () => {
  it("keeps the minimal messages.tts example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{ messages?: { tts?: Record<string, unknown> } }>(
      "## Minimal TTS config",
    );
    expect(example.messages?.tts?.provider).toBe("fish-audio");

    const resolved = provider.resolveConfig({
      rawConfig: example.messages?.tts ?? {},
    }) as {
      voiceId?: string;
      model?: string;
      latency?: string;
      baseUrl?: string;
    };

    expect(resolved.voiceId).toBe("802e3bc2b27e49c2995d23ef70e6ac89");
    expect(resolved.model).toBe("s2-pro");
    expect(resolved.latency).toBe("normal");
    expect(resolved.baseUrl).toBe("https://api.fish.audio");
  });

  it("keeps the full messages.tts example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{ messages?: { tts?: Record<string, unknown> } }>(
      "## Example with supported settings",
    );

    const resolved = provider.resolveConfig({
      rawConfig: example.messages?.tts ?? {},
    }) as {
      voiceId?: string;
      model?: string;
      latency?: string;
      speed?: number;
      temperature?: number;
      topP?: number;
      normalize?: boolean;
      chunkLength?: number;
      sampleRate?: number;
      mp3Bitrate?: number;
    };

    expect(resolved).toMatchObject({
      voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
      model: "s2-pro",
      latency: "normal",
      speed: 1,
      temperature: 0.7,
      topP: 0.7,
      normalize: true,
      chunkLength: 300,
      sampleRate: 44100,
      mp3Bitrate: 128,
    });
  });

  it("keeps the talk provider example parseable and normalizable", () => {
    const example = parseJson5Fence<{
      talk?: {
        provider?: string;
        providers?: Record<string, Record<string, unknown>>;
      };
    }>("## Talk mode example");
    expect(example.talk?.provider).toBe("fish-audio");

    const resolved = provider.resolveTalkConfig?.({
      baseTtsConfig: {},
      talkProviderConfig: example.talk?.providers?.["fish-audio"] ?? {},
    }) as
      | {
          voiceId?: string;
          model?: string;
          latency?: string;
          speed?: number;
          normalize?: boolean;
        }
      | undefined;

    expect(resolved).toMatchObject({
      voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
      model: "s2-pro",
      latency: "balanced",
      speed: 1,
      normalize: true,
    });
  });

  it("keeps the talk.speak payload example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<Record<string, unknown>>("### `talk.speak` override example");
    const params = asObject(example.params);

    expect(example.method).toBe("talk.speak");
    expect(params?.text).toBe("Hello, this is OpenClaw.");
    expect(params?.voiceId).toBe("802e3bc2b27e49c2995d23ef70e6ac89");
    expect(params?.modelId).toBe("s2-pro");
    expect(params?.speed).toBe(0.95);
    expect(params?.normalize).toBe("on");

    const overrides = provider.resolveTalkOverrides?.({
      params: params ?? {},
    }) as
      | {
          voiceId?: string;
          model?: string;
          speed?: number;
          normalize?: boolean;
        }
      | undefined;

    expect(overrides).toMatchObject({
      voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
      model: "s2-pro",
      speed: 0.95,
      normalize: true,
    });
  });

  it("keeps the Discord voice override example parseable and provider-normalizable", () => {
    const example = parseJson5Fence<{
      channels?: {
        discord?: {
          voice?: {
            enabled?: boolean;
            tts?: Record<string, unknown>;
          };
        };
      };
    }>("## Discord voice example");
    expect(example.channels?.discord?.voice?.enabled).toBe(true);
    expect(example.channels?.discord?.voice?.tts?.provider).toBe("fish-audio");

    const resolved = provider.resolveConfig({
      rawConfig: example.channels?.discord?.voice?.tts ?? {},
    }) as {
      voiceId?: string;
      model?: string;
      latency?: string;
    };

    expect(resolved).toMatchObject({
      voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
      model: "s2-pro",
      latency: "normal",
    });
  });
});
