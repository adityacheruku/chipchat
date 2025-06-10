export type Mood = "Happy" | "Sad" | "Neutral" | "Excited" | "Thoughtful" | "Chilling";

export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling"];

export interface User {
  id: string;
  name: string;
  avatar: string; // URL to placeholder
  mood: Mood;
}

export interface Message {
  id: string;
  userId: string; // Corresponds to User.id
  text: string;
  timestamp: number; // Unix timestamp
}
