/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Camera, Shield, User, BarChart3, ChevronRight, Menu, X, Info, Trophy, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import RegistrationForm from "./components/RegistrationForm";
import AdminDashboard from "./components/AdminDashboard";
import EvaluatorInterface from "./components/EvaluatorInterface";
import AdminSetup from "./components/AdminSetup";
import PublicGallery from "./components/PublicGallery";
import Results from "./components/Results";

type View = "home" | "admin" | "evaluator" | "admin-setup" | "public" | "results";

export type Lang = "sk" | "en";

export interface Settings {
  contestNameSk: string;
  contestNameEn: string;
  museumNameSk: string;
  museumNameEn: string;
  edition: string;
  contestYear?: string;
  contestStatus: "submissions" | "review" | "judging" | "shortlist" | "results";
  submissionStart?: string;
  submissionEnd?: string;
  judgingStart?: string;
  judgingEnd?: string;
  categories: { 
    id: string; 
    nameSk: string; 
    nameEn: string;
    name?: string;
    minDesc?: number;
    maxDesc?: number;
    descRequired?: boolean;
  }[];
  fieldRequirements: {
    author: boolean;
    email: boolean;
    instagram: boolean;
    address: boolean;
  };
  emailConfig?: {
    service: string;
    user: string;
    pass: string;
    from: string;
    enabled: boolean;
  };
  rulesSk: string;
  rulesEn: string;
  rulesText?: string;
  debugMode?: boolean;
  maxPhotosPerCategory: string;
  logoUrl?: string;
  watermarkFontSize?: number;
  watermarkColor?: string;
  googleAnalyticsId?: string;
  turnstileEnabled?: boolean;
  turnstileSiteKey?: string;
  awards?: {
    id: string;
    type: 'grand_prize' | 'cat_a_1' | 'cat_a_2' | 'cat_a_3' | 'cat_b_1' | 'cat_b_2' | 'cat_b_3' | 'public_choice' | 'custom';
    titleSk: string;
    titleEn: string;
    photoId: string;
    descriptionSk?: string;
    descriptionEn?: string;
  }[];
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [evalId, setEvalId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("sk");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    // Detekcia iframe (automatická + manuálna cez parameter)
    const params = new URLSearchParams(window.location.search);
    const isIframeMode = window.self !== window.top || params.get("mode") === "iframe";
    setIsIframe(isIframeMode);

    // Explicitné nastavenie pohľadu cez URL
    const viewParam = params.get("view") as View;
    if (viewParam && ["home", "admin", "evaluator", "admin-setup", "public", "results"].includes(viewParam)) {
      setCurrentView(viewParam);
    }

    const evalParam = params.get("eval");
    if (evalParam) {
      setEvalId(evalParam);
      setCurrentView("evaluator");
    }
    const tokenParam = params.get("token");
    if (tokenParam) {
      setCurrentView("admin-setup");
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    const title = lang === "sk" 
      ? (settings?.contestNameSk || "Speleofotografia 2026") 
      : (settings?.contestNameEn || "Speleophotography 2026");
    document.title = title;
  }, [settings, lang]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        const params = new URLSearchParams(window.location.search);
        if (data.contestStatus === "results" && !params.get("view") && !params.get("eval") && !params.get("token")) {
          setCurrentView("results");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    ...(settings?.contestStatus === "results" || currentView === "results" ? [{ id: "results", label: lang === "sk" ? "Výsledky / Results" : "Results", icon: Trophy }] : []),
    { id: "public", label: lang === "sk" ? "Galéria / Gallery" : "Public Mosaic", icon: Camera },
    { id: "home", label: lang === "sk" ? "Prihláška / Form" : "Registration / Form", icon: Camera },
    { id: "admin", label: lang === "sk" ? "Admin / Kontrola" : "Admin / Control", icon: Shield },
  ];

  const isSubmissionActive = () => {
    if (!settings) return false;
    
    const now = new Date();
    // If dates are set, they define the window regardless of status (for stress testing/flexibility)
    if (settings.submissionStart && settings.submissionEnd) {
      const start = new Date(settings.submissionStart);
      const end = new Date(settings.submissionEnd);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    }
    
    // Fallback to status if dates are not properly set
    return settings.contestStatus === "submissions";
  };

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

  return (
    <div className="flex h-screen bg-paper text-ink font-sans selection:bg-ink selection:text-paper overflow-hidden">
      {/* Sidebar - skrytý v iframe */}
      {!isIframe && (
        <aside className="w-[240px] bg-[#f9f9f9] border-r border-border p-6 flex flex-col justify-between shrink-0 hidden md:flex">
          <div>
            <button 
              onClick={() => setCurrentView("home")}
              className="w-full text-left mb-10 group"
            >
              {settings?.logoUrl && (
                <img 
                  src={settings.logoUrl} 
                  alt="Contest Logo" 
                  className="max-h-20 max-w-full mb-4 object-contain grayscale group-hover:grayscale-0 transition-all"
                />
              )}
              <div className="text-[14px] font-extrabold tracking-[2px] uppercase border-l-[3px] border-ink pl-3 group-hover:border-accent transition-colors">
                {lang === "sk" ? settings?.contestNameSk : settings?.contestNameEn}
              </div>
            </button>
            
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as View)}
                  className={cn(
                    "w-full text-left py-3 text-[13px] font-medium transition-all uppercase tracking-widest border-b border-transparent",
                    currentView === item.id 
                      ? "text-ink border-ink" 
                      : "text-muted hover:text-ink"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            <div className="flex gap-2">
              <button 
                onClick={() => setLang("sk")}
                className={cn("text-[10px] uppercase font-bold tracking-widest border border-border px-2 py-1", lang === "sk" ? "bg-ink text-paper" : "text-muted")}
              >SK</button>
              <button 
                onClick={() => setLang("en")}
                className={cn("text-[10px] uppercase font-bold tracking-widest border border-border px-2 py-1", lang === "en" ? "bg-ink text-paper" : "text-muted")}
              >EN</button>
            </div>
            
            <div className="space-y-4">
              <label className="block text-[11px] font-bold uppercase text-muted tracking-tight">
                {lang === "sk" ? "Aktuálny stav" : "Current Status"}
              </label>
              <div className="text-[12px] leading-relaxed opacity-80">
                <p>{settings?.edition}</p>
                <p>{lang === "sk" ? settings?.museumNameSk : settings?.museumNameEn}</p>
                <p className="mt-2 font-bold uppercase tracking-tighter">SMOPAJ</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar - skrytý v iframe */}
        {!isIframe && (
          <header className="h-16 px-10 border-b border-border flex items-center justify-between bg-white shrink-0">
            <div>
              <h1 className="text-[18px] font-light tracking-tight">
                {currentView === "home" && (lang === "sk" ? "Prihláška / Application Form" : "Application Form")}
                {currentView === "public" && (lang === "sk" ? "Galéria / Gallery" : "Public Gallery")}
                {currentView === "admin" && (lang === "sk" ? "Administrácia / Admin" : "Admin Dashboard")}
                {currentView === "evaluator" && (lang === "sk" ? "Hodnotenie / Evaluation" : "Evaluation System")}
              </h1>
            </div>
            <div className="bg-accent text-white text-[10px] px-2 py-1 font-bold tracking-widest uppercase">
              SECURE ACCESS
            </div>
          </header>
        )}

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn("p-10 mx-auto", isIframe ? "max-w-full p-0" : "max-w-6xl")}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-muted" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {currentView === "home" && (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isSubmissionActive() ? (
                      <RegistrationForm lang={lang} settings={settings} />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-20 bg-paper border border-border space-y-6 text-center">
                        <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-full">
                          <X className="text-muted" size={32} />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-light uppercase tracking-tight">
                            {lang === "sk" ? "Prihlasovanie uzavreté" : "Submissions Closed"}
                          </h2>
                          <p className="text-[11px] uppercase font-bold tracking-widest text-muted max-w-xs mx-auto">
                            {lang === "sk" 
                              ? (settings?.submissionStart && new Date(settings.submissionStart) > new Date()
                                  ? `Prihlasovanie sa začne ${new Date(settings.submissionStart).toLocaleDateString()}.`
                                  : "Termín na odosielanie fotografií už uplynul. Sledujte náš web pre výsledky.")
                              : (settings?.submissionStart && new Date(settings.submissionStart) > new Date()
                                  ? `Submissions will open on ${new Date(settings.submissionStart).toLocaleDateString()}.`
                                  : "The deadline for photo submissions has passed. Follow our website for results.")}
                          </p>
                        </div>
                        <button 
                          onClick={() => setCurrentView("public")}
                          className="px-10 py-4 bg-ink text-white text-[10px] font-bold uppercase tracking-[2px]"
                        >
                          {lang === "sk" ? "Prezrieť galériu" : "View Gallery"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

              {currentView === "results" && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Results lang={lang} isIframe={isIframe} />
                </motion.div>
              )}

              {currentView === "public" && (
                <motion.div
                  key="public"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <PublicGallery lang={lang} isIframe={isIframe} />
                </motion.div>
              )}

              {currentView === "admin" && (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AdminDashboard lang={lang} />
                </motion.div>
              )}

              {currentView === "admin-setup" && (
                <motion.div
                  key="admin-setup"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AdminSetup lang={lang} />
                </motion.div>
              )}

              {currentView === "evaluator" && evalId && (
                <motion.div
                  key="evaluator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EvaluatorInterface evalId={evalId} lang={lang} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}

