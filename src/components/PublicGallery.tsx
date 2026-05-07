import { useState, useEffect } from "react";
import { Heart, Loader2, Maximize2, X, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Lang } from "../App";

interface PublicPhoto {
  id: string;
  category: string;
  name: string;
  webPath: string;
  description: string;
}

export default function PublicGallery({ lang }: { lang: Lang }) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);
  const [filter, setFilter] = useState<"all" | "A" | "B">("all");

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
  }, []);

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

  const handleVote = async (photoId: string, e: any) => {
    e.stopPropagation();
    if (votedIds.includes(photoId)) return;

    try {
      const res = await fetch("/api/public/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId })
      });
      
      if (res.ok) {
        const newVoted = [...votedIds, photoId];
        setVotedIds(newVoted);
        localStorage.setItem("speleo_voted_ids", JSON.stringify(newVoted));
      }
    } catch (e) {
      console.error(e);
    }
  };

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
        <div className="flex justify-center gap-2 pt-4">
          {["all", "A", "B"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as any)}
              className={cn(
                "px-4 py-1 text-[9px] uppercase font-bold tracking-widest transition-all border",
                filter === cat 
                  ? "bg-ink text-white border-ink" 
                  : "bg-transparent text-muted border-border hover:border-ink"
              )}
            >
              {cat === "all" ? (lang === "sk" ? "Všetky" : "All") : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 md:gap-4 space-y-3 md:space-y-4 px-3 md:px-4 max-w-[1800px] mx-auto">
        {photos
          .filter(p => filter === "all" || p.category === filter)
          .map((photo) => (
          <motion.div
            layout
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="break-inside-avoid group relative bg-paper border border-border cursor-pointer overflow-hidden rounded-sm mx-auto w-full"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img 
              src={`/uploads/${photo.webPath}`} 
              className="w-full h-auto grayscale-[30%] md:grayscale-[50%] group-hover:grayscale-0 transition-all duration-500"
              alt={photo.name}
            />
            
            {/* Overlay - always visible on mobile, hover on desktop */}
            <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity">
               <div className="flex justify-between items-end gap-2">
                  <div className="space-y-0.5">
                    <p className="text-[7px] md:text-[8px] text-accent font-bold uppercase tracking-widest">{photo.category}</p>
                    <p className="text-[10px] md:text-[11px] text-white font-bold tracking-tight line-clamp-1">{photo.name}</p>
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
              <div className="w-full lg:col-span-8 flex items-center justify-center relative mt-12 lg:mt-0">
                <motion.img 
                  layoutId={selectedPhoto.id}
                  src={`/uploads/${selectedPhoto.webPath}`}
                  className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain shadow-2xl border border-white/5"
                />
              </div>
              
              <div className="w-full lg:col-span-4 space-y-6 md:space-y-8 bg-paper p-6 md:p-8 rounded-sm lg:shadow-2xl">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[3px] text-accent">{lang === "sk" ? "Kategória" : "Category"} {selectedPhoto.category}</p>
                  <h2 className="text-2xl md:text-3xl font-light tracking-tighter uppercase">{selectedPhoto.name}</h2>
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
    </div>
  );
}
