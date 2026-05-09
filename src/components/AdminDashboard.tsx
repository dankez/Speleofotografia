import { useState, useEffect, ChangeEvent } from "react";
import { BarChart3, Users, Image as ImageIcon, Link as LinkIcon, Plus, Copy, Check, Download, Trash2, Eye, Shield, Settings as SettingsIcon, Mail, UserPlus, Heart, Code, ExternalLink, X, User, LayoutGrid, List, Search, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { Photo, Evaluator } from "../types";
import { Lang, Settings } from "../App";

interface ContestSettings {
  contestName: string;
  museumName: string;
  edition: string;
  contestStatus: "submissions" | "review" | "judging" | "shortlist" | "results";
  categories: { id: string, name: string }[];
  fieldRequirements: {
    author: boolean;
    email: boolean;
    instagram: boolean;
    address: boolean;
  };
  rulesSk: string;
  rulesEn: string;
  rulesText?: string;
  debugMode?: boolean;
  maxPhotosPerCategory: string;
  watermarkTemplate: string;
  logoUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  adminEmail: string;
  adminPass: string;
}

export default function AdminDashboard({ lang }: { lang: Lang }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, uniqueEmails: 0 });
  const [newEvalName, setNewEvalName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "photos" | "evaluators" | "embed" | "settings">("stats");
  const [settings, setSettings] = useState<ContestSettings>({
    contestName: "",
    museumName: "",
    edition: "",
    contestStatus: "submissions",
    categories: [],
    fieldRequirements: {
      author: true,
      email: true,
      instagram: false,
      address: true
    },
    rulesSk: "",
    rulesEn: "",
    rulesText: `SPELEOFOTOGRAFIA 2026
23. ročník medzinárodnej súťažnej výstavy fotografií s jaskyniarskou tematikou

1. Organizátori
Slovenská speleologická spoločnosť
Štátna ochrana prírody SR – Správa slovenských jaskýň
Slovenské múzeum ochrany prírody a jaskyniarstva
Mesto Liptovský Mikuláš

2. Podmienky účasti
Súťaže sa môže zúčastniť každý fotograf, ktorý splní podmienky týchto propozícií.
Účasť v súťaži je bezplatná.
Každý autor môže do jednej kategórie zaslať najviac 5 fotografií.
Členovia poroty a organizátori sú z účasti v súťaži vylúčení.

3. Súťažné kategórie a ceny
Kategória A: Fotografia s príbehom – snímky znázorňujúce kras, jaskyne a jaskyniarov doplnené textovým príbehom v rozsahu do 5 000 znakov.
Kategória B: Speleomoment – reportážna fotografia z jaskyniarskych akcií a expedícií.

Ocenenia:
V každej kategórii budú ocenené 3 najlepšie práce.
Hlavná cena Speleofotografie 2026: Absolútny víťaz 23. ročníka vybraný odbornou porotou.
Cena verejnosti: Na základe hlasovania na sociálnych sieťach.

4. Technické parametre a spôsob prihlásenia
Súťaž prebieha plne digitálne cez online formulár. Zasielanie prác e-mailom nie je akceptované.
Technické požiadavky: Minimálne 3 000 px na dlhšej strane, formát .jpg, maximálna veľkosť súboru 5 MB.
Jazyk: Názvy fotografií a sprievodné informácie musia byť v anglickom jazyku. Príbeh ku kategórii A môže byť v slovenskom alebo anglickom jazyku.

5. Právne ustanovenia (Autorské práva a GDPR)
Autorské práva: Účastník odoslaním formulára potvrdzuje, že je autorom diel. Autor udeľuje organizátorom súhlas na bezodplatné použitie fotografií na propagáciu súťaže.
GDPR: Osobné údaje sú spracúvané výhradne za účelom realizácie súťaže v zmysle Nariadenia (EÚ) 2016/679.

6. Harmonogram a porota
Uzávierka prihlášok: 15. september 2026.
Zloženie poroty: Pavol Kočiš (SK – predseda), Marek Audy (CZ), Cosmin Berghean (RO), Daniel Lee (RU), Pavol Staník (SK), Lukáš Kubičina (SK).
Vyhlásenie výsledkov: November 2026, SMOPaJ Liptovský Mikuláš.`,
    maxPhotosPerCategory: "5",
    watermarkTemplate: "",
    logoUrl: "",
    smtpHost: "",
    smtpPort: "",
    smtpSecure: "false",
    smtpUser: "",
    smtpPass: "",
    emailFrom: "",
    adminEmail: "",
    adminPass: "",
  });
  const [adminList, setAdminList] = useState<any[]>([]);
  const [publicResults, setPublicResults] = useState<Record<string, number>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [photoFilter, setPhotoFilter] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [galleryView, setGalleryView] = useState<"grid" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [commModal, setCommModal] = useState<{ open: boolean; email: string; photoId: string }>({ open: false, email: "", photoId: "" });
  const [commSubject, setCommSubject] = useState("");
  const [commMessage, setCommMessage] = useState("");
  const [commStatus, setCommStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState("");
  const [resetView, setResetView] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
      fetchSettings();
      fetchAdminList();
      fetchPublicResults();
    }
  }, [isAuthorized]);

  const fetchPublicResults = async () => {
    try {
      const res = await fetch("/api/admin/public-results");
      if (res.ok) setPublicResults(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminList = async () => {
    try {
      const res = await fetch("/api/admin/list");
      if (res.ok) setAdminList(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const inviteAdmin = async () => {
    if (!inviteEmail) return;
    setInviteStatus("sending");
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail })
      });
      if (res.ok) {
        setInviteStatus("success");
        setInviteEmail("");
        setTimeout(() => setInviteStatus("idle"), 3000);
      } else {
        setInviteStatus("error");
      }
    } catch (e) {
      setInviteStatus("error");
    }
  };

  const deleteAdmin = async (emailToDelete: string) => {
    if (!confirm(lang === "sk" ? `Zmazať administrátora ${emailToDelete}?` : `Delete admin ${emailToDelete}?`)) return;
    try {
      const res = await fetch(`/api/admin/list/${emailToDelete}`, { method: "DELETE" });
      if (res.ok) fetchAdminList();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        setIsAuthorized(true);
        setAuthError("");
      } else {
        const data = await res.json();
        setAuthError(data.error);
      }
    } catch (e) {
      setAuthError("Server Error");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError(lang === "sk" ? "Zadajte email" : "Enter email");
      return;
    }
    setResetStatus("sending");
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setResetStatus("success");
        setAuthError("");
      } else {
        setResetStatus("error");
        setAuthError(lang === "sk" ? "Email nebol nájdený" : "Email not found");
      }
    } catch (e) {
      setResetStatus("error");
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, photosRes, evalsRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/admin/photos"),
        fetch("/api/evaluators")
      ]);
      setStats(await statsRes.json());
      setPhotos(await photosRes.json());
      setEvaluators(await evalsRes.json());
    } catch (e) {
      console.error("Data fetch error", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (e) {
      console.error("Settings fetch error", e);
    }
  };

  const saveSettings = async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch (e) {
      setSaveStatus("error");
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...settings, logoUrl: data.url });
        alert(lang === "sk" ? "Logo bolo úspešne nahrané" : "Logo uploaded successfully");
      }
    } catch (e) {
      console.error(e);
      alert("Error uploading logo");
    }
  };

  const createEvaluator = async () => {
    if (!newEvalName) return;
    const res = await fetch("/api/evaluators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newEvalName })
    });
    if (res.ok) {
      setNewEvalName("");
      fetchData();
    }
  };

  const copyEvalLink = (id: string) => {
    const url = `${window.location.origin}/?eval=${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deletePhoto = async (id: string) => {
    if (!confirm(lang === "sk" ? "Naozaj chcete zmazať túto fotografiu?" : "Are you sure you want to delete this photo?")) return;
    try {
      const res = await fetch(`/api/admin/photos/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updatePhoto = async (id: string, updates: Partial<Photo>) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setEditingPhoto(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const sendCommunication = async () => {
    if (!commModal.email || !commSubject || !commMessage) return;
    setCommStatus("sending");
    try {
      const res = await fetch("/api/admin/communicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: commModal.email,
          subject: commSubject,
          message: commMessage
        })
      });
      if (res.ok) {
        setCommStatus("success");
        setTimeout(() => {
          setCommModal({ open: false, email: "", photoId: "" });
          setCommStatus("idle");
        }, 2000);
      } else {
        setCommStatus("error");
      }
    } catch (e) {
      setCommStatus("error");
    }
  };

  const toggleShortlist = async (id: string, current: boolean) => {
    await updatePhoto(id, { shortlisted: !current });
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 border border-border bg-white space-y-6">
        <div className="space-y-2 text-center">
          <Shield size={32} className="mx-auto text-accent mb-4" />
          <h2 className="text-xl font-bold uppercase tracking-widest">
            {resetView 
              ? (lang === "sk" ? "Obnova prístupu" : "Reset Access")
              : (lang === "sk" ? "Vstup pre správcov" : "Admin Login")}
          </h2>
          <p className="text-[11px] text-muted uppercase tracking-tight">
            {resetView 
              ? (lang === "sk" ? "Zadajte váš registračný e-mail" : "Enter your registration e-mail")
              : (lang === "sk" ? "Zadajte prihlasovacie údaje" : "Please enter login credentials")}
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted ml-1">E-mail</label>
            <input 
              type="text" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (resetView ? handleForgotPassword() : handleLogin())}
              className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
              placeholder="admin@example.com"
            />
          </div>
          
          {!resetView && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted ml-1">{lang === "sk" ? "Heslo" : "Password"}</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
                placeholder="••••••••"
              />
            </div>
          )}

          {authError && <p className="text-red-500 text-[10px] uppercase font-bold text-center">{authError}</p>}
          {resetStatus === "success" && (
            <p className="text-green-600 text-[10px] uppercase font-bold text-center">
              {lang === "sk" ? "Link na obnovu bol odoslaný" : "Reset link has been sent"}
            </p>
          )}

          {resetView ? (
            <div className="space-y-3">
              <button 
                onClick={handleForgotPassword}
                disabled={resetStatus === "sending"}
                className="w-full py-4 bg-ink text-white font-bold uppercase tracking-[3px] text-[11px] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {resetStatus === "sending" ? "..." : (lang === "sk" ? "Odoslať resetovací link" : "Send Reset Link")}
              </button>
              <button 
                onClick={() => { setResetView(false); setAuthError(""); setResetStatus("idle"); }}
                className="w-full text-[10px] font-bold uppercase text-muted tracking-widest hover:text-ink"
              >
                {lang === "sk" ? "Späť na prihlásenie" : "Back to login"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button 
                onClick={handleLogin}
                className="w-full py-4 bg-ink text-white font-bold uppercase tracking-[3px] text-[11px] transition-opacity hover:opacity-90"
              >
                {lang === "sk" ? "Vstúpiť / Login" : "Authenticate / Login"}
              </button>
              <button 
                onClick={() => { setResetView(true); setAuthError(""); }}
                className="w-full text-[10px] font-bold uppercase text-muted tracking-widest hover:text-ink"
              >
                {lang === "sk" ? "Zabudol som heslo" : "Forgot password?"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-b border-border pb-6">
        <div className="space-y-2">
          <p className="text-[11px] text-muted uppercase font-bold tracking-widest">
            {lang === "sk" ? "Riadiace stredisko / Admin Control" : "Control Center / Admin"}
          </p>
          <h2 className="text-3xl font-light tracking-tight uppercase">Dashboard</h2>
        </div>

        <div className="flex gap-4">
            {[
              { id: "stats", label: lang === "sk" ? "Štatistiky" : "Stats", icon: BarChart3 },
              { id: "photos", label: lang === "sk" ? "Galéria" : "Gallery", icon: ImageIcon },
              { id: "evaluators", label: lang === "sk" ? "Porota" : "Jury", icon: Users },
              { id: "embed", label: lang === "sk" ? "Prepojenie" : "Embed", icon: Code },
              { id: "settings", label: lang === "sk" ? "Nastavenia" : "Settings", icon: SettingsIcon },
            ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2 text-[11px] uppercase tracking-widest font-bold border-b-2 transition-all flex items-center gap-2",
                activeTab === tab.id ? "text-ink border-ink" : "text-muted border-transparent hover:text-ink"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Areas */}
      <div className="pt-6">
        {activeTab === "settings" && (
          <div className="max-w-3xl space-y-10">
            <div className="space-y-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">
                {lang === "sk" ? "Parametre súťaže" : "Competition Parameters"}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Contest Status</label>
                  <select 
                    value={settings.contestStatus}
                    onChange={e => setSettings({ ...settings, contestStatus: e.target.value as any })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  >
                    <option value="submissions">Open for Submissions</option>
                    <option value="review">Closed / Technical Review</option>
                    <option value="judging">Judging Session</option>
                    <option value="shortlist">Shortlist Round</option>
                    <option value="results">Public Results</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={settings.contestName}
                    onChange={e => setSettings({ ...settings, contestName: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Edition</label>
                  <input 
                    type="text" 
                    value={settings.edition}
                    onChange={e => setSettings({ ...settings, edition: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Museum Name</label>
                  <input 
                    type="text" 
                    value={settings.museumName}
                    onChange={e => setSettings({ ...settings, museumName: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <label className="text-[10px] font-bold uppercase text-muted">{lang === "sk" ? "Kategórie" : "Categories"}</label>
                    <button 
                      onClick={() => {
                        const categories = settings?.categories || [];
                        const nextLetter = String.fromCharCode(65 + categories.length);
                        const newId = categories.some(c => c.id === nextLetter) 
                          ? Math.random().toString(36).substring(2, 5).toUpperCase()
                          : nextLetter;
                        setSettings({
                          ...settings,
                          categories: [...categories, { id: newId, name: `New Category ${newId}` }]
                        });
                      }}
                      className="text-[9px] font-bold uppercase text-accent flex items-center gap-1 hover:underline"
                    >
                      <Plus size={10} /> {lang === "sk" ? "Pridať kategóriu" : "Add Category"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(settings?.categories || []).map((cat, idx) => (
                      <div key={cat.id} className="flex gap-4 items-end">
                        <div className="w-12">
                          <label className="text-[8px] font-bold uppercase text-muted block mb-1">ID</label>
                          <input 
                            type="text" 
                            value={cat.id}
                            disabled
                            className="w-full p-2 border border-border bg-paper text-xs text-center opacity-50"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-bold uppercase text-muted block mb-1">Name</label>
                          <input 
                            type="text" 
                            value={cat.name}
                            onChange={e => {
                              const categories = settings?.categories || [];
                              const newCats = [...categories];
                              newCats[idx].name = e.target.value;
                              setSettings({ ...settings, categories: newCats });
                            }}
                            className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                          />
                        </div>
                        {(settings?.categories || []).length > 1 && (
                          <button 
                            onClick={() => {
                              const categories = settings?.categories || [];
                              setSettings({
                                ...settings,
                                categories: categories.filter((_, i) => i !== idx)
                              });
                            }}
                            className="p-2.5 text-muted hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
                  <label className="text-[10px] font-bold uppercase text-muted">{lang === "sk" ? "Požiadavky na polia" : "Field Requirements"}</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(settings.fieldRequirements || {}).map(([field, required]) => (
                      <button 
                        key={field}
                        onClick={() => {
                          setSettings({
                            ...settings,
                            fieldRequirements: {
                              ...settings.fieldRequirements,
                              [field]: !required
                            }
                          });
                        }}
                        className={cn(
                          "p-3 border text-[10px] font-bold uppercase tracking-widest transition-all",
                          required 
                            ? "border-ink bg-ink text-white" 
                            : "border-border bg-white text-muted hover:border-ink hover:text-ink"
                        )}
                      >
                        {field}: {required ? (lang === "sk" ? "Povinné" : "Required") : (lang === "sk" ? "Dobrovoľné" : "Voluntary")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Rules (SK)</label>
                  <textarea 
                    value={settings.rulesSk}
                    onChange={e => setSettings({ ...settings, rulesSk: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink h-32"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Rules (EN)</label>
                  <textarea 
                    value={settings.rulesEn}
                    onChange={e => setSettings({ ...settings, rulesEn: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink h-32"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Max Photos per Category</label>
                  <input 
                    type="number" 
                    value={settings.maxPhotosPerCategory}
                    onChange={e => setSettings({ ...settings, maxPhotosPerCategory: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Watermark Template ($author is variable)</label>
                  <input 
                    type="text" 
                    value={settings.watermarkTemplate}
                    onChange={e => setSettings({ ...settings, watermarkTemplate: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="e.g. $author | Speleofotografia 2026"
                  />
                </div>
                <div className="space-y-2 md:col-span-2 border border-border p-4 bg-paper">
                  <label className="text-[10px] font-bold uppercase text-muted block mb-2">{lang === "sk" ? "Logo súťaže" : "Contest Logo"}</label>
                  <div className="flex items-center gap-6">
                    {settings.logoUrl && (
                      <img src={settings.logoUrl} alt="Preview" className="h-16 w-auto border border-border bg-white p-1" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="text-[10px]"
                    />
                  </div>
                  <p className="text-[9px] text-muted mt-2 uppercase tracking-tight">
                    {lang === "sk" ? "Nahrajte súbor (JPG, PNG, SVG). Logo sa zobrazí v bočnom paneli." : "Upload file (JPG, PNG, SVG). Logo will appear in the sidebar."}
                  </p>
                </div>
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2 pt-10">
                {lang === "sk" ? "E-mailové nastavenia (SMTP)" : "Email Settings (SMTP)"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">SMTP Host</label>
                  <input 
                    type="text" 
                    value={settings.smtpHost}
                    onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="e.g. smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">SMTP Port</label>
                  <input 
                    type="text" 
                    value={settings.smtpPort}
                    onChange={e => setSettings({ ...settings, smtpPort: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="e.g. 587"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">SMTP User</label>
                  <input 
                    type="text" 
                    value={settings.smtpUser}
                    onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="User / Login"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">SMTP Password</label>
                  <input 
                    type="password" 
                    value={settings.smtpPass}
                    onChange={e => setSettings({ ...settings, smtpPass: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Email From</label>
                  <input 
                    type="text" 
                    value={settings.emailFrom}
                    onChange={e => setSettings({ ...settings, emailFrom: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    placeholder="info@speleofoto.sk"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Secure (SSL/TLS)</label>
                  <select 
                    value={settings.smtpSecure}
                    onChange={e => setSettings({ ...settings, smtpSecure: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  >
                    <option value="false">No (STARTTLS)</option>
                    <option value="true">Yes (SSL/TLS)</option>
                  </select>
                </div>
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2 pt-10">
                {lang === "sk" ? "Podmienky súťaže" : "Competition Rules"}
              </h3>
              <div className="space-y-2">
                <p className="text-[11px] text-muted uppercase tracking-tight mb-2">
                  {lang === "sk" 
                    ? "Tento text sa zobrazí v modálnom okne po kliknutí na odkaz v prihláške. Podporuje Markdown formátovanie." 
                    : "This text will be displayed in a modal window when the link in the application is clicked. Supports Markdown formatting."}
                </p>
                <textarea 
                  value={settings.rulesText}
                  onChange={e => setSettings({ ...settings, rulesText: e.target.value })}
                  className="w-full p-4 border border-border bg-white text-[12px] font-mono outline-none focus:border-ink h-96 leading-relaxed"
                />
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2 pt-10">
                {lang === "sk" ? "Vývojársky režim" : "Developer Mode"}
              </h3>
              <div className="flex items-center justify-between p-4 bg-paper/30 border border-border">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink">
                    {lang === "sk" ? "Debug režim" : "Debug Mode"}
                  </p>
                  <p className="text-[10px] text-muted">
                    {lang === "sk" ? "Umožňuje rýchle nahrávanie testovacích prihlášok." : "Allows quick upload of test applications."}
                  </p>
                </div>
                <button 
                  onClick={() => setSettings({ ...settings, debugMode: !settings.debugMode })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    settings.debugMode ? "bg-accent" : "bg-ink/20"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    settings.debugMode ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2 pt-10">
                {lang === "sk" ? "Správa administrátorov" : "Admin Management"}
              </h3>

              <div className="space-y-6">
                <div className="border border-border p-6 bg-paper space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {lang === "sk" ? "Pozvať nového administrátora" : "Invite New Administrator"}
                  </p>
                  <div className="flex gap-4">
                    <input 
                      type="email" 
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    />
                    <button 
                      onClick={inviteAdmin}
                      disabled={inviteStatus === "sending"}
                      className="px-6 py-3 bg-ink text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus size={14} />
                      {inviteStatus === "sending" ? "..." : (lang === "sk" ? "Pozvať" : "Invite")}
                    </button>
                  </div>
                  {inviteStatus === "success" && <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Pozvánka bola úspešne odoslaná / Invitation sent successfully</p>}
                  {inviteStatus === "error" && <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Chyba pri odosielaní / Error sending invitation</p>}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {lang === "sk" ? "Aktívni administrátori" : "Active Administrators"}
                  </p>
                  <div className="divide-y divide-border border border-border bg-white">
                    {(adminList || []).map(adm => (
                      <div key={adm.email} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-muted">
                            <Users size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold tracking-tight">{adm.email}</p>
                            <p className="text-[9px] text-muted uppercase font-bold tracking-widest">{adm.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteAdmin(adm.email)}
                          className="p-2 text-muted hover:text-red-500 transition-colors"
                          title="Delete Admin"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-6">
                <button 
                  onClick={saveSettings}
                  className={cn(
                    "px-10 py-4 bg-ink text-white text-[11px] font-bold uppercase tracking-[2px] transition-all",
                    saveStatus === "saving" && "opacity-50 pointer-events-none"
                  )}
                >
                  {saveStatus === "saving" ? "Saving..." : (lang === "sk" ? "Uložiť nastavenia" : "Save Settings")}
                </button>
                {saveStatus === "success" && <span className="text-[10px] font-bold uppercase text-green-600 flex items-center gap-1"><Check size={14} /> Saved</span>}
                {saveStatus === "error" && <span className="text-[10px] font-bold uppercase text-red-600">Error saving</span>}
              </div>
            </div>
          </div>
        )}
        {activeTab === "stats" && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label={lang === "sk" ? "Fotografie celkom" : "Total Photos"} value={stats.total} />
              <StatCard label={lang === "sk" ? "Počet autorov" : "Total Authors"} value={stats.uniqueEmails} />
              {(settings?.categories || []).map(cat => (
                <div key={cat.id}>
                  <StatCard 
                    label={cat.name?.split(" / ")?.[0] || cat.id} 
                    value={stats[`cat${cat.id}`] || 0} 
                  />
                </div>
              ))}
            </div>

            {/* Public Choice Leaderboard */}
            <div className="bg-paper border border-border p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-accent" />
                  <h3 className="text-[12px] font-bold uppercase tracking-[2px]">
                    {lang === "sk" ? "Cena verejnosti - Priebežný rebríček" : "Public Choice - Current Standings"}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  {(Object.values(publicResults) as number[]).reduce((a: number, b: number) => a + b, 0)} {lang === "sk" ? "hlasov celkom" : "total votes"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {Object.entries(publicResults)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .slice(0, 6)
                   .map(([id, count]) => {
                     const photo = photos.find(p => p.id === id);
                     if (!photo) return null;
                     return (
                       <div key={id} className="flex items-center gap-4 p-3 border border-border bg-white group hover:border-accent transition-colors">
                         <div className="w-12 h-12 bg-muted shrink-0 overflow-hidden">
                           <img src={`/uploads/${photo.webPath || photo.path}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-bold truncate tracking-tight">{photo.name}</p>
                           <p className="text-[9px] text-muted uppercase font-bold truncate leading-tight">{photo.author}</p>
                         </div>
                         <div className="text-right">
                           <p className="text-xl font-light text-accent leading-none">{count}</p>
                           <p className="text-[8px] text-muted font-bold uppercase leading-none mt-1">{lang === "sk" ? "hlasov" : "votes"}</p>
                         </div>
                       </div>
                     );
                   })}
              </div>
            </div>
            
            <div className="bg-paper border border-border p-10 flex flex-col items-center justify-center space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold uppercase tracking-tight">
                  {lang === "sk" ? "Export dát" : "Data Export"}
                </h3>
                <p className="text-[11px] uppercase tracking-widest text-muted">
                  {lang === "sk" ? "Stiahnite si dáta pre zasadnutie komisie" : "Download data for the committee meeting"}
                </p>
              </div>
              <div className="flex gap-4">
                <a href="/data/registrations.csv" download className="px-6 py-4 bg-ink text-white text-[11px] uppercase font-bold tracking-[2px] transition-all hover:opacity-90 flex items-center gap-2">
                  <Download size={14} /> {lang === "sk" ? "Registre / CSV" : "Registry / CSV"}
                </a>
                <a href="/api/admin/export/photos-zip" download className="px-6 py-4 border border-ink text-ink text-[11px] uppercase font-bold tracking-[2px] transition-all hover:bg-ink hover:text-white flex items-center gap-2">
                  <ImageIcon size={14} /> {lang === "sk" ? "Originály / ZIP" : "Originals / ZIP"}
                </a>
                <a href="/data/ratings.csv" download className="px-6 py-4 border border-border text-muted text-[11px] uppercase font-bold tracking-[2px] transition-all hover:border-ink hover:text-ink flex items-center gap-2">
                  <BarChart3 size={14} /> {lang === "sk" ? "Body / CSV" : "Scores / CSV"}
                </a>
              </div>
            </div>

            <div className="p-8 border border-border bg-white space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted">
                {lang === "sk" ? "WordPress integrácia (Shortcodes)" : "WordPress Integration (Shortcodes)"}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-paper font-mono text-[10px] space-y-1">
                  <p className="text-accent font-bold"># Gallery Shortcode</p>
                  <code>[speleo_gallery category="all" year="2025" count="{stats.total}"]</code>
                </div>
                <div className="p-4 bg-paper font-mono text-[10px] space-y-1">
                  <p className="text-accent font-bold"># Stats Shortcode</p>
                  <code>[speleo_stats authors="..." photos_a="{stats.catA}" photos_b="{stats.catB}"]</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "embed" && (
          <div className="space-y-8 max-w-4xl">
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">
                {lang === "sk" ? "VLOŽENIE GALÉRIE NA VÁŠ WEB" : "EMBED GALLERY ON YOUR SITE"}
              </h3>
              <p className="text-[12px] text-muted leading-relaxed">
                {lang === "sk" 
                  ? "Tento kód skopírujte a vložte do vašej webstránky na miesto, kde chcete zobraziť galériu. Galéria sa automaticky prispôsobí veľkosti kontajnera. Toto je najbezpečnejší a najjednoduchší spôsob integrácie."
                  : "Copy this code and paste it into your website where you want the gallery to appear. The gallery will automatically adapt to the container size. This is the safest and easiest way to integrate."
                }
              </p>
            </div>

            <div className="bg-paper border border-border p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">IFrame Embed Code</span>
                  <button 
                    onClick={() => {
                      const baseUrl = window.location.origin;
                      const embedCode = `<iframe \n  src="${baseUrl}?view=public" \n  width="100%" \n  height="800px" \n  frameborder="0" \n  loading="lazy" \n  referrerpolicy="no-referrer-when-downgrade"\n  style="border:none; overflow:hidden; min-height:600px;"\n></iframe>`;
                      navigator.clipboard.writeText(embedCode);
                      setCopied("embed");
                      setTimeout(() => setCopied(null), 2000);
                    }}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ink hover:text-accent transition-colors"
                  >
                    {copied === "embed" ? <Check size={14} /> : <Copy size={14} />}
                    {copied === "embed" ? (lang === "sk" ? "Skopírované" : "Copied") : (lang === "sk" ? "Kopírovať kód" : "Copy Code")}
                  </button>
                </div>
                <pre className="bg-white border border-border p-4 text-[11px] font-mono overflow-x-auto text-muted whitespace-pre-wrap leading-relaxed">
{`<iframe
  src="${window.location.origin}?view=public"
  width="100%"
  height="800px"
  frameborder="0"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  style="border:none; min-height:600px;"
></iframe>`}
                </pre>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Secure & Sandbox friendly</span>
                </div>
                <a 
                  href={`${window.location.origin}?view=public`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
                >
                  View Gallery <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border bg-white space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink">Lazy Loading</h4>
                <p className="text-[11px] text-muted leading-tight">
                  {lang === "sk" 
                    ? "Galéria sa načíta až keď k nej návštevník príde, čo šetrí rýchlosť vášho webu." 
                    : "The gallery loads only when the visitor scrolls to it, optimizing your site performance."}
                </p>
              </div>
              <div className="p-4 border border-border bg-white space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink">Responsive</h4>
                <p className="text-[11px] text-muted leading-tight">
                  {lang === "sk" 
                    ? "Iframe je nastavený na 100% šírku, aby fungoval bezchybne na mobiloch aj počítačoch." 
                    : "The iframe is set to 100% width to work flawlessly on both mobile and desktop devices."}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-8 border-t border-border">
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">
                  {lang === "sk" ? "VLOŽENIE PRIHLÁŠKY NA VÁŠ WEB" : "EMBED REGISTRATION FORM ON YOUR SITE"}
                </h3>
                <p className="text-[12px] text-muted leading-relaxed">
                  {lang === "sk" 
                    ? "Tento kód skopírujte a vložte pre zobrazenie registračného formulára. Ideálne pre podstránku 'Súťaž' alebo 'Registrácia'."
                    : "Copy this code to display the registration form. Ideal for a 'Competition' or 'Registration' subpage."
                  }
                </p>
              </div>

              <div className="bg-paper border border-border p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Registration IFrame Code</span>
                    <button 
                      onClick={() => {
                        const baseUrl = window.location.origin;
                        const embedCode = `<iframe \n  src="${baseUrl}" \n  width="100%" \n  height="1200px" \n  frameborder="0" \n  loading="lazy" \n  referrerpolicy="no-referrer-when-downgrade"\n  style="border:none; overflow:hidden; min-height:800px;"\n></iframe>`;
                        navigator.clipboard.writeText(embedCode);
                        setCopied("form-embed");
                        setTimeout(() => setCopied(null), 2000);
                      }}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ink hover:text-accent transition-colors"
                    >
                      {copied === "form-embed" ? <Check size={14} /> : <Copy size={14} />}
                      {copied === "form-embed" ? (lang === "sk" ? "Skopírované" : "Copied") : (lang === "sk" ? "Kopírovať kód" : "Copy Code")}
                    </button>
                  </div>
                  <pre className="bg-white border border-border p-4 text-[11px] font-mono overflow-x-auto text-muted whitespace-pre-wrap leading-relaxed">
{`<iframe
  src="${window.location.origin}"
  width="100%"
  height="1200px"
  frameborder="0"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  style="border:none; min-height:800px;"
></iframe>`}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="p-8 border border-border bg-white space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted">
                {lang === "sk" ? "WordPress integrácia (Legacy Shortcodes)" : "WordPress Integration (Legacy Shortcodes)"}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-paper font-mono text-[10px] space-y-1">
                  <p className="text-accent font-bold"># Gallery Shortcode</p>
                  <code>[speleo_gallery category="all" year="2025" count="{stats.total}"]</code>
                </div>
                <div className="p-4 bg-paper font-mono text-[10px] space-y-1">
                  <p className="text-accent font-bold"># Stats Shortcode</p>
                  <code>[speleo_stats authors="..." photos_a="{stats.catA}" photos_b="{stats.catB}"]</code>
                </div>
              </div>
              <p className="text-[9px] text-muted uppercase font-bold tracking-widest italic">
                {lang === "sk" 
                  ? "* Pre nové inštalácie odporúčame použiť IFrame kód vyššie." 
                  : "* For new installations, we recommend using the IFrame code above."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "photos" && (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-6 items-center justify-between bg-paper p-6 border border-border">
              <div className="flex gap-2">
                <button 
                  onClick={() => setPhotoFilter("all")}
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                    photoFilter === "all" ? "bg-ink text-white border-ink" : "bg-white text-muted border-border hover:border-ink"
                  )}
                >
                  {lang === "sk" ? "Všetky" : "All"}
                </button>
                {(settings?.categories || []).map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setPhotoFilter(cat.id)}
                    className={cn(
                      "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                      photoFilter === cat.id ? "bg-ink text-white border-ink" : "bg-white text-muted border-border hover:border-ink"
                    )}
                  >
                    {cat.name?.split(" / ")?.[0] || cat.id}
                  </button>
                ))}
              </div>

              <div className="flex-1 max-w-sm relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={lang === "sk" ? "Hľadať autora, názov..." : "Search author, name..."}
                  className="w-full pl-10 pr-4 py-2 border border-border bg-white text-[11px] font-bold uppercase tracking-widest outline-none focus:border-ink"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex border border-border">
                  <button 
                    onClick={() => setGalleryView("grid")}
                    className={cn("p-2 transition-colors", galleryView === "grid" ? "bg-ink text-white" : "bg-white text-muted hover:text-ink")}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button 
                    onClick={() => setGalleryView("table")}
                    className={cn("p-2 transition-colors", galleryView === "table" ? "bg-ink text-white" : "bg-white text-muted hover:text-ink")}
                  >
                    <List size={16} />
                  </button>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  {photos.filter(p => (photoFilter === "all" || p.category === photoFilter) && (p.author.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase()))).length} {lang === "sk" ? "výsledkov" : "results"}
                </div>
              </div>
            </div>

            {galleryView === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {photos
                  .filter(p => (photoFilter === "all" || p.category === photoFilter) && (p.author.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase())))
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(photo => (
                  <div key={photo.id} className="aspect-square bg-paper border border-border relative group overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                    <img 
                      src={`/uploads/${photo.webPath || photo.path}`} 
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110" 
                      alt={photo.name} 
                    />
                    <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye size={24} className="text-white" />
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-1 bg-ink/80 text-white text-[8px] font-bold uppercase tracking-widest">
                      {photo.category}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingPhoto(photo); }}
                        className="p-2 bg-white/80 text-ink hover:bg-white"
                        title={lang === "sk" ? "Upraviť" : "Edit"}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                        className="p-2 bg-red-500/80 text-white hover:bg-red-600"
                        title={lang === "sk" ? "Zmazať" : "Delete"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink/90 to-transparent">
                      <p className="text-[10px] text-white font-bold truncate leading-none mb-1">{photo.name}</p>
                      <p className="text-[8px] text-white/60 truncate leading-none uppercase tracking-tight">{photo.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-border bg-white overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-paper border-b border-border">
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted w-20">{lang === "sk" ? "Foto" : "Photo"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Dielo / Autor" : "Piece / Author"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Krátky list" : "Shortlist"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Bodovanie" : "Scoring"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted text-right">{lang === "sk" ? "Akcie" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {photos
                      .filter(p => (photoFilter === "all" || p.category === photoFilter) && (p.author.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase())))
                      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
                      .map(photo => (
                      <tr key={photo.id} className={cn("hover:bg-paper/50 transition-colors group", photo.shortlisted && "bg-accent/5")}>
                        <td className="p-4">
                          <div className="w-12 h-12 bg-paper border border-border overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                            <img src={`/uploads/${photo.webPath || photo.path}`} className="w-full h-full object-cover" alt="" />
                          </div>
                        </td>
                        <td className="p-4">
                           <div className="space-y-1">
                            <p className="text-xs font-bold tracking-tight text-ink">{photo.name}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-tight">{photo.author}</p>
                          </div>
                        </td>
                        <td className="p-4">
                           <button 
                            onClick={() => toggleShortlist(photo.id, photo.shortlisted || false)}
                            className={cn(
                              "px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest border transition-all",
                              photo.shortlisted ? "bg-accent text-white border-accent" : "text-muted border-border hover:border-ink hover:text-ink"
                            )}
                           >
                            {photo.shortlisted ? "SHORTLISTED" : "OFF"}
                           </button>
                        </td>
                        <td className="p-4">
                           <div className="flex items-center gap-2">
                             <span className="text-sm font-light text-ink">{photo.averageScore || 0}</span>
                             <span className="text-[8px] text-muted font-bold uppercase">avg</span>
                           </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => setCommModal({ open: true, email: photo.email, photoId: photo.id })}
                              className="p-2 text-muted hover:text-accent transition-colors"
                              title={lang === "sk" ? "Kontaktovať autora" : "Contact Author"}
                            >
                              <Mail size={14} />
                            </button>
                            <button 
                              onClick={() => setSelectedPhoto(photo)}
                              className="p-2 text-muted hover:text-ink transition-colors"
                              title={lang === "sk" ? "Zobraziť" : "View"}
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              onClick={() => setEditingPhoto(photo)}
                              className="p-2 text-muted hover:text-ink transition-colors"
                              title={lang === "sk" ? "Upraviť" : "Edit"}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => deletePhoto(photo.id)}
                              className="p-2 text-muted hover:text-red-500 transition-colors"
                              title={lang === "sk" ? "Zmazať" : "Delete"}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <AnimatePresence>
              {commModal.open && (
                 <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/90 backdrop-blur-md"
                >
                   <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white max-w-lg w-full p-10 space-y-8 shadow-2xl relative"
                  >
                    <button onClick={() => setCommModal({ open: false, email: "", photoId: "" })} className="absolute top-6 right-6 text-muted hover:text-ink">
                      <X size={24} />
                    </button>

                    <div className="space-y-2">
                       <p className="text-accent text-[11px] font-bold uppercase tracking-[2px]">{lang === "sk" ? "Správa autorovi" : "Message to Author"}</p>
                       <h3 className="text-xl font-light tracking-tight">{commModal.email}</h3>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Subject</label>
                          <input 
                            type="text" 
                            value={commSubject}
                            onChange={e => setCommSubject(e.target.value)}
                            placeholder="e.g. Photo status update"
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink font-bold"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Message</label>
                          <textarea 
                            value={commMessage}
                            onChange={e => setCommMessage(e.target.value)}
                            placeholder="Write your message here..."
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink h-48 leading-relaxed"
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Approved", sub: "Photo accepted", msg: "Dobrý deň,\n\nVaša fotografia bola schválená do užšieho výberu.\n\nCongratulations, your photo has been shortlisted." },
                            { label: "Re-upload", sub: "Technical issue", msg: "Dobrý deň,\n\nVaša fotografia nespĺňa technické parametre (rozlíšenie). Prosím, nahrajte ju znova v lepšej kvalite.\n\nYour photo does not meet the technical requirements. Please re-upload in better quality." }
                          ].map(tpl => (
                            <button 
                              key={tpl.label}
                              onClick={() => { setCommSubject(tpl.sub); setCommMessage(tpl.msg); }}
                              className="p-2 border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-paper transition-all"
                            >
                              {tpl.label}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                       <button 
                        onClick={() => setCommModal({ open: false, email: "", photoId: "" })} 
                        className="flex-1 py-3 border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-paper transition-all"
                       >
                         {lang === "sk" ? "Zrušiť" : "Cancel"}
                       </button>
                       <button 
                        onClick={sendCommunication}
                        disabled={commStatus === "sending"}
                        className="flex-1 py-3 bg-accent text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                       >
                         {commStatus === "sending" ? "..." : (lang === "sk" ? "Odoslať email" : "Send Email")}
                       </button>
                    </div>

                    {commStatus === "success" && <p className="text-[10px] font-bold text-green-600 text-center uppercase tracking-widest">Email sent successfully!</p>}
                    {commStatus === "error" && <p className="text-[10px] font-bold text-red-600 text-center uppercase tracking-widest">Failed to send email.</p>}
                  </motion.div>
                </motion.div>
              )}

              {editingPhoto && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/90 backdrop-blur-md"
                >
                   <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white max-w-lg w-full p-10 space-y-8 shadow-2xl relative"
                  >
                    <button onClick={() => setEditingPhoto(null)} className="absolute top-6 right-6 text-muted hover:text-ink">
                      <X size={24} />
                    </button>

                    <div className="space-y-2">
                       <p className="text-accent text-[11px] font-bold uppercase tracking-[2px]">{lang === "sk" ? "Editácia záznamu" : "Edit Record"}</p>
                       <h3 className="text-2xl font-light tracking-tight">{editingPhoto.name}</h3>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Author</label>
                          <input 
                            type="text" 
                            value={editingPhoto.author}
                            onChange={e => setEditingPhoto({...editingPhoto, author: e.target.value})}
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Email</label>
                          <input 
                            type="email" 
                            value={editingPhoto.email}
                            onChange={e => setEditingPhoto({...editingPhoto, email: e.target.value})}
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Piece Name</label>
                          <input 
                            type="text" 
                            value={editingPhoto.name}
                            onChange={e => setEditingPhoto({...editingPhoto, name: e.target.value})}
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Category</label>
                          <select 
                            value={editingPhoto.category}
                            onChange={e => setEditingPhoto({...editingPhoto, category: e.target.value})}
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
                          >
                            {settings.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest">Description</label>
                          <textarea 
                            value={editingPhoto.description}
                            onChange={e => setEditingPhoto({...editingPhoto, description: e.target.value})}
                            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink h-32"
                          />
                       </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                       <button 
                        onClick={() => setEditingPhoto(null)} 
                        className="flex-1 py-3 border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-paper transition-all"
                       >
                         {lang === "sk" ? "Zrušiť" : "Cancel"}
                       </button>
                       <button 
                        onClick={() => updatePhoto(editingPhoto.id, {
                          author: editingPhoto.author,
                          email: editingPhoto.email,
                          name: editingPhoto.name,
                          category: editingPhoto.category,
                          description: editingPhoto.description
                        })}
                        disabled={isUpdating}
                        className="flex-1 py-3 bg-ink text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                       >
                         {isUpdating ? "..." : (lang === "sk" ? "Uložiť zmeny" : "Save Changes")}
                       </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {selectedPhoto && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/90 backdrop-blur-md"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-white max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col md:flex-row shadow-2xl"
                  >
                    <div className="md:w-3/5 bg-paper p-4 flex items-center justify-center">
                      <img 
                        src={`/uploads/${selectedPhoto.webPath || selectedPhoto.path}`} 
                        className="max-w-full max-h-[70vh] shadow-xl" 
                        alt="" 
                      />
                    </div>
                    <div className="md:w-2/5 p-10 space-y-8 flex flex-col justify-between">
                      <div className="space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-accent text-[11px] font-bold uppercase tracking-[2px] mb-1">{selectedPhoto.category}</p>
                            <h3 className="text-2xl font-light tracking-tight">{selectedPhoto.name}</h3>
                          </div>
                          <button onClick={() => setSelectedPhoto(null)} className="text-muted hover:text-ink">
                            <X size={24} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <User size={16} className="text-muted" />
                            <div>
                              <p className="text-[9px] text-muted uppercase font-bold tracking-widest">{lang === "sk" ? "Autor" : "Author"}</p>
                              <p className="text-sm font-bold">{selectedPhoto.author}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Mail size={16} className="text-muted" />
                            <div>
                              <p className="text-[9px] text-muted uppercase font-bold tracking-widest">Email</p>
                              <p className="text-sm">{selectedPhoto.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <ImageIcon size={16} className="text-muted" />
                            <div>
                              <p className="text-[9px] text-muted uppercase font-bold tracking-widest">{lang === "sk" ? "Dátum nahratia" : "Upload Date"}</p>
                              <p className="text-sm">{new Date(selectedPhoto.createdAt).toLocaleString(lang === "sk" ? "sk-SK" : "en-US")}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-border pt-6">
                          <p className="text-[9px] text-muted uppercase font-bold tracking-widest">{lang === "sk" ? "Popis / Príbeh" : "Description / Story"}</p>
                          <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{selectedPhoto.description || "No description provided."}</p>
                        </div>

                        {selectedPhoto.metadata && (
                          <div className="space-y-2 border-t border-border pt-6">
                             <p className="text-[9px] text-muted uppercase font-bold tracking-widest">EXIF / Technical</p>
                             <div className="grid grid-cols-2 gap-4">
                               {selectedPhoto.metadata.camera && (
                                 <div>
                                   <p className="text-[8px] text-muted uppercase font-bold">Camera</p>
                                   <p className="text-[10px] font-bold">{selectedPhoto.metadata.camera}</p>
                                 </div>
                               )}
                               {selectedPhoto.metadata.settings && (
                                 <div>
                                   <p className="text-[8px] text-muted uppercase font-bold">Settings</p>
                                   <p className="text-[10px] font-bold">{selectedPhoto.metadata.settings}</p>
                                 </div>
                               )}
                               {selectedPhoto.metadata.width && (
                                 <div>
                                   <p className="text-[8px] text-muted uppercase font-bold">Resolution</p>
                                   <p className="text-[10px] font-bold">{selectedPhoto.metadata.width} x {selectedPhoto.metadata.height}</p>
                                 </div>
                               )}
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-6 flex gap-4">
                        <a 
                          href={`/uploads/${selectedPhoto.originalPath}`} 
                          download 
                          className="flex-1 py-3 border border-ink text-ink text-center text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-white transition-all"
                        >
                          {lang === "sk" ? "Stiahnuť originál" : "Download Original"}
                        </a>
                        <button 
                          onClick={() => { setSelectedPhoto(null); deletePhoto(selectedPhoto.id); }}
                          className="px-6 py-3 bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title={lang === "sk" ? "Zmazať" : "Delete"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "evaluators" && (
          <div className="max-w-3xl space-y-12">
            <div className="border border-border p-8 space-y-6 bg-white">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted">
                {lang === "sk" ? "Pridať člena poroty" : "Add Jury Member"}
              </label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={newEvalName}
                  onChange={e => setNewEvalName(e.target.value)}
                  placeholder={lang === "sk" ? "Meno porotcu" : "Jury Name"}
                  className="flex-1 border border-border p-4 text-sm outline-none focus:border-ink"
                />
                <button 
                  onClick={createEvaluator}
                  className="px-8 py-4 bg-ink text-white text-[11px] font-bold uppercase tracking-[2px] shrink-0"
                >
                  {lang === "sk" ? "Generovať Link" : "Generate Link"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted border-b border-border pb-2">
                {lang === "sk" ? "Zápis poroty" : "Jury Registry"}
              </h3>
              <div className="divide-y divide-border border border-border bg-white text-xs">
                {evaluators.map(evalu => (
                  <div key={evalu.id} className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                      <p className="font-bold uppercase tracking-widest">{evalu.name}</p>
                      <p className="text-[9px] text-muted font-mono">{evalu.id}</p>
                    </div>
                    <button 
                      onClick={() => copyEvalLink(evalu.id)}
                      className={cn(
                        "px-6 py-2 text-[9px] uppercase font-bold tracking-widest border border-border transition-all",
                        copiedId === evalu.id ? "bg-accent text-white border-accent" : "hover:border-ink"
                      )}
                    >
                      {copiedId === evalu.id ? (lang === "sk" ? "Skopírované" : "Copied") : (lang === "sk" ? "Kopírovať Link" : "Copy Link")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-8 space-y-4 bg-white text-center">
      <p className="text-[11px] uppercase font-bold tracking-[2px] text-muted">{label}</p>
      <p className="text-5xl font-light tracking-tighter">{value}</p>
    </div>
  );
}
