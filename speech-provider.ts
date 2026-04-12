import { formatErrorMessage } from "openclaw/plugin-sdk/error-runtime";
import { normalizeResolvedSecretInputString } from "openclaw/plugin-sdk/secret-input";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
  SpeechVoiceOption,
} from "openclaw/plugin-sdk/speech";
import {
  asBoolean,
  asFiniteNumber,
  asObject,
  requireInRange,
  trimToUndefined,
} from "openclaw/plugin-sdk/speech";
import {
  type FishAudioFormat,
  type FishAudioLatency,
  type FishAudioModel,
  fishAudioTTS,
  isValidFishAudioVoiceId,
  listFishAudioVoices,
  normalizeFishAudioBaseUrl,
  normalizeFishAudioFormat,
  normalizeFishAudioLatency,
  normalizeFishAudioModel,
} from "./tts.js";

const DEFAULT_FISH_AUDIO_MODEL = "s2-pro";
const DEFAULT_FISH_AUDIO_LATENCY = "normal";
const FISH_AUDIO_TTS_MODELS = ["s1", "s2-pro"] as const;

type FishAudioProviderConfig = {
  apiKey?: string;
  baseUrl: string;
  voiceId?: string;
  model: FishAudioModel;
  latency: FishAudioLatency;
  speed?: number;
  temperature?: number;
  topP?: number;
  normalize?: boolean;
  chunkLength?: number;
  sampleRate?: number;
  mp3Bitrate?: number;
  opusBitrate?: number;
  maxNewTokens?: number;
  repetitionPenalty?: number;
  minChunkLength?: number;
  conditionOnPreviousChunks?: boolean;
  earlyStopThreshold?: number;
  languages?: string[];
};

type FishAudioProviderOverrides = Partial<FishAudioProviderConfig>;

function parseNumberValue(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanValue(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseTalkNormalizeValue(value: unknown): boolean | undefined {
  const normalized = trimToUndefined(value);
  if (!normalized) {
    return undefined;
  }
  const lower = normalized.toLowerCase();
  if (lower === "auto") {
    return undefined;
  }
  return parseBooleanValue(normalized);
}

function normalizeVoiceId(value: unknown): string | undefined {
  const normalized = trimToUndefined(value);
  return normalized && isValidFishAudioVoiceId(normalized) ? normalized : normalized;
}

function normalizeProviderConfig(rawConfig: Record<string, unknown>): FishAudioProviderConfig {
  const providers = asObject(rawConfig.providers);
  const raw = asObject(providers?.["fish-audio"]) ?? asObject(rawConfig["fish-audio"]);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: "messages.tts.providers.fish-audio.apiKey",
    }),
    baseUrl: normalizeFishAudioBaseUrl(trimToUndefined(raw?.baseUrl)),
    voiceId: normalizeVoiceId(raw?.voiceId ?? raw?.referenceId),
    model:
      normalizeFishAudioModel(trimToUndefined(raw?.model ?? raw?.modelId)) ??
      DEFAULT_FISH_AUDIO_MODEL,
    latency: normalizeFishAudioLatency(trimToUndefined(raw?.latency)) ?? DEFAULT_FISH_AUDIO_LATENCY,
    speed: asFiniteNumber(raw?.speed),
    temperature: asFiniteNumber(raw?.temperature),
    topP: asFiniteNumber(raw?.topP ?? raw?.top_p),
    normalize: asBoolean(raw?.normalize),
    chunkLength: asFiniteNumber(raw?.chunkLength ?? raw?.chunk_length),
    sampleRate: asFiniteNumber(raw?.sampleRate ?? raw?.sample_rate),
    mp3Bitrate: asFiniteNumber(raw?.mp3Bitrate ?? raw?.mp3_bitrate),
    opusBitrate: asFiniteNumber(raw?.opusBitrate ?? raw?.opus_bitrate),
    maxNewTokens: asFiniteNumber(raw?.maxNewTokens ?? raw?.max_new_tokens),
    repetitionPenalty: asFiniteNumber(raw?.repetitionPenalty ?? raw?.repetition_penalty),
    minChunkLength: asFiniteNumber(raw?.minChunkLength ?? raw?.min_chunk_length),
    conditionOnPreviousChunks: asBoolean(
      raw?.conditionOnPreviousChunks ?? raw?.condition_on_previous_chunks,
    ),
    earlyStopThreshold: asFiniteNumber(raw?.earlyStopThreshold ?? raw?.early_stop_threshold),
    languages: Array.isArray(raw?.languages)
      ? raw.languages.map((entry) => String(entry).trim()).filter(Boolean)
      : undefined,
  };
}

