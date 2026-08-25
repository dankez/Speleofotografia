import { useState, useRef, ChangeEvent, useMemo, useEffect, DragEvent } from "react";
import { Upload, X, Check, Loader2, Plus, Info, AlertTriangle, Instagram, Mail, MapPin, User, FileText, Trophy, Globe, CheckCircle2, FlaskConical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/src/lib/utils";
import type { PhotoInfo, Registration } from "../types";
import { Lang, Settings } from "../App";

export default function RegistrationForm({ lang, settings }: { lang: Lang, settings: Settings | null }) {
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [existingCounts, setExistingCounts] = useState<Record<string, number>>({});
  const [debugLoading, setDebugLoading] = useState(false);
  const [publicStats, setPublicStats] = useState<{ totalPhotos: number; uniqueAuthors: number; byCategory: Record<string, number>; totalVotes: number } | null>(null);

  const isSubmissionClosed = useMemo(() => {
    if (!settings) return false;
    if (settings.contestStatus && settings.contestStatus !== "submissions") return true;
    if (settings.submissionEnd) {
      const end = new Date(settings.submissionEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date() > end) return true;
    }
    return false;
  }, [settings]);

  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setPublicStats(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings?.submissionEnd) return;
    
    const end = new Date(settings.submissionEnd);
    end.setHours(23, 59, 59, 999);

    const updateTimer = () => {
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [settings?.submissionEnd]);

  const generateTestData = async () => {
    if (!settings?.debugMode) return;
    setDebugLoading(true);
    try {
      const res = await fetch("/api/admin/generate-test-data", { method: "POST" });
      if (res.ok) {
        setSuccess(true);
      } else {
        alert("Failed to generate test data");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDebugLoading(false);
    }
  };
  
  const [formData, setFormData] = useState<Omit<Registration, "photos">>({
    author: "",
    email: "",
    instagram: "",
    webpage: "",
    address: "",
    gdprConsent: false,
    rulesConsent: false,
  });

  // Auto-save draft logic
  useEffect(() => {
    const saved = localStorage.getItem("speleo_registration_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Draft load error", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("speleo_registration_draft", JSON.stringify(formData));
  }, [formData]);

  const isValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    const req = settings?.fieldRequirements;
    
    return {
      author: !req?.author || formData.author.length > 2,
      email: !req?.email || emailRegex.test(formData.email),
      instagram: !req?.instagram || (formData.instagram.length > 1 && formData.instagram.startsWith("@")),
      webpage: !formData.webpage || urlRegex.test(formData.webpage),
      address: !req?.address || formData.address.length > 5,
      gdpr: formData.gdprConsent,
      rules: formData.rulesConsent,
    };
  }, [formData, settings]);

  useEffect(() => {
    if (isValid.email) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/check-uploads?email=${encodeURIComponent(formData.email)}`);
          if (!res.ok) throw new Error("Network response was not ok");
          const data = await res.json();
          setExistingCounts(data || {});
        } catch (e) {
          console.error("Error checking existing uploads", e);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setExistingCounts({});
    }
  }, [formData.email, isValid.email]);

  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    sk: {
      personalInfo: "01 Autor / Personal Info",
      fullName: "Autor / Full Name *",
      email: "Email *",
      address: "Korešpondenčná Adresa *",
      instagram: "Instagram",
      webpage: "Webstránka Autora (voliteľné)",
      consentTitle: "Súhlas so spracovaním údajov",
      consentText: "Súhlasím so zverejnením fotografií a spracovaním osobných údajov pre potreby súťaže (GDPR). Súhlas platí 5 rokov.",
      photosTitle: "02 Diela / Photos",
      uploadTitle: "Nahrávanie fotografií",
      uploadNote: "Min. 300 dpi, min. 1200px krátka strana, max. 12MB. Pomenujte podľa kategórie.",
      uploadBtn: "Nahrať",
      detailsTitle: "Detaily vybranej fotografie",
      photoName: "Názov diela",
      photoDesc: "Popis / Príbeh fotografie...",
      catA: "Kat A - Krása",
      catB: "Kat B - Moment",
      submit: "Odoslať prihlášku / Submit",
      successTitle: "Prihláška úspešne odoslaná",
      successText: `Ďakujeme za vašu účasť - ${settings?.contestNameSk || "Speleofotografia 2026"}`,
      newForm: "Nová prihláška / New Form",
      errorEmpty: "Vyplňte všetky povinné polia a nahrajte aspoň jednu fotku.",
      errorLimit: `Do každej kategórie môžete zaslať maximálne ${settings?.maxPhotosPerCategory || 5} fotografií.`,
    },
    en: {
      personalInfo: "01 Author / Personal Info",
      fullName: "Author / Full Name *",
      email: "Email *",
      address: "Correspondence Address *",
      instagram: "Instagram",
      webpage: "Author Webpage (optional)",
      consentTitle: "Data Processing Consent",
      consentText: "I agree with the publication of photos and the processing of personal data for the needs of the competition (GDPR). Consent is valid for 5 years.",
      rulesConsentText: "I agree with the competition rules and confirm that I am the author of the submitted works.",
      photosTitle: "02 Works / Photos",
      uploadTitle: "Photo Upload",
      uploadNote: "Min. 300 dpi, min. 1200px short side, max. 12MB. Name according to category.",
      uploadBtn: "Upload",
      detailsTitle: "Selected Photo Details",
      photoName: "Title of work",
      photoDesc: "Description / Story of the photo...",
      catA: "Cat A - Beauty",
      catB: "Cat B - Moment",
      submit: "Submit Application",
      successTitle: "Application Submitted Successfully",
      successText: `Thank you for your participation - ${settings?.contestNameEn || "Speleophotography 2026"}`,
      newForm: "New Application",
      errorEmpty: "Please fill in all required fields and upload at least one photo.",
      errorLimit: `You can submit a maximum of ${settings?.maxPhotosPerCategory || 5} photos per category.`,
      errorConsent: "You must agree to GDPR and competition rules.",
    }
  }[lang];

  const handleFiles = (files: File[], category?: string) => {
    const newPhotos: PhotoInfo[] = files.map(f => {
      return {
        name: f.name.split(".")[0],
        category: category || (settings?.categories?.[0]?.id || "A"),
        description: "",
        file: f,
        previewUrl: URL.createObjectURL(f)
      };
    });

    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, category?: string) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    handleFiles(files, category);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files as FileList);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      if (newPhotos[index].previewUrl) URL.revokeObjectURL(newPhotos[index].previewUrl!);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  };

  const updatePhotoInfo = (index: number, updates: Partial<PhotoInfo>) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      newPhotos[index] = { ...newPhotos[index], ...updates };
      return newPhotos;
    });
  };

  // Wizard state for interactive completion modal
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<"author" | "photos" | "consents">("author");

  const missingAuthorFields = useMemo(() => {
    const list: { id: string; label: string; type: string; placeholder: string; isMissing: boolean }[] = [];
    const req = settings?.fieldRequirements;
    if (req?.author && !isValid.author) {
      list.push({ id: "author", label: lang === "sk" ? "Meno a priezvisko autor (min. 3 znaky)" : "Full Name (min. 3 chars)", type: "text", placeholder: "napr. Ján Slovák", isMissing: true });
    }
    if (req?.email && !isValid.email) {
      list.push({ id: "email", label: lang === "sk" ? "Platná e-mailová adresa" : "Valid Email Address", type: "email", placeholder: "email@example.sk", isMissing: true });
    }
    if (req?.address && !isValid.address) {
      list.push({ id: "address", label: lang === "sk" ? "Korešpondenčná adresa (min. 5 znakov)" : "Address (min. 5 chars)", type: "text", placeholder: "Ulica, PSČ, Mesto, Štát", isMissing: true });
    }
    if (req?.instagram && !isValid.instagram) {
      list.push({ id: "instagram", label: lang === "sk" ? "Instagram účet (začínajúci @)" : "Instagram handle (starting with @)", type: "text", placeholder: "@meno", isMissing: true });
    }
    return list;
  }, [settings, isValid, lang]);

  const invalidPhotos = useMemo(() => {
    return photos.map((p, idx) => {
      const catSet = settings?.categories?.find(c => c.id === p.category);
      const pMin = catSet?.minDesc || 0;
      const pMax = catSet?.maxDesc || 5000;
      const pReq = catSet?.descRequired;
      const len = p.description ? p.description.length : 0;
      const isMissing = Boolean((pReq && len === 0) || len < pMin || len > pMax);
      return {
        idx,
        photo: p,
        catName: lang === "sk" ? catSet?.nameSk || p.category : catSet?.nameEn || p.category,
        minDesc: pMin,
        maxDesc: pMax,
        descRequired: pReq,
        isMissing
      };
    }).filter(item => item.isMissing);
  }, [photos, settings, lang]);

  const missingConsents = useMemo(() => {
    const list: string[] = [];
    if (!formData.gdprConsent) list.push(lang === "sk" ? "Súhlas so spracovaním údajov (GDPR)" : "GDPR Consent");
    if (!formData.rulesConsent) list.push(lang === "sk" ? "Súhlas s pravidlami a vyhlásenie autorstva" : "Agreement with rules and authorship declaration");
    return list;
  }, [formData, lang]);

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  const req = settings?.fieldRequirements;

  const handleSubmit = async () => {
    const errors: string[] = [];

    if (req?.author && formData.author.length < 3) errors.push(lang === "sk" ? "Meno autora je príliš krátke alebo chýba" : "Author name is too short or missing");
    if (req?.email && !isValid.email) errors.push(lang === "sk" ? "Neplatný email" : "Invalid email");
    if (req?.address && formData.address.length < 5) errors.push(lang === "sk" ? "Adresa je príliš krátka" : "Address is too short");
    if (req?.instagram && !isValid.instagram) errors.push(lang === "sk" ? "Instagram by mal začínať @ a byť dlhší" : "Instagram should start with @ and be longer");
    
    if (!formData.gdprConsent || !formData.rulesConsent) {
      errors.push(lang === "sk" ? "Je potrebné odsúhlasiť GDPR a pravidlá súťaže." : "You must agree to GDPR and competition rules.");
    }

    if (photos.length === 0) {
      errors.push(lang === "sk" ? "Nahrajte aspoň jednu fotografiu" : "Upload at least one photo");
    }

    const catCounts: Record<string, number> = {};
    photos.forEach(p => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    });

    const maxPhotos = parseInt(settings?.maxPhotosPerCategory || "5");
      (settings?.categories || []).forEach(cat => {
      const existing = existingCounts[cat.id] || 0;
      const current = catCounts[cat.id] || 0;
      const catDisplayName = lang === "sk" ? cat.nameSk : cat.nameEn;
      if (existing + current > maxPhotos) {
        if (existing > 0) {
          errors.push(`${lang === "sk" ? "Limit prekročený. Už ste nahrali" : "Limit exceeded. You already uploaded"} ${existing} ${lang === "sk" ? "fotiek v kategórii" : "photos in category"} ${catDisplayName || cat.id}. ${lang === "sk" ? "Môžete pridať už len" : "You can only add"} ${maxPhotos - existing}.`);
        } else {
          errors.push(`${lang === "sk" ? "Limit prekročený v kategorii" : "Limit exceeded in category"} ${catDisplayName || cat.id} (${current}/${maxPhotos})`);
        }
      }
    });
    
    photos.forEach((p, idx) => {
      const catSet = settings?.categories?.find(c => c.id === p.category);
      const pMin = catSet?.minDesc || 0;
      const pMax = catSet?.maxDesc || 5000;
      const pReq = catSet?.descRequired;
      const photoLabel = `#${idx + 1}`;

      if (pReq && (!p.description || p.description.trim().length === 0)) {
        errors.push(`${lang === "sk" ? "Príbeh je povinný pre fotografiu" : "Story is required for photo"} ${photoLabel}`);
      } else if (p.description.length < pMin) {
        errors.push(`${lang === "sk" ? "Príbeh k fotografii" : "Story for photo"} ${photoLabel} ${lang === "sk" ? "je príliš krátky" : "is too short"} (${p.description.length}/${pMin} ${lang === "sk" ? "znakov" : "chars"})`);
      }
      
      if (p.description.length > pMax) {
        errors.push(`${lang === "sk" ? "Príbeh k fotografii" : "Story for photo"} ${photoLabel} ${lang === "sk" ? "je príliš dlhý" : "is too long"} (${p.description.length}/${pMax} ${lang === "sk" ? "znakov" : "chars"})`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      if (missingAuthorFields.length > 0) {
        setWizardStep("author");
      } else if (invalidPhotos.length > 0 || photos.length === 0) {
        setWizardStep("photos");
      } else {
        setWizardStep("consents");
      }
      setShowWizard(true);
      return;
    }

    setLoading(true);
    setValidationErrors([]);
    setError(null);

    // Spoločné polia formulára (bez fotiek)
    const commonFields = {
      author: formData.author,
      email: formData.email,
      instagram: formData.instagram,
      webpage: formData.webpage || "",
      address: formData.address,
      gdprConsent: String(formData.gdprConsent),
      rulesConsent: String(formData.rulesConsent),
    };

    try {
      let uploadedCount = 0;
      let lastError = "";

      // Každú fotku pošleme v samostatnom requeste – obíde limit max_file_uploads na serveri
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.file) continue;

        const data = new FormData();
        Object.entries(commonFields).forEach(([k, v]) => data.append(k, v));

        // photoInfo iba pre TÚTO jednu fotku
        const pInfo = [{
          name: p.name || p.file.name.split(".")[0] || "Untitled",
          category: p.category,
          description: p.description,
        }];
        data.append("photoInfo", JSON.stringify(pInfo));
        data.append("photos", p.file);

        const res = await fetch("/api/register", {
          method: "POST",
          body: data,
        });
        const result = await res.json();
        if (result.success) {
          uploadedCount++;
        } else {
          lastError = result.error || "Chyba pri odosielaní";
        }
      }

      if (uploadedCount > 0) {
        setSuccess(true);
        localStorage.removeItem("speleo_registration_draft");

        // Odoslanie potvrdzovacieho emailu autorovi
        try {
          fetch("/api/send-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              author: formData.author,
              email: formData.email,
              address: formData.address,
              instagram: formData.instagram,
              photos: photos.map(p => ({
                name: p.name || (p.file ? p.file.name.split(".")[0] : "Untitled"),
                category: p.category,
                description: p.description || "",
              })),
            }),
          }).catch(err => console.error("Confirmation email background error", err));
        } catch (mailErr) {
          console.error("Confirmation email trigger error", mailErr);
        }
      } else {
        setError(lastError || (lang === "sk" ? "Chyba pri odosielaní / Error during submission" : "Error during submission"));
      }
    } catch (e) {
      setError(lang === "sk" ? "Nepodarilo sa pripojiť k serveru." : "Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-10">
        <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto text-white">
          <Check size={32} />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-light tracking-tight uppercase">{t.successTitle}</h2>
          <p className="text-sm text-muted uppercase tracking-widest font-bold">{t.successText}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-ink text-white px-10 py-4 uppercase text-[11px] font-bold tracking-[3px] hover:opacity-90 transition-opacity"
        >
          {t.newForm}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Interactive Step-by-Step Completion Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white border border-border shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                    <Info size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wider text-ink">
                      {lang === "sk" ? "Sprievodca dokončením prihlášky" : "Application Completion Wizard"}
                    </h3>
                    <p className="text-[11px] text-muted font-medium">
                      {lang === "sk" ? "Doplňte chýbajúce údaje, aby bolo možné prihlášku úspešne odoslať" : "Complete missing required fields to submit your application"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWizard(false)} 
                  className="p-1 text-muted hover:text-ink transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Wizard Steps Navigation Pills */}
              <div className="flex border-b border-border text-[11px] font-bold uppercase tracking-wider">
                <button 
                  onClick={() => setWizardStep("author")}
                  className={cn(
                    "flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5",
                    wizardStep === "author" ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  {missingAuthorFields.length > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                  )}
                  {lang === "sk" ? "1. Autor" : "1. Author"}
                </button>
                <button 
                  onClick={() => setWizardStep("photos")}
                  className={cn(
                    "flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5",
                    wizardStep === "photos" ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  {invalidPhotos.length > 0 || photos.length === 0 ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                  )}
                  {lang === "sk" ? "2. Príbehy fotiek" : "2. Photo Stories"}
                </button>
                <button 
                  onClick={() => setWizardStep("consents")}
                  className={cn(
                    "flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5",
                    wizardStep === "consents" ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  {missingConsents.length > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                  )}
                  {lang === "sk" ? "3. Súhlasy" : "3. Consents"}
                </button>
              </div>

              {/* Wizard Body Content based on Step */}
              <div className="space-y-5">
                {wizardStep === "author" && (
                  <div className="space-y-4">
                    {missingAuthorFields.length === 0 ? (
                      <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {lang === "sk" ? "Všetky údaje o autorovi sú vyplnené správne." : "Author details are complete and valid."}
                      </div>
                    ) : (
                      missingAuthorFields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-ink">
                            {field.label} *
                          </label>
                          <input 
                            type={field.type}
                            value={(formData as any)[field.id] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            placeholder={field.placeholder}
                            className="w-full p-3 border border-border bg-paper/20 text-sm focus:border-accent focus:bg-white outline-none transition-all"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {wizardStep === "photos" && (
                  <div className="space-y-4">
                    {photos.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-col gap-2">
                        <p className="font-bold uppercase tracking-wider">
                          {lang === "sk" ? "Neboli nahrané žiadne fotografie" : "No photos uploaded yet"}
                        </p>
                        <p>
                          {lang === "sk" ? "Pre odoslanie prihlášky nahrajte aspoň 1 fotografiu." : "Please upload at least 1 photo to submit."}
                        </p>
                      </div>
                    ) : invalidPhotos.length === 0 ? (
                      <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {lang === "sk" ? "Všetky príbehy k fotografiám vyhovujú požiadavkám." : "All photo descriptions meet the requirements."}
                      </div>
                    ) : (
                      invalidPhotos.map(({ idx, photo, catName, minDesc, maxDesc, descRequired }) => (
                        <div key={idx} className="p-4 border border-red-200 bg-red-50/30 space-y-3">
                          <div className="flex items-center gap-3">
                            <img src={photo.previewUrl} className="w-12 h-12 object-cover border border-border shrink-0" alt="Thumbnail" />
                            <div>
                              <p className="text-xs font-bold text-ink">{photo.name || photo.file?.name}</p>
                              <p className="text-[10px] text-muted uppercase tracking-wider">
                                {lang === "sk" ? "Kategória:" : "Category:"} {catName} ({lang === "sk" ? `min. ${minDesc}, max. ${maxDesc} znakov` : `min. ${minDesc}, max. ${maxDesc} chars`})
                              </p>
                            </div>
                          </div>
                          <div>
                            <textarea 
                              value={photo.description}
                              onChange={(e) => updatePhotoInfo(idx, { description: e.target.value })}
                              placeholder={lang === "sk" ? "Napíšte príbeh / popis k fotografii..." : "Write story / description for the photo..."}
                              className="w-full text-xs bg-white border border-border p-2.5 h-20 outline-none focus:border-accent resize-none"
                            />
                            <div className="flex justify-between items-center mt-1 text-[9px]">
                              <span className={cn("font-bold uppercase", (photo.description.length < minDesc || photo.description.length > maxDesc) ? "text-red-600" : "text-green-600")}>
                                {lang === "sk" ? "Dĺžka:" : "Length:"} {photo.description.length} / {maxDesc} {lang === "sk" ? "znakov" : "chars"} {minDesc > 0 && `(min. ${minDesc})`}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {wizardStep === "consents" && (
                  <div className="space-y-4">
                    {missingConsents.length === 0 ? (
                      <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {lang === "sk" ? "Všetky súhlasy sú potvrdené." : "All consents are agreed."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {!formData.gdprConsent && (
                          <div className="flex items-start gap-3 p-3.5 border border-border bg-paper/30">
                            <input 
                              type="checkbox"
                              id="wiz-gdpr"
                              checked={formData.gdprConsent}
                              onChange={(e) => setFormData({ ...formData, gdprConsent: e.target.checked })}
                              className="mt-0.5 w-4 h-4 accent-accent cursor-pointer shrink-0"
                            />
                            <label htmlFor="wiz-gdpr" className="text-xs text-ink cursor-pointer select-none leading-relaxed">
                              {t.consentText}
                            </label>
                          </div>
                        )}
                        {!formData.rulesConsent && (
                          <div className="flex items-start gap-3 p-3.5 border border-border bg-paper/30">
                            <input 
                              type="checkbox"
                              id="wiz-rules"
                              checked={formData.rulesConsent}
                              onChange={(e) => setFormData({ ...formData, rulesConsent: e.target.checked })}
                              className="mt-0.5 w-4 h-4 accent-accent cursor-pointer shrink-0"
                            />
                            <label htmlFor="wiz-rules" className="text-xs text-ink cursor-pointer select-none leading-relaxed">
                              {lang === "sk" 
                                ? "Čestne vyhlasujem, že som autorom zaslaných diel a súhlasím s podmienkami súťaže."
                                : "I solemnly declare that I am the author of the submitted works and I agree with the competition conditions."}
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wizard Footer Controls */}
              <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                <button 
                  onClick={() => setShowWizard(false)}
                  className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors"
                >
                  {lang === "sk" ? "Upraviť vo formulári" : "Edit in form"}
                </button>
                <div className="flex items-center gap-2">
                  {wizardStep !== "consents" ? (
                    <button 
                      onClick={() => setWizardStep(wizardStep === "author" ? "photos" : "consents")}
                      className="px-6 py-2.5 bg-ink text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      {lang === "sk" ? "Ďalší krok ->" : "Next step ->"}
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setShowWizard(false);
                        handleSubmit();
                      }}
                      disabled={missingAuthorFields.length > 0 || invalidPhotos.length > 0 || missingConsents.length > 0 || photos.length === 0}
                      className="px-8 py-2.5 bg-accent text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {lang === "sk" ? "Dokončiť & Odoslať" : "Complete & Submit"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Error Modal Backup */}
      <AnimatePresence>
        {validationErrors.length > 0 && !showWizard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-red-500 p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-border">
                <AlertTriangle size={24} />
                <h3 className="text-sm font-bold uppercase tracking-widest">{lang === "sk" ? "Chyby v prihláške" : "Application Errors"}</h3>
              </div>
              <ul className="space-y-3">
                {validationErrors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted">
                    <div className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setValidationErrors([]);
                    setShowWizard(true);
                  }}
                  className="flex-1 py-3 bg-accent text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  {lang === "sk" ? "Otvoriť Sprievodcu" : "Open Wizard"}
                </button>
                <button 
                  onClick={() => setValidationErrors([])}
                  className="px-4 py-3 bg-paper border border-border text-[10px] font-bold uppercase tracking-widest hover:border-ink transition-all"
                >
                  {lang === "sk" ? "Zavrieť" : "Close"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Introduction & Public Stats */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <p className="text-[11px] text-muted uppercase font-bold tracking-widest">
              {settings?.edition} - {lang === "sk" ? settings?.museumNameSk : settings?.museumNameEn}
            </p>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <h2 className="text-3xl font-light tracking-tight">{lang === "sk" ? "Prihláška do súťaže" : "Application Form"}</h2>
              {!isSubmissionClosed && timeLeft && (timeLeft.days > 0 || timeLeft.hours > 0 || timeLeft.minutes > 0 || timeLeft.seconds > 0) && (
                <div className="flex items-center gap-2 mb-1 px-3 py-1.5 bg-red-50 border border-red-100 rounded-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                    {lang === "sk" ? "Uzávierka o:" : "Ends in:"} {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                  </span>
                </div>
              )}
            </div>
          </div>
          {settings?.debugMode && (
            <button 
              onClick={generateTestData}
              disabled={debugLoading}
              className="flex items-center gap-2 px-4 py-2 border border-accent/20 bg-accent/5 text-[10px] font-bold uppercase tracking-widest text-accent hover:bg-accent/10 transition-all disabled:opacity-50"
            >
              {debugLoading ? <Loader2 className="animate-spin" size={14} /> : <FlaskConical size={14} />}
              {lang === "sk" ? "Nahrať testovacie dáta (ADMIN)" : "Upload Test Data (ADMIN)"}
            </button>
          )}
        </div>

        {/* Live Public Stats Bar */}
        {publicStats && publicStats.totalPhotos > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-paper/60 border border-border">
            <div className="text-center sm:text-left space-y-0.5">
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Fotografií" : "Photos"}</p>
              <p className="text-xl font-bold text-ink">{publicStats.totalPhotos}</p>
            </div>
            <div className="text-center sm:text-left space-y-0.5">
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Autorov" : "Authors"}</p>
              <p className="text-xl font-bold text-ink">{publicStats.uniqueAuthors}</p>
            </div>
            <div className="text-center sm:text-left space-y-0.5">
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Kategórie A / B" : "Categories A / B"}</p>
              <p className="text-xl font-bold text-ink">{(publicStats.byCategory?.A || 0)} / {(publicStats.byCategory?.B || 0)}</p>
            </div>
            <div className="text-center sm:text-left space-y-0.5">
              <p className="text-[9px] uppercase font-bold text-muted tracking-wider">{lang === "sk" ? "Hlasov verejnosti" : "Public Votes"}</p>
              <p className="text-xl font-bold text-accent">{publicStats.totalVotes}</p>
            </div>
          </div>
        )}

        {/* Closed Submissions Alert */}
        {isSubmissionClosed && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-sm flex items-start gap-4">
            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={24} />
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-red-900">
                {lang === "sk" ? "Prihlasovanie do súťaže je uzavreté" : "Submissions are currently closed"}
              </h4>
              <p className="text-xs text-red-700 leading-relaxed">
                {lang === "sk" 
                  ? "Termín na odosielanie prihlášok vypršal. Prebieha hodnotenie odbornej poroty a verejné hlasovanie v Galérii." 
                  : "The deadline for photo submissions has ended. Jury evaluation and public choice voting are currently active."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Form Content */}
      <div className="space-y-12">
        {/* Author Info Section - Full Width */}
        <div className="space-y-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">{t.personalInfo}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-muted">{t.fullName}{req?.author && " *"}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.author}
                  onChange={e => setFormData({ ...formData, author: e.target.value })}
                  className={cn(
                    "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                    isValid.author && "border-green-200"
                  )}
                  placeholder="napr. Ján Slovák"
                />
                {formData.author && isValid.author && (
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-muted">{t.email}{req?.email && " *"}</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={cn(
                    "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                    isValid.email && "border-green-200"
                  )}
                  placeholder="email@example.sk"
                />
                {formData.email && isValid.email && (
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-muted">{t.instagram}{req?.instagram && " *"}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.instagram}
                  onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                  className={cn(
                    "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                    formData.instagram && isValid.instagram && "border-green-200"
                  )}
                  placeholder="@instagram"
                />
                {formData.instagram && isValid.instagram && (
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold text-muted">{t.webpage}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.webpage}
                  onChange={e => setFormData({ ...formData, webpage: e.target.value })}
                  className={cn(
                    "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                    formData.webpage && isValid.webpage && "border-green-200"
                  )}
                  placeholder="https://www.author.sk"
                />
                {formData.webpage && isValid.webpage && (
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>

            <div className="md:col-span-1 lg:col-span-2 space-y-2">
              <label className="text-[11px] uppercase font-bold text-muted">{t.address}{req?.address && " *"}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className={cn(
                    "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                    isValid.address && "border-green-200"
                  )}
                  placeholder="Ulica, Obec, PSČ, Štát"
                />
                {formData.address && isValid.address && (
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Photos Upload Section - Multi Column */}
        <div className="space-y-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">{t.photosTitle}</h3>
          
          <div className={cn(
            "grid gap-8",
            (settings?.categories?.length || 0) <= 1 ? "grid-cols-1" : 
            (settings?.categories?.length || 0) === 2 ? "grid-cols-1 lg:grid-cols-2" : 
            "grid-cols-1 lg:grid-cols-3"
          )}>
            {(settings?.categories || []).map((cat) => {
              if (!cat || !cat.id) return null;
              const catPhotos = photos.filter(p => p.category === cat.id);
              return (
                <div key={cat.id} className="space-y-4 group/cat">
                <div className="flex items-center justify-between p-3 bg-paper/50 border border-border group-hover/cat:border-accent transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-ink text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                      {cat.id}
                    </div>
                    <h4 className="text-[10px] font-bold uppercase text-ink tracking-widest">{lang === "sk" ? cat.nameSk : cat.nameEn}</h4>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full",
                    (existingCounts[cat.id] || 0) + catPhotos.length > parseInt(settings?.maxPhotosPerCategory || "5") 
                      ? "bg-red-100 text-red-600" 
                      : (existingCounts[cat.id] || 0) > 0 ? "bg-accent/10 text-accent" : "bg-ink/5 text-muted"
                  )}>
                    {(existingCounts[cat.id] || 0) + catPhotos.length}/{settings?.maxPhotosPerCategory || 5}
                    {(existingCounts[cat.id] || 0) > 0 && ` (${lang === "sk" ? "z toho" : "incl."} ${existingCounts[cat.id]} ${lang === "sk" ? "pôvodných" : "previous"})`}
                  </span>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = Array.from(e.dataTransfer.files as FileList);
                    handleFiles(files, cat.id);
                  }}
                  className={cn(
                    "h-40 border-2 flex flex-col items-center justify-center p-4 transition-all cursor-pointer rounded-none bg-accent/[0.02] hover:bg-accent/[0.06]",
                    isDragging 
                      ? "border-solid bg-accent/10 scale-[0.98] border-accent" 
                      : "border-dashed animate-border-pulse"
                  )}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = ".jpg,.jpeg,.png,.tiff,.tif";
                    input.onchange = (e) => handleFileSelect(e as any, cat.id);
                    input.click();
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                    <Upload size={20} className="text-accent" />
                  </div>
                  <p className="text-[11px] text-ink font-bold uppercase tracking-widest">{lang === "sk" ? "PRIDAŤ FOTKY" : "ADD PHOTOS"}</p>
                  <p className="text-[9px] text-muted mt-1 uppercase tracking-widest">{lang === "sk" ? "Kliknite alebo pretiahnite súbory sem" : "Click or drag files here"}</p>
                </div>

                {/* Grid for uploaded photos in this category */}
                <div className="grid grid-cols-1 gap-4">
                  <AnimatePresence>
                    {(photos || []).filter(p => p.category === cat.id).map((photo, i) => {
                      const globalIdx = photos.findIndex(p => p === photo);
                      return (
                        <motion.div 
                          key={globalIdx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="border border-border bg-white"
                        >
                          <div className="flex gap-4 p-3 relative group">
                            <div className="w-16 h-16 bg-paper shrink-0 overflow-hidden border border-border">
                              <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                            </div>
                            <div className="flex-1 space-y-2">
                               <input 
                                type="text" 
                                value={photo.name}
                                onChange={e => updatePhotoInfo(globalIdx, { name: e.target.value })}
                                className="w-full border-b border-border bg-transparent p-1 text-[11px] font-bold outline-none focus:border-ink"
                                placeholder={photo.file?.name.split(".")[0] || t.photoName}
                              />
                              <div className="relative">
                                <textarea 
                                  value={photo.description}
                                  onChange={e => updatePhotoInfo(globalIdx, { description: e.target.value })}
                                  className={cn(
                                    "w-full text-[10px] bg-white border p-2 h-16 outline-none resize-none leading-tight transition-colors",
                                    cat.descRequired && !photo.description ? "border-red-200" : "border-border focus:border-ink"
                                  )}
                                  placeholder={t.photoDesc + (cat.descRequired ? " *" : "")}
                                />
                                <div className="absolute bottom-1 right-2 flex gap-2">
                                  <span className={cn(
                                    "text-[7px] font-bold uppercase",
                                    (photo.description.length < (cat.minDesc || 0) || photo.description.length > (cat.maxDesc || 5000)) ? "text-red-500" : "text-muted/50"
                                  )}>
                                    {photo.description.length} / {cat.maxDesc || 5000}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => removePhoto(globalIdx)}
                              className="absolute top-2 right-2 p-1 text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Global Submit */}
        <div className="pt-10 border-t border-border flex flex-col space-y-8">
          <div className="space-y-4 max-w-2xl">
             <div className="flex gap-3 items-start p-4 bg-paper/30 border border-border">
                <input 
                  type="checkbox" 
                  id="gdpr-check"
                  className="mt-1 w-4 h-4 accent-ink border-border rounded-none cursor-pointer" 
                  checked={formData.gdprConsent}
                  onChange={e => setFormData({ ...formData, gdprConsent: e.target.checked })}
                />
                <label htmlFor="gdpr-check" className="text-[11px] leading-relaxed text-muted cursor-pointer select-none">
                  {t.consentText}
                </label>
              </div>

             <div className="flex gap-3 items-start p-4 bg-paper/30 border border-border">
                <input 
                  type="checkbox" 
                  id="rules-check"
                  className="mt-1 w-4 h-4 accent-ink border-border rounded-none cursor-pointer" 
                  checked={formData.rulesConsent}
                  onChange={e => setFormData({ ...formData, rulesConsent: e.target.checked })}
                />
                <label htmlFor="rules-check" className="text-[11px] leading-relaxed text-muted cursor-pointer select-none">
                  {lang === "sk" 
                    ? "Čestne vyhlasujem, že som autorom zaslaných diel a súhlasím s podmienkami súťaže. "
                    : "I solemnly declare that I am the author of the submitted works and I agree with the competition conditions. "}
                  <button 
                    onClick={() => setShowRules(true)}
                    className="text-accent font-bold hover:underline"
                  >
                    {lang === "sk" ? "Zobraziť podmienky súťaže" : "View competition rules"}
                  </button>
                </label>
              </div>
          </div>

          <AnimatePresence>
            {showRules && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/80 backdrop-blur-sm"
                onClick={() => setShowRules(false)}
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white max-w-2xl w-full max-h-[80vh] overflow-y-auto p-10 border border-border shadow-2xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-ink">
                      {lang === "sk" ? "Podmienky súťaže" : "Competition Rules"}
                    </h3>
                    <button onClick={() => setShowRules(false)} className="hover:text-accent transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none prose-headings:text-ink prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-widest prose-p:text-muted prose-li:text-muted whitespace-pre-wrap font-sans">
                    <ReactMarkdown>{(lang === "sk" ? settings?.rulesSk : settings?.rulesEn) || "Competition rules will be provided by the organizer."}</ReactMarkdown>
                  </div>
                  <div className="pt-6 border-t border-border flex justify-end">
                    <button 
                      onClick={() => setShowRules(false)}
                      className="px-8 py-3 bg-ink text-white text-[10px] font-bold uppercase tracking-widest"
                    >
                      {lang === "sk" ? "Zavrieť" : "Close"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-[10px] text-muted uppercase tracking-widest max-w-sm">
              {lang === "sk" 
                ? "Všetky polia označené * sú povinné. Odoslaním súhlasíte s podmienkami súťaže." 
                : "All fields marked with * are required. By submitting you agree to competition terms."}
            </p>
            <button
              onClick={handleSubmit}
              disabled={loading || photos.length === 0 || isSubmissionClosed}
              className={cn(
                "w-full md:w-80 py-4 bg-ink text-white text-[11px] font-bold uppercase tracking-[2px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
                loading && "opacity-80"
              )}
            >
              {isSubmissionClosed 
                ? (lang === "sk" ? "Registrácia uzavretá" : "Submissions Closed")
                : (loading ? <Loader2 size={18} className="mx-auto animate-spin" /> : t.submit)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
