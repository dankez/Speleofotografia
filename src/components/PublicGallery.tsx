import { useState, useEffect, useMemo } from "react";
import { Heart, Loader2, Maximize2, X, ChevronLeft, ChevronRight, Info, Shield } from "lucide-react";
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
  const [votingPhotoId, setVotingPhotoId] = useState<string | null>(null);
  const [showTurnstileModal, setShowTurnstileModal] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  
  // Detekcia stĺpcov z URL alebo default
  const columns = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const colsParam = params.get("cols");
    if (colsParam) return parseInt(colsParam);
    return isIframe ? 3 : 0; // 0 znamená pôvodná responzívna logika
  }, [isIframe]);

  const filteredPhotos = photos.filter(p => filter === "all" || p.category === filter);

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
  }, []);

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

  return (
    <div className="space-y-8 md:space-y-12 pb-20">
      <div className="text-center space-y-3 md:space-y-4 max-w-2xl mx-auto px-4">
        <h2 className="text-3xl md:text-5xl font-light tracking-tighter uppercase">
          {lang === "sk" ? "Verejné hlasovanie" : "Public Choice"}
        </h2>
        <p className="text-[10px] md:text-[11px] text-muted uppercase font-bold tracking-[2px] md:tracking-[3px] leading-relaxed">
          {lang === "sk" 
            ? "Hlasujte za fotografie, ktoré vás najviac oslovili. Autori sú anonymizovaní." 
            : "Vote for the photos that inspired you the most. Authors remain anonymous."}
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 pt-4">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-4 py-1 text-[9px] uppercase font-bold tracking-widest transition-all border",
              filter === "all" 
                ? "bg-ink text-white border-ink" 
                : "bg-transparent text-muted border-border hover:border-ink"
            )}
          >
            {lang === "sk" ? "Všetky" : "All"}
          </button>
          {(settings?.categories || []).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={cn(
                "px-4 py-1 text-[9px] uppercase font-bold tracking-widest transition-all border",
                filter === cat.id 
                  ? "bg-ink text-white border-ink" 
                  : "bg-transparent text-muted border-border hover:border-ink"
              )}
            >
              {lang === "sk" ? cat.nameSk : cat.nameEn}
            </button>
          ))}
        </div>
      </div>

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
              className="w-full h-auto transition-transform duration-700 ease-in-out group-hover:scale-110"
              alt={photo.name}
              loading="lazy"
            />
            
            {/* Overlay - always visible on mobile, hover on desktop */}
            <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity">
               <div className="flex justify-between items-end gap-2">
                  <div className="space-y-0.5">
                    <p className="text-[7px] md:text-[8px] text-accent font-bold uppercase tracking-widest">
                      {(settings?.categories || []).find(c => c.id === photo.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || photo.category}
                    </p>
                    <p className="text-[10px] md:text-[11px] text-white font-bold tracking-tight line-clamp-1">{lang === "sk" ? "Súťažná fotografia" : "Contest Photo"}</p>
                  </div>
                  <button 
                    onClick={(e) => handleVote(photo.id, e)}
                    className={cn(
                      "p-2.5 md:p-2 rounded-full transition-all duration-300",
                      votedIds.includes(photo.id) 
                        ? "bg-accent text-white scale-110" 
                        : "bg-white/20 md:bg-white/10 text-white hover:bg-accent backdrop-blur-sm"
                    )}
                  >
                    <Heart size={16} fill={votedIds.includes(photo.id) ? "currentColor" : "none"} />
                  </button>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-ink/95 flex flex-col items-center overflow-y-auto"
          >
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="fixed top-4 right-4 md:top-8 md:right-8 z-[110] p-2 text-white/60 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-md"
            >
              <X size={24} className="md:w-8 md:h-8" />
            </button>

            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-12 max-w-7xl w-full min-h-screen lg:min-h-0 lg:h-auto items-center p-4 md:p-12">
              <div className="w-full lg:col-span-8 flex items-center justify-center relative mt-12 lg:mt-0 group/img">
                {/* Navigation Arrows */}
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  className="absolute left-2 md:-left-12 z-[110] p-4 text-white/40 hover:text-white transition-all bg-black/10 hover:bg-black/30 rounded-full md:opacity-0 md:group-hover/img:opacity-100"
                >
                  <ChevronLeft size={32} />
                </button>

                <div className="relative group/photoContainer">
                  <motion.img 
                    key={selectedPhoto.id}
                    layoutId={selectedPhoto.id}
                    src={`/uploads/${selectedPhoto.webPath || (selectedPhoto.id + ".webp")}`}
                    className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain shadow-2xl border border-white/5"
                  />
                  
                  {/* Floating heart on large photo */}
                  <button 
                    onClick={(e) => handleVote(selectedPhoto.id, e)}
                    className={cn(
                      "absolute top-4 right-4 p-4 rounded-full transition-all duration-300 shadow-xl",
                      votedIds.includes(selectedPhoto.id) 
                        ? "bg-accent text-white scale-110" 
                        : "bg-white/20 text-white hover:bg-accent backdrop-blur-md"
                    )}
                  >
                    <Heart size={24} fill={votedIds.includes(selectedPhoto.id) ? "currentColor" : "none"} />
                  </button>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="absolute right-2 md:-right-12 z-[110] p-4 text-white/40 hover:text-white transition-all bg-black/10 hover:bg-black/30 rounded-full md:opacity-0 md:group-hover/img:opacity-100"
                >
                  <ChevronRight size={32} />
                </button>
              </div>
              
              <div className="w-full lg:col-span-4 space-y-6 md:space-y-8 bg-paper p-6 md:p-8 rounded-sm lg:shadow-2xl">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[3px] text-accent">
                    {lang === "sk" ? "Kategória" : "Category"} {(settings?.categories || []).find(c => c.id === selectedPhoto.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || selectedPhoto.category}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-light tracking-tighter uppercase">{lang === "sk" ? "Súťažná fotografia" : "Contest Photo"}</h2>
                </div>

                <div className="space-y-2 pb-6 border-b border-border">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Príbeh" : "Story"}</p>
                  <p className="text-xs md:text-sm text-balance leading-relaxed text-muted/80">
                    {selectedPhoto.description || (lang === "sk" ? "Bez popisu." : "No description provided.")}
                  </p>
                </div>

                <div className="space-y-4 md:space-y-6">
                  <button 
                    onClick={(e) => handleVote(selectedPhoto.id, e)}
                    disabled={votedIds.includes(selectedPhoto.id)}
                    className={cn(
                      "w-full py-4 md:py-5 text-[10px] md:text-[11px] font-bold uppercase tracking-[3px] md:tracking-[4px] transition-all flex items-center justify-center gap-3",
                      votedIds.includes(selectedPhoto.id)
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : "bg-ink text-white hover:opacity-90 active:scale-95"
                    )}
                  >
                    <Heart size={18} fill={votedIds.includes(selectedPhoto.id) ? "currentColor" : "none"} />
                    {votedIds.includes(selectedPhoto.id) 
                      ? (lang === "sk" ? "Hlas započítaný" : "Vote counted")
                      : (lang === "sk" ? "Dať hlas fotografii" : "Vote for this photo")}
                  </button>

                  <div className="flex items-center gap-3 p-3 md:p-4 bg-muted/5 border border-border text-muted">
                    <Info size={14} className="shrink-0 text-accent" />
                    <p className="text-[8px] md:text-[9px] uppercase font-bold leading-tight">
                      {lang === "sk" 
                        ? "Vaša voľba je anonymná a pomáha určiť Cenu verejnosti. Každý návštevník môže dať každej fotke iba jeden hlas." 
                        : "Your choice is anonymous and helps determine the Public Choice Award. Each visitor can vote once per photo."}
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