function readProviderConfig(config: SpeechProviderConfig): FishAudioProviderConfig {
  const defaults = normalizeProviderConfig({});
  const raw = asObject(config) ?? {};
  return {
    apiKey: trimToUndefined(config.apiKey) ?? defaults.apiKey,
    baseUrl: normalizeFishAudioBaseUrl(trimToUndefined(config.baseUrl) ?? defaults.baseUrl),
    voiceId: normalizeVoiceId(raw.voiceId ?? raw.referenceId) ?? defaults.voiceId,
    model:
      normalizeFishAudioModel(trimToUndefined(raw.model ?? raw.modelId) ?? defaults.model) ??
      defaults.model,
    latency:
      normalizeFishAudioLatency(trimToUndefined(raw.latency) ?? defaults.latency) ??
      defaults.latency,
    speed: asFiniteNumber(raw.speed) ?? defaults.speed,
    temperature: asFiniteNumber(raw.temperature) ?? defaults.temperature,
    topP: asFiniteNumber(raw.topP ?? raw.top_p) ?? defaults.topP,
    normalize: asBoolean(raw.normalize) ?? defaults.normalize,
    chunkLength: asFiniteNumber(raw.chunkLength ?? raw.chunk_length) ?? defaults.chunkLength,
    sampleRate: asFiniteNumber(raw.sampleRate ?? raw.sample_rate) ?? defaults.sampleRate,
    mp3Bitrate: asFiniteNumber(raw.mp3Bitrate ?? raw.mp3_bitrate) ?? defaults.mp3Bitrate,
    opusBitrate: asFiniteNumber(raw.opusBitrate ?? raw.opus_bitrate) ?? defaults.opusBitrate,
    maxNewTokens: asFiniteNumber(raw.maxNewTokens ?? raw.max_new_tokens) ?? defaults.maxNewTokens,
    repetitionPenalty:
      asFiniteNumber(raw.repetitionPenalty ?? raw.repetition_penalty) ?? defaults.repetitionPenalty,
    minChunkLength:
      asFiniteNumber(raw.minChunkLength ?? raw.min_chunk_length) ?? defaults.minChunkLength,
    conditionOnPreviousChunks:
      asBoolean(raw.conditionOnPreviousChunks ?? raw.condition_on_previous_chunks) ??
      defaults.conditionOnPreviousChunks,
    earlyStopThreshold:
      asFiniteNumber(raw.earlyStopThreshold ?? raw.early_stop_threshold) ??
      defaults.earlyStopThreshold,
    languages: Array.isArray(raw.languages)
      ? raw.languages.map((entry) => String(entry).trim()).filter(Boolean)
      : defaults.languages,
  };
}

function readOverrides(overrides: SpeechProviderOverrides | undefined): FishAudioProviderOverrides {
  if (!overrides) {
    return {};
  }
  const raw = asObject(overrides) ?? {};
  return {
    voiceId: normalizeVoiceId(raw.voiceId ?? raw.referenceId),
    model: trimToUndefined(raw.model ?? raw.modelId)
      ? normalizeFishAudioModel(trimToUndefined(raw.model ?? raw.modelId))
      : undefined,
    latency: trimToUndefined(raw.latency)
      ? normalizeFishAudioLatency(trimToUndefined(raw.latency))
      : undefined,
    speed: asFiniteNumber(raw.speed),
    temperature: asFiniteNumber(raw.temperature),
    topP: asFiniteNumber(raw.topP ?? raw.top_p),
    normalize: asBoolean(raw.normalize),
    sampleRate: asFiniteNumber(raw.sampleRate ?? raw.sample_rate),
    mp3Bitrate: asFiniteNumber(raw.mp3Bitrate ?? raw.mp3_bitrate),
    opusBitrate: asFiniteNumber(raw.opusBitrate ?? raw.opus_bitrate),
  };
}

