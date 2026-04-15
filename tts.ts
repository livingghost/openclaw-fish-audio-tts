import {
  asObject,
  readResponseTextLimited,
  requireInRange,
  trimToUndefined,
  truncateErrorDetail,
} from "openclaw/plugin-sdk/speech";

const DEFAULT_FISH_AUDIO_BASE_URL = "https://api.fish.audio";
const FISH_AUDIO_MODELS = new Set(["s1", "s2-pro"] as const);
const FISH_AUDIO_FORMATS = new Set(["mp3", "opus", "wav", "pcm"] as const);
const FISH_AUDIO_LATENCIES = new Set(["low", "normal", "balanced"] as const);
const MP3_BITRATES = new Set([64, 128, 192]);
const OPUS_BITRATES = new Set([-1000, 24000, 32000, 48000, 64000]);
const OPUS_BITRATE_ALIASES = new Map([
  [24, 24000],
  [32, 32000],
  [48, 48000],
  [64, 64000],
]);
const SAMPLE_RATES_BY_FORMAT = {
  mp3: new Set([32000, 44100]),
  opus: new Set([48000]),
  wav: new Set([8000, 16000, 24000, 32000, 44100]),
  pcm: new Set([8000, 16000, 24000, 32000, 44100]),
} as const;

export type FishAudioModel = "s1" | "s2-pro";
export type FishAudioFormat = "mp3" | "opus" | "wav" | "pcm";
export type FishAudioLatency = "low" | "normal" | "balanced";

export type FishAudioVoiceOption = {
  id: string;
  title?: string;
  description?: string;
  tags?: string[];
  languages?: string[];
  visibility?: string;
  author?: string;
};

export type FishAudioTTSRequest = {
  text: string;
  apiKey: string;
  baseUrl?: string;
  voiceId: string;
  model: FishAudioModel;
  format: FishAudioFormat;
  sampleRate?: number;
  mp3Bitrate?: number;
  opusBitrate?: number;
  speed?: number;
  temperature?: number;
  topP?: number;
  latency?: FishAudioLatency;
  normalize?: boolean;
  chunkLength?: number;
  maxNewTokens?: number;
  repetitionPenalty?: number;
  minChunkLength?: number;
  conditionOnPreviousChunks?: boolean;
  earlyStopThreshold?: number;
  timeoutMs: number;
};

function buildFishAudioAuthHeader(apiKey: string): string {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new Error("Fish Audio API key missing");
  }
  return /^bearer\s+/i.test(normalized) ? normalized : `Bearer ${normalized}`;
}

export function normalizeFishAudioBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  return trimmed?.replace(/\/+$/, "") || DEFAULT_FISH_AUDIO_BASE_URL;
}

export function isValidFishAudioVoiceId(value: string): boolean {
  return value.trim().length > 0;
}

export function normalizeFishAudioModel(value: string | undefined): FishAudioModel | undefined {
  const normalized = value?.trim().toLowerCase() as FishAudioModel | undefined;
  if (!normalized) {
    return undefined;
  }
  if (!FISH_AUDIO_MODELS.has(normalized)) {
    throw new Error(`invalid Fish Audio model "${value}"`);
  }
  return normalized;
}

export function normalizeFishAudioFormat(value: string | undefined): FishAudioFormat | undefined {
  const normalized = value?.trim().toLowerCase() as FishAudioFormat | undefined;
  if (!normalized) {
    return undefined;
  }
  if (!FISH_AUDIO_FORMATS.has(normalized)) {
    throw new Error(`invalid Fish Audio format "${value}"`);
  }
  return normalized;
}

export function normalizeFishAudioLatency(value: string | undefined): FishAudioLatency | undefined {
  const normalized = value?.trim().toLowerCase() as FishAudioLatency | undefined;
  if (!normalized) {
    return undefined;
  }
  if (!FISH_AUDIO_LATENCIES.has(normalized)) {
    throw new Error(`invalid Fish Audio latency "${value}"`);
  }
  return normalized;
}

function formatFishAudioErrorPayload(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }
  const message = trimToUndefined(root.message) ?? trimToUndefined(root.detail);
  const status =
    (typeof root.status === "number" ? String(root.status) : undefined) ??
    trimToUndefined(root.status);
  if (message && status) {
    return `${truncateErrorDetail(message)} [status=${status}]`;
  }
  if (message) {
    return truncateErrorDetail(message);
  }
  if (status) {
    return `[status=${status}]`;
  }
  return undefined;
}

async function extractFishAudioErrorDetail(response: Response): Promise<string | undefined> {
  const rawBody = trimToUndefined(await readResponseTextLimited(response));
  if (!rawBody) {
    return undefined;
  }
  try {
    return formatFishAudioErrorPayload(JSON.parse(rawBody)) ?? truncateErrorDetail(rawBody);
  } catch {
    return truncateErrorDetail(rawBody);
  }
}

function normalizeFishAudioOpusBitrate(opusBitrate: number | undefined): number | undefined {
  if (opusBitrate == null) {
    return undefined;
  }
  const normalized = OPUS_BITRATE_ALIASES.get(opusBitrate) ?? opusBitrate;
  if (!OPUS_BITRATES.has(normalized)) {
    throw new Error(
      `unsupported Fish Audio opusBitrate "${opusBitrate}" (allowed: -1000, 24/24000, 32/32000, 48/48000, 64/64000)`,
    );
  }
  return normalized;
}

