import type { Mood } from '@/types';
import { Smile, Frown, Meh, PartyPopper, Brain, Glasses } from 'lucide-react'; // Using Glasses for Chilling

interface MoodIndicatorProps {
  mood: Mood;
  size?: number;
}

const moodIcons: Record<Mood, React.ElementType> = {
  Happy: Smile,
  Sad: Frown,
  Neutral: Meh,
  Excited: PartyPopper,
  Thoughtful: Brain,
  Chilling: Glasses,
};

export default function MoodIndicator({ mood, size = 16 }: MoodIndicatorProps) {
  const IconComponent = moodIcons[mood] || Meh; // Default to Meh if mood is unrecognized

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground" title={mood}>
      <IconComponent size={size} className="text-accent" />
      <span className="hidden sm:inline">{mood}</span>
    </div>
  );
}
