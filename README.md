# Fish Audio TTS for OpenClaw

Unofficial, community-maintained OpenClaw plugin that adds the Fish Audio TTS provider.
It is built for OpenClaw's extension loader and local wrapper use, not as a generic Fish Audio SDK wrapper.

- Package name: `openclaw-fish-audio-tts`
- Extension/plugin id: `fish-audio-tts`
- Speech provider id: `fish-audio`
- License: `MIT`
- Required auth: `FISH_AUDIO_API_KEY` or `messages.tts.providers["fish-audio"].apiKey`

The extension registers the `fish-audio` speech provider, so OpenClaw config uses
`messages.tts.provider: "fish-audio"` and `messages.tts.providers["fish-audio"]`.

## Requirements

- OpenClaw `>=2026.4.11`
- Fish Audio API key via `FISH_AUDIO_API_KEY` or `messages.tts.providers["fish-audio"].apiKey`
- A Fish Audio single-speaker `voiceId` / `reference_id`

## Minimal TTS config

```json5
{
  messages: {
    tts: {
      provider: "fish-audio",
      providers: {
        "fish-audio": {
          voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
        },
      },
    },
  },
}
```

## Example with supported settings

```json5
{
  messages: {
    tts: {
      provider: "fish-audio",
      providers: {
        "fish-audio": {
          apiKey: "optional-if-FISH_AUDIO_API_KEY-is-set",
          baseUrl: "https://api.fish.audio",
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
        },
      },
    },
  },
}
```

## Talk mode example

Talk mode uses `talk.provider` and `talk.providers.<provider>`.
For Fish Audio, keep the Talk provider name as `fish-audio`.

```json5
{
  talk: {
    provider: "fish-audio",
    providers: {
      "fish-audio": {
        voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
        model: "s2-pro",
        latency: "balanced",
        speed: 1,
        normalize: true,
      },
    },
  },
}
```

### `talk.speak` override example

The public `talk.speak` gateway method accepts the generic Talk override fields.
For Fish Audio, the practical per-request overrides are `voiceId`, `modelId`, `speed`,
and `normalize`.

```json
{
  "method": "talk.speak",
  "params": {
    "text": "Hello, this is OpenClaw.",
    "voiceId": "802e3bc2b27e49c2995d23ef70e6ac89",
    "modelId": "s2-pro",
    "speed": 0.95,
    "normalize": "on"
  }
}
```

## Discord voice example

Discord voice playback can override the global `messages.tts` config with `channels.discord.voice.tts`.

```json5
{
  channels: {
    discord: {
      voice: {
        enabled: true,
        tts: {
          provider: "fish-audio",
          providers: {
            "fish-audio": {
              voiceId: "802e3bc2b27e49c2995d23ef70e6ac89",
              model: "s2-pro",
              latency: "normal",
            },
          },
        },
      },
    },
  },
}
```

## Emotion and style tags

Fish Audio emotion control is text-driven. The plugin does not transform these markers; it passes
them through exactly as written.

```text
(happy) What a beautiful day!
(sad)(whispering) I'll miss you so much.
(excited)(laughing) We did it! Ha ha ha!
```

These examples come from Fish Audio's emotion reference. You can mix tags such as
`(happy)`, `(sad)`, `(whispering)`, `(laughing)`, `(sighing)`, and `(panting)` directly into the
spoken text when the target voice/model supports them.

## Config reference

