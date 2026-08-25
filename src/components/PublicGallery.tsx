import { useState, useEffect, useMemo } from "react";
import { Heart, Loader2, Maximize2, X, ChevronLeft, ChevronRight, Info, Shield, Search, ArrowUpDown, Share2, Check, Sparkles, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Lang, Settings } from "../App";

interface PublicPhoto {
  id: string;
  category: string;
  name: string;
  webPath: string;
  description: string;
  voteCount?: number;
}

export default function PublicGallery({ lang, isIframe = false }: { lang: Lang, isIframe?: boolean }) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"default" | "votes">("default");
  const [copiedLink, setCopiedLink] = useState(false);
  const [publicStats, setPublicStats] = useState<{ totalPhotos: number; uniqueAuthors: number; byCategory: Record<string, number>; totalVotes: number } | null>(null);
  const [votingPhotoId, setVotingPhotoId] = useState<string | null>(null);
  const [showTurnstileModal, setShowTurnstileModal] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  
  // Detekcia stĺpcov z URL alebo default
  const columns = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const colsParam = params.get("cols");
    if (colsParam) return parseInt(colsParam);
    return isIframe ? 3 : 0;
  }, [isIframe]);

  // Kategórie s počtami fotografií
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: photos.length };
    photos.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = photos.filter(p => {
      const matchCat = filter === "all" || p.category === filter;
      // Anonymizované vyhľadávanie výhradne v texte popisu / príbehu fotografie
      const matchSearch = !q || (p.description && p.description.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    if (sortBy === "votes") {
      list = [...list].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    }

    return list;
  }, [photos, filter, searchQuery, sortBy]);

  const columnClass = useMemo(() => {
    if (columns === 1) return "columns-1";
    if (columns === 2) return "columns-2";
    if (columns === 3) return "columns-3";
    if (columns === 4) return "columns-4";
    return "columns-1 sm:columns-2 lg:columns-3 xl:columns-4";
  }, [columns]);

  const handleNext = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[nextIndex]);
  };

  const handlePrev = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[prevIndex]);
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
  }, [selectedPhoto, filteredPhotos]);

  useEffect(() => {
    // Load voted IDs from local storage for privacy
    const stored = localStorage.getItem("speleo_voted_ids");
    if (stored) {
      try {
        setVotedIds(JSON.parse(stored));
      } catch (e) {
        setVotedIds([]);
      }
    }
    
    fetchPhotos();
    fetchSettings();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setPublicStats(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPhotos = async () => {
    try {
      const res = await fetch("/api/public/gallery");
      if (res.ok) setPhotos(await res.json());
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleVote = (photoId: string, e: any) => {
    e.stopPropagation();
    if (votedIds.includes(photoId)) return;

    const turnstileEnabled = Boolean(settings?.turnstileEnabled);
    if (!turnstileEnabled) {
      submitVote(photoId, "");
    } else {
      setVotingPhotoId(photoId);
      setTurnstileError(null);
      setShowTurnstileModal(true);
    }
  };

  const submitVote = async (photoId: string, token: string) => {
    setIsSubmittingVote(true);
    setTurnstileError(null);

    let fingerprint = localStorage.getItem("speleo_fp");
    if (!fingerprint) {
      fingerprint = crypto.randomUUID();
      localStorage.setItem("speleo_fp", fingerprint);
    }

    try {
      const res = await fetch("/api/public/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, fingerprint, turnstileToken: token })
      });
      
      const data = await res.json();

      if (res.ok) {
        const newVoted = [...votedIds, photoId];
        setVotedIds(newVoted);
        localStorage.setItem("speleo_voted_ids", JSON.stringify(newVoted));
        setPhotos(prev => prev.map(p => 
          p.id === photoId ? { ...p, voteCount: (p.voteCount || 0) + 1 } : p
        ));
        setShowTurnstileModal(false);
        setVotingPhotoId(null);
        fetchStats(); // Obnoviť celkový počet hlasov
      } else {
        setTurnstileError(data.error || (lang === "sk" ? "Chyba pri hlasovaní" : "Error voting"));
        if (res.status === 429) {
          setVotedIds(prev => [...prev, photoId]);
          localStorage.setItem("speleo_voted_ids", JSON.stringify([...votedIds, photoId]));
          setTimeout(() => {
            setShowTurnstileModal(false);
            setVotingPhotoId(null);
          }, 1500);
        }
      }
    } catch (e) {
      console.error(e);
      setTurnstileError(lang === "sk" ? "Chyba pripojenia" : "Connection error");
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const copyShareLink = (photo: PublicPhoto) => {
    const url = `${window.location.origin}/?view=public&photo=${photo.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  useEffect(() => {
    if (showTurnstileModal && votingPhotoId) {
      const timer = setTimeout(() => {
        if ((window as any).turnstile) {
          try {
            (window as any).turnstile.render("#turnstile-container", {
              sitekey: settings?.turnstileSiteKey || "1x00000000000000000000AA",
              callback: (token: string) => {
                submitVote(votingPhotoId, token);
              },
              "error-callback": () => {
                setTurnstileError(lang === "sk" ? "Overenie Turnstile zlyhalo." : "Turnstile verification failed.");
              }
            });
          } catch (e) {
            console.error("Turnstile render error:", e);
          }
        } else {
          setTurnstileError(lang === "sk" ? "Chyba načítania ochrany proti botom." : "Failed to load bot protection.");
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showTurnstileModal, votingPhotoId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin text-accent" size={40} />
      <p className="text-[10px] font-bold uppercase tracking-[3px] text-muted">
        {lang === "sk" ? "Generujem mozaiku súťaže..." : "Generating competition mosaic..."}
      </p>
    </div>
  );

  const selectedIndex = selectedPhoto ? filteredPhotos.findIndex(p => p.id === selectedPhoto.id) : -1;

  return (
    <div className="space-y-8 md:space-y-10 pb-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent">
          <Sparkles size={13} className="animate-pulse" />
          <span className="text-[9px] uppercase font-extrabold tracking-[2px]">
            {lang === "sk" ? "Galéria súťaže & Hlasovanie verejnosti" : "Competition Gallery & Public Choice"}
          </span>
        </div>

        <h2 className="text-3xl md:text-5xl font-light tracking-tighter uppercase">
          {lang === "sk" ? "Mozaika fotografií" : "Photo Mosaic"}
        </h2>
        <p className="text-[11px] text-muted uppercase font-bold tracking-[2px] md:tracking-[3px] leading-relaxed max-w-xl mx-auto">
          {lang === "sk" 
            ? "Prezrite si súťažné fotografie a dajte hlas svojim favoritom. Autori sú počas hlasovania anonymizovaní." 
            : "Explore competition photographs and vote for your favorites. Authors remain anonymous during voting."}
        </p>

        {/* Live Public Stats Bar */}
        {publicStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-paper/80 border border-border mt-4 text-left">
            <div>
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Fotografií" : "Photos"}</p>
              <p className="text-lg font-bold text-ink">{publicStats.totalPhotos}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Autorov" : "Authors"}</p>
              <p className="text-lg font-bold text-ink">{publicStats.uniqueAuthors}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Kategórie A / B" : "Categories A / B"}</p>
              <p className="text-lg font-bold text-ink">{(publicStats.byCategory?.A || 0)} / {(publicStats.byCategory?.B || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Hlasov verejnosti" : "Public Votes"}</p>
              <p className="text-lg font-bold text-accent">{publicStats.totalVotes}</p>
            </div>
          </div>
        )}

        {/* Filter, Search & Sort Bar */}
        <div className="space-y-3 pt-2">
          {/* Category Filter Pills with counts */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all border flex items-center gap-1.5",
                filter === "all" 
                  ? "bg-ink text-white border-ink shadow-sm" 
                  : "bg-white text-muted border-border hover:border-ink"
              )}
            >
              <span>{lang === "sk" ? "Všetky" : "All"}</span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.2 rounded-full",
                filter === "all" ? "bg-white/20 text-white" : "bg-ink/5 text-muted"
              )}>
                {categoryCounts["all"] || 0}
              </span>
            </button>
            {(settings?.categories || []).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={cn(
                  "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all border flex items-center gap-1.5",
                  filter === cat.id 
                    ? "bg-ink text-white border-ink shadow-sm" 
                    : "bg-white text-muted border-border hover:border-ink"
                )}
              >
                <span>{lang === "sk" ? cat.nameSk : cat.nameEn}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.2 rounded-full",
                  filter === cat.id ? "bg-white/20 text-white" : "bg-ink/5 text-muted"
                )}>
                  {categoryCounts[cat.id] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === "sk" ? "Hľadať v popise fotografie..." : "Search photo description..."}
                className="w-full pl-9 pr-8 py-2 bg-white border border-border text-xs outline-none focus:border-ink"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted">{lang === "sk" ? "Zoradiť:" : "Sort:"}</span>
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-white border border-border px-3 py-2 text-xs outline-none focus:border-ink uppercase font-medium"
              >
                <option value="default">{lang === "sk" ? "Predvolené" : "Default"}</option>
                <option value="votes">{lang === "sk" ? "Najviac hlasov" : "Most votes"}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Empty Search Result */}
      {filteredPhotos.length === 0 && (
        <div className="text-center py-16 border border-border bg-paper/50 max-w-xl mx-auto p-6 space-y-3">
          <Info size={32} className="mx-auto text-muted" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink">
            {lang === "sk" ? "Žiadne fotografie nevyhovujú filtru" : "No photos match your filter"}
          </h3>
          <p className="text-xs text-muted">
            {lang === "sk" ? "Skúste upraviť hľadaný výraz alebo zvoľte inú kategóriu." : "Try adjusting your search query or select another category."}
          </p>
          <button 
            onClick={() => { setFilter("all"); setSearchQuery(""); }}
            className="px-4 py-2 bg-ink text-white text-[10px] font-bold uppercase tracking-widest"
          >
            {lang === "sk" ? "Zobraziť všetky" : "Show all"}
          </button>
        </div>
      )}

      {/* Photo Mosaic Grid */}
      <div className={cn(columnClass, "gap-3 md:gap-4 space-y-3 md:space-y-4 px-3 md:px-4 max-w-[1800px] mx-auto")}>
        {filteredPhotos.map((photo) => (
          <motion.div
            layout
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="break-inside-avoid group relative bg-paper border border-border cursor-pointer overflow-hidden rounded-sm mx-auto w-full"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img 
              src={`/uploads/${photo.webPath || (photo.id + ".webp")}`} 
              className="w-full h-auto transition-transform duration-700 ease-in-out group-hover:scale-105"
              alt={photo.name}
              loading="lazy"
            />
            
            {/* Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity">
               <div className="flex justify-between items-end gap-2">
                  <div className="space-y-0.5">
                    <p className="text-[8px] text-accent font-bold uppercase tracking-widest">
                      {(settings?.categories || []).find(c => c.id === photo.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || `Kategória ${photo.category}`}
                    </p>
                    <p className="text-[11px] text-white font-bold tracking-tight line-clamp-1">{photo.name || (lang === "sk" ? "Súťažná fotografia" : "Contest Photo")}</p>
                  </div>
                  <button 
                    onClick={(e) => handleVote(photo.id, e)}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300 flex items-center gap-1.5 px-2.5",
                      votedIds.includes(photo.id) 
                        ? "bg-accent text-white scale-105" 
                        : "bg-white/20 text-white hover:bg-accent backdrop-blur-sm"
                    )}
                  >
                    <Heart size={14} fill={votedIds.includes(photo.id) ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold">{photo.voteCount || 0}</span>
                  </button>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Enhanced Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-ink/95 flex flex-col items-center overflow-y-auto"
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="fixed top-4 right-4 md:top-6 md:right-6 z-[120] p-2.5 text-white/70 hover:text-white transition-colors bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md"
            >
              <X size={22} />
            </button>

            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-10 max-w-7xl w-full min-h-screen lg:min-h-0 lg:h-auto items-center p-4 md:p-10 my-auto">
              {/* Photo Area */}
              <div className="w-full lg:col-span-8 flex items-center justify-center relative mt-12 lg:mt-0 group/img">
                {/* Navigation Arrows */}
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  className="absolute left-2 md:-left-10 z-[110] p-3.5 text-white/50 hover:text-white transition-all bg-black/20 hover:bg-black/50 rounded-full md:opacity-0 md:group-hover/img:opacity-100"
                >
                  <ChevronLeft size={30} />
                </button>

                <div className="relative group/photoContainer">
                  <motion.img 
                    key={selectedPhoto.id}
                    layoutId={selectedPhoto.id}
                    src={`/uploads/${selectedPhoto.webPath || (selectedPhoto.id + ".webp")}`}
                    className="max-w-full max-h-[65vh] md:max-h-[82vh] object-contain shadow-2xl border border-white/10"
                  />
                  
                  {/* Floating heart on large photo */}
                  <button 
                    onClick={(e) => handleVote(selectedPhoto.id, e)}
                    className={cn(
                      "absolute top-4 right-4 p-3.5 rounded-full transition-all duration-300 shadow-xl flex items-center gap-2",
                      votedIds.includes(selectedPhoto.id) 
                        ? "bg-accent text-white scale-105" 
                        : "bg-white/25 text-white hover:bg-accent backdrop-blur-md"
                    )}
                  >
                    <Heart size={20} fill={votedIds.includes(selectedPhoto.id) ? "currentColor" : "none"} />
                    <span className="text-xs font-bold">{selectedPhoto.voteCount || 0}</span>
                  </button>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="absolute right-2 md:-right-10 z-[110] p-3.5 text-white/50 hover:text-white transition-all bg-black/20 hover:bg-black/50 rounded-full md:opacity-0 md:group-hover/img:opacity-100"
                >
                  <ChevronRight size={30} />
                </button>
              </div>
              
              {/* Info Sidebar */}
              <div className="w-full lg:col-span-4 space-y-6 bg-paper p-6 md:p-8 rounded-sm lg:shadow-2xl border border-border">
                {/* Counter & Category */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-[9px] font-bold uppercase tracking-[2px] text-accent">
                    {(settings?.categories || []).find(c => c.id === selectedPhoto.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || `Kategória ${selectedPhoto.category}`}
                  </span>
                  {selectedIndex >= 0 && (
                    <span className="text-[10px] font-mono text-muted font-bold">
                      {selectedIndex + 1} / {filteredPhotos.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-light tracking-tight uppercase text-ink">
                    {selectedPhoto.name || (lang === "sk" ? "Súťažná fotografia" : "Contest Photo")}
                  </h2>
                </div>

                {/* Story / Description */}
                <div className="space-y-2 pb-5 border-b border-border">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Príbeh fotografie" : "Photo Story"}</p>
                  <p className="text-xs md:text-sm text-balance leading-relaxed text-muted/90 max-h-48 overflow-y-auto">
                    {selectedPhoto.description || (lang === "sk" ? "Bez sprievodného textu." : "No description provided.")}
                  </p>
                </div>

                {/* Voting & Actions */}
                <div className="space-y-3">
                  <button 
                    onClick={(e) => handleVote(selectedPhoto.id, e)}
                    disabled={votedIds.includes(selectedPhoto.id)}
                    className={cn(
                      "w-full py-4 text-[10px] md:text-[11px] font-bold uppercase tracking-[3px] transition-all flex items-center justify-center gap-3",
                      votedIds.includes(selectedPhoto.id)
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-ink text-white hover:opacity-90 active:scale-95"
                    )}
                  >
                    <Heart size={16} fill={votedIds.includes(selectedPhoto.id) ? "currentColor" : "none"} />
                    {votedIds.includes(selectedPhoto.id) 
                      ? (lang === "sk" ? "Váš hlas bol započítaný" : "Vote counted")
                      : (lang === "sk" ? "Dať hlas fotografii" : "Vote for this photo")}
                  </button>

                  <button 
                    onClick={() => copyShareLink(selectedPhoto)}
                    className="w-full py-2.5 border border-border bg-white text-muted hover:text-ink text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {copiedLink ? <Check size={13} className="text-green-600" /> : <Share2 size={13} />}
                    {copiedLink ? (lang === "sk" ? "Odkaz skopírovaný" : "Link copied") : (lang === "sk" ? "Zdieľať / Kopírovať odkaz" : "Share / Copy link")}
                  </button>

                  <div className="flex items-center gap-2.5 p-3 bg-muted/5 border border-border text-muted">
                    <Info size={13} className="shrink-0 text-accent" />
                    <p className="text-[8px] uppercase font-bold leading-tight">
                      {lang === "sk" 
                        ? "Hlasovanie je anonymné a určuje Cenu verejnosti. Každý návštevník môže dať každej fotke 1 hlas." 
                        : "Voting is anonymous and determines the Public Choice Award. 1 vote per photo."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turnstile Verification Modal */}
      <AnimatePresence>
        {showTurnstileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-paper max-w-sm w-full p-6 md:p-8 rounded-sm shadow-2xl relative border border-border"
            >
              <button 
                onClick={() => { setShowTurnstileModal(false); setVotingPhotoId(null); }}
                className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
                disabled={isSubmittingVote}
              >
                <X size={18} />
              </button>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                  <Shield size={24} />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-lg font-light uppercase tracking-tight text-ink">
                    {lang === "sk" ? "Overenie hlasu" : "Verify Vote"}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">
                    {lang === "sk" 
                      ? "Pre započítanie vášho hlasu prosím potvrďte, že ste človek." 
                      : "To submit your vote, please confirm you are human."}
                  </p>
                </div>

                {/* Turnstile Container */}
                <div className="flex justify-center py-4 min-h-[74px]">
                  <div id="turnstile-container"></div>
                </div>

                {isSubmittingVote && (
                  <p className="text-[10px] font-bold text-accent uppercase tracking-widest animate-pulse">
                    {lang === "sk" ? "Zapisujem hlas..." : "Recording vote..."}
                  </p>
                )}

                {turnstileError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 border border-red-100 rounded-sm">
                    {turnstileError}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