function assertFishAudioRequest(params: FishAudioTTSRequest): void {
  if (!params.text.trim()) {
    throw new Error("Fish Audio TTS text is empty");
  }
  if (!isValidFishAudioVoiceId(params.voiceId)) {
    throw new Error(`invalid Fish Audio voiceId "${params.voiceId}"`);
  }
  normalizeFishAudioModel(params.model);
  normalizeFishAudioFormat(params.format);
  if (params.latency != null) {
    normalizeFishAudioLatency(params.latency);
  }
  if (params.sampleRate != null) {
    const supported = SAMPLE_RATES_BY_FORMAT[params.format];
    if (!supported.has(params.sampleRate)) {
      throw new Error(
        `unsupported Fish Audio sampleRate ${params.sampleRate} for ${params.format} (allowed: ${[
          ...supported,
        ].join(", ")})`,
      );
    }
  }
  if (params.mp3Bitrate != null && !MP3_BITRATES.has(params.mp3Bitrate)) {
    throw new Error(`unsupported Fish Audio mp3Bitrate "${params.mp3Bitrate}"`);
  }
  normalizeFishAudioOpusBitrate(params.opusBitrate);
  if (params.speed != null) {
    requireInRange(params.speed, 0.5, 2, "speed");
  }
  if (params.temperature != null) {
    requireInRange(params.temperature, 0, 1, "temperature");
  }
  if (params.topP != null) {
    requireInRange(params.topP, 0, 1, "topP");
  }
  if (params.chunkLength != null) {
    requireInRange(params.chunkLength, 100, 300, "chunkLength");
  }
  if (params.minChunkLength != null) {
    requireInRange(params.minChunkLength, 0, 100, "minChunkLength");
  }
  if (params.earlyStopThreshold != null) {
    requireInRange(params.earlyStopThreshold, 0, 1, "earlyStopThreshold");
  }
  if (params.maxNewTokens != null) {
    requireInRange(params.maxNewTokens, 1, 4096, "maxNewTokens");
  }
  if (params.repetitionPenalty != null) {
    requireInRange(params.repetitionPenalty, 0, 10, "repetitionPenalty");
  }
}

export async function listFishAudioVoices(params: {
  apiKey: string;
  baseUrl?: string;
  languages?: string[];
  pageSize?: number;
}): Promise<FishAudioVoiceOption[]> {
  const url = new URL(`${normalizeFishAudioBaseUrl(params.baseUrl)}/model`);
  url.searchParams.set("page_size", String(params.pageSize ?? 100));
  url.searchParams.set("sort_by", "task_count");
  for (const language of params.languages ?? []) {
    const normalized = language.trim();
    if (normalized) {
      url.searchParams.append("language", normalized);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: buildFishAudioAuthHeader(params.apiKey),
    },
  });
  if (!response.ok) {
    const detail = await extractFishAudioErrorDetail(response);
    throw new Error(
      `Fish Audio model API error (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = (await response.json()) as {
    items?: Array<{
      _id?: string;
      title?: string;
      description?: string;
      tags?: string[];
      languages?: string[];
      visibility?: string;
      author?: { nickname?: string };
    }>;
  };

  return Array.isArray(payload.items)
    ? payload.items
        .map((item) => ({
          id: item._id?.trim() ?? "",
          title: trimToUndefined(item.title),
          description: trimToUndefined(item.description),
          tags: Array.isArray(item.tags)
            ? item.tags.map((tag) => tag.trim()).filter(Boolean)
            : undefined,
          languages: Array.isArray(item.languages)
            ? item.languages.map((language) => language.trim()).filter(Boolean)
            : undefined,
          visibility: trimToUndefined(item.visibility),
          author: trimToUndefined(item.author?.nickname),
        }))
        .filter((voice) => voice.id.length > 0)
    : [];
}

export async function fishAudioTTS(params: FishAudioTTSRequest): Promise<Buffer> {
  assertFishAudioRequest(params);
  const normalizedOpusBitrate = normalizeFishAudioOpusBitrate(params.opusBitrate);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(`${normalizeFishAudioBaseUrl(params.baseUrl)}/v1/tts`, {
      method: "POST",
      headers: {
        Authorization: buildFishAudioAuthHeader(params.apiKey),
        "Content-Type": "application/json",
        model: params.model,
      },
      body: JSON.stringify({
        text: params.text.trim(),
        reference_id: params.voiceId.trim(),
        format: params.format,
        ...(params.temperature == null ? {} : { temperature: params.temperature }),
        ...(params.topP == null ? {} : { top_p: params.topP }),
        ...(params.speed == null ? {} : { prosody: { speed: params.speed } }),
        ...(params.chunkLength == null ? {} : { chunk_length: params.chunkLength }),
        ...(params.normalize == null ? {} : { normalize: params.normalize }),
        ...(params.sampleRate == null ? {} : { sample_rate: params.sampleRate }),
        ...(params.mp3Bitrate == null ? {} : { mp3_bitrate: params.mp3Bitrate }),
        ...(normalizedOpusBitrate == null ? {} : { opus_bitrate: normalizedOpusBitrate }),
        ...(params.latency == null ? {} : { latency: params.latency }),
        ...(params.maxNewTokens == null ? {} : { max_new_tokens: params.maxNewTokens }),
        ...(params.repetitionPenalty == null
          ? {}
          : { repetition_penalty: params.repetitionPenalty }),
        ...(params.minChunkLength == null ? {} : { min_chunk_length: params.minChunkLength }),
        ...(params.conditionOnPreviousChunks == null
          ? {}
          : { condition_on_previous_chunks: params.conditionOnPreviousChunks }),
        ...(params.earlyStopThreshold == null
          ? {}
          : { early_stop_threshold: params.earlyStopThreshold }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await extractFishAudioErrorDetail(response);
      throw new Error(
        `Fish Audio TTS API error (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new Error("Fish Audio TTS API returned no audio data");
    }
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}
