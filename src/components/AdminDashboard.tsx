import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { BarChart3, Users, Image as ImageIcon, Link as LinkIcon, Plus, Copy, Check, Download, Trash2, Eye, Shield, Settings as SettingsIcon, Mail, UserPlus, Heart, Code, ExternalLink, X, User, LayoutGrid, List, Search, Edit2, TrendingUp, Activity, FileText, Zap, Upload, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { Photo, Evaluator } from "../types";
import { Lang, Settings } from "../App";

interface ContestSettings {
  contestNameSk: string;
  contestNameEn: string;
  museumNameSk: string;
  museumNameEn: string;
  edition: string;
  contestStatus: "submissions" | "review" | "judging" | "shortlist" | "results";
  submissionStart?: string;
  submissionEnd?: string;
  judgingStart?: string;
  judgingEnd?: string;
  categories: { id: string, nameSk: string, nameEn: string }[];
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
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [newEvalName, setNewEvalName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "photos" | "evaluators" | "embed" | "settings" | "stress">("stats");
  const [stressStatus, setStressStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [stressResults, setStressResults] = useState<{ count: number, details: any[] } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [settings, setSettings] = useState<ContestSettings>({
    contestNameSk: "",
    contestNameEn: "",
    museumNameSk: "",
    museumNameEn: "",
    contestYear: "",
    rulesSk: "",
    rulesEn: "",
    categories: [],
    debugMode: false,
    googleAnalyticsId: ""
  });

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotos(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllPhotos = () => {
    const ids = filteredPhotos.map(p => p.id);
    if (selectedPhotos.length === ids.length && ids.length > 0) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(ids);
    }
  };

  const deleteSelected = async () => {
    if (!selectedPhotos.length) return;
    if (!confirm(lang === "sk" ? `Naozaj chcete zmazať ${selectedPhotos.length} vybraných fotografií?` : `Do you really want to delete ${selectedPhotos.length} selected photos?`)) return;

    try {
      const res = await fetch("/api/admin/photos/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedPhotos })
      });
      if (res.ok) {
        setSelectedPhotos([]);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAll = async () => {
    if (!confirm(lang === "sk" ? "VAROVANIE: Naozaj chcete zmazať ÚPLNE VŠETKY fotografie v súťaži?" : "WARNING: Do you really want to delete ALL photos in the contest?")) return;

    try {
      const res = await fetch("/api/admin/photos/delete-all", { method: "POST" });
      if (res.ok) {
        setSelectedPhotos([]);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
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
  
  const filteredPhotos = useMemo(() => {
    return photos
      .filter(p => {
        const author = (p.author || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        const query = (searchQuery || "").toLowerCase();
        const matchesSearch = author.includes(query) || name.includes(query);
        const matchesCategory = photoFilter === "all" || p.category === photoFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (galleryView === "table") {
          return (b.averageScore || 0) - (a.averageScore || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [photos, photoFilter, searchQuery, galleryView]);

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

  const runStressTest = async () => {
    setStressStatus("uploading");
    setStressResults(null);
    try {
      const res = await fetch("/api/admin/stress-upload", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStressStatus("success");
        setStressResults(data);
        fetchData();
      } else {
        setStressStatus("error");
        alert(data.error || (lang === "sk" ? "Chyba pri importe" : "Import failed"));
      }
    } catch (e) {
      setStressStatus("error");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setStressStatus("uploading");
    setStressResults(null);
    const formData = new FormData();
    Array.from(e.target.files).forEach(file => {
      formData.append('photos', file);
    });
 
    try {
      const response = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
 
      if (response.ok) {
        setStressStatus("success");
        setStressResults(data);
        fetchData();
        e.target.value = '';
      } else {
        setStressStatus("error");
        alert(data.error || (lang === "sk" ? "Chyba pri uploade" : "Upload failed"));
      }
    } catch (err) {
      setStressStatus("error");
    }
  };

  const exportResults = () => {
    window.location.href = "/api/admin/export-results";
  };

  const fetchData = async () => {
    try {
      const [statsRes, photosRes, evalsRes, dashStatsRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/admin/photos"),
        fetch("/api/evaluators"),
        fetch("/api/admin/dashboard-stats")
      ]);
      
      const statsData = await (statsRes.ok ? statsRes.json() : Promise.resolve({}));
      const photosData = await (photosRes.ok ? photosRes.json() : Promise.resolve([]));
      const evalsData = await (evalsRes.ok ? evalsRes.json() : Promise.resolve([]));
      const dashStatsData = await (dashStatsRes.ok ? dashStatsRes.json() : Promise.resolve({}));

      setStats(statsData);
      setPhotos(Array.isArray(photosData) ? photosData : []);
      setEvaluators(evalsData);
      setDashboardStats(dashStatsData);
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
              { id: "stress", label: lang === "sk" ? "Stress Test" : "Stress Test", icon: Zap },
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
                  <label className="text-[10px] font-bold uppercase text-muted">Edition</label>
                  <input 
                    type="text" 
                    value={settings.edition}
                    onChange={e => setSettings({ ...settings, edition: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Contest Name (SK)</label>
                  <input 
                    type="text" 
                    value={settings.contestNameSk}
                    onChange={e => setSettings({ ...settings, contestNameSk: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Contest Name (EN)</label>
                  <input 
                    type="text" 
                    value={settings.contestNameEn}
                    onChange={e => setSettings({ ...settings, contestNameEn: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Museum Name (SK)</label>
                  <input 
                    type="text" 
                    value={settings.museumNameSk}
                    onChange={e => setSettings({ ...settings, museumNameSk: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Museum Name (EN)</label>
                  <input 
                    type="text" 
                    value={settings.museumNameEn}
                    onChange={e => setSettings({ ...settings, museumNameEn: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>

                {/* Date Ranges */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                  <div className="space-y-4">
                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted">Submission Period (Prihlášky)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase text-muted block">From / Od</label>
                        <input 
                          type="date" 
                          value={settings.submissionStart?.split('T')[0] || ""}
                          onChange={e => setSettings({ ...settings, submissionStart: e.target.value })}
                          className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase text-muted block">To / Do</label>
                        <input 
                          type="date" 
                          value={settings.submissionEnd?.split('T')[0] || ""}
                          onChange={e => setSettings({ ...settings, submissionEnd: e.target.value })}
                          className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted">Judging Period (Hodnotenie)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase text-muted block">From / Od</label>
                        <input 
                          type="date" 
                          value={settings.judgingStart?.split('T')[0] || ""}
                          onChange={e => setSettings({ ...settings, judgingStart: e.target.value })}
                          className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase text-muted block">To / Do</label>
                        <input 
                          type="date" 
                          value={settings.judgingEnd?.split('T')[0] || ""}
                          onChange={e => setSettings({ ...settings, judgingEnd: e.target.value })}
                          className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
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
                          categories: [...categories, { id: newId, nameSk: `Nová kategória ${newId}`, nameEn: `New Category ${newId}` }]
                        });
                      }}
                      className="text-[9px] font-bold uppercase text-accent flex items-center gap-1 hover:underline"
                    >
                      <Plus size={10} /> {lang === "sk" ? "Pridať kategóriu" : "Add Category"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(settings?.categories || []).map((cat, idx) => (
                      <div key={cat.id} className="p-4 bg-paper border border-border space-y-3 relative group">
                        <div className="flex gap-4">
                          <div className="w-16">
                            <label className="text-[8px] font-bold uppercase text-muted block mb-1">ID</label>
                            <input 
                              type="text" 
                              value={cat.id}
                              disabled
                              className="w-full p-2 border border-border bg-paper text-xs text-center opacity-50"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] font-bold uppercase text-muted block mb-1">Názov (SK)</label>
                            <input 
                              type="text" 
                              value={cat.nameSk || cat.name || ''}
                              onChange={e => {
                                const newCats = [...settings.categories];
                                newCats[idx].nameSk = e.target.value;
                                setSettings({ ...settings, categories: newCats });
                              }}
                              className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] font-bold uppercase text-muted block mb-1">Name (EN)</label>
                            <input 
                              type="text" 
                              value={cat.nameEn || ''}
                              onChange={e => {
                                const newCats = [...settings.categories];
                                newCats[idx].nameEn = e.target.value;
                                setSettings({ ...settings, categories: newCats });
                              }}
                              className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                            />
                          </div>
                          {(settings?.categories || []).length > 1 && (
                            <button 
                              onClick={() => setSettings({ ...settings, categories: settings.categories.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 p-2 text-muted hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/40">
                          <div>
                            <label className="text-[8px] font-bold uppercase text-muted block mb-1">{lang === "sk" ? "Min. znakov" : "Min Chars"}</label>
                            <input 
                              type="number" 
                              value={cat.minDesc || 0}
                              onChange={e => {
                                const newCats = [...settings.categories];
                                newCats[idx].minDesc = parseInt(e.target.value) || 0;
                                setSettings({ ...settings, categories: newCats });
                              }}
                              className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase text-muted block mb-1">{lang === "sk" ? "Max. znakov" : "Max Chars"}</label>
                            <input 
                              type="number" 
                              value={cat.maxDesc || 5000}
                              onChange={e => {
                                const newCats = [...settings.categories];
                                newCats[idx].maxDesc = parseInt(e.target.value) || 5000;
                                setSettings({ ...settings, categories: newCats });
                              }}
                              className="w-full p-2 border border-border bg-white text-xs outline-none focus:border-ink"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <input 
                              type="checkbox" 
                              id={`req-${cat.id}`}
                              checked={cat.descRequired}
                              onChange={e => {
                                const newCats = [...settings.categories];
                                newCats[idx].descRequired = e.target.checked;
                                setSettings({ ...settings, categories: newCats });
                              }}
                              className="w-4 h-4 rounded border-border text-ink focus:ring-ink"
                            />
                            <label htmlFor={`req-${cat.id}`} className="text-[8px] font-bold uppercase text-muted cursor-pointer select-none">
                              {lang === "sk" ? "Povinný príbeh" : "Story Required"}
                            </label>
                          </div>
                        </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted">Watermark Font Size (px)</label>
                    <input 
                      type="number" 
                      value={settings.watermarkFontSize || 24}
                      onChange={e => setSettings({ ...settings, watermarkFontSize: parseInt(e.target.value) || 24 })}
                      className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted">Watermark Color (RGBA/Hex)</label>
                    <input 
                      type="text" 
                      value={settings.watermarkColor || "rgba(255,255,255,0.4)"}
                      onChange={e => setSettings({ ...settings, watermarkColor: e.target.value })}
                      className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                      placeholder="rgba(255,255,255,0.4)"
                    />
                  </div>
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
          <div className="space-y-12">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-paper border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Total Photos</p>
                  <ImageIcon size={16} className="text-muted" />
                </div>
                <p className="text-3xl font-light">{dashboardStats?.totalPhotos || stats.total || 0}</p>
              </div>
              <div className="p-6 bg-paper border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Authors</p>
                  <Users size={16} className="text-muted" />
                </div>
                <p className="text-3xl font-light">{dashboardStats?.uniqueAuthors || stats.uniqueEmails || 0}</p>
              </div>
              <div className="p-6 bg-paper border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Public Votes</p>
                  <Heart size={16} className="text-muted" />
                </div>
                <p className="text-3xl font-light">{dashboardStats?.totalPublicVotes || 0}</p>
              </div>
              <div className="p-6 bg-paper border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Daily Access</p>
                  <Activity size={16} className="text-muted" />
                </div>
                <p className="text-3xl font-light">{dashboardStats?.dailyAccess || 0}</p>
              </div>
            </div>

            {/* Daily Traffic Chart */}
            <div className="p-8 bg-paper border border-border space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-[2px]">Aktivita za posledných 14 dní</h4>
                  <p className="text-[9px] text-muted uppercase font-medium">Interaktívny prehľad návštevnosti a verejného hlasovania</p>
                </div>
                <div className="flex gap-4 text-[9px] uppercase font-bold text-muted">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-ink rounded-xs" /> Návštevy</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-accent rounded-xs" /> Hodnotenia</div>
                </div>
              </div>
              
              <div className="h-64 flex items-end gap-1.5 md:gap-3 px-2 border-b border-border/30 relative">
                {/* Y-Axis helper lines */}
                {[0, 25, 50, 75, 100].map(line => (
                  <div key={line} className="absolute left-0 right-0 border-t border-border/10 pointer-events-none" style={{ bottom: `${line}%` }} />
                ))}

                {(dashboardStats?.activity || []).map((data: any, i: number) => {
                  const maxVal = Math.max(...dashboardStats.activity.map((d: any) => Math.max(d.visits, d.votes)), 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-ink text-white text-[9px] p-2 opacity-0 group-hover:opacity-100 transition-all rounded shadow-xl z-20 pointer-events-none whitespace-nowrap">
                        <p className="font-bold border-b border-white/20 pb-1 mb-1">{data.day}</p>
                        <p className="flex justify-between gap-4"><span>Visits:</span> <b>{data.visits}</b></p>
                        <p className="flex justify-between gap-4"><span>Votes:</span> <b>{data.votes}</b></p>
                      </div>

                      {/* Bars */}
                      <div className="flex items-end gap-[2px] h-full">
                        <div 
                          className="flex-1 bg-ink/20 group-hover:bg-ink transition-colors rounded-t-[1px]" 
                          style={{ height: `${(data.visits / maxVal) * 100}%` }} 
                        />
                        <div 
                          className="flex-1 bg-accent/20 group-hover:bg-accent transition-colors rounded-t-[1px]" 
                          style={{ height: `${(data.votes / maxVal) * 100}%` }} 
                        />
                      </div>
                      
                      {/* Label - show only every 3rd day or first/last to avoid clutter */}
                      {(i === 0 || i === 13 || i % 3 === 0) && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-muted font-bold uppercase rotate-45 origin-left whitespace-nowrap">
                          {data.day.split('-').slice(1).join('/')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Public Ranking Mini-View */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">
                  {lang === "sk" ? "Cena verejnosti - Priebežný rebríček" : "Public Choice - Current Standings"}
                </h3>
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

            {/* Export Actions */}
            <div className="flex flex-col md:flex-row gap-6 p-8 bg-ink text-white items-center justify-between rounded-sm">
              <div className="space-y-2 text-center md:text-left">
                <h4 className="text-sm font-bold uppercase tracking-[3px]">Exportovať výsledky súťaže</h4>
                <p className="text-[11px] opacity-70 max-w-md">
                  Kompletná databáza fotiek, autorov, bodového hodnotenia a poradia. Formát CSV je kompatibilný s Excelom a Google Sheets.
                </p>
              </div>
              <button 
                onClick={exportResults}
                className="flex items-center gap-3 px-10 py-4 bg-white text-ink text-[11px] font-bold uppercase tracking-widest hover:bg-paper transition-colors"
              >
                <Download size={16} />
                Download CSV
              </button>
            </div>
          </div>
        )}

        {activeTab === "stress" && (
          <div className="max-w-3xl space-y-10">
            <div className="space-y-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2 flex items-center gap-2">
                <Zap size={14} className="text-ink" />
                Stress Test & Demo Data
              </h3>
              
              <div className="p-8 bg-paper border border-border space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold uppercase tracking-widest">Hromadný import testovacích dát</h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Tento nástroj automaticky načíta fotografie z adresára <code className="bg-muted px-1 rounded">/demo</code>. 
                    Fotky začínajúce na <strong>A*</strong> budú priradené do kategórie A, fotky na <strong>B*</strong> do kategórie B.
                    Budú vytvorené náhodné mená autorov pre simuláciu reálnej prevádzky.
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={runStressTest}
                    disabled={stressStatus === "uploading"}
                    className="px-8 py-4 bg-ink text-white text-[11px] font-bold uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {stressStatus === "uploading" ? (
                      <>
                        <Activity className="animate-spin" size={14} />
                        Spracovávam...
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Spustiť Stress Test
                      </>
                    )}
                  </button>
                  
                  {stressStatus === "success" && (
                    <p className="text-green-600 text-[10px] font-bold uppercase flex items-center gap-1">
                      <Check size={14} /> Import dokončený
                    </p>
                  )}
                  {stressStatus === "error" && (
                    <p className="text-red-600 text-[10px] font-bold uppercase flex items-center gap-1">
                      <X size={14} /> Chyba pri importe
                    </p>
                  )}
                </div>
              </div>

              <div className="p-8 border-2 border-dashed border-border bg-paper/50 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-white border border-border flex items-center justify-center text-muted">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink">{lang === "sk" ? "Priamy hromadný upload" : "Direct Bulk Upload"}</p>
                  <p className="text-[10px] text-muted uppercase tracking-tight">
                    {lang === "sk" ? "Vyberte viacero súborov naraz z vášho počítača" : "Select multiple files at once from your computer"}
                  </p>
                </div>
                <input 
                   type="file" 
                   multiple 
                   accept="image/*"
                   onChange={handleBulkUpload}
                   className="hidden" 
                   id="bulk-upload-input"
                   disabled={stressStatus === "uploading"}
                />
                <label 
                  htmlFor="bulk-upload-input"
                  className={cn(
                    "px-6 py-3 bg-ink text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:opacity-90 transition-all",
                    stressStatus === "uploading" && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {stressStatus === "uploading" ? (lang === "sk" ? "Nahrávam..." : "Uploading...") : (lang === "sk" ? "Vybrať fotky k testovaniu" : "Select Photos for Testing")}
                </label>
              </div>

              {stressResults && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">Aktivita spracovania</h4>
                    <span className="text-[10px] font-bold text-ink uppercase">{stressResults.count} {lang === "sk" ? "súborov spracovaných" : "files processed"}</span>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto border border-border bg-paper/30 divide-y divide-border/50">
                    {stressResults?.details?.map((res: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-4 text-[10px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {res.status === "success" ? (
                            <div className="w-4 h-4 bg-green-100 text-green-700 flex items-center justify-center rounded-full shrink-0">
                              <Check size={10} />
                            </div>
                          ) : (
                            <div className="w-4 h-4 bg-red-100 text-red-700 flex items-center justify-center rounded-full shrink-0">
                              <X size={10} />
                            </div>
                          )}
                          <span className="font-mono truncate opacity-80">{res.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {res.watermark && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-[2px] font-bold uppercase text-[8px] tracking-tight",
                              res.watermark === "success" ? "bg-green-50 text-green-600 border border-green-200" : "bg-yellow-50 text-yellow-600 border border-yellow-200"
                            )}>
                              {lang === "sk" ? "Vodoznak" : "Watermark"}: {res.watermark}
                            </span>
                          )}
                          {res.status === "error" && (
                            <span className="text-red-600 font-bold uppercase italic text-[9px]">{res.error}</span>
                          )}
                          <span className={cn(
                            "font-bold uppercase tracking-widest text-[9px]",
                            res.status === "success" ? "text-green-600" : "text-red-600"
                          )}>
                            {res.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => { setStressResults(null); setStressStatus("idle"); }}
                    className="text-[9px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors flex items-center gap-2"
                  >
                    {lang === "sk" ? "Vymazať výpis" : "Clear Log"}
                  </button>
                </div>
              )}
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
                    {lang === "sk" ? cat.nameSk : cat.nameEn}
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
              </div>
            </div>

            {/* Bulk Actions Bar */}
            <div className={cn(
              "sticky top-4 z-30 flex items-center justify-between bg-ink text-white p-4 transition-all duration-300 shadow-2xl",
              selectedPhotos.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none h-0 p-0 overflow-hidden"
            )}>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full">
                  {selectedPhotos.length} {lang === "sk" ? "vybraných" : "selected"}
                </span>
                <button 
                  onClick={selectAllPhotos}
                  className="text-[10px] font-bold uppercase tracking-widest hover:text-accent transition-colors"
                >
                  {selectedPhotos.length === filteredPhotos.length ? (lang === "sk" ? "Zrušiť výber" : "Deselect All") : (lang === "sk" ? "Vybrať všetko" : "Select All")}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={deleteSelected}
                  className="px-4 py-2 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-2"
                >
                  <Trash2 size={14} /> {lang === "sk" ? "Zmazať vybrané" : "Delete Selected"}
                </button>
                <button 
                  onClick={deleteAll}
                  className="px-4 py-2 border border-white/30 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-ink transition-all flex items-center gap-2"
                >
                  <AlertTriangle size={14} /> {lang === "sk" ? "Zmazať ÚPLNE všetko" : "Delete ABSOLUTELY All"}
                </button>
                <button 
                  onClick={() => setSelectedPhotos([])}
                  className="p-2 hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {galleryView === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredPhotos.map(photo => (
                  <div 
                    key={photo.id} 
                    className={cn(
                      "aspect-square bg-paper border relative group overflow-hidden cursor-pointer transition-all",
                      selectedPhotos.includes(photo.id) ? "border-ink ring-2 ring-ink ring-inset" : "border-border"
                    )}
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    {/* Bulk Select Checkbox */}
                    <div 
                      className={cn(
                        "absolute top-2 left-2 z-20 w-5 h-5 border-2 transition-all flex items-center justify-center",
                        selectedPhotos.includes(photo.id) ? "bg-ink border-ink text-white" : "bg-white/80 border-white opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectPhoto(photo.id);
                      }}
                    >
                      {selectedPhotos.includes(photo.id) && <Check size={14} strokeWidth={4} />}
                    </div>
                    <img 
                      src={`/uploads/${photo.webPath || photo.path}`} 
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110" 
                      alt={photo.name} 
                    />
                    <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye size={24} className="text-white" />
                    </div>
                    <div className="absolute bottom-11 left-2 px-1.5 py-0.5 bg-ink/60 text-white text-[7px] font-bold uppercase tracking-widest backdrop-blur-sm">
                      {(settings?.categories || []).find(c => c.id === photo.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || photo.category}
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
                      <th className="p-4 w-10">
                        <div 
                          onClick={selectAllPhotos}
                          className={cn(
                            "w-4 h-4 border-2 cursor-pointer flex items-center justify-center transition-all",
                            selectedPhotos.length === filteredPhotos.length && filteredPhotos.length > 0 ? "bg-ink border-ink text-white" : "bg-white border-border hover:border-ink"
                          )}
                        >
                          {selectedPhotos.length === filteredPhotos.length && filteredPhotos.length > 0 && <Check size={12} strokeWidth={4} />}
                        </div>
                      </th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted w-20">{lang === "sk" ? "Foto" : "Photo"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Dielo / Autor" : "Piece / Author"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Krátky list" : "Shortlist"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted">{lang === "sk" ? "Bodovanie" : "Scoring"}</th>
                      <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-muted text-right">{lang === "sk" ? "Akcie" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPhotos.map(photo => (
                      <tr key={photo.id} className={cn("hover:bg-paper/50 transition-colors group", photo.shortlisted && "bg-accent/5", selectedPhotos.includes(photo.id) && "bg-ink/5")}>
                        <td className="p-4">
                          <div 
                            onClick={() => toggleSelectPhoto(photo.id)}
                            className={cn(
                              "w-4 h-4 border-2 cursor-pointer flex items-center justify-center transition-all",
                              selectedPhotos.includes(photo.id) ? "bg-ink border-ink text-white" : "bg-white border-border hover:border-ink"
                            )}
                          >
                            {selectedPhotos.includes(photo.id) && <Check size={12} strokeWidth={4} />}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="w-12 h-12 bg-paper border border-border overflow-hidden cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                            <img src={`/uploads/${photo.webPath || photo.path}`} className="w-full h-full object-cover" alt="" loading="lazy" />
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
                            {settings.categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {lang === "sk" ? cat.nameSk : cat.nameEn}
                              </option>
                            ))}
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
                            <p className="text-accent text-[11px] font-bold uppercase tracking-[2px] mb-1">
                              {settings.categories.find(c => c.id === selectedPhoto.category)?.[lang === "sk" ? "nameSk" : "nameEn"] || selectedPhoto.category}
                            </p>
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
