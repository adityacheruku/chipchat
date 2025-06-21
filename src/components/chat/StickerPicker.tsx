
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sticker, StickerPack } from '@/types';
import { Clock, Search, Star, Loader2, Frown } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface StickerPickerProps {
    onStickerSelect: (stickerId: string) => void;
}

type PickerStatus = 'idle' | 'loading' | 'error' | 'success';

const StickerGrid = ({
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
      return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
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
                    <div key={sticker.id} className="relative group/sticker">
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => onSelect(sticker)}
                                        className="p-1 w-full h-full flex items-center justify-center rounded-md hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                    <p>{sticker.name || "Sticker"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <button
                            onClick={() => onToggleFavorite(sticker.id)}
                            className={cn(
                                "absolute top-0 right-0 p-0.5 rounded-full bg-card/70 text-muted-foreground opacity-0 group-hover/sticker:opacity-100 hover:text-yellow-500 focus:opacity-100 transition-opacity",
                                favoriteStickerIds.has(sticker.id) && "opacity-100 text-yellow-400"
                            )}
                            aria-label={favoriteStickerIds.has(sticker.id) ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Star size={16} className={cn(favoriteStickerIds.has(sticker.id) && "fill-current")} />
                        </button>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
};

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
        const response = await api.toggleFavoriteSticker('00000000-0000-0000-0000-000000000001'); // Dummy ID to fetch list
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

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    if (tabValue === 'recent') {
      fetchRecent();
    } else if (tabValue === 'favorites') {
      fetchFavorites();
    } else if (tabValue !== 'search') {
      fetchStickersForPack(tabValue);
    }
  };

  const handleSelect = (sticker: Sticker) => {
    onStickerSelect(sticker.id);
    setRecentStickers(prev => [sticker, ...prev.filter(s => s.id !== sticker.id)].slice(0, 20));
  };
  
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

  return (
    <div className="w-[90vw] max-w-[340px] p-2 bg-card">
      <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stickers..."
            value={searchQuery}
            onChange={handleQueryChange}
            className="pl-9 bg-muted border-none focus-visible:ring-ring"
          />
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={cn("grid w-full grid-cols-4 sm:grid-cols-5")}>
          <TabsTrigger value="recent" aria-label="Recent stickers"><Clock size={18} /></TabsTrigger>
          <TabsTrigger value="favorites" aria-label="Favorite stickers"><Star size={18} /></TabsTrigger>
          {packs.slice(0, 3).map(pack => (
            <TabsTrigger key={pack.id} value={pack.id} className="p-1" aria-label={`Sticker pack: ${pack.name}`}>
                <Image src={pack.thumbnail_url || ''} alt={pack.name} width={24} height={24} unoptimized />
            </TabsTrigger>
          ))}
          {searchQuery && <TabsTrigger value="search" aria-label="Search results"><Search size={18}/></TabsTrigger>}
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