function parseDirectiveToken(ctx: SpeechDirectiveTokenParseContext) {
  try {
    switch (ctx.key) {
      case "voice":
      case "voiceid":
      case "voice_id":
      case "referenceid":
      case "reference_id":
      case "fish_voice":
      case "fishaudio_voice":
      case "fish_reference_id":
      case "fishaudio_reference_id":
        if (!ctx.policy.allowVoice) {
          return { handled: true };
        }
        if (!isValidFishAudioVoiceId(ctx.value)) {
          return { handled: true, warnings: [`invalid Fish Audio voiceId "${ctx.value}"`] };
        }
        return {
          handled: true,
          overrides: { ...ctx.currentOverrides, voiceId: ctx.value.trim() },
        };
      case "model":
      case "modelid":
      case "model_id":
      case "fish_model":
      case "fishaudio_model":
        if (!ctx.policy.allowModelId) {
          return { handled: true };
        }
        return {
          handled: true,
          overrides: {
            ...ctx.currentOverrides,
            model: normalizeFishAudioModel(ctx.value),
          },
        };
      case "speed":
      case "fish_speed":
      case "fishaudio_speed": {
        const value = parseNumberValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid speed value"] };
        }
        requireInRange(value, 0.5, 2, "speed");
        return { handled: true, overrides: { ...ctx.currentOverrides, speed: value } };
      }
      case "latency":
      case "fish_latency":
      case "fishaudio_latency":
        return {
          handled: true,
          overrides: {
            ...ctx.currentOverrides,
            latency: normalizeFishAudioLatency(ctx.value),
          },
        };
      case "temperature":
      case "fish_temperature":
      case "fishaudio_temperature": {
        const value = parseNumberValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid temperature value"] };
        }
        requireInRange(value, 0, 1, "temperature");
        return { handled: true, overrides: { ...ctx.currentOverrides, temperature: value } };
      }
      case "top_p":
      case "topp":
      case "fish_top_p":
      case "fishaudio_top_p": {
        const value = parseNumberValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid topP value"] };
        }
        requireInRange(value, 0, 1, "topP");
        return { handled: true, overrides: { ...ctx.currentOverrides, topP: value } };
      }
      case "normalize":
      case "fish_normalize":
      case "fishaudio_normalize": {
        if (!ctx.policy.allowNormalization) {
          return { handled: true };
        }
        const value = parseBooleanValue(ctx.value);
        if (value == null) {
          return { handled: true, warnings: ["invalid normalize value"] };
        }
        return { handled: true, overrides: { ...ctx.currentOverrides, normalize: value } };
      }
      default:
        return { handled: false };
    }
  } catch (error) {
    return {
      handled: true,
      warnings: [formatErrorMessage(error)],
    };
  }
}

function fileExtensionForFormat(format: FishAudioFormat): string {
  switch (format) {
    case "mp3":
      return ".mp3";
    case "opus":
      return ".opus";
    case "wav":
      return ".wav";
    case "pcm":
      return ".pcm";
  }
}

