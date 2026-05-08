/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Camera, Shield, User, BarChart3, ChevronRight, Menu, X, Info, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import RegistrationForm from "./components/RegistrationForm";
import AdminDashboard from "./components/AdminDashboard";
import EvaluatorInterface from "./components/EvaluatorInterface";
import AdminSetup from "./components/AdminSetup";
import PublicGallery from "./components/PublicGallery";

type View = "home" | "admin" | "evaluator" | "admin-setup" | "public";

export type Lang = "sk" | "en";

export interface Settings {
  contestName: string;
  museumName: string;
  edition: string;
  categories: { id: string, name: string }[];
  rulesSk: string;
  rulesEn: string;
  maxPhotosPerCategory: string;
  logoUrl?: string;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [evalId, setEvalId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("sk");
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { id: "public", label: lang === "sk" ? "Galéria / Gallery" : "Public Mosaic", icon: Camera },
    { id: "home", label: lang === "sk" ? "Prihláška / Form" : "Registration / Form", icon: Camera },
    { id: "admin", label: lang === "sk" ? "Admin / Kontrola" : "Admin / Control", icon: Shield },
  ];

  return (
    <div className="flex h-screen bg-paper text-ink font-sans selection:bg-ink selection:text-paper overflow-hidden">
      {/* Sidebar */}
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
              {settings?.contestName?.split(" ").slice(0, -1).join(" ") || settings?.contestName}<br />
              {(settings?.contestName?.split(" ").length || 0) > 1 ? settings?.contestName?.split(" ").slice(-1)[0] : ""}
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
              <p>{settings?.museumName.split(" - ")[1] || "Liptovský Mikuláš"}</p>
              <p className="mt-2 font-bold uppercase tracking-tighter">SMOPAJ</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
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

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-10 max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              {currentView === "home" && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RegistrationForm lang={lang} settings={settings} />
                </motion.div>
              )}

              {currentView === "public" && (
                <motion.div
                  key="public"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <PublicGallery lang={lang} />
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
          </div>
        </div>
      </main>
    </div>
  );
}

