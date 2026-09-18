import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Star, ChevronLeft, ChevronRight, Maximize2, X, CheckCircle2, User, 
  Camera, Info, Loader2, LayoutGrid, Award, Trophy, ZoomIn, Search, 
  Filter, ArrowUpRight, Crown, ArrowUpDown, Check, Clock, Eye,
  Lock, Unlock, Send, AlertTriangle, AlertCircle, Heart, Sparkles, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { Rating, ChairmanPhotoResult } from "../types";
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
  metadata?: any;
}

export default function EvaluatorInterface({ evalId, lang }: Props) {
  // Evaluator Info & Role
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorRole, setEvaluatorRole] = useState<"evaluator" | "chairman">("evaluator");
  const [isLocked, setIsLocked] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // All competition photos & my ratings
  const [allPhotos, setAllPhotos] = useState<JuryPhoto[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'dashboard' (grid) | 'rate' (single photo review) | 'chairman' (intermediate leaderboard)
  const [viewMode, setViewMode] = useState<"dashboard" | "rate" | "chairman">("dashboard");

  // Dashboard filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unrated" | "rated">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Single photo rating view state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Lightbox Zoom Modal (for dashboard & chairman table)
  const [zoomPhoto, setZoomPhoto] = useState<any | null>(null);

  // Submit flow states
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Chairman view states
  const [chairmanResults, setChairmanResults] = useState<ChairmanPhotoResult[]>([]);
  const [chairmanLoading, setChairmanLoading] = useState(false);
  const [chairmanCategory, setChairmanCategory] = useState<string>("all");
  const [chairmanSearch, setChairmanSearch] = useState("");
  const [chairmanSort, setChairmanSort] = useState<"score_desc" | "avg_desc" | "author_asc" | "name_asc">("score_desc");
  const [allEvaluators, setAllEvaluators] = useState<any[]>([]);
  const [unlockingJurorId, setUnlockingJurorId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, [evalId]);

  // Fetch chairman data when switching to chairman tab
  useEffect(() => {
    if (viewMode === "chairman" && evaluatorRole === "chairman") {
      fetchChairmanData();
    }
  }, [viewMode, evaluatorRole]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const settingsPromise = fetch("/api/settings").then(r => r.ok ? r.json() : null);
      
      const mePromise = fetch(`/api/jury/me/${evalId}`).then(async r => {
        if (r.ok) return r.json();
        const fallback = await fetch("/api/evaluators");
        if (fallback.ok) {
          const list = await fallback.json();
          return list.find((e: any) => e.id === evalId) || null;
        }
        return null;
      });

      const photosPromise = fetch("/api/jury/photos").then(r => r.ok ? r.json() : []);
      const ratingsPromise = fetch(`/api/ratings/${evalId}`).then(r => r.ok ? r.json() : []);

      const [sett, me, photosData, ratingsData] = await Promise.all([
        settingsPromise,
        mePromise,
        photosPromise,
        ratingsPromise
      ]);

      if (sett) setSettings(sett);
      if (me) {
        setEvaluatorName(me.name || "");
        setEvaluatorRole((me.role === "chairman") ? "chairman" : "evaluator");
        setIsLocked(!!me.isLocked);
        setSubmittedAt(me.submittedAt || null);
      }
      setAllPhotos(photosData || []);
      setRatings(ratingsData || []);
    } catch (e) {
      console.error("Error loading evaluator data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChairmanData = async () => {
    setChairmanLoading(true);
    try {
      const [resResults, resEvals] = await Promise.all([
        fetch(`/api/jury/chairman-results?evalId=${encodeURIComponent(evalId)}`),
        fetch("/api/evaluators")
      ]);
      if (resResults.ok) {
        setChairmanResults(await resResults.json());
      }
      if (resEvals.ok) {
        setAllEvaluators(await resEvals.json());
      }
    } catch (e) {
      console.error("Error fetching chairman results:", e);
    } finally {
      setChairmanLoading(false);
    }
  };

  // Chairman unlocking a locked juror
  const unlockJuror = async (targetId: string, jurorName: string) => {
    const confirmMsg = lang === "sk"
      ? `Naozaj chcete odomknúť hodnotenie porotcovi "${jurorName}"? Umožníte mu znova upravovať a meniť body.`
      : `Are you sure you want to unlock ratings for juror "${jurorName}"?`;
    if (!window.confirm(confirmMsg)) return;

    setUnlockingJurorId(targetId);
    try {
      const res = await fetch("/api/jury/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          evalId: targetId,
          chairmanEvalId: evalId 
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(lang === "sk" ? "Hodnotenie porotcu bolo úspešne odomknuté." : "Juror ratings unlocked successfully.");
        fetchChairmanData();
      } else {
        alert(data.error || (lang === "sk" ? "Chyba pri odomykaní" : "Failed to unlock"));
      }
    } catch (e) {
      alert(lang === "sk" ? "Chyba spojenia so serverom" : "Server connection error");
    } finally {
      setUnlockingJurorId(null);
    }
  };

  // Quick lookup dictionary for my ratings: photoId -> score
  const ratingsMap = useMemo(() => {
    const map: Record<string, number> = {};
    ratings.forEach(r => {
      if (r.photoId) map[r.photoId] = r.score;
    });
    return map;
  }, [ratings]);

  // Filtered photos for the evaluator dashboard
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter(p => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }
      const isRated = (ratingsMap[p.id] || 0) > 0;
      if (statusFilter === "rated" && !isRated) return false;
      if (statusFilter === "unrated" && isRated) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesId = p.id?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc) return false;
      }
      return true;
    });
  }, [allPhotos, selectedCategory, statusFilter, searchQuery, ratingsMap]);

  // Overall statistics for this evaluator
  const stats = useMemo(() => {
    const total = allPhotos.length;
    const rated = allPhotos.filter(p => (ratingsMap[p.id] || 0) > 0).length;
    const unrated = total - rated;
    const percent = total > 0 ? Math.round((rated / total) * 100) : 0;
    return { total, rated, unrated, percent };
  }, [allPhotos, ratingsMap]);

  // List of all unrated photos across all categories
  const unratedPhotosList = useMemo(() => {
    return allPhotos.filter(p => (ratingsMap[p.id] || 0) === 0);
  }, [allPhotos, ratingsMap]);

  // Current photo in Single Photo Rating view
  const activePhotosList = useMemo(() => {
    if (selectedCategory === "all") return allPhotos;
    return allPhotos.filter(p => p.category === selectedCategory);
  }, [allPhotos, selectedCategory]);

  const currentPhoto = activePhotosList[currentIndex] || activePhotosList[0];
  const currentRating = currentPhoto ? (ratingsMap[currentPhoto.id] || 0) : 0;

  // Jump from dashboard or unrated modal into rating view for a specific photo
  const jumpToPhoto = (photo: JuryPhoto) => {
    if (selectedCategory !== "all" && selectedCategory !== photo.category) {
      setSelectedCategory(photo.category);
    }
    const list = (selectedCategory === "all") 
      ? allPhotos 
      : allPhotos.filter(p => p.category === (selectedCategory === "all" ? photo.category : selectedCategory));
    
    const idx = list.findIndex(p => p.id === photo.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setViewMode("rate");
    setShowIncompleteModal(false);
  };

  // Submit rating for any photo
  const handleRate = async (score: number, targetPhoto?: JuryPhoto) => {
    if (isLocked) {
      alert(lang === "sk" ? "Vaše hodnotenie je uzamknuté. Dodatočné zmeny nie sú povolené bez odomknutia." : "Your evaluation is locked. Changes are not allowed.");
      return;
    }

    const photoToRate = targetPhoto || currentPhoto;
    if (!photoToRate) return;

    // Optimistic update local ratings
    setRatings(prev => {
      const exists = prev.findIndex(r => r.photoId === photoToRate.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = { photoId: photoToRate.id, score, judgeId: evalId };
        return next;
      }
      return [...prev, { photoId: photoToRate.id, score, judgeId: evalId }];
    });

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evalId,
          evalName: evaluatorName,
          photoId: photoToRate.id,
          score
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || (lang === "sk" ? "Chyba pri ukladaní hodnotenia" : "Error saving score"));
        setSaveStatus("error");
        setRatings(prev => prev.filter(r => r.photoId !== photoToRate.id || r.score !== score));
        return;
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);

      // In single view, advance to next
      if (!targetPhoto && viewMode === "rate") {
        if (currentIndex < activePhotosList.length - 1) {
          setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
        }
      }
    } catch (e) {
      console.error("Failed to save rating:", e);
      setSaveStatus("error");
    }
  };

  // Click on Submit button
  const handleSubmitClick = () => {
    if (isLocked) return;
    if (unratedPhotosList.length > 0) {
      setShowIncompleteModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  // Final submit execution (calls backend /api/jury/submit)
  const executeFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/jury/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evalId })
      });
      const data = await res.json();
      if (res.ok) {
        setIsLocked(true);
        setSubmittedAt(data.submittedAt || new Date().toLocaleString());
        setShowConfirmModal(false);
        setSubmitSuccess(true);
      } else {
        alert(data.error || (lang === "sk" ? "Chyba pri odosielaní hodnotenia" : "Submission failed"));
        if (data.unratedPhotos) {
          setShowConfirmModal(false);
          setShowIncompleteModal(true);
        }
      }
    } catch (e) {
      console.error(e);
      alert(lang === "sk" ? "Chyba spojenia so serverom" : "Server connection error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation for single photo review
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (viewMode !== "rate") return;
    if (e.key >= "1" && e.key <= "5" && !isLocked) {
      handleRate(parseInt(e.key));
    }
    if (e.key === "ArrowLeft") {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
    if (e.key === "ArrowRight") {
      setCurrentIndex(prev => Math.min(activePhotosList.length - 1, prev + 1));
    }
    if (e.key === "Escape") {
      setIsFullscreen(false);
      setZoomPhoto(null);
      setShowIncompleteModal(false);
      setShowConfirmModal(false);
      setSubmitSuccess(false);
    }
  }, [viewMode, activePhotosList.length, currentIndex, isLocked]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isJudgingActive = () => {
    if (!settings) return true;
    const now = new Date();
    if (settings.judgingStart && settings.judgingEnd) {
      const start = new Date(settings.judgingStart);
      const end = new Date(settings.judgingEnd);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    }
    return ["review", "judging", "shortlist"].includes(settings.contestStatus);
  };

  // Filtered and sorted Chairman Results
  const filteredChairmanResults = useMemo(() => {
    let list = [...chairmanResults];

    if (chairmanCategory !== "all") {
      list = list.filter(r => r.category === chairmanCategory);
    }

    if (chairmanSearch.trim()) {
      const q = chairmanSearch.toLowerCase().trim();
      list = list.filter(r => 
        r.author?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (chairmanSort === "score_desc") {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return b.averageScore - a.averageScore;
      }
      if (chairmanSort === "avg_desc") {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        return b.totalScore - a.totalScore;
      }
      if (chairmanSort === "author_asc") {
        return (a.author || "").localeCompare(b.author || "");
      }
      if (chairmanSort === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return 0;
    });

    return list;
  }, [chairmanResults, chairmanCategory, chairmanSearch, chairmanSort]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-accent" size={40} />
        <span className="uppercase tracking-[3px] text-xs font-bold text-muted">
          {lang === "sk" ? "Pripravujem hodnotiace rozhranie poroty..." : "Loading jury evaluation interface..."}
        </span>
      </div>
    );
  }

  const judgingOpen = isJudgingActive();

  return (
    <div className="space-y-8 pb-28">
      {/* ============================================================ */}
      {/* TOP EVALUATOR HEADER & NAVIGATION                            */}
      {/* ============================================================ */}
      <div className="border-b border-border pb-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Evaluator Identity */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-muted">
                {lang === "sk" ? "Hodnotiace rozhranie poroty" : "Jury Scoring Panel"}
              </span>
              <span className="text-muted/40">•</span>
              <span className="text-[10px] font-mono text-muted">Speleofotografia 2026</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-light uppercase tracking-tight text-ink">
                {evaluatorName || (lang === "sk" ? "Vážený porotca" : "Honorable Judge")}
              </h1>
              {evaluatorRole === "chairman" ? (
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 rounded-full flex items-center gap-1.5 shadow-xs">
                  <Crown size={12} className="text-amber-600 fill-amber-500" />
                  {lang === "sk" ? "Predseda poroty" : "Jury Chairman"}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-paper text-muted border border-border rounded-full flex items-center gap-1">
                  <User size={11} className="text-muted" />
                  {lang === "sk" ? "Člen poroty" : "Jury Member"}
                </span>
              )}
              {isLocked && (
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-900 border border-green-300 rounded-full flex items-center gap-1.5 shadow-xs">
                  <Lock size={12} className="text-green-700" />
                  {lang === "sk" ? "Hodnotenie uzamknuté" : "Evaluation Locked"}
                </span>
              )}
            </div>
          </div>

          {/* Progress & Submit Action Pill */}
          <div className="flex flex-wrap items-center gap-4 bg-paper/70 border border-border p-3.5 rounded-sm shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>{lang === "sk" ? "Vaše hodnotenie" : "Your Progress"}</span>
                <span className="text-ink font-mono">{stats.rated} / {stats.total} ({stats.percent}%)</span>
              </div>
              <div className="w-44 sm:w-48 h-2 bg-border overflow-hidden rounded-full">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    stats.percent === 100 ? "bg-green-600" : "bg-ink"
                  )}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>

            {/* SUBMIT BUTTON OR LOCKED BADGE */}
            {isLocked ? (
              <div className="px-3.5 py-2 bg-green-50 border border-green-300 text-green-900 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-xs">
                <Lock size={13} className="text-green-700" />
                <span>{lang === "sk" ? "Odoslané & Uzamknuté" : "Locked"}</span>
              </div>
            ) : (
              <button
                onClick={handleSubmitClick}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 rounded-xs shadow-xs transition-all",
                  stats.unrated === 0
                    ? "bg-green-600 hover:bg-green-700 text-white animate-pulse hover:animate-none ring-2 ring-green-400"
                    : "bg-ink hover:bg-black text-white"
                )}
                title={stats.unrated === 0 
                  ? (lang === "sk" ? "Definitívne odoslať a uzamknúť hodnotenie" : "Submit and lock evaluation")
                  : (lang === "sk" ? `Ešte zostáva ohodnotiť ${stats.unrated} fotografií` : `${stats.unrated} photos unrated`)}
              >
                {stats.unrated === 0 ? <CheckCircle2 size={15} /> : <Send size={13} />}
                <span>{lang === "sk" ? "Odoslať hodnotenie" : "Submit Evaluation"}</span>
                {stats.unrated > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded font-mono">
                    {stats.unrated}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* LOCKED STATUS BANNER (When evaluator has submitted) */}
        {isLocked && (
          <div className="p-4 border border-green-300 bg-green-50/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-green-950 text-xs shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Lock size={16} />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold uppercase tracking-wider text-green-950 flex items-center gap-2">
                  <span>{lang === "sk" ? "Vaše záverečné hodnotenie bolo definitívne odoslané" : "Your final evaluation has been submitted"}</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 bg-green-200/60 rounded text-green-800">
                    {submittedAt}
                  </span>
                </p>
                <p className="text-[11px] text-green-900/80">
                  {lang === "sk" 
                    ? "Predsedovi odbornej poroty bola doručená emailová notifikácia. Hodnotenie je uzamknuté a slúži už iba na prehliadanie. V prípade potreby dodatočných úprav kontaktujte predsedu poroty alebo administrátora."
                    : "The Jury Chairman has been notified. Scoring is locked for review. If you need modifications, please contact the chairman or admin."}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white border border-green-200 text-green-800 text-[10px] font-bold uppercase tracking-widest rounded shrink-0">
              {lang === "sk" ? "Režim čítania" : "Read-only mode"}
            </span>
          </div>
        )}

        {/* View Mode Navigation Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center border border-border bg-paper/50 p-1 rounded-sm">
            {/* Tab 1: Dashboard / Prehľad fotiek */}
            <button
              onClick={() => setViewMode("dashboard")}
              className={cn(
                "px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                viewMode === "dashboard"
                  ? "bg-white text-ink border border-border shadow-xs"
                  : "text-muted hover:text-ink"
              )}
            >
              <LayoutGrid size={15} />
              <span>{lang === "sk" ? "Prehľad fotiek (Dashboard)" : "Photo Dashboard"}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-paper border border-border rounded font-mono">
                {allPhotos.length}
              </span>
            </button>

            {/* Tab 2: Detailné hodnotenie */}
            <button
              onClick={() => setViewMode("rate")}
              className={cn(
                "px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                viewMode === "rate"
                  ? "bg-white text-ink border border-border shadow-xs"
                  : "text-muted hover:text-ink"
              )}
            >
              <Maximize2 size={15} />
              <span>{lang === "sk" ? "Karta hodnotenia" : "Rating Card"}</span>
            </button>

            {/* Tab 3: Priebežné hodnotenie (IBA PRE PREDSEDU POROTY) */}
            {evaluatorRole === "chairman" && (
              <button
                onClick={() => setViewMode("chairman")}
                className={cn(
                  "px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                  viewMode === "chairman"
                    ? "bg-amber-500 text-white shadow-xs font-black"
                    : "text-amber-800 bg-amber-100/50 hover:bg-amber-100"
                )}
                title={lang === "sk" ? "Priebežné hodnotenie a autori diel (iba pre predsedu)" : "Interim results with authors (chairman only)"}
              >
                <Crown size={15} className={viewMode === "chairman" ? "text-white" : "text-amber-600"} />
                <span>{lang === "sk" ? "Priebežné hodnotenie" : "Interim Results"}</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-black/10 rounded font-mono uppercase tracking-widest">
                  {lang === "sk" ? "Predseda" : "Chairman"}
                </span>
              </button>
            )}
          </div>

          {/* Shortcut hint */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted">
            <Info size={13} className="text-accent" />
            <span>
              {isLocked 
                ? (lang === "sk" ? "Hodnotenie je uzamknuté – body sú finálne uložené" : "Evaluation is locked – scores are finalized")
                : (viewMode === "rate"
                    ? (lang === "sk" ? "Klávesy 1-5 body, šípky navigácia, ESC celá obrazovka" : "Keys 1-5 score, arrows navigate, ESC exit")
                    : (lang === "sk" ? "Kliknutím na fotografiu sa okamžite prepnete do hodnotenia" : "Click any photo to jump straight into evaluation"))}
            </span>
          </div>
        </div>

        {/* Closed warning banner if judging closed */}
        {!judgingOpen && (
          <div className="p-4 border border-amber-300 bg-amber-50 flex items-center gap-3 text-amber-900 text-xs">
            <Clock size={16} className="shrink-0 text-amber-700" />
            <span>
              {lang === "sk" 
                ? "Hodnotiace obdobie nie je momentálne aktívne. Môžete si prezerať fotografie a vaše doterajšie body, ale zmeny nemusia byť povolené."
                : "Judging period is currently not open. You can browse photos and your previous scores."}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* VIEW 1: DASHBOARD / PREHĽAD VŠETKÝCH FOTOGRAFIÍ              */}
      {/* ============================================================ */}
      {viewMode === "dashboard" && (
        <div className="space-y-8">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border p-5 bg-white space-y-1 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {lang === "sk" ? "Celkovo fotografií" : "Total Photos"}
              </p>
              <p className="text-3xl font-light tracking-tight text-ink font-mono">{stats.total}</p>
            </div>

            <div className="border border-border p-5 bg-white space-y-1 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">
                {lang === "sk" ? "Vami ohodnotené" : "Rated by You"}
              </p>
              <p className="text-3xl font-light tracking-tight text-green-700 font-mono">
                {stats.rated} <span className="text-sm font-normal text-muted">({stats.percent}%)</span>
              </p>
            </div>

            <div className="border border-border p-5 bg-white space-y-1 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                {lang === "sk" ? "Zostáva ohodnotiť" : "Awaiting Rating"}
              </p>
              <p className="text-3xl font-light tracking-tight text-amber-700 font-mono">{stats.unrated}</p>
            </div>

            <div className="border border-border p-5 bg-white flex flex-col justify-center space-y-2 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {isLocked ? (lang === "sk" ? "Stav hodnotenia" : "Status") : (lang === "sk" ? "Záverečné odoslanie" : "Final Action")}
              </p>
              {isLocked ? (
                <div className="w-full py-2 bg-green-50 border border-green-200 text-green-900 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                  <Lock size={12} className="text-green-700" />
                  <span>{lang === "sk" ? "Úspešne odoslané" : "Submitted"}</span>
                </div>
              ) : (
                <button
                  onClick={handleSubmitClick}
                  className={cn(
                    "w-full py-2 text-white text-[10px] font-bold uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1.5",
                    stats.unrated === 0 
                      ? "bg-green-600 hover:bg-green-700 shadow-sm" 
                      : "bg-ink hover:opacity-90"
                  )}
                >
                  {stats.unrated === 0 ? <CheckCircle2 size={12} /> : <Send size={12} />}
                  <span>
                    {stats.unrated === 0 
                      ? (lang === "sk" ? "Odoslať záverečné hodnotenie" : "Submit Final Score")
                      : (lang === "sk" ? `Odoslať (${stats.unrated} chýba)` : `Submit (${stats.unrated} left)`)}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="border border-border bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all",
                    selectedCategory === "all"
                      ? "bg-ink text-white border-ink"
                      : "border-border text-muted hover:text-ink bg-paper/40"
                  )}
                >
                  {lang === "sk" ? "Všetky kategórie" : "All Categories"} ({allPhotos.length})
                </button>
                {(settings?.categories || []).map((cat: any) => {
                  const catCount = allPhotos.filter(p => p.category === cat.id).length;
                  const isCatSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all",
                        isCatSelected
                          ? "bg-ink text-white border-ink"
                          : "border-border text-muted hover:text-ink bg-paper/40"
                      )}
                    >
                      <span>Kat. {cat.id}</span>
                      <span className="ml-1.5 opacity-60 font-mono text-[11px]">({catCount})</span>
                    </button>
                  );
                })}
              </div>

              {/* Status Filter (Všetky / Neohodnotené / Ohodnotené) */}
              <div className="flex items-center gap-1 border border-border p-1 bg-paper/50 self-start lg:self-auto">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all",
                    statusFilter === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                  )}
                >
                  {lang === "sk" ? "Všetky" : "All"}
                </button>
                <button
                  onClick={() => setStatusFilter("unrated")}
                  className={cn(
                    "px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1",
                    statusFilter === "unrated" ? "bg-white text-amber-700 shadow-xs font-black" : "text-muted hover:text-ink"
                  )}
                >
                  <span>{lang === "sk" ? "Neohodnotené" : "Unrated"}</span>
                  <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-900 rounded font-mono">
                    {stats.unrated}
                  </span>
                </button>
                <button
                  onClick={() => setStatusFilter("rated")}
                  className={cn(
                    "px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1",
                    statusFilter === "rated" ? "bg-white text-green-700 shadow-xs font-black" : "text-muted hover:text-ink"
                  )}
                >
                  <span>{lang === "sk" ? "Ohodnotené" : "Rated"}</span>
                  <span className="px-1.5 py-0.2 text-[9px] bg-green-100 text-green-900 rounded font-mono">
                    {stats.rated}
                  </span>
                </button>
              </div>
            </div>

            {/* Search Input & Status Info */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={lang === "sk" ? "Hľadať fotografiu podľa názvu alebo ID..." : "Search by title or ID..."}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-border outline-none focus:border-ink bg-paper/20"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted font-mono uppercase tracking-widest self-center">
                {lang === "sk" ? "Zobrazených:" : "Showing:"} <strong>{filteredPhotos.length}</strong> {lang === "sk" ? "fotografií" : "photos"}
              </p>
            </div>
          </div>

          {/* Grid of Photos */}
          {filteredPhotos.length === 0 ? (
            <div className="border border-dashed border-border p-16 text-center space-y-4 bg-paper/20">
              <p className="text-sm font-bold uppercase tracking-wider text-muted">
                {lang === "sk" ? "Žiadne fotografie nezodpovedajú zvolenému filtru" : "No photos match the selected filter"}
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs uppercase font-bold tracking-widest text-accent underline"
              >
                {lang === "sk" ? "Obnoviť všetky filtre" : "Reset all filters"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPhotos.map((photo) => {
                const score = ratingsMap[photo.id] || 0;
                const isRated = score > 0;

                return (
                  <div
                    key={photo.id}
                    className={cn(
                      "group border bg-white flex flex-col overflow-hidden transition-all shadow-sm hover:shadow-md",
                      isRated ? "border-border hover:border-ink" : "border-amber-300 hover:border-amber-500 ring-1 ring-amber-200/50"
                    )}
                  >
                    {/* Thumbnail Image Container with Overlay Badges */}
                    <div className="relative aspect-[4/3] bg-ink overflow-hidden cursor-pointer" onClick={() => jumpToPhoto(photo)}>
                      <img
                        src={`/uploads/${photo.webPath}`}
                        alt={photo.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Status Badge in Top Left */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                        {isRated ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-ink/90 backdrop-blur-xs text-white border border-white/20 shadow-md flex items-center gap-1">
                            <Star size={11} className="text-amber-400 fill-amber-400" />
                            <span>{score} {lang === "sk" ? "b" : "pts"}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-md flex items-center gap-1">
                            <Clock size={11} />
                            <span>{lang === "sk" ? "Neohodnotené" : "Unrated"}</span>
                          </span>
                        )}
                      </div>

                      {/* Category Badge in Top Right */}
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-ink border border-border">
                          Kat. {photo.category}
                        </span>
                      </div>

                      {/* Zoom Icon Overlay on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomPhoto(photo);
                        }}
                        className="absolute bottom-2.5 right-2.5 w-8 h-8 bg-black/60 hover:bg-black/90 backdrop-blur-xs text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title={lang === "sk" ? "Zväčšiť náhľad" : "Zoom preview"}
                      >
                        <ZoomIn size={15} />
                      </button>

                      {/* Dark gradient at bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Photo Info Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-mono text-muted">{photo.id}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-accent">
                            {(settings?.categories || []).find((c: any) => c.id === photo.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || `Kat. ${photo.category}`}
                          </p>
                        </div>
                        <h4 className="font-bold text-sm text-ink uppercase tracking-tight line-clamp-1 group-hover:text-accent transition-colors" title={photo.name}>
                          {photo.name}
                        </h4>
                        {photo.description && (
                          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                            {photo.description}
                          </p>
                        )}
                      </div>

                      {/* Quick Rating Stars & Jump Button */}
                      <div className="pt-3 border-t border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted">
                            {isLocked 
                              ? (lang === "sk" ? "Udelené body (zamknuté):" : "Awarded Score (locked):")
                              : (lang === "sk" ? "Rýchle body:" : "Quick Score:")}
                          </span>
                          <button
                            onClick={() => jumpToPhoto(photo)}
                            className="text-[10px] font-bold uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1"
                          >
                            <span>{lang === "sk" ? "Detail" : "Open"}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        </div>

                        {/* 1 - 5 Quick Scoring Buttons */}
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map(pts => (
                            <button
                              key={pts}
                              onClick={() => handleRate(pts, photo)}
                              disabled={isLocked}
                              className={cn(
                                "h-8 flex items-center justify-center text-xs font-bold border transition-all",
                                score === pts
                                  ? "bg-ink text-white border-ink font-black shadow-xs"
                                  : isLocked
                                    ? "bg-paper/20 border-border text-muted/50 cursor-not-allowed"
                                    : "bg-paper/40 hover:bg-ink/10 border-border text-ink"
                              )}
                              title={isLocked ? "Hodnotenie je uzamknuté" : `${pts} ${pts === 1 ? "bod" : pts < 5 ? "body" : "bodov"}`}
                            >
                              {pts}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW 2: SINGLE PHOTO RATING CARD                             */}
      {/* ============================================================ */}
      {viewMode === "rate" && (
        <div className="space-y-8">
          {/* Subheader with Navigation & Back to Dashboard */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("dashboard")}
                className="px-3.5 py-2 border border-border bg-white text-ink text-xs font-bold uppercase tracking-wider hover:border-ink transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>{lang === "sk" ? "Späť na prehľad fotiek" : "Back to Dashboard"}</span>
              </button>
              <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
                {lang === "sk" ? "Karta" : "Work"} <strong>{currentIndex + 1}</strong> {lang === "sk" ? "z" : "of"} <strong>{activePhotosList.length}</strong>
              </p>
            </div>

            {/* Category Switcher in Rating View */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {lang === "sk" ? "Kategória:" : "Category:"}
              </span>
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setCurrentIndex(0);
                }}
                className="border border-border bg-white p-2 text-xs font-bold uppercase outline-none focus:border-ink"
              >
                <option value="all">{lang === "sk" ? "Všetky kategórie" : "All categories"} ({allPhotos.length})</option>
                {(settings?.categories || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    Kat. {cat.id} – {lang === "sk" ? cat.nameSk : cat.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activePhotosList.length === 0 ? (
            <div className="p-16 text-center border border-dashed border-border space-y-4">
              <p className="text-sm font-bold uppercase tracking-wider text-muted">
                {lang === "sk" ? "V tejto kategórii nie sú žiadne fotografie." : "No photos in this category."}
              </p>
              <button 
                onClick={() => setViewMode("dashboard")}
                className="text-xs uppercase font-bold tracking-widest text-accent underline"
              >
                {lang === "sk" ? "Návrat do prehľadu" : "Return to dashboard"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Evaluator UI */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Photo Stage */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="relative aspect-[4/3] bg-ink group overflow-hidden border border-border shadow-2xl">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentPhoto?.id}
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={`/uploads/${currentPhoto?.webPath}`}
                        className="w-full h-full object-contain"
                        alt={currentPhoto?.name}
                      />
                    </AnimatePresence>
                    
                    {/* Fullscreen Button */}
                    <button 
                      onClick={() => setIsFullscreen(true)}
                      className="absolute top-4 right-4 w-10 h-10 bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all z-10"
                      title={lang === "sk" ? "Zobraziť na celú obrazovku" : "View fullscreen"}
                    >
                      <Maximize2 size={20} />
                    </button>

                    {/* Navigation Arrows */}
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <button 
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        className="w-12 h-12 bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-30 pointer-events-auto transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button 
                        onClick={() => setCurrentIndex(prev => Math.min(activePhotosList.length - 1, prev + 1))}
                        disabled={currentIndex >= activePhotosList.length - 1}
                        className="w-12 h-12 bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-30 pointer-events-auto transition-colors"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                  </div>

                  {/* 1 - 5 Points Scoring Buttons */}
                  <div className="space-y-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                      {isLocked 
                        ? (lang === "sk" ? "🔒 Hodnotenie je uzamknuté (zmeny nie sú povolené)" : "🔒 Evaluation is locked")
                        : (lang === "sk" ? "Udeľte body (1 = najmenej, 5 = maximum)" : "Cast your score (1 = min, 5 = max)")}
                    </p>
                    <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          onClick={() => handleRate(score)}
                          disabled={isLocked}
                          className={cn(
                            "w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center border transition-all",
                            currentRating === score 
                              ? "bg-ink text-white border-ink shadow-lg scale-105" 
                              : isLocked
                                ? "bg-paper/30 border-border text-muted cursor-not-allowed"
                                : "bg-white border-border hover:border-ink hover:bg-paper/30"
                          )}
                        >
                          <span className="text-2xl font-bold font-mono">{score}</span>
                          <span className="text-[9px] uppercase font-bold tracking-widest opacity-60">
                            {score === 1 ? (lang === "sk" ? "bod" : "pt") : (lang === "sk" ? "body" : "pts")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info Sidebar */}
                <div className="lg:col-span-4 space-y-8">
                  <div className="space-y-6">
                    <div className="border-b border-border pb-2 flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted">
                        {lang === "sk" ? "Informácie o diele" : "Work Details"}
                      </h3>
                      <span className="text-xs font-mono text-muted">{currentPhoto?.id}</span>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-2xl font-light tracking-tight uppercase leading-tight text-ink">
                          {currentPhoto?.name}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-[2px] text-accent">
                          {(settings?.categories || []).find((c: any) => c.id === currentPhoto?.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || `Kat. ${currentPhoto?.category}`}
                        </p>
                      </div>

                      {/* Technical metadata */}
                      {currentPhoto?.metadata && (
                        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border bg-paper/20 p-3">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Fotoaparát" : "Camera"}</p>
                            <p className="text-[12px] font-bold uppercase tracking-tight truncate">{currentPhoto.metadata.camera || "—"}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Nastavenia" : "Settings"}</p>
                            <p className="text-[12px] font-bold uppercase tracking-tight truncate">{currentPhoto.metadata.settings || "—"}</p>
                          </div>
                          {currentPhoto.metadata.lens && (
                            <div className="col-span-2 space-y-0.5">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Objektív" : "Lens"}</p>
                              <p className="text-[12px] font-bold uppercase tracking-tight truncate">{currentPhoto.metadata.lens}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Story / Description */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                          {lang === "sk" ? "Príbeh / Popis" : "Story / Description"}
                        </p>
                        <div className="p-4 border border-border bg-white text-xs leading-relaxed text-ink/80 whitespace-pre-wrap max-h-56 overflow-y-auto">
                          {currentPhoto?.description || (lang === "sk" ? "Fotografia bez popisu." : "No description provided.")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rating Status Card */}
                  <div className="p-6 border border-border bg-paper space-y-4 text-center">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">
                      {lang === "sk" ? "Stav hodnotenia fotografie" : "Rating Status"}
                    </h4>
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn(
                        "w-16 h-16 flex flex-col items-center justify-center font-bold text-3xl border transition-all",
                        currentRating > 0 ? "bg-accent text-white border-accent shadow-md" : "bg-white text-muted border-border"
                      )}>
                        {saveStatus === "saving" ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          currentRating || "—"
                        )}
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
                         currentRating > 0 ? (lang === "sk" ? "OHODNOTENÉ" : "RATED") : (lang === "sk" ? "ČAKÁ NA BODY" : "WAITING FOR SCORE")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick-Thumbnail Switcher Strip */}
              <div className="pt-6 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                  <span>{lang === "sk" ? "Rýchle prepnutie medzi fotografiami:" : "Quick Photo Switcher:"}</span>
                  <span>{currentIndex + 1} / {activePhotosList.length}</span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin">
                  {activePhotosList.map((p, idx) => {
                    const sc = ratingsMap[p.id] || 0;
                    const isCurrent = idx === currentIndex;

                    return (
                      <button
                        key={p.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                          "relative shrink-0 w-20 h-16 border-2 overflow-hidden transition-all",
                          isCurrent ? "border-accent scale-105 shadow-md" : "border-border hover:border-ink opacity-70 hover:opacity-100"
                        )}
                        title={`${idx + 1}. ${p.name}`}
                      >
                        <img 
                          src={`/uploads/${p.webPath}`} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute top-1 left-1">
                          {sc > 0 ? (
                            <span className="w-4 h-4 rounded-full bg-ink text-white font-mono text-[9px] font-bold flex items-center justify-center">
                              {sc}
                            </span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW 3: PRIEBEŽNÉ HODNOTENIE (EXKLUZÍVNE PRE PREDSEDU POROTY) */}
      {/* ============================================================ */}
      {viewMode === "chairman" && evaluatorRole === "chairman" && (
        <div className="space-y-10">
          {/* Chairman Header Banner */}
          <div className="border border-amber-300 bg-amber-50/70 p-6 md:p-8 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <Crown size={24} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-light uppercase tracking-tight text-amber-950">
                    {lang === "sk" ? "Priebežné hodnotenie súťaže – Predseda poroty" : "Interim Contest Results – Jury Chairman"}
                  </h2>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    {lang === "sk" 
                      ? "Špeciálny autoritatívny prehľad pre predsedu poroty s náhľadmi fotografií, zoomom, menami autorov a rozpisom bodov od všetkých porotcov."
                      : "Special privileged overview for jury chairman with thumbnails, zoom, author names, and point breakdown from all jury members."}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchChairmanData}
                disabled={chairmanLoading}
                className="px-4 py-2.5 bg-amber-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors flex items-center gap-2 shadow-xs shrink-0"
              >
                {chairmanLoading ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                <span>{lang === "sk" ? "Aktualizovať výsledky" : "Refresh Standings"}</span>
              </button>
            </div>
          </div>

          {/* JURY MEMBERS COMPLETION & UNLOCK SECTION FOR CHAIRMAN */}
          <div className="border border-border bg-white p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink">
                  {lang === "sk" ? "Stav hodnotenia porotcov a odomykanie" : "Jury Member Statuses & Unlock"}
                </h3>
              </div>
              <span className="text-[11px] text-muted font-mono">
                {allEvaluators.length} {lang === "sk" ? "členov poroty" : "judges"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {allEvaluators.map(ev => {
                const isChairmanSelf = ev.id === evalId;
                return (
                  <div 
                    key={ev.id} 
                    className={cn(
                      "p-4 border text-xs space-y-3 transition-all",
                      ev.isLocked ? "border-green-300 bg-green-50/40" : "border-border bg-paper/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold uppercase tracking-wider text-ink text-sm flex items-center gap-1.5">
                          <span>{ev.name}</span>
                          {ev.role === "chairman" && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold border border-amber-300">
                              👑 Predseda
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {lang === "sk" ? "Ohodnotené:" : "Rated:"} <strong>{ev.ratedCount || 0}</strong> {lang === "sk" ? "fotografií" : "photos"}
                        </p>
                      </div>

                      {ev.isLocked ? (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-900 border border-green-300 rounded flex items-center gap-1">
                          <Lock size={10} className="text-green-700" />
                          <span>Uzamknuté</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-paper text-muted border border-border rounded flex items-center gap-1">
                          <Clock size={10} />
                          <span>Hodnotí</span>
                        </span>
                      )}
                    </div>

                    {ev.submittedAt && (
                      <p className="text-[10px] text-green-800 font-mono">
                        {lang === "sk" ? "Odoslané:" : "Submitted:"} {ev.submittedAt}
                      </p>
                    )}

                    {/* Chairman Unlock button */}
                    {ev.isLocked && (
                      <div className="pt-2 border-t border-border flex justify-end">
                        <button
                          onClick={() => unlockJuror(ev.id, ev.name)}
                          disabled={unlockingJurorId === ev.id}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          title={lang === "sk" ? "Umožniť porotcovi znova meniť body" : "Unlock ratings for this judge"}
                        >
                          {unlockingJurorId === ev.id ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                          <span>{lang === "sk" ? "Odomknúť porotcovi hodnotenie" : "Unlock Ratings"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chairman Filter & Search Controls */}
          <div className="border border-border bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Category selector */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setChairmanCategory("all")}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all",
                    chairmanCategory === "all" ? "bg-ink text-white border-ink" : "border-border text-muted hover:text-ink bg-paper/40"
                  )}
                >
                  {lang === "sk" ? "Všetky kategórie" : "All Categories"} ({chairmanResults.length})
                </button>
                {(settings?.categories || []).map((cat: any) => {
                  const count = chairmanResults.filter(r => r.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setChairmanCategory(cat.id)}
                      className={cn(
                        "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all",
                        chairmanCategory === cat.id ? "bg-ink text-white border-ink" : "border-border text-muted hover:text-ink bg-paper/40"
                      )}
                    >
                      <span>Kat. {cat.id}</span>
                      <span className="ml-1.5 opacity-60 font-mono text-[11px]">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Sorting selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  {lang === "sk" ? "Zoradiť:" : "Sort by:"}
                </span>
                <select
                  value={chairmanSort}
                  onChange={e => setChairmanSort(e.target.value as any)}
                  className="border border-border bg-white p-2 text-xs font-bold outline-none focus:border-ink"
                >
                  <option value="score_desc">{lang === "sk" ? "Najviac bodov celkovo" : "Highest Total Score"}</option>
                  <option value="avg_desc">{lang === "sk" ? "Najvyšší priemer" : "Highest Average"}</option>
                  <option value="author_asc">{lang === "sk" ? "Meno autora (A-Z)" : "Author Name (A-Z)"}</option>
                  <option value="name_asc">{lang === "sk" ? "Názov fotografie (A-Z)" : "Photo Title (A-Z)"}</option>
                </select>
              </div>
            </div>

            {/* Search input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={chairmanSearch}
                  onChange={e => setChairmanSearch(e.target.value)}
                  placeholder={lang === "sk" ? "Filtrovať podľa autora alebo názvu fotografie..." : "Search by author or title..."}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-border outline-none focus:border-ink bg-paper/20"
                />
                {chairmanSearch && (
                  <button 
                    onClick={() => setChairmanSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted font-mono uppercase tracking-widest self-center">
                {lang === "sk" ? "Diel v tabuľke:" : "Works in table:"} <strong>{filteredChairmanResults.length}</strong>
              </p>
            </div>
          </div>

          {/* Chairman Standings Table */}
          {chairmanLoading ? (
            <div className="p-16 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-amber-600 mx-auto" />
              <p className="text-xs uppercase tracking-widest text-muted font-bold">
                {lang === "sk" ? "Počítam priebežné body porotcov..." : "Aggregating jury scores..."}
              </p>
            </div>
          ) : filteredChairmanResults.length === 0 ? (
            <div className="p-16 border border-dashed border-border text-center text-muted text-xs uppercase tracking-wider">
              {lang === "sk" ? "Žiadne výsledky pre zvolené filtre." : "No results for chosen filters."}
            </div>
          ) : (
            <div className="border border-border bg-white shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-paper/80 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4 w-28">{lang === "sk" ? "Náhľad / Zoom" : "Preview / Zoom"}</th>
                    <th className="p-4">{lang === "sk" ? "Názov fotografie" : "Photo Title"}</th>
                    <th className="p-4">{lang === "sk" ? "Meno autora" : "Author Name"}</th>
                    <th className="p-4 text-center">{lang === "sk" ? "Body celkovo" : "Total Points"}</th>
                    <th className="p-4 text-center">{lang === "sk" ? "Priemer" : "Average"}</th>
                    <th className="p-4">{lang === "sk" ? "Hodnotenia poroty" : "Jury Scores"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredChairmanResults.map((item, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3 && item.totalScore > 0;

                    return (
                      <tr 
                        key={item.id} 
                        className={cn(
                          "hover:bg-paper/40 transition-colors",
                          rank === 1 && item.totalScore > 0 && "bg-amber-50/40"
                        )}
                      >
                        {/* Rank */}
                        <td className="p-4 text-center font-mono font-bold">
                          {isTop3 ? (
                            <span className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center mx-auto text-xs font-black shadow-xs",
                              rank === 1 ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300" :
                              rank === 2 ? "bg-slate-300 text-slate-900" :
                              "bg-amber-700/80 text-white"
                            )}>
                              {rank}
                            </span>
                          ) : (
                            <span className="text-muted">{rank}</span>
                          )}
                        </td>

                        {/* Thumbnail & Zoom Icon */}
                        <td className="p-4">
                          <div 
                            onClick={() => setZoomPhoto(item)}
                            className="relative w-20 h-16 bg-ink rounded-xs overflow-hidden cursor-pointer group/thumb border border-border shadow-xs"
                            title={lang === "sk" ? "Kliknite pre zväčšenie fotografie" : "Click to zoom"}
                          >
                            <img 
                              src={`/uploads/${item.webPath}`} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16} />
                            </div>
                          </div>
                        </td>

                        {/* Title & Category */}
                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-paper border border-border rounded font-mono">
                              Kat. {item.category}
                            </span>
                            <span className="text-[10px] font-mono text-muted">{item.id}</span>
                          </div>
                          <p 
                            onClick={() => setZoomPhoto(item)}
                            className="font-bold text-ink uppercase tracking-tight hover:text-accent cursor-pointer text-sm"
                          >
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-muted line-clamp-1 max-w-xs">
                              {item.description}
                            </p>
                          )}
                        </td>

                        {/* Author Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-muted shrink-0" />
                            <span className="font-bold text-ink uppercase tracking-wider text-xs">
                              {item.author || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Total Score */}
                        <td className="p-4 text-center">
                          <span className={cn(
                            "inline-block px-3 py-1 font-mono font-bold text-base border rounded",
                            item.totalScore > 0 
                              ? "bg-ink text-white border-ink shadow-xs" 
                              : "bg-paper text-muted border-border"
                          )}>
                            {item.totalScore} {lang === "sk" ? "b" : "pts"}
                          </span>
                        </td>

                        {/* Average Score */}
                        <td className="p-4 text-center">
                          <div className="font-mono font-bold text-sm text-ink">
                            Ø {item.averageScore.toFixed(1)}
                          </div>
                          <p className="text-[9px] text-muted uppercase tracking-widest mt-0.5">
                            {item.ratedCount} {lang === "sk" ? "hodnotení" : "votes"}
                          </p>
                        </td>

                        {/* Breakdown per judge */}
                        <td className="p-4">
                          {item.judges && item.judges.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {item.judges.map((j, jidx) => (
                                <span 
                                  key={jidx}
                                  className="px-2 py-0.5 text-[10px] bg-paper border border-border rounded flex items-center gap-1 font-mono"
                                  title={`${j.judgeName}: ${j.score} b`}
                                >
                                  <span className="text-muted font-sans truncate max-w-[80px]">{j.judgeName}:</span>
                                  <strong className="text-ink font-bold">{j.score}★</strong>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted italic">
                              {lang === "sk" ? "Zatiaľ nehodnotené" : "No scores yet"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: INCOMPLETE EVALUATION WARNING MODAL                 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showIncompleteModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border w-full max-w-2xl p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={18} />
                    <h3 className="text-base font-bold uppercase tracking-wider">
                      {lang === "sk" ? "Hodnotenie nie je kompletné" : "Evaluation Incomplete"}
                    </h3>
                  </div>
                  <p className="text-xs text-muted">
                    {lang === "sk" 
                      ? `Pred definitívnym odoslaním musíte ohodnotiť všetky súťažné diela. Zostáva ešte ${unratedPhotosList.length} neohodnotených fotografií.`
                      : `You must score all competition works before final submission. ${unratedPhotosList.length} photos remaining.`}
                  </p>
                </div>
                <button 
                  onClick={() => setShowIncompleteModal(false)}
                  className="text-muted hover:text-ink p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable list of unrated photos */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 divide-y divide-border">
                {unratedPhotosList.map(photo => (
                  <div key={photo.id} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img 
                        src={`/uploads/${photo.webPath}`} 
                        alt="" 
                        className="w-14 h-12 object-cover border border-border shrink-0 bg-ink"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                          <span className="bg-paper px-1.5 py-0.2 border border-border">Kat. {photo.category}</span>
                          <span>{photo.id}</span>
                        </div>
                        <p className="font-bold text-xs uppercase tracking-tight text-ink truncate mt-0.5" title={photo.name}>
                          {photo.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Quick 1-5 scoring on the spot */}
                      <div className="hidden sm:flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(pts => (
                          <button
                            key={pts}
                            onClick={() => handleRate(pts, photo)}
                            className="w-7 h-7 flex items-center justify-center text-xs font-bold border border-border bg-paper/40 hover:bg-ink hover:text-white transition-all"
                            title={`${pts} b`}
                          >
                            {pts}
                          </button>
                        ))}
                      </div>

                      {/* Jump button */}
                      <button
                        onClick={() => jumpToPhoto(photo)}
                        className="px-3 py-1.5 bg-ink text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-1"
                      >
                        <span>{lang === "sk" ? "Hodnotiť" : "Rate"}</span>
                        <ArrowUpRight size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowIncompleteModal(false)}
                  className="px-6 py-2.5 bg-ink text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                >
                  {lang === "sk" ? "Rozumiem, pokračovať v hodnotení" : "Continue Scoring"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* MODAL 2: TWO-STEP CONFIRMATION & THANK YOU MODAL             */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border w-full max-w-lg p-6 md:p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Lock size={15} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wider text-ink">
                      {lang === "sk" ? "Potvrdenie a uzamknutie hodnotenia" : "Confirm & Lock Evaluation"}
                    </h3>
                    <p className="text-[11px] text-muted">Krok 2 z 2 &bull; Záverečné potvrdenie</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="text-muted hover:text-ink p-1 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary of 100% completion */}
              <div className="p-4 border border-green-300 bg-green-50/70 space-y-1.5">
                <div className="flex items-center gap-2 text-green-900 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span>{lang === "sk" ? "Všetky fotografie sú úspešne ohodnotené" : "All photos successfully rated"}</span>
                </div>
                <p className="text-[11px] text-green-900/80 leading-relaxed">
                  {lang === "sk"
                    ? `Máte udelené body pre všetkých ${stats.total} súťažných fotografií (100 % hotovo).`
                    : `Scores assigned to all ${stats.total} competition works (100% completed).`}
                </p>
              </div>

              {/* Lock Warning */}
              <div className="p-4 border border-amber-300 bg-amber-50/70 space-y-1.5 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-900">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                  <span>{lang === "sk" ? "Upozornenie o uzamknutí" : "Locking Notice"}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  {lang === "sk"
                    ? "Po potvrdení tohto kroku sa Vaše hlasovanie natrvalo UZAMKNE a predsedovi odbornej poroty bude doručená oficiálna emailová notifikácia. Dodatočné zmeny budú možné len po manuálnom odomknutí predsedom poroty alebo administrátorom."
                    : "After confirming, your evaluation will be permanently LOCKED and an email notification will be sent to the Jury Chairman. Future edits require unlocking by chairman or admin."}
                </p>
              </div>

              {/* Heartfelt Thank You */}
              <div className="p-5 border border-border bg-paper/50 space-y-2 text-center">
                <Heart size={22} className="text-accent fill-accent mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-ink">
                  {lang === "sk" ? "Ďakujeme za Váš čas a prácu" : "Thank you for your contribution"}
                </h4>
                <p className="text-[11px] text-muted leading-relaxed">
                  {lang === "sk"
                    ? `Vážený ${evaluatorName || "porotca"}, organizačný tím súťaže Speleofotografia 2026 Vám úprimne ďakuje za Vaše odborné zhodnotenie a nasadenie.`
                    : `Dear judge, the organizing committee of Speleofotografia 2026 sincerely thanks you for your expertise and dedication.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 border border-border text-muted hover:text-ink text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {lang === "sk" ? "Ešte skontrolovať body" : "Review Again"}
                </button>
                <button
                  onClick={executeFinalSubmit}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{lang === "sk" ? "Odosielam predsedovi..." : "Submitting..."}</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>{lang === "sk" ? "Definitívne odoslať a uzamknúť" : "Confirm, Submit & Lock"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* MODAL 3: SUCCESS CONFIRMATION MODAL                          */}
      {/* ============================================================ */}
      <AnimatePresence>
        {submitSuccess && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border w-full max-w-md p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-light uppercase tracking-tight text-ink">
                  {lang === "sk" ? "Hodnotenie bolo úspešne odoslané!" : "Evaluation Successfully Submitted!"}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {lang === "sk"
                    ? "Vaša práca bola dokončená a uzamknutá. Predseda odbornej poroty bol upovedomený emailom a Vaše body boli započítané do celkových výsledkov súťaže."
                    : "Your scoring has been finalized and locked. The Jury Chairman has been notified and your points have been aggregated."}
                </p>
              </div>

              <div className="p-4 bg-paper/60 border border-border rounded text-[11px] font-mono text-muted">
                {lang === "sk" ? "Čas zaznamenania:" : "Timestamp:"} <strong>{submittedAt}</strong>
              </div>

              <button
                onClick={() => setSubmitSuccess(false)}
                className="w-full py-3 bg-ink text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                {lang === "sk" ? "Zatvoriť" : "Close"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* FULLSCREEN LIGHTBOX MODAL FOR ZOOM (PHOTO POPUP)             */}
      {/* ============================================================ */}
      <AnimatePresence>
        {(isFullscreen || zoomPhoto) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8"
            onClick={() => {
              setIsFullscreen(false);
              setZoomPhoto(null);
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between text-white border-b border-white/10 pb-4" onClick={e => e.stopPropagation()}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                  <span>Kat. {(zoomPhoto || currentPhoto)?.category}</span>
                  <span>•</span>
                  <span>{(zoomPhoto || currentPhoto)?.id}</span>
                </div>
                <h3 className="text-lg md:text-xl font-light uppercase tracking-tight text-white">
                  {(zoomPhoto || currentPhoto)?.name}
                </h3>
                {/* Author Name shown if Chairman or zoomPhoto has author */}
                {(zoomPhoto?.author || (evaluatorRole === "chairman" && (zoomPhoto || currentPhoto)?.author)) && (
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                    {lang === "sk" ? "Autor:" : "Author:"} {(zoomPhoto || currentPhoto)?.author}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsFullscreen(false);
                    setZoomPhoto(null);
                  }}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Image Display */}
            <div className="flex-1 flex items-center justify-center py-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <img
                src={`/uploads/${(zoomPhoto || currentPhoto)?.webPath}`}
                className="max-w-[95vw] max-h-[75vh] object-contain shadow-2xl rounded-xs"
                alt="Full preview"
              />
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white text-xs" onClick={e => e.stopPropagation()}>
              <p className="text-white/60 text-[11px] line-clamp-2 max-w-2xl text-center sm:text-left">
                {(zoomPhoto || currentPhoto)?.description || (lang === "sk" ? "Bez popisu." : "No description.")}
              </p>

              {/* In Fullscreen mode from rating card, allow scoring if not locked */}
              {isFullscreen && !zoomPhoto && !isLocked && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 mr-2">
                    {lang === "sk" ? "Bodovať:" : "Rate:"}
                  </span>
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => {
                        handleRate(score);
                        setIsFullscreen(false);
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full border text-sm font-bold flex items-center justify-center transition-all",
                        currentRating === score
                          ? "bg-white text-black border-white"
                          : "bg-white/10 text-white border-white/20 hover:bg-white hover:text-black"
                      )}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
