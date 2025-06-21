
import type { Sticker, StickerPack } from '@/types';

export const mockStickerPacks: StickerPack[] = [
  {
    id: 'pack-1',
    name: 'Reactions',
    thumbnail_url: 'https://placehold.co/64x64.png?text=😂',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'pack-2',
    name: 'Cute Animals',
    thumbnail_url: 'https://placehold.co/64x64.png?text=🐶',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'pack-3',
    name: 'Greetings',
    thumbnail_url: 'https://placehold.co/64x64.png?text=👋',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const mockStickers: Record<string, Sticker[]> = {
  'pack-1': [
    { id: 'sticker-1-1', pack_id: 'pack-1', name: 'Laughing', image_url: 'https://placehold.co/128x128.png?text=😂', tags: ['happy', 'laugh', 'lol'] },
    { id: 'sticker-1-2', pack_id: 'pack-1', name: 'Thumbs Up', image_url: 'https://placehold.co/128x128.png?text=👍', tags: ['ok', 'good', 'agree'] },
    { id: 'sticker-1-3', pack_id: 'pack-1', name: 'Crying', image_url: 'https://placehold.co/128x128.png?text=😢', tags: ['sad', 'cry'] },
    { id: 'sticker-1-4', pack_id: 'pack-1', name: 'Heart', image_url: 'https://placehold.co/128x128.png?text=❤️', tags: ['love', 'like'] },
    { id: 'sticker-1-5', pack_id: 'pack-1', name: 'Mind Blown', image_url: 'https://placehold.co/128x128.png?text=🤯', tags: ['wow', 'omg', 'mindblown'] },
  ],
  'pack-2': [
    { id: 'sticker-2-1', pack_id: 'pack-2', name: 'Happy Dog', image_url: 'https://placehold.co/128x128.png?text=🐶', tags: ['dog', 'happy', 'cute'] },
    { id: 'sticker-2-2', pack_id: 'pack-2', name: 'Grumpy Cat', image_url: 'https://placehold.co/128x128.png?text=😼', tags: ['cat', 'grumpy', 'cute'] },
    { id: 'sticker-2-3', pack_id: 'pack-2', name: 'Sleepy Panda', image_url: 'https://placehold.co/128x128.png?text=🐼', tags: ['panda', 'sleepy', 'cute'] },
    { id: 'sticker-2-4', pack_id: 'pack-2', name: 'Dancing Penguin', image_url: 'https://placehold.co/128x128.png?text=🐧', tags: ['penguin', 'dance', 'cute'] },
  ],
  'pack-3': [
    { id: 'sticker-3-1', pack_id: 'pack-3', name: 'Hello', image_url: 'https://placehold.co/128x128.png?text=Hello', tags: ['hi', 'hey', 'greeting'] },
    { id: 'sticker-3-2', pack_id: 'pack-3', name: 'Bye', image_url: 'https://placehold.co/128x128.png?text=Bye', tags: ['goodbye', 'see ya'] },
    { id: 'sticker-3-3', pack_id: 'pack-3', name: 'Good Morning', image_url: 'https://placehold.co/128x128.png?text=GM', tags: ['morning', 'gm'] },
    { id: 'sticker-3-4', pack_id: 'pack-3', name: 'Good Night', image_url: 'https://placehold.co/128x128.png?text=GN', tags: ['night', 'gn', 'sleep'] },
  ],
};
