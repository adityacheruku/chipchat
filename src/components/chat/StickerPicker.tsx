
"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sticker, StickerPack } from '@/types';
import { Clock, Search, Star, Frown } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import Spinner from '../common/Spinner';

interface StickerPickerProps {
    onStickerSelect: (stickerId: string) => void;
}

type PickerStatus = 'idle' | 'loading' | 'error' | 'success';

// ⚡️ Memoized StickerGrid to prevent re-rendering the entire grid when only one part changes
const StickerGrid = memo(({
    stickerList,
    status,
    onRetry,
    onSelect,
    onToggleFavorite,
    favoriteStickerIds,
}: {
    stickerList: Sticker[];
    status: PickerStatus;
    onRetry: () => void;
    onSelect: (sticker: Sticker) => void;
    onToggleFavorite: (stickerId: string) => void;
    favoriteStickerIds: Set<string>;
}) => {
    if (status === 'loading') {
      return <div className="h-64 flex items-center justify-center"><Spinner /></div>
    }
    if (status === 'error') {
       return (
            <div className="h-64 flex flex-col items-center justify-center text-sm text-destructive gap-4">
                <Frown size={32}/>
                <p>Failed to load stickers.</p>
                <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
            </div>
        )
    }
    if (stickerList.length === 0) {
       return <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No stickers found.</div>
    }

    return (
        <ScrollArea className="h-64">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2">
                {stickerList.map(sticker => (
                    <StickerItem
                        key={sticker.id}
                        sticker={sticker}
                        onSelect={onSelect}
                        onToggleFavorite={onToggleFavorite}
                        isFavorite={favoriteStickerIds.has(sticker.id)}
                    />
                ))}
            </div>
        </ScrollArea>
    );
});
StickerGrid.displayName = "StickerGrid";


// ⚡️ Memoized StickerItem to avoid re-rendering every sticker in a grid on state changes
const StickerItem = memo(({ sticker, onSelect, onToggleFavorite, isFavorite }: { sticker: Sticker; onSelect: (sticker: Sticker) => void; onToggleFavorite: (stickerId: string) => void; isFavorite: boolean; }) => {
    
    const longPressEvents = useLongPress(() => {
        onToggleFavorite(sticker.id);
    }, {
        threshold: 500, // 500ms for long press
        onStart: () => document.getElementById(`sticker-${sticker.id}`)?.classList.add('scale-90'),
        onFinish: () => document.getElementById(`sticker-${sticker.id}`)?.classList.remove('scale-90'),
        onCancel: () => document.getElementById(`sticker-${sticker.id}`)?.classList.remove('scale-90'),
    });

    return (
         <div 
            id={`sticker-${sticker.id}`}
            key={sticker.id} 
            className="relative group/sticker transition-transform duration-150"
            {...longPressEvents}
        >
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => onSelect(sticker)}
                            className="p-1 w-full h-full flex items-center justify-center rounded-md hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Select sticker: ${sticker.name || 'Sticker'}`}
                        >
                            <Image
                                src={sticker.image_url}
                                alt={sticker.name || 'Chat sticker'}
                                width={64}
                                height={64}
                                className="aspect-square object-contain"
                                unoptimized
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{sticker.name || "Sticker"} (long-press to favorite)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {isFavorite && (
                 <div className="absolute top-1 right-1 p-0.5 rounded-full bg-card/70 text-yellow-400 pointer-events-none">
                     <Star size={12} className="fill-current" />
                 </div>
            )}
        </div>
    );
});
StickerItem.displayName = "StickerItem";


