import { useState, useEffect } from "react";
import { Shield, Check, Loader2, Lock } from "lucide-react";
import { motion } from "motion/react";
import { Lang } from "../App";

export default function AdminSetup({ lang }: { lang: Lang }) {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setStatus("error");
      setError(lang === "sk" ? "Neplatný odkaz" : "Invalid link");
      return;
    }
    setToken(t);
    validateToken(t);
  }, [lang]);

  const validateToken = async (t: string) => {
    try {
      const res = await fetch(`/api/admin/invite/${t}`);
      if (res.ok) {
        const data = await res.json();
        setEmail(data.email);
        setStatus("ready");
      } else {
        setStatus("error");
        setError(lang === "sk" ? "Pozvánka je neplatná alebo expirovala" : "Invitation is invalid or has expired");
      }
    } catch (e) {
      setStatus("error");
    }
  };

  const handleSetup = async () => {
    if (!password || password !== confirmPass) {
      setError(lang === "sk" ? "Heslá sa nezhodujú" : "Passwords do not match");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/admin/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => window.location.href = "/", 3000);
      } else {
        setStatus("error");
        setError(lang === "sk" ? "Chyba pri ukladaní" : "Error saving password");
      }
    } catch (e) {
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 border border-border bg-white text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-light uppercase tracking-tight">
          {lang === "sk" ? "Úspešne nastavené" : "Setup Successful"}
        </h2>
        <p className="text-[11px] text-muted uppercase tracking-widest leading-loose">
          {lang === "sk" 
            ? "Váš administrátorský účet je pripravený. Budete presmerovaný na prihlásenie." 
            : "Your admin account is ready. You will be redirected to login."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 border border-border bg-white space-y-8">
      <div className="space-y-2 text-center">
        <Shield size={32} className="mx-auto text-accent mb-4" />
        <h2 className="text-xl font-bold uppercase tracking-widest">
          {lang === "sk" ? "Nastavenie administrátora" : "Admin Setup"}
        </h2>
        <p className="text-[11px] text-muted uppercase tracking-tight">
          {lang === "sk" ? `Nastavte si heslo pre účet ${email}` : `Set a password for account ${email}`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-muted ml-1">E-mail</label>
          <input 
            type="text" 
            value={email}
            readOnly
            className="w-full p-3 border border-border bg-paper text-sm outline-none opacity-60 cursor-not-allowed"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-muted ml-1">{lang === "sk" ? "Nové heslo" : "New Password"}</label>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-muted ml-1">{lang === "sk" ? "Potvrdiť heslo" : "Confirm Password"}</label>
          <input 
            type="password" 
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            className="w-full p-3 border border-border bg-paper text-sm outline-none focus:border-ink"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-red-500 text-[10px] uppercase font-bold text-center">{error}</p>}

        <button 
          onClick={handleSetup}
          disabled={status === "saving" || status === "error"}
          className="w-full py-4 bg-ink text-white font-bold uppercase tracking-[3px] text-[11px] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "..." : (lang === "sk" ? "Dokončiť nastavenie" : "Complete Setup")}
        </button>
      </div>
    </div>
  );
}
