
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sticker, StickerPack, Message } from '@/types';
import { Clock, Search, Star, Loader2, Frown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';


interface StickerPickerProps {
    onStickerSelect: (stickerId: string) => void;
}

type PickerStatus = 'loading' | 'error' | 'success';

export default function StickerPicker({ onStickerSelect }: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [stickersByPack, setStickersByPack] = useState<Record<string, Sticker[]>>({});
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const [favoriteStickers, setFavoriteStickers] = useState<Sticker[]>([]);
  const [searchResults, setSearchResults] = useState<Sticker[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('recent');

  const [packStatus, setPackStatus] = useState<PickerStatus>('loading');
  const [stickersStatus, setStickersStatus] = useState<Record<string, PickerStatus>>({});

  const isMobile = useIsMobile();
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
    if (stickersByPack[packId]) return; // Already fetched
    setStickersStatus(prev => ({ ...prev, [packId]: 'loading' }));
    try {
      const response = await api.getStickersInPack(packId);
      setStickersByPack(prev => ({ ...prev, [packId]: response.stickers }));
      setStickersStatus(prev => ({ ...prev, [packId]: 'success' }));
    } catch (error) {
      console.error(`Failed to load stickers for pack ${packId}`, error);
      toast({ variant: 'destructive', title: 'Error', description: `Could not load stickers for pack.` });
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
    // This uses the favorite toggle endpoint, which returns the full list.
    // A dedicated GET /favorites endpoint would be cleaner but this works.
    setStickersStatus(prev => ({...prev, favorites: 'loading'}));
    try {
        // To get favorites, we can "toggle" a known non-existent sticker ID
        // or the backend would need a GET /favorites. Let's assume for now a dedicated
        // endpoint would be added. Simulating empty toggle to fetch list.
        const response = await api.toggleFavoriteSticker('00000000-0000-0000-0000-000000000000');
        setFavoriteStickers(response.stickers);
        setStickersStatus(prev => ({...prev, favorites: 'success'}));
    } catch (e) {
        setStickersStatus(prev => ({...prev, favorites: 'error'}));
    }
  }, [])
  
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
    // Optimistically add to recents
    setRecentStickers(prev => [sticker, ...prev.filter(s => s.id !== sticker.id)].slice(0, 20));
  };
  
  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      if (activeTab === 'search') setActiveTab('recent'); // Go back to recent if search cleared
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
  
  const StickerGrid = ({ stickerList, status, onRetry }: { stickerList: Sticker[], status: PickerStatus, onRetry: () => void }) => {
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
                            unoptimized // Since URLs can be from anywhere
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
  };

  return (
    <div className="w-[320px] p-2 bg-card">
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
        <TabsList className={cn("grid w-full", `grid-cols-${Math.min(packs.length + 2, 6)}`)}>
          <TabsTrigger value="recent"><Clock size={18} /></TabsTrigger>
          <TabsTrigger value="favorites"><Star size={18} /></TabsTrigger>
          {packs.map(pack => (
            <TabsTrigger key={pack.id} value={pack.id} className="p-1">
                <Image src={pack.thumbnail_url || ''} alt={pack.name} width={24} height={24} unoptimized />
            </TabsTrigger>
          ))}
          {searchQuery && <TabsTrigger value="search"><Search size={18}/></TabsTrigger>}
        </TabsList>
        <TabsContent value="recent">
            <StickerGrid stickerList={recentStickers} status={stickersStatus['recent'] || 'loading'} onRetry={fetchRecent} />
        </TabsContent>
        <TabsContent value="favorites">
             <StickerGrid stickerList={favoriteStickers} status={stickersStatus['favorites'] || 'loading'} onRetry={fetchFavorites} />
        </TabsContent>
        {packs.map(pack => (
          <TabsContent key={pack.id} value={pack.id}>
             <StickerGrid stickerList={stickersByPack[pack.id] || []} status={stickersStatus[pack.id] || 'loading'} onRetry={() => fetchStickersForPack(pack.id)} />
          </TabsContent>
        ))}
         <TabsContent value="search">
            <StickerGrid stickerList={searchResults} status={stickersStatus['search'] || 'loading'} onRetry={() => handleSearch(searchQuery)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