export default function StickerPicker({ onStickerSelect }: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [stickersByPack, setStickersByPack] = useState<Record<string, Sticker[]>>({});
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const [favoriteStickers, setFavoriteStickers] = useState<Sticker[]>([]);
  const [searchResults, setSearchResults] = useState<Sticker[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('recent');

  const [packStatus, setPackStatus] = useState<PickerStatus>('idle');
  const [stickersStatus, setStickersStatus] = useState<Record<string, PickerStatus>>({});

  const { toast } = useToast();

  const fetchPacks = useCallback(async () => {
    setPackStatus('loading');
    try {
      const response = await api.getStickerPacks();
      setPacks(response.packs);
      setPackStatus('success');
    } catch (error) {
      console.error("Failed to load sticker packs", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load sticker packs.' });
      setPackStatus('error');
    }
  }, [toast]);
  
  const fetchStickersForPack = useCallback(async (packId: string) => {
    if (stickersByPack[packId]) return;
    setStickersStatus(prev => ({ ...prev, [packId]: 'loading' }));
    try {
      const response = await api.getStickersInPack(packId);
      setStickersByPack(prev => ({ ...prev, [packId]: response.stickers }));
      setStickersStatus(prev => ({ ...prev, [packId]: 'success' }));
    } catch (error) {
      console.error(`Failed to load stickers for pack ${packId}`, error);
      toast({ variant: 'destructive', title: 'Error', description: `Could not load stickers.` });
      setStickersStatus(prev => ({ ...prev, [packId]: 'error' }));
    }
  }, [stickersByPack, toast]);

  const fetchRecent = useCallback(async () => {
    setStickersStatus(prev => ({...prev, recent: 'loading'}));
    try {
        const response = await api.getRecentStickers();
        setRecentStickers(response.stickers);
        setStickersStatus(prev => ({...prev, recent: 'success'}));
    } catch (e) {
        setStickersStatus(prev => ({...prev, recent: 'error'}));
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    setStickersStatus(prev => ({...prev, favorites: 'loading'}));
    try {
        const response = await api.getFavoriteStickers();
        setFavoriteStickers(response.stickers);
        setStickersStatus(prev => ({...prev, favorites: 'success'}));
    } catch (e) {
        setStickersStatus(prev => ({...prev, favorites: 'error'}));
    }
  }, []);
  
  useEffect(() => {
    fetchPacks();
    fetchRecent();
    fetchFavorites();
  }, [fetchPacks, fetchRecent, fetchFavorites]);

  const handleTabChange = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
    if (tabValue === 'recent') {
      fetchRecent();
    } else if (tabValue === 'favorites') {
      fetchFavorites();
    } else if (tabValue !== 'search') {
      fetchStickersForPack(tabValue);
    }
  }, [fetchRecent, fetchFavorites, fetchStickersForPack]);

  const handleSelect = useCallback((sticker: Sticker) => {
    onStickerSelect(sticker.id);
    setRecentStickers(prev => [sticker, ...prev.filter(s => s.id !== sticker.id)].slice(0, 20));
  }, [onStickerSelect]);
  
  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      if (activeTab === 'search') setActiveTab('recent');
      return;
    }
    setActiveTab('search');
    setStickersStatus(prev => ({...prev, search: 'loading'}));
    try {
        const response = await api.searchStickers(query);
        setSearchResults(response.stickers);
        setStickersStatus(prev => ({...prev, search: 'success'}));
    } catch (e) {
        setStickersStatus(prev => ({...prev, search: 'error'}));
    }
  }, [activeTab]);

  const debouncedSearch = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (query: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => handleSearch(query), 300);
    }
  }, [handleSearch]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  }

  const handleToggleFavorite = useCallback(async (stickerId: string) => {
    const isCurrentlyFavorite = favoriteStickers.some(s => s.id === stickerId);
    try {
        const response = await api.toggleFavoriteSticker(stickerId);
        setFavoriteStickers(response.stickers);
        toast({
            title: isCurrentlyFavorite ? "Removed from favorites" : "Added to favorites",
            duration: 2000,
        });
    } catch (error) {
        console.error("Failed to toggle favorite sticker", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not update your favorites."
        });
    }
  }, [toast, favoriteStickers]);

  const favoriteStickerIds = useMemo(() => new Set(favoriteStickers.map(s => s.id)), [favoriteStickers]);

  const tabsForDisplay = useMemo(() => {
    const staticTabs = ['recent', 'favorites'];
    const dynamicTabs = packs.slice(0, 3).map(p => p.id);
    const searchTab = searchQuery ? ['search'] : [];
    return [...staticTabs, ...dynamicTabs, ...searchTab];
  }, [packs, searchQuery]);


  return (
    <div className="w-full p-2 bg-card">
      <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stickers..."
            value={searchQuery}
            onChange={handleQueryChange}
            className="pl-9 bg-input border-none focus-visible:ring-ring"
          />
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabsForDisplay.length}, minmax(0, 1fr))` }}>
          <TabsTrigger value="recent" aria-label="Recent stickers" className="transition-all duration-200"><Clock size={18} /></TabsTrigger>
          <TabsTrigger value="favorites" aria-label="Favorite stickers" className="transition-all duration-200"><Star size={18} /></TabsTrigger>
          {packs.slice(0, 3).map(pack => (
            <TabsTrigger key={pack.id} value={pack.id} className="p-1 transition-all duration-200" aria-label={`Sticker pack: ${pack.name}`}>
                <Image src={pack.thumbnail_url || ''} alt={pack.name} width={24} height={24} unoptimized />
            </TabsTrigger>
          ))}
          {searchQuery && <TabsTrigger value="search" aria-label="Search results" className="transition-all duration-200"><Search size={18}/></TabsTrigger>}
        </TabsList>
        
        <TabsContent value="recent">
            <StickerGrid stickerList={recentStickers} status={stickersStatus['recent'] || 'idle'} onRetry={fetchRecent} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} favoriteStickerIds={favoriteStickerIds} />
        </TabsContent>
        <TabsContent value="favorites">
             <StickerGrid stickerList={favoriteStickers} status={stickersStatus['favorites'] || 'idle'} onRetry={fetchFavorites} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} favoriteStickerIds={favoriteStickerIds} />
        </TabsContent>
        {packs.map(pack => (
          <TabsContent key={pack.id} value={pack.id}>
             <StickerGrid stickerList={stickersByPack[pack.id] || []} status={stickersStatus[pack.id] || 'idle'} onRetry={() => fetchStickersForPack(pack.id)} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} favoriteStickerIds={favoriteStickerIds} />
          </TabsContent>
        ))}
         {searchQuery && (
            <TabsContent value="search">
                <StickerGrid stickerList={searchResults} status={stickersStatus['search'] || 'idle'} onRetry={() => handleSearch(searchQuery)} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} favoriteStickerIds={favoriteStickerIds} />
            </TabsContent>
         )}
      </Tabs>
    </div>
  );
}
