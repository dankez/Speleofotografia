import { useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight, Maximize2, X, CheckCircle2, User, Camera, Calendar, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { Photo, Rating } from "../types";
import { Lang } from "../App";

interface Props {
  evalId: string;
  lang: Lang;
}

interface JuryPhoto {
  id: string;
  category: string;
  name: string;
  webPath: string;
  description: string;
  metadata: any;
}

export default function EvaluatorInterface({ evalId, lang }: Props) {
  const [photos, setPhotos] = useState<JuryPhoto[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluatorName, setEvaluatorName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetchEvaluator();
    fetchSettings();
  }, [evalId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvaluator = async () => {
    try {
      const res = await fetch("/api/evaluators");
      const evals = await res.json();
      const currentEval = evals.find((e: any) => e.id === evalId);
      if (currentEval) setEvaluatorName(currentEval.name);
    } catch (e) {
      console.error(e);
    }
  };

  const startEvaluation = async (category: string) => {
    setLoading(true);
    setSelectedCategory(category);
    try {
      const [photosRes, ratingsRes] = await Promise.all([
        fetch(`/api/jury/photos?category=${category}`),
        fetch(`/api/ratings/${evalId}`)
      ]);
      
      const juryPhotos = await photosRes.json();
      const myRatings = await ratingsRes.json();

      setPhotos(juryPhotos);
      setRatings(myRatings);
      setCurrentIndex(0);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const currentPhoto = photos[currentIndex];
  const currentRating = ratings.find(r => r.photoId === currentPhoto?.id)?.score || 0;

  const handleRate = async (score: number) => {
    if (!currentPhoto) return;

    // Optimistic update local state immediately
    setRatings(prev => {
      const existing = prev.findIndex(r => r.photoId === currentPhoto.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { photoId: currentPhoto.id, score, judgeId: evalId };
        return next;
      }
      return [...prev, { photoId: currentPhoto.id, score, judgeId: evalId }];
    });

    // Save to server with error handling
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evalId,
          evalName: evaluatorName,
          photoId: currentPhoto.id,
          score
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Rating save failed:", errData);
        setSaveStatus("error");
        // Revert local state on failure
        setRatings(prev => prev.filter(r => r.photoId !== currentPhoto.id || r.score !== score));
        return;
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);

      // Auto next or finish category
      if (currentIndex < photos.length - 1) {
        setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
      } else {
        setTimeout(() => {
          setSelectedCategory(null);
          setCurrentIndex(0);
        }, 600);
      }
    } catch (e) {
      console.error("Network error saving rating:", e);
      setSaveStatus("error");
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key >= "1" && e.key <= "5") handleRate(parseInt(e.key));
    if (e.key === "ArrowLeft") setCurrentIndex(prev => Math.max(0, prev - 1));
    if (e.key === "ArrowRight") setCurrentIndex(prev => Math.min(photos.length - 1, prev + 1));
  }, [photos.length, currentIndex]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isJudgingActive = () => {
    if (!settings) return false;
    
    const now = new Date();
    // Use dates as primary source of truth if available
    if (settings.judgingStart && settings.judgingEnd) {
      const start = new Date(settings.judgingStart);
      const end = new Date(settings.judgingEnd);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    }

    // Fallback to status
    return ["review", "judging", "shortlist"].includes(settings.contestStatus);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <Loader2 className="animate-spin text-accent" size={40} />
      <span className="uppercase tracking-[3px] text-[10px] font-bold text-muted">
        {lang === "sk" ? "Nahrávam fotografie..." : "Loading competition photos..."}
      </span>
    </div>
  );

  if (!selectedCategory) {
    const judgingOpen = isJudgingActive();

    return (
      <div className="max-w-4xl mx-auto py-12 space-y-12">
        <div className="text-center space-y-4">
          <p className="text-[11px] text-muted uppercase font-bold tracking-[3px]">
            {lang === "sk" ? "Výber kategórie na hodnotenie" : "Select Category to Evaluate"}
          </p>
          <h2 className="text-5xl font-light tracking-tighter uppercase">{evaluatorName}</h2>
          
          {!judgingOpen && settings && (
            <div className="mt-8 p-6 border border-accent bg-accent/5 max-w-lg mx-auto">
              <p className="text-xs uppercase font-bold tracking-widest text-accent">
                {lang === "sk" ? "Bodovanie momentálne nie je aktívne" : "Judging is currently not active"}
              </p>
              <p className="text-[11px] text-muted mt-2 font-bold uppercase">
                {lang === "sk" 
                  ? (settings.judgingStart && new Date(settings.judgingStart) > new Date()
                      ? `Hodnotenie sa začne ${new Date(settings.judgingStart).toLocaleDateString()}.`
                      : "Termín na hodnotenie už uplynul.")
                  : (settings.judgingStart && new Date(settings.judgingStart) > new Date()
                      ? `Judging will open on ${new Date(settings.judgingStart).toLocaleDateString()}.`
                      : "The deadline for judging has passed.")}
              </p>
            </div>
          )}
        </div>

        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8", !judgingOpen && "opacity-40 pointer-events-none")}>
          {(settings?.categories || []).map(cat => (
            <button
              key={cat.id}
              onClick={() => startEvaluation(cat.id)}
              className="group relative h-80 border border-border bg-white flex flex-col items-center justify-center space-y-6 overflow-hidden transition-all hover:border-ink"
            >
              <div className="absolute inset-0 bg-paper opacity-0 group-hover:opacity-40 transition-opacity" />
              <div className="z-10 text-center px-6">
                <span className="text-[120px] font-black opacity-[0.03] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none">{cat.id}</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Kategória" : "Category"}</p>
                <h3 className="text-2xl md:text-3xl font-light tracking-tight uppercase mt-2">{lang === "sk" ? cat.nameSk : cat.nameEn}</h3>
              </div>
              <div className="z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-ink text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest">
                  {lang === "sk" ? "Začať bodovanie" : "Start Scoring"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-light tracking-tight uppercase">{lang === "sk" ? "Žiadne fotografie" : "No photos"}</h2>
          <p className="text-muted uppercase text-[11px] tracking-widest">
            {lang === "sk" ? `V kategórii ${selectedCategory} zatiaľ nie sú žiadne nahrané fotografie.` : `No photos uploaded in category ${selectedCategory} yet.`}
          </p>
          <button 
            onClick={() => setSelectedCategory(null)}
            className="text-accent text-[11px] font-bold uppercase tracking-widest hover:underline"
          >
            {lang === "sk" ? "Späť na výber" : "Back to selection"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      {/* Evaluator Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <button onClick={() => setSelectedCategory(null)} className="text-muted hover:text-ink transition-colors">
                <ChevronLeft size={20} />
             </button>
             <p className="text-[11px] text-muted uppercase font-bold tracking-widest">
                {lang === "sk" ? "Porotca" : "Jury"}: {evaluatorName} — {lang === "sk" ? "Karta" : "Work"} {currentIndex + 1} {lang === "sk" ? "z" : "of"} {photos.length} — {(settings?.categories || []).find((c: any) => c.id === selectedCategory)?.[lang === "sk" ? "nameSk" : "nameEn"] || selectedCategory}
             </p>
          </div>
          <h2 className="text-3xl font-light tracking-tight uppercase">{lang === "sk" ? "Anonymné hodnotenie" : "Anonymous Scoring"}</h2>
        </div>

        <div className="hidden md:flex gap-2 text-[10px] uppercase tracking-widest font-bold text-muted border border-border p-3 bg-white">
           <Info size={14} className="text-accent" />
           <span>{lang === "sk" ? "Klávesy 1-5 pre body, šípky pre navigáciu" : "Keys 1-5 for points, arrows for navigation"}</span>
        </div>
      </div>

      {/* Main Evaluator UI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Photo Stage */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative aspect-[4/3] bg-ink group overflow-hidden border border-border shadow-2xl">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentPhoto?.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                src={`/uploads/${currentPhoto?.webPath}`}
                className="w-full h-full object-contain"
                alt={currentPhoto?.name}
              />
            </AnimatePresence>
            
            <button 
              onClick={() => setIsFullscreen(true)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Maximize2 size={20} />
            </button>

            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="w-12 h-12 bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40"
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                onClick={() => setCurrentIndex(prev => Math.min(photos.length - 1, prev + 1))}
                className="w-12 h-12 bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                onClick={() => handleRate(score)}
                className={cn(
                  "w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-xl font-bold border transition-all",
                  currentRating === score 
                    ? "bg-ink text-white border-ink shadow-lg" 
                    : "bg-white border-border hover:border-ink"
                )}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          <div className="space-y-6">
             <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">{lang === "sk" ? "Informácie / Info" : "Details / Info"}</h3>
             <div className="space-y-8">
                <div className="space-y-1">
                  <p className="text-3xl font-light tracking-tight uppercase leading-none">{lang === "sk" ? "Súťažná fotografia" : "Contest Photo"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[2px] text-accent mt-2">{(settings?.categories || []).find((c: any) => c.id === currentPhoto?.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || currentPhoto?.category}</p>
                </div>

                {currentPhoto?.metadata && (
                  <div className="grid grid-cols-2 gap-4 py-6 border-y border-border">
                    <div className="space-y-0.5">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Fotoaparát" : "Camera"}</p>
                       <p className="text-[12px] font-bold uppercase tracking-tight truncate">{currentPhoto.metadata.camera || "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Nastavenia" : "Settings"}</p>
                       <p className="text-[12px] font-bold uppercase tracking-tight">{currentPhoto.metadata.settings || "—"}</p>
                    </div>
                    {currentPhoto.metadata.lens && (
                      <div className="col-span-2 space-y-0.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Objektív" : "Lens"}</p>
                        <p className="text-[12px] font-bold uppercase tracking-tight truncate">{currentPhoto.metadata.lens}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Príbeh / Description" : "Story / Description"}</p>
                  <p className="text-[13px] leading-relaxed font-medium text-ink/80 whitespace-pre-wrap">
                    {currentPhoto?.description || (lang === "sk" ? "Bez popisu." : "No description.")}
                  </p>
                </div>
             </div>
          </div>

          <div className="p-8 border border-border bg-paper space-y-4 text-center">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Stav hodnotenia" : "Rating Status"}</h4>
             <div className="flex flex-col items-center gap-2">
                <div className={cn("w-14 h-14 flex items-center justify-center font-bold text-2xl border transition-all", currentRating > 0 ? "bg-accent text-white border-accent" : "bg-white text-muted border-border")}>
                  {saveStatus === "saving" ? <Loader2 size={24} className="animate-spin" /> : (currentRating || "—")}
                </div>
                <p className={cn("text-[10px] font-bold uppercase tracking-[1px] mt-2 transition-colors",
                  saveStatus === "error" ? "text-red-500" :
                  saveStatus === "saved" ? "text-green-600" :
                  saveStatus === "saving" ? "text-muted animate-pulse" :
                  "text-ink"
                )}>
                  {saveStatus === "saving" ? (lang === "sk" ? "UKLADÁM..." : "SAVING...") :
                   saveStatus === "saved" ? (lang === "sk" ? "✓ ULOŽENÉ" : "✓ SAVED") :
                   saveStatus === "error" ? (lang === "sk" ? "✗ CHYBA UKLADANIA" : "✗ SAVE FAILED") :
                   currentRating > 0 ? (lang === "sk" ? "BODOVANÉ" : "RATED") : (lang === "sk" ? "ČAKÁ NA BODY" : "WAITING")}
                </p>
             </div>
          </div>

        </div>
      </div>

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#141414] flex items-center justify-center"
          >
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
            >
              <X size={40} />
            </button>

            <img 
              src={`/uploads/${currentPhoto?.webPath}`}
              className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl"
              alt="Fullscreen"
            />
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
               {[1,2,3,4,5].map(score => (
                 <button
                  key={score}
                  onClick={() => { handleRate(score); setIsFullscreen(false); }}
                  className={cn(
                    "w-16 h-16 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full text-xl font-bold hover:bg-white hover:text-[#141414] transition-all",
                    currentRating === score && "bg-white text-[#141414]"
                  )}
                 >
                  {score}
                 </button>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
