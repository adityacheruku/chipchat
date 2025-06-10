
export type Mood = "Happy" | "Sad" | "Neutral" | "Excited" | "Thoughtful" | "Chilling";

export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling"];

export interface User {
  id: string;
  name: string;
  avatar: string; // URL to placeholder or data URI
  mood: Mood;
  "data-ai-hint"?: string; // For placeholder images
}

export interface Message {
  id: string;
  userId: string; // Corresponds to User.id
  text: string;
  timestamp: number; // Unix timestamp
}
