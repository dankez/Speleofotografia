import { useState, useEffect, ChangeEvent } from "react";
import { BarChart3, Users, Image as ImageIcon, Link as LinkIcon, Plus, Copy, Check, Download, Trash2, Eye, Shield, Settings, Mail, UserPlus, Heart } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { Photo, Evaluator } from "../types";
import { Lang } from "../App";

interface ContestSettings {
  contestName: string;
  museumName: string;
  edition: string;
  catA: string;
  catB: string;
  rulesSk: string;
  rulesEn: string;
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
  const [stats, setStats] = useState({ total: 0, catA: 0, catB: 0 });
  const [newEvalName, setNewEvalName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "photos" | "evaluators" | "settings">("stats");
  const [settings, setSettings] = useState<ContestSettings>({
    contestName: "",
    museumName: "",
    edition: "",
    catA: "",
    catB: "",
    rulesSk: "",
    rulesEn: "",
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
            { id: "settings", label: lang === "sk" ? "Nastavenia" : "Settings", icon: Settings },
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
                  <label className="text-[10px] font-bold uppercase text-muted">Contest Name</label>
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Category A Name</label>
                  <input 
                    type="text" 
                    value={settings.catA}
                    onChange={e => setSettings({ ...settings, catA: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted">Category B Name</label>
                  <input 
                    type="text" 
                    value={settings.catB}
                    onChange={e => setSettings({ ...settings, catB: e.target.value })}
                    className="w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink"
                  />
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
                    {adminList.map(adm => (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label={lang === "sk" ? "Celkom fotografií" : "Total Photos"} value={stats.total} />
              <StatCard label={lang === "sk" ? "Kategória A" : "Category A"} value={stats.catA} />
              <StatCard label={lang === "sk" ? "Kategória B" : "Category B"} value={stats.catB} />
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
                <a href="/data/registrations.csv" download className="px-10 py-4 bg-ink text-white text-[11px] uppercase font-bold tracking-[2px] transition-all hover:opacity-90">
                  {lang === "sk" ? "Prihlášky / CSV" : "Entries / CSV"}
                </a>
                <a href="/data/ratings.csv" download className="px-10 py-4 border border-ink text-ink text-[11px] uppercase font-bold tracking-[2px] transition-all hover:bg-ink hover:text-white">
                  {lang === "sk" ? "Hodnotenie / CSV" : "Ratings / CSV"}
                </a>
                <a href="/api/admin/export/public-votes" download className="px-10 py-4 border border-accent text-accent text-[11px] uppercase font-bold tracking-[2px] transition-all hover:bg-accent hover:text-white">
                  {lang === "sk" ? "Verejnosť / CSV" : "Public / CSV"}
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

        {activeTab === "photos" && (
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className="aspect-square bg-ink border border-border relative group overflow-hidden">
                <img 
                  src={`/uploads/${photo.webPath || photo.path}`} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300" 
                  alt={photo.name} 
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-ink/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{photo.category}</p>
                      <p className="text-[11px] text-white font-bold tracking-tight line-clamp-1 truncate">{photo.name}</p>
                      {photo.author && <p className="text-[9px] text-white/40 uppercase font-bold truncate">{photo.author}</p>}
                    </div>
                    <button 
                      onClick={() => deletePhoto(photo.id)}
                      className="text-red-400 hover:text-red-500 transition-colors p-1"
                      title={lang === "sk" ? "Zmazať" : "Delete"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Heart size={8} className="text-accent fill-accent" />
                    <span className="text-[8px] font-bold text-white">{publicResults[photo.id] || 0} hlasov</span>
                  </div>
                  {photo.metadata?.camera && (
                    <p className="text-[8px] text-accent font-bold mt-1 truncate">{photo.metadata.camera}</p>
                  )}
                  {photo.metadata?.settings && (
                    <p className="text-[7px] text-white/30 font-mono mt-0.5 truncate">{photo.metadata.settings}</p>
                  )}
                </div>
              </div>
            ))}
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
