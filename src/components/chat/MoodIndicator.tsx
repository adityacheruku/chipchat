
import type { Mood } from '@/types';
import { Smile, Frown, Meh, PartyPopper, Brain, Glasses, Angry, HelpCircle } from 'lucide-react'; // Using Glasses for Chilling

interface MoodIndicatorProps {
  mood: Mood;
  size?: number;
}

const moodIcons: Record<string, React.ElementType> = {
  Happy: Smile,
  Sad: Frown,
  Neutral: Meh,
  Excited: PartyPopper,
  Thoughtful: Brain,
  Chilling: Glasses,
  Angry: Angry,
  Anxious: HelpCircle,
  Content: Smile,
};

export default function MoodIndicator({ mood, size = 16 }: MoodIndicatorProps) {
  const IconComponent = moodIcons[mood] || Meh; // Default to Meh if mood is unrecognized

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground" title={mood} aria-label={`Current mood: ${mood}`}>
      <IconComponent size={size} className="text-accent" aria-hidden="true" />
      <span className="hidden sm:inline">{mood}</span>
    </div>
  );
}
