import { type ReadiumSpeechPlaybackEngine } from "./engine";
import { type ReadiumSpeechVoice } from "./voices";

export interface ReadiumSpeechEngineProvider {
  readonly id: string;
  readonly name: string;
  
  // Voice Management
  getVoices(): Promise<ReadiumSpeechVoice[]>;
  
  // Engine Creation
  createEngine(voice?: ReadiumSpeechVoice | string): Promise<ReadiumSpeechPlaybackEngine>;
  
  // Lifecycle
  destroy(): Promise<void>;
}