export function buildFishAudioSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "fish-audio",
    label: "Fish Audio",
    autoSelectOrder: 18,
    models: [...FISH_AUDIO_TTS_MODELS],
    resolveConfig: ({ rawConfig }) => normalizeProviderConfig(rawConfig),
    parseDirectiveToken,
    resolveTalkConfig: ({ baseTtsConfig, talkProviderConfig }) => {
      const base = normalizeProviderConfig(baseTtsConfig);
      return {
        ...base,
        ...(talkProviderConfig.apiKey === undefined
          ? {}
          : {
              apiKey: normalizeResolvedSecretInputString({
                value: talkProviderConfig.apiKey,
                path: "talk.providers.fish-audio.apiKey",
              }),
            }),
        ...(trimToUndefined(talkProviderConfig.baseUrl) == null
          ? {}
          : { baseUrl: normalizeFishAudioBaseUrl(trimToUndefined(talkProviderConfig.baseUrl)) }),
        ...(trimToUndefined(talkProviderConfig.voiceId) == null
          ? {}
          : { voiceId: normalizeVoiceId(talkProviderConfig.voiceId) }),
        ...(trimToUndefined(talkProviderConfig.modelId ?? talkProviderConfig.model) == null
          ? {}
          : {
              model:
                normalizeFishAudioModel(
                  trimToUndefined(talkProviderConfig.modelId ?? talkProviderConfig.model),
                ) ?? base.model,
            }),
        ...(trimToUndefined(talkProviderConfig.latency) == null
          ? {}
          : {
              latency:
                normalizeFishAudioLatency(trimToUndefined(talkProviderConfig.latency)) ??
                base.latency,
            }),
        ...(asFiniteNumber(talkProviderConfig.speed) == null
          ? {}
          : { speed: asFiniteNumber(talkProviderConfig.speed) }),
        ...(asFiniteNumber(talkProviderConfig.temperature) == null
          ? {}
          : { temperature: asFiniteNumber(talkProviderConfig.temperature) }),
        ...(asFiniteNumber(talkProviderConfig.topP ?? talkProviderConfig.top_p) == null
          ? {}
          : { topP: asFiniteNumber(talkProviderConfig.topP ?? talkProviderConfig.top_p) }),
        ...(asBoolean(talkProviderConfig.normalize) == null
          ? {}
          : { normalize: asBoolean(talkProviderConfig.normalize) }),
      };
    },
    resolveTalkOverrides: ({ params }) => ({
      ...(trimToUndefined(params.voiceId) == null
        ? {}
        : { voiceId: normalizeVoiceId(params.voiceId) }),
      ...(trimToUndefined(params.modelId ?? params.model) == null
        ? {}
        : {
            model:
              normalizeFishAudioModel(trimToUndefined(params.modelId ?? params.model)) ??
              DEFAULT_FISH_AUDIO_MODEL,
          }),
      ...(asFiniteNumber(params.speed) == null ? {} : { speed: asFiniteNumber(params.speed) }),
      ...(parseTalkNormalizeValue(params.normalize) == null
        ? {}
        : { normalize: parseTalkNormalizeValue(params.normalize) }),
    }),
    listVoices: async (req): Promise<SpeechVoiceOption[]> => {
      const config = req.providerConfig ? readProviderConfig(req.providerConfig) : undefined;
      const apiKey = req.apiKey || config?.apiKey || process.env.FISH_AUDIO_API_KEY;
      if (!apiKey) {
        throw new Error("Fish Audio API key missing");
      }
      const voices = await listFishAudioVoices({
        apiKey,
        baseUrl: req.baseUrl ?? config?.baseUrl,
        languages: config?.languages,
      });
      return voices.map((voice) => ({
        id: voice.id,
        name: voice.title ?? voice.id,
        description: voice.description,
        category: voice.visibility,
        locale: voice.languages?.[0],
        personalities: voice.tags,
      }));
    },
    isConfigured: ({ providerConfig }) => {
      const config = readProviderConfig(providerConfig);
      const apiKey = config.apiKey || process.env.FISH_AUDIO_API_KEY;
      return Boolean(apiKey && config.voiceId);
    },
    synthesize: async (req) => {
      const config = readProviderConfig(req.providerConfig);
      const overrides = readOverrides(req.providerOverrides);
      const apiKey = config.apiKey || process.env.FISH_AUDIO_API_KEY;
      if (!apiKey) {
        throw new Error("Fish Audio API key missing");
      }

      const format =
        normalizeFishAudioFormat(trimToUndefined(req.providerOverrides?.outputFormat)) ??
        (req.target === "voice-note" ? "opus" : "mp3");
      const sampleRate =
        overrides.sampleRate ??
        config.sampleRate ??
        (format === "opus" ? 48000 : format === "mp3" ? 44100 : undefined);
      const audioBuffer = await fishAudioTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        voiceId: overrides.voiceId ?? config.voiceId ?? "",
        model: overrides.model ?? config.model,
        format,
        sampleRate,
        mp3Bitrate:
          format === "mp3" ? (overrides.mp3Bitrate ?? config.mp3Bitrate ?? 128) : undefined,
        opusBitrate:
          format === "opus" ? (overrides.opusBitrate ?? config.opusBitrate ?? 32) : undefined,
        speed: overrides.speed ?? config.speed,
        temperature: overrides.temperature ?? config.temperature,
        topP: overrides.topP ?? config.topP,
        latency: overrides.latency ?? config.latency,
        normalize: overrides.normalize ?? config.normalize,
        chunkLength: config.chunkLength,
        maxNewTokens: config.maxNewTokens,
        repetitionPenalty: config.repetitionPenalty,
        minChunkLength: config.minChunkLength,
        conditionOnPreviousChunks: config.conditionOnPreviousChunks,
        earlyStopThreshold: config.earlyStopThreshold,
        timeoutMs: req.timeoutMs,
      });
      return {
        audioBuffer,
        outputFormat: format,
        fileExtension: fileExtensionForFormat(format),
        voiceCompatible: req.target === "voice-note" && format === "opus",
      };
    },
    synthesizeTelephony: async (req) => {
      const config = readProviderConfig(req.providerConfig);
      const apiKey = config.apiKey || process.env.FISH_AUDIO_API_KEY;
      if (!apiKey) {
        throw new Error("Fish Audio API key missing");
      }
      const outputFormat = "pcm";
      const sampleRate = 8000;
      const audioBuffer = await fishAudioTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        voiceId: config.voiceId ?? "",
        model: config.model,
        format: outputFormat,
        sampleRate,
        speed: config.speed,
        temperature: config.temperature,
        topP: config.topP,
        latency: config.latency,
        normalize: config.normalize,
        chunkLength: config.chunkLength,
        maxNewTokens: config.maxNewTokens,
        repetitionPenalty: config.repetitionPenalty,
        minChunkLength: config.minChunkLength,
        conditionOnPreviousChunks: config.conditionOnPreviousChunks,
        earlyStopThreshold: config.earlyStopThreshold,
        timeoutMs: req.timeoutMs,
      });
      return {
        audioBuffer,
        outputFormat,
        sampleRate,
      };
    },
  };
}
