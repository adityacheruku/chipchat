
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sticker, StickerPack } from '@/types';
import { mockStickerPacks, mockStickers } from '@/lib/mock-stickers';
import { Clock, Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface StickerPickerProps {
  onStickerSelect: (stickerUrl: string) => void;
}

const RECENT_STICKERS_KEY = 'chirpChat_recentStickers';
const MAX_RECENT_STICKERS = 20;

export default function StickerPicker({ onStickerSelect }: StickerPickerProps) {
  const [packs] = useState<StickerPack[]>(mockStickerPacks);
  const [stickers] = useState<Record<string, Sticker[]>>(mockStickers);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      const savedRecents = localStorage.getItem(RECENT_STICKERS_KEY);
      if (savedRecents) {
        setRecentStickers(JSON.parse(savedRecents));
      }
    } catch (error) {
      console.error("Failed to load recent stickers from localStorage", error);
    }
  }, []);

  const handleSelect = (sticker: Sticker) => {
    onStickerSelect(sticker.image_url);

    // Update recent stickers
    const newRecents = [sticker, ...recentStickers.filter(s => s.id !== sticker.id)].slice(0, MAX_RECENT_STICKERS);
    setRecentStickers(newRecents);
    try {
      localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(newRecents));
    } catch (error) {
      console.error("Failed to save recent stickers to localStorage", error);
    }
  };

  const filteredStickers = useMemo(() => {
    if (!searchQuery) return stickers;

    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered: Record<string, Sticker[]> = {};

    for (const packId in stickers) {
      filtered[packId] = stickers[packId].filter(sticker => 
        sticker.name?.toLowerCase().includes(lowercasedQuery) || 
        sticker.tags?.some(tag => tag.toLowerCase().includes(lowercasedQuery))
      );
    }
    return filtered;
  }, [searchQuery, stickers]);
  
  const filteredRecentStickers = useMemo(() => {
      if (!searchQuery) return recentStickers;
      const lowercasedQuery = searchQuery.toLowerCase();
      return recentStickers.filter(sticker => 
        sticker.name?.toLowerCase().includes(lowercasedQuery) || 
        sticker.tags?.some(tag => tag.toLowerCase().includes(lowercasedQuery))
      );
  }, [searchQuery, recentStickers]);

  const StickerGrid = ({ stickerList }: { stickerList: Sticker[] }) => (
    <ScrollArea className="h-64">
        <div className="grid grid-cols-4 gap-2 p-2">
            {stickerList.map(sticker => (
            <TooltipProvider key={sticker.id} delayDuration={isMobile ? 1000 : 300}>
                <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => handleSelect(sticker)}
                        className="p-1 rounded-md hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                    <Image
                        src={sticker.image_url}
                        alt={sticker.name || 'sticker'}
                        width={64}
                        height={64}
                        className="aspect-square object-contain"
                    />
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{sticker.name || "Sticker"}</p>
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            ))}
        </div>
    </ScrollArea>
  );

  return (
    <div className="w-[320px] p-2 bg-card">
      <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stickers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted border-none focus-visible:ring-ring"
          />
      </div>
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent"><Clock size={18} /></TabsTrigger>
          {packs.map(pack => (
            <TabsTrigger key={pack.id} value={pack.id} className="p-1">
                <Image src={pack.thumbnail_url || ''} alt={pack.name} width={24} height={24} />
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="recent">
          {filteredRecentStickers.length > 0 ? (
            <StickerGrid stickerList={filteredRecentStickers} />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                {searchQuery ? "No matching recent stickers" : "No recently used stickers"}
            </div>
          )}
        </TabsContent>
        {packs.map(pack => (
          <TabsContent key={pack.id} value={pack.id}>
             {(filteredStickers[pack.id] || []).length > 0 ? (
                <StickerGrid stickerList={filteredStickers[pack.id]} />
             ) : (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    No stickers match your search.
                </div>
             )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
