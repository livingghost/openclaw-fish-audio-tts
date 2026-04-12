import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { buildFishAudioSpeechProvider } from "./speech-provider.js";

export default definePluginEntry({
  id: "fish-audio-tts",
  name: "Fish Audio TTS",
  description: "OpenClaw extension that adds the Fish Audio text-to-speech provider.",
  register(api) {
    api.registerSpeechProvider(buildFishAudioSpeechProvider());
  },
});