| Key                         | Type      | Default                  | Notes                                                                     |
| --------------------------- | --------- | ------------------------ | ------------------------------------------------------------------------- |
| `apiKey`                    | `string`  | unset                    | Falls back to `FISH_AUDIO_API_KEY`.                                       |
| `baseUrl`                   | `string`  | `https://api.fish.audio` | Trailing slash is removed automatically.                                  |
| `voiceId`                   | `string`  | unset                    | Maps to Fish Audio single-speaker `reference_id`. Required for synthesis. |
| `model`                     | `string`  | `s2-pro`                 | Supported values are listed below.                                        |
| `latency`                   | `string`  | `normal`                 | `low`, `normal`, `balanced`.                                              |
| `speed`                     | `number`  | provider default         | Allowed range is `0.5` to `2.0`.                                          |
| `temperature`               | `number`  | provider default         | Allowed range is `0` to `1`.                                              |
| `topP`                      | `number`  | provider default         | Allowed range is `0` to `1`.                                              |
| `normalize`                 | `boolean` | provider default         | Maps to Fish Audio text normalization.                                    |
| `chunkLength`               | `number`  | provider default         | Allowed range is `100` to `300`.                                          |
| `sampleRate`                | `number`  | target-dependent         | Allowed sample rates depend on format.                                    |
| `mp3Bitrate`                | `number`  | `128`                    | Only applies when format is `mp3`.                                        |
| `opusBitrate`               | `number`  | `32`                     | Only applies when format is `opus`.                                       |
| `maxNewTokens`              | `number`  | provider default         | Optional generation cap per chunk.                                        |
| `repetitionPenalty`         | `number`  | provider default         | Optional repetition control.                                              |
| `minChunkLength`            | `number`  | provider default         | Allowed range is `0` to `100`.                                            |
| `conditionOnPreviousChunks` | `boolean` | provider default         | Keeps voice consistency across chunks.                                    |
| `earlyStopThreshold`        | `number`  | provider default         | Allowed range is `0` to `1`.                                              |

## Supported values

### `model`

- `s1`
- `s2-pro`

### Output formats

- `mp3`
- `opus`
- `wav`
- `pcm`

### Sample rates

- `mp3`: `32000`, `44100`
- `opus`: `48000`
- `wav` / `pcm`: `8000`, `16000`, `24000`, `32000`, `44100`

## Target-specific defaults

When format-specific settings are omitted, OpenClaw picks defaults based on the output target.

| Target                     | Format | Sample rate | Bitrate    | Notes                                       |
| -------------------------- | ------ | ----------- | ---------- | ------------------------------------------- |
| Normal reply / file output | `mp3`  | `44100`     | `128` kbps | Default for general outbound audio.         |
| Voice note                 | `opus` | `48000`     | `32` kbps  | Marked as voice-compatible by the provider. |
| Telephony                  | `pcm`  | `8000`      | n/a        | Forced for telephony output.                |

## OpenClaw behavior notes

- The extension registers only a speech provider. It does not add a new channel or realtime voice transport by itself.
- `messages.tts.provider` must remain `fish-audio`. The plugin name `fish-audio-tts` is only for OpenClaw's plugin loader.
- `messages.tts.providers["fish-audio"].voiceId` maps to Fish Audio's single-speaker `reference_id`.
- `talk.providers["fish-audio"]` can store provider-specific Talk defaults such as `model`, `latency`, and `speed`.
- Public `talk.speak` requests use the generic Talk schema; for Fish Audio the practical per-request overrides are `voiceId`, `modelId`, `speed`, and `normalize`.
- Per-request `temperature`, `topP`, and `latency` are not exposed by OpenClaw's public `talk.speak` schema. Set those as provider defaults instead.
- Telephony synthesis forces `pcm` at `8000` Hz.
- The Fish Audio TTS endpoint accepts both `application/json` and `application/msgpack`. This plugin uses JSON for standard `reference_id` synthesis requests.
- Multi-speaker `reference_id` arrays are available in the Fish API, but this plugin currently targets the single-speaker path only.

## Service docs

- [Fish Audio Text to Speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio Emotion Reference](https://docs.fish.audio/api-reference/emotion-reference)
- [Fish Audio List Models API](https://docs.fish.audio/api-reference/endpoint/model/list-models)

## ClawHub packaging notes

- `package.json` includes `openclaw.compat` and `openclaw.build`, which are required for ClawHub-published external plugins.
- `package.json` keeps `openclaw` as a peer dependency because the host runtime provides it.
- The local test setup uses lightweight SDK shims so `pnpm test` and `pnpm check` can run without a sibling OpenClaw checkout.

## Validation

From this package directory, first install dependencies so `pnpm-lock.yaml` is generated locally:

```bash
pnpm install
```

Then run:

```bash
pnpm test
pnpm check
```

- `pnpm test` runs the local extension Vitest suite, including `readme.test.ts`.
- `pnpm check` runs the local formatting check, local lint, and then the local extension test suite.

## Support

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-pink?logo=github)](https://github.com/sponsors/livingghost)

If this plugin is useful, you can support development here:

- [Sponsor on GitHub](https://github.com/sponsors/livingghost)
