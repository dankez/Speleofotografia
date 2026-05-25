/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { Trophy, Heart, Award, ArrowLeft, ArrowRight, X, Maximize2, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Lang } from "../App";

interface AwardPhoto {
  id: string;
  author: string;
  category: string;
  name: string;
  webPath: string;
  description: string;
  juryScore: number;
  publicVotes: number;
}

interface AwardItem {
  id: string;
  type: 'grand_prize' | 'cat_a_1' | 'cat_a_2' | 'cat_a_3' | 'cat_b_1' | 'cat_b_2' | 'cat_b_3' | 'public_choice' | 'custom';
  titleSk: string;
  titleEn: string;
  descriptionSk: string;
  descriptionEn: string;
  photo: AwardPhoto | null;
}

interface ResultsData {
  edition: string;
  contestName: string;
  museumName: string;
  awards: AwardItem[];
  exhibition: AwardPhoto[];
}

export default function Results({ lang, isIframe = false }: { lang: Lang; isIframe?: boolean }) {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<AwardPhoto | null>(null);
  const [activeTab, setActiveTab] = useState<'awards' | 'exhibition'>('awards');
  const [exhibitionFilter, setExhibitionFilter] = useState<string>('all');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const res = await fetch("/api/public/results");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch results", e);
    } finally {
      setLoading(false);
    }
  };

  // Rozdelenie ocenení na logické kategórie
  const grandPrize = useMemo(() => {
    return data?.awards.find(a => a.type === 'grand_prize') || null;
  }, [data]);

  const catAPodium = useMemo(() => {
    if (!data) return { first: null, second: null, third: null };
    return {
      first: data.awards.find(a => a.type === 'cat_a_1') || null,
      second: data.awards.find(a => a.type === 'cat_a_2') || null,
      third: data.awards.find(a => a.type === 'cat_a_3') || null
    };
  }, [data]);

  const catBPodium = useMemo(() => {
    if (!data) return { first: null, second: null, third: null };
    return {
      first: data.awards.find(a => a.type === 'cat_b_1') || null,
      second: data.awards.find(a => a.type === 'cat_b_2') || null,
      third: data.awards.find(a => a.type === 'cat_b_3') || null
    };
  }, [data]);

  const publicChoice = useMemo(() => {
    return data?.awards.find(a => a.type === 'public_choice') || null;
  }, [data]);

  const customAwards = useMemo(() => {
    if (!data) return [];
    return data.awards.filter(a => a.type === 'custom');
  }, [data]);

  // Všetky ocenené fotky, aby sme ich mohli prechádzať v lightboxe, ak klikneme na ocenenú fotku
  const allAwardPhotos = useMemo(() => {
    if (!data) return [];
    const photos: AwardPhoto[] = [];
    data.awards.forEach(a => {
      if (a.photo) photos.push(a.photo);
    });
    return photos;
  }, [data]);

  // Listovateľný zoznam pre lightbox (najskôr ocenené, potom výstavná sieň)
  const lightboxList = useMemo(() => {
    if (!data) return [];
    const exhibitionFiltered = data.exhibition.filter(
      p => exhibitionFilter === 'all' || p.category === exhibitionFilter
    );
    // Spojíme ich tak, aby mal používateľ možnosť prechádzať fotkami
    return [...allAwardPhotos, ...exhibitionFiltered];
  }, [data, allAwardPhotos, exhibitionFilter]);

  const handleNext = () => {
    if (!selectedPhoto) return;
    const idx = lightboxList.findIndex(p => p.id === selectedPhoto.id);
    if (idx !== -1) {
      const nextIdx = (idx + 1) % lightboxList.length;
      setSelectedPhoto(lightboxList[nextIdx]);
    }
  };

  const handlePrev = () => {
    if (!selectedPhoto) return;
    const idx = lightboxList.findIndex(p => p.id === selectedPhoto.id);
    if (idx !== -1) {
      const prevIdx = (idx - 1 + lightboxList.length) % lightboxList.length;
      setSelectedPhoto(lightboxList[prevIdx]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPhoto) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") setSelectedPhoto(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, lightboxList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 size={40} className="animate-spin text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
          {lang === "sk" ? "Načítavam výsledky..." : "Loading results..."}
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 border border-border bg-paper">
        <p className="text-sm font-bold uppercase text-muted tracking-widest">
          {lang === "sk" ? "Výsledky zatiaľ neboli zverejnené." : "Results have not been published yet."}
        </p>
      </div>
    );
  }

  const activeExhibitionPhotos = data.exhibition.filter(
    p => exhibitionFilter === 'all' || p.category === exhibitionFilter
  );

  return (
    <div className="space-y-12">
      {/* Intro Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent">
          <Sparkles size={14} className="animate-pulse" />
          <span className="text-[9px] uppercase font-extrabold tracking-[2px]">
            {lang === "sk" ? "Oficiálne Výsledky" : "Official Results"}
          </span>
        </div>
        <h2 className="text-4xl font-extralight tracking-tight uppercase">
          {data.edition}
        </h2>
        <p className="text-[12px] font-bold uppercase tracking-[2px] text-muted">
          {lang === "sk" ? data.museumName : data.museumName}
        </p>
        <div className="w-12 h-[1px] bg-border mx-auto my-6" />
      </div>

      {/* Tabs */}
      <div className="flex justify-center border-b border-border">
        <button
          onClick={() => setActiveTab('awards')}
          className={cn(
            "px-8 py-4 text-[12px] font-extrabold uppercase tracking-[3px] border-b-2 -mb-[2px] transition-all flex items-center gap-2",
            activeTab === 'awards' ? "text-ink border-ink" : "text-muted border-transparent hover:text-ink"
          )}
        >
          <Trophy size={14} />
          {lang === "sk" ? "Ocenenia" : "Awards"}
        </button>
        <button
          onClick={() => setActiveTab('exhibition')}
          className={cn(
            "px-8 py-4 text-[12px] font-extrabold uppercase tracking-[3px] border-b-2 -mb-[2px] transition-all flex items-center gap-2",
            activeTab === 'exhibition' ? "text-ink border-ink" : "text-muted border-transparent hover:text-ink"
          )}
        >
          <Award size={14} />
          {lang === "sk" ? "Výstavná sieň" : "Exhibition Hall"}
        </button>
      </div>

      {/* TAB 1: AWARDS */}
      {activeTab === 'awards' && (
        <div className="space-y-20">
          
          {/* 1. GRAND PRIZE */}
          {grandPrize && grandPrize.photo && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative p-8 md:p-12 border border-accent bg-paper/50 rounded-lg shadow-xl overflow-hidden group max-w-4xl mx-auto"
            >
              {/* Background gradient blur */}
              <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/20 border border-accent text-accent rounded-full">
                    <Trophy size={14} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">
                      {lang === "sk" ? "Hlavná cena súťaže" : "Grand Prize Winner"}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-3xl font-light tracking-tight text-ink uppercase">
                      {grandPrize.photo.author}
                    </h3>
                    <p className="text-[11px] uppercase font-extrabold tracking-[2px] text-accent">
                      {lang === "sk" ? grandPrize.titleSk : grandPrize.titleEn}
                    </p>
                    <p className="text-lg italic font-light text-muted">
                      “{grandPrize.photo.name}”
                    </p>
                  </div>

                  <p className="text-sm font-light text-muted leading-relaxed">
                    {lang === "sk" 
                      ? (grandPrize.descriptionSk || grandPrize.photo.description) 
                      : (grandPrize.descriptionEn || grandPrize.photo.description)}
                  </p>

                  <div className="pt-4 flex items-center gap-6">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted font-bold block">
                        {lang === "sk" ? "Hodnotenie poroty" : "Jury Score"}
                      </span>
                      <span className="text-xl font-light text-ink">
                        {grandPrize.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                </div>

                <div 
                  className="relative aspect-[4/3] bg-black overflow-hidden border border-border shadow-2xl rounded cursor-pointer group/img"
                  onClick={() => setSelectedPhoto(grandPrize.photo)}
                >
                  <img 
                    src={grandPrize.photo.webPath} 
                    alt={grandPrize.photo.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="text-white" size={24} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PODIUMS CONTAINER */}
          <div className="space-y-24">
            
            {/* CATEGORY A PODIUM */}
            <div className="space-y-10">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-light uppercase tracking-widest text-ink">
                  {lang === "sk" ? "Kategória A – Krása jaskýň" : "Category A – Beauty of Caves"}
                </h3>
                <div className="w-16 h-[1px] bg-border mx-auto" />
              </div>

              {/* 3D Podium Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto pt-6">
                
                {/* 2nd Place */}
                {catAPodium.second && catAPodium.second.photo && (
                  <div className="order-2 md:order-1 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border border-border shadow-lg rounded cursor-pointer group"
                      onClick={() => setSelectedPhoto(catAPodium.second!.photo)}
                    >
                      <img 
                        src={catAPodium.second.photo.webPath} 
                        alt={catAPodium.second.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={20} />
                      </div>
                    </div>
                    
                    {/* Podium Column */}
                    <div className="w-full bg-gradient-to-t from-zinc-200 to-zinc-100 border border-zinc-300 mt-4 p-5 text-center shadow-md flex flex-col justify-between h-[160px]">
                      <div>
                        <div className="w-8 h-8 rounded-full bg-zinc-300 border-2 border-white shadow flex items-center justify-center text-xs font-bold text-zinc-700 mx-auto -mt-9">
                          2
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mt-2">
                          {lang === "sk" ? "2. Miesto" : "2nd Place"}
                        </p>
                        <h4 className="text-sm font-bold text-ink mt-1 truncate max-w-full">
                          {catAPodium.second.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catAPodium.second.photo.name}”
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 block mt-2">
                        {catAPodium.second.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {catAPodium.first && catAPodium.first.photo && (
                  <div className="order-1 md:order-2 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border-2 border-amber-400 shadow-2xl rounded cursor-pointer group scale-105"
                      onClick={() => setSelectedPhoto(catAPodium.first!.photo)}
                    >
                      <img 
                        src={catAPodium.first.photo.webPath} 
                        alt={catAPodium.first.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={24} />
                      </div>
                    </div>
                    
                    {/* Podium Column - Higher */}
                    <div className="w-full bg-gradient-to-t from-amber-100 to-amber-50 border border-amber-200 mt-6 p-6 text-center shadow-lg flex flex-col justify-between h-[200px] scale-105 z-10">
                      <div>
                        <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-white shadow-lg flex items-center justify-center text-sm font-bold text-white mx-auto -mt-11">
                          1
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 mt-2">
                          {lang === "sk" ? "1. Miesto" : "1st Place"}
                        </p>
                        <h4 className="text-base font-bold text-ink mt-1 truncate max-w-full">
                          {catAPodium.first.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catAPodium.first.photo.name}”
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-700 block mt-2">
                        {catAPodium.first.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {catAPodium.third && catAPodium.third.photo && (
                  <div className="order-3 md:order-3 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border border-border shadow-lg rounded cursor-pointer group"
                      onClick={() => setSelectedPhoto(catAPodium.third!.photo)}
                    >
                      <img 
                        src={catAPodium.third.photo.webPath} 
                        alt={catAPodium.third.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={20} />
                      </div>
                    </div>
                    
                    {/* Podium Column */}
                    <div className="w-full bg-gradient-to-t from-orange-200 to-orange-100 border border-orange-300 mt-4 p-5 text-center shadow-md flex flex-col justify-between h-[140px]">
                      <div>
                        <div className="w-8 h-8 rounded-full bg-orange-300 border-2 border-white shadow flex items-center justify-center text-xs font-bold text-orange-800 mx-auto -mt-9">
                          3
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 mt-2">
                          {lang === "sk" ? "3. Miesto" : "3rd Place"}
                        </p>
                        <h4 className="text-sm font-bold text-ink mt-1 truncate max-w-full">
                          {catAPodium.third.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catAPodium.third.photo.name}”
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-orange-800 block mt-2">
                        {catAPodium.third.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* CATEGORY B PODIUM */}
            <div className="space-y-10 pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-light uppercase tracking-widest text-ink">
                  {lang === "sk" ? "Kategória B – Speleomoment" : "Category B – Speleomoment"}
                </h3>
                <div className="w-16 h-[1px] bg-border mx-auto" />
              </div>

              {/* 3D Podium Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto pt-6">
                
                {/* 2nd Place */}
                {catBPodium.second && catBPodium.second.photo && (
                  <div className="order-2 md:order-1 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border border-border shadow-lg rounded cursor-pointer group"
                      onClick={() => setSelectedPhoto(catBPodium.second!.photo)}
                    >
                      <img 
                        src={catBPodium.second.photo.webPath} 
                        alt={catBPodium.second.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={20} />
                      </div>
                    </div>
                    
                    {/* Podium Column */}
                    <div className="w-full bg-gradient-to-t from-zinc-200 to-zinc-100 border border-zinc-300 mt-4 p-5 text-center shadow-md flex flex-col justify-between h-[160px]">
                      <div>
                        <div className="w-8 h-8 rounded-full bg-zinc-300 border-2 border-white shadow flex items-center justify-center text-xs font-bold text-zinc-700 mx-auto -mt-9">
                          2
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mt-2">
                          {lang === "sk" ? "2. Miesto" : "2nd Place"}
                        </p>
                        <h4 className="text-sm font-bold text-ink mt-1 truncate max-w-full">
                          {catBPodium.second.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catBPodium.second.photo.name}”
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 block mt-2">
                        {catBPodium.second.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {catBPodium.first && catBPodium.first.photo && (
                  <div className="order-1 md:order-2 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border-2 border-amber-400 shadow-2xl rounded cursor-pointer group scale-105"
                      onClick={() => setSelectedPhoto(catBPodium.first!.photo)}
                    >
                      <img 
                        src={catBPodium.first.photo.webPath} 
                        alt={catBPodium.first.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={24} />
                      </div>
                    </div>
                    
                    {/* Podium Column - Higher */}
                    <div className="w-full bg-gradient-to-t from-amber-100 to-amber-50 border border-amber-200 mt-6 p-6 text-center shadow-lg flex flex-col justify-between h-[200px] scale-105 z-10">
                      <div>
                        <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-white shadow-lg flex items-center justify-center text-sm font-bold text-white mx-auto -mt-11">
                          1
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 mt-2">
                          {lang === "sk" ? "1. Miesto" : "1st Place"}
                        </p>
                        <h4 className="text-base font-bold text-ink mt-1 truncate max-w-full">
                          {catBPodium.first.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catBPodium.first.photo.name}”
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-700 block mt-2">
                        {catBPodium.first.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {catBPodium.third && catBPodium.third.photo && (
                  <div className="order-3 md:order-3 flex flex-col items-center">
                    <div 
                      className="w-full relative aspect-[4/3] bg-black overflow-hidden border border-border shadow-lg rounded cursor-pointer group"
                      onClick={() => setSelectedPhoto(catBPodium.third!.photo)}
                    >
                      <img 
                        src={catBPodium.third.photo.webPath} 
                        alt={catBPodium.third.photo.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={20} />
                      </div>
                    </div>
                    
                    {/* Podium Column */}
                    <div className="w-full bg-gradient-to-t from-orange-200 to-orange-100 border border-orange-300 mt-4 p-5 text-center shadow-md flex flex-col justify-between h-[140px]">
                      <div>
                        <div className="w-8 h-8 rounded-full bg-orange-300 border-2 border-white shadow flex items-center justify-center text-xs font-bold text-orange-800 mx-auto -mt-9">
                          3
                        </div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 mt-2">
                          {lang === "sk" ? "3. Miesto" : "3rd Place"}
                        </p>
                        <h4 className="text-sm font-bold text-ink mt-1 truncate max-w-full">
                          {catBPodium.third.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted mt-1 truncate max-w-full">
                          “{catBPodium.third.photo.name}”
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-orange-800 block mt-2">
                        {catBPodium.third.photo.juryScore} {lang === "sk" ? "bodov" : "pts"}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* PUBLIC CHOICE & CUSTOM AWARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto pt-6">
            
            {/* PUBLIC CHOICE */}
            {publicChoice && publicChoice.photo && (
              <motion.div 
                whileHover={{ y: -4 }}
                className="p-6 bg-paper border border-pink-200 shadow rounded-lg flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute -right-8 -top-8 text-pink-100 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                  <Heart size={120} fill="currentColor" />
                </div>
                
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-50 border border-pink-200 text-pink-600 rounded-full">
                    <Heart size={14} fill="currentColor" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">
                      {lang === "sk" ? "Cena Verejnosti" : "Public Vote Winner"}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-xl font-light text-ink">
                      {publicChoice.photo.author}
                    </h4>
                    <p className="text-sm italic text-muted">
                      “{publicChoice.photo.name}”
                    </p>
                    {publicChoice.descriptionSk && (
                      <p className="text-xs font-light text-muted mt-2">
                        {lang === "sk" ? publicChoice.descriptionSk : publicChoice.descriptionEn}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between">
                  <div 
                    className="w-28 relative aspect-[4/3] bg-black overflow-hidden border border-border shadow rounded cursor-pointer"
                    onClick={() => setSelectedPhoto(publicChoice.photo)}
                  >
                    <img 
                      src={publicChoice.photo.webPath} 
                      alt={publicChoice.photo.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-muted font-bold block">
                      {lang === "sk" ? "Počet hlasov verejnosti" : "Total Public Votes"}
                    </span>
                    <span className="text-2xl font-light text-pink-600">
                      {publicChoice.photo.publicVotes} {lang === "sk" ? "hlasov" : "votes"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CUSTOM / SPECIAL AWARDS */}
            {customAwards.length > 0 && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 text-accent rounded-full">
                  <Award size={14} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">
                    {lang === "sk" ? "Špeciálne ocenenia" : "Special Awards"}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {customAwards.map((a) => a.photo && (
                    <motion.div 
                      key={a.id}
                      whileHover={{ x: 4 }}
                      className="p-4 bg-paper border border-border rounded flex gap-4 items-center group shadow-sm"
                    >
                      <div 
                        className="w-20 aspect-[4/3] bg-black overflow-hidden border border-border rounded cursor-pointer shrink-0"
                        onClick={() => setSelectedPhoto(a.photo)}
                      >
                        <img 
                          src={a.photo.webPath} 
                          alt={a.photo.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] uppercase font-extrabold tracking-widest text-accent block">
                          {lang === "sk" ? a.titleSk : a.titleEn}
                        </span>
                        <h4 className="text-sm font-bold text-ink truncate">
                          {a.photo.author}
                        </h4>
                        <p className="text-xs italic text-muted truncate">
                          “{a.photo.name}”
                        </p>
                        {a.descriptionSk && (
                          <p className="text-[10px] text-muted font-light mt-1 line-clamp-1">
                            {lang === "sk" ? a.descriptionSk : a.descriptionEn}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: EXHIBITION HALL */}
      {activeTab === 'exhibition' && (
        <div className="space-y-8">
          
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { id: 'all', labelSk: 'Všetky diela', labelEn: 'All Photos' },
              { id: 'A', labelSk: 'Kategória A - Krása jaskýň', labelEn: 'Category A' },
              { id: 'B', labelSk: 'Kategória B - Speleomoment', labelEn: 'Category B' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setExhibitionFilter(f.id)}
                className={cn(
                  "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                  exhibitionFilter === f.id
                    ? "bg-ink text-white border-ink"
                    : "text-muted border-border hover:text-ink hover:border-ink"
                )}
              >
                {lang === "sk" ? f.labelSk : f.labelEn}
              </button>
            ))}
          </div>

          {activeExhibitionPhotos.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border">
              <p className="text-xs uppercase font-bold text-muted tracking-widest">
                {lang === "sk" ? "Žiadne fotky vo výstavnej sieni." : "No photos in the exhibition hall."}
              </p>
            </div>
          ) : (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {activeExhibitionPhotos.map((photo) => (
                  <motion.div
                    layout
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="bg-paper border border-border shadow-sm hover:shadow-md transition-all rounded overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <div className="aspect-[4/3] bg-black overflow-hidden relative">
                      <img 
                        src={photo.webPath} 
                        alt={photo.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="text-white" size={18} />
                      </div>
                      
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-[8px] font-bold text-white uppercase tracking-widest rounded">
                        {photo.category === 'A' 
                          ? (lang === "sk" ? "Krása jaskýň" : "Beauty of Caves") 
                          : "Speleomoment"}
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-1">
                      <h4 className="text-xs font-bold text-ink truncate">{photo.author}</h4>
                      <p className="text-[11px] italic text-muted truncate">“{photo.name}”</p>
                      
                      <div className="pt-2 border-t border-border flex justify-between items-center text-[9px] uppercase tracking-wider text-muted font-bold">
                        <span>{lang === "sk" ? "Porota" : "Jury"}: {photo.juryScore}b</span>
                        <span>{lang === "sk" ? "Verejnosť" : "Public"}: {photo.publicVotes}x</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

        </div>
      )}

      {/* LIGHTBOX / FULLSCREEN VIEWER */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4"
          >
            {/* Top Toolbar */}
            <div className="flex justify-between items-center py-2 px-4 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {selectedPhoto.category === 'A' 
                  ? (lang === "sk" ? "Kategória A - Krása jaskýň" : "Category A - Beauty of Caves") 
                  : (lang === "sk" ? "Kategória B - Speleomoment" : "Category B - Speleomoment")}
              </span>
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Middle Container */}
            <div className="flex-1 flex items-center justify-between gap-4 max-h-[75vh]">
              <button 
                onClick={handlePrev}
                className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-full shrink-0"
              >
                <ArrowLeft size={28} />
              </button>

              <div className="relative max-w-full max-h-full flex items-center justify-center">
                <img 
                  src={selectedPhoto.webPath} 
                  alt={selectedPhoto.name}
                  className="max-w-[85vw] max-h-[70vh] object-contain shadow-2xl border border-zinc-800"
                />
              </div>

              <button 
                onClick={handleNext}
                className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-full shrink-0"
              >
                <ArrowRight size={28} />
              </button>
            </div>

            {/* Bottom Metadata Panel */}
            <div className="max-w-3xl mx-auto w-full text-center py-4 px-6 shrink-0 space-y-2">
              <h3 className="text-xl font-light text-white uppercase tracking-wider">
                {selectedPhoto.author}
              </h3>
              <p className="text-sm italic text-zinc-400">
                “{selectedPhoto.name}”
              </p>
              {selectedPhoto.description && (
                <p className="text-xs font-light text-zinc-500 max-w-2xl mx-auto line-clamp-3">
                  {selectedPhoto.description}
                </p>
              )}
              
              <div className="pt-2 flex justify-center gap-6 text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                <span>{lang === "sk" ? "Porota" : "Jury"}: {selectedPhoto.juryScore}b</span>
                <span>{lang === "sk" ? "Verejnosť" : "Public"}: {selectedPhoto.publicVotes}x</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
