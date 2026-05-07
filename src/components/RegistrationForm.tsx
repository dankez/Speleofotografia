import { useState, useRef, ChangeEvent, useMemo } from "react";
import { Upload, X, Check, Loader2, Plus, Info, AlertTriangle, Instagram, Mail, MapPin, User, FileText, Trophy, Globe, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { PhotoInfo, Registration } from "../types";
import { Lang, Settings } from "../App";
import { FlaskConical } from "lucide-react";

export default function RegistrationForm({ lang, settings }: { lang: Lang, settings: Settings | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Registration, "photos">>({
    author: "",
    email: "",
    instagram: "",
    webpage: "",
    address: "",
  });

  const isValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    
    return {
      author: formData.author.length > 2,
      email: emailRegex.test(formData.email),
      instagram: formData.instagram.length > 1 && formData.instagram.startsWith("@"),
      webpage: !formData.webpage || urlRegex.test(formData.webpage),
      address: formData.address.length > 5,
    };
  }, [formData]);

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
      successText: `Ďakujeme za vašu účasť - ${settings?.contestName || "Speleofotografia 2025"}`,
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
      successText: `Thank you for your participation - ${settings?.contestName || "Speleophotography 2025"}`,
      newForm: "New Application",
      errorEmpty: "Please fill in all required fields and upload at least one photo.",
      errorLimit: `You can submit a maximum of ${settings?.maxPhotosPerCategory || 5} photos per category.`,
    }
  }[lang];

  const handleFiles = (files: File[]) => {
    const newPhotos: PhotoInfo[] = files.map(f => {
      return {
        name: f.name.split(".")[0],
        category: "A",
        description: "",
        file: f,
        previewUrl: URL.createObjectURL(f)
      };
    });

    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    handleFiles(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
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

  const loadTestPhotos = () => {
    const mockPhotos: PhotoInfo[] = Array.from({ length: 5 }).map((_, i) => ({
      name: `Svadobná sieň ${i + 1}`,
      category: i < 3 ? "A" : "B",
      description: `Testovacia fotografia pre porotu. Zobrazenie krásy podzemia v roku 2025.`,
      previewUrl: `https://picsum.photos/seed/${i + 50}/800/800`
    }));
    setPhotos(mockPhotos);
    setFormData({
      author: "Michal Danko",
      email: "michal.danko@gmail.com",
      webpage: "https://michaldanko.sk",
      address: "Demänovská dolina 10, Liptovský Mikuláš",
      instagram: "@michal.danko",
    });
  };

  const handleSubmit = async () => {
    if (!formData.author || !formData.email || !formData.address) {
      setError(t.errorEmpty);
      return;
    }

    if (photos.length === 0) {
      setError(lang === "sk" ? "Prosím nahrajte aspoň jednu fotografiu." : "Please upload at least one photo.");
      return;
    }

    const catA = photos.filter(p => p.category === "A").length;
    const catB = photos.filter(p => p.category === "B").length;
    const maxPhotos = parseInt(settings?.maxPhotosPerCategory || "5");
    if (catA > maxPhotos || catB > maxPhotos) {
      setError(t.errorLimit);
      return;
    }

    setLoading(true);
    setError(null);

    const data = new FormData();
    data.append("author", formData.author);
    data.append("email", formData.email);
    data.append("instagram", formData.instagram);
    data.append("webpage", formData.webpage || "");
    data.append("address", formData.address);
    
    const photoInfos = photos.map(p => ({
      name: p.name,
      category: p.category,
      description: p.description
    }));
    data.append("photoInfo", JSON.stringify(photoInfos));

    photos.forEach(p => {
      if (p.file) data.append("photos", p.file);
    });

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: data
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Chyba pri odosielaní / Error during submission");
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
      {/* Introduction */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <p className="text-[11px] text-muted uppercase font-bold tracking-widest">
            {settings?.edition} - {settings?.museumName}
          </p>
          <h2 className="text-3xl font-light tracking-tight">{lang === "sk" ? "Prihláška" : "Application Form"}</h2>
        </div>
        <button 
          onClick={loadTestPhotos}
          className="flex items-center gap-2 px-4 py-2 border border-border text-[10px] font-bold uppercase tracking-widest text-muted hover:bg-paper hover:text-ink transition-all"
        >
          <FlaskConical size={14} className="text-accent" />
          {lang === "sk" ? "Nahrať testovacie dáta" : "Load Test Data"}
        </button>
      </div>

      {settings && (
        <div className="p-6 border border-border bg-white text-[12px] leading-relaxed text-muted whitespace-pre-wrap">
          <div className="flex gap-2 items-center mb-2 text-ink font-bold uppercase tracking-widest text-[10px]">
            <Info size={14} />
            {lang === "sk" ? "Podmienky súťaže / Rules" : "Competition Rules"}
          </div>
          {lang === "sk" ? settings.rulesSk : settings.rulesEn}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Author Info */}
        <div className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted border-b border-border pb-2">{t.personalInfo}</h3>
            
            <div className="space-y-6">
              <div className="space-y-2 relative">
                <label className="text-[11px] uppercase font-bold text-muted">{t.fullName}</label>
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
                  {isValid.author && (
                    <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-[11px] uppercase font-bold text-muted">{t.email}</label>
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
                    {isValid.email && (
                      <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <label className="text-[11px] uppercase font-bold text-muted">{t.instagram}</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.instagram}
                      onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                      className={cn(
                        "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors pr-10",
                        isValid.instagram && "border-green-200"
                      )}
                      placeholder="@instagram"
                    />
                    {isValid.instagram && (
                      <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 relative">
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

              <div className="space-y-2 relative">
                <label className="text-[11px] uppercase font-bold text-muted">{t.address}</label>
                <div className="relative">
                  <textarea 
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className={cn(
                      "w-full p-3 border border-border bg-white text-sm outline-none focus:border-ink transition-colors h-24 resize-none pr-10",
                      isValid.address && "border-green-200"
                    )}
                    placeholder="Ulica, Obec, PSČ, Štát"
                  />
                  {isValid.address && (
                    <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                  )}
                </div>
              </div>

              <div className="p-5 border border-border bg-paper/50 space-y-4">
                <label className="text-[11px] uppercase font-bold text-accent">{t.consentTitle}</label>
                <div className="flex gap-3 items-start">
                  <input type="checkbox" className="mt-1 w-4 h-4 border-border rounded-none" defaultChecked />
                  <p className="text-[11px] leading-relaxed text-muted">{t.consentText}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Photos and Upload Zone */}
        <div className="space-y-8 flex flex-col">
          <div className="space-y-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[2px] text-muted">{t.photosTitle}</h3>
              <div className="flex gap-4">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", photos.filter(p => p.category === "A").length > parseInt(settings?.maxPhotosPerCategory || "5") ? "text-red-500" : "text-muted")}>
                  {settings?.catA.split(" / ")[0] || t.catA}: {photos.filter(p => p.category === "A").length}/{settings?.maxPhotosPerCategory || 5}
                </span>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", photos.filter(p => p.category === "B").length > parseInt(settings?.maxPhotosPerCategory || "5") ? "text-red-500" : "text-muted")}>
                  {settings?.catB.split(" / ")[0] || t.catB}: {photos.filter(p => p.category === "B").length}/{settings?.maxPhotosPerCategory || 5}
                </span>
              </div>
            </div>

            <div 
              className={cn(
                "flex-1 min-h-[300px] border-2 border-dashed transition-all flex flex-col items-center justify-center p-10 text-center relative group",
                isDragging ? "border-accent bg-accent/5" : "border-border hover:bg-paper"
              )}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" multiple accept=".jpg,.jpeg,.png,.tiff,.tif" className="hidden" onChange={handleFileSelect} ref={fileInputRef} />
              
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-paper border border-border flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload size={20} className="text-accent" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase font-bold tracking-widest text-ink">{t.uploadTitle}</p>
                  <p className="text-[9px] text-muted uppercase tracking-tight max-w-[280px] mx-auto leading-relaxed">
                    {t.uploadNote}
                  </p>
                </div>
              </div>

              <div className="absolute bottom-4 left-0 right-0">
                <p className="text-[8px] uppercase tracking-[3px] text-muted font-bold">
                  {lang === "sk" ? "Potiahnite súbory sem alebo kliknite" : "Drag files here or click to upload"}
                </p>
              </div>
            </div>

            {/* List of uploaded photos */}
            {photos.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                <AnimatePresence>
                  {photos.map((photo, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="aspect-square border border-border bg-ink overflow-hidden group relative"
                    >
                      <img src={photo.previewUrl} className="w-full h-full object-cover opacity-80" alt="Preview" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                        className="absolute inset-0 bg-ink/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} className="text-white" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

            {/* Photo Details (if photos selected) */}
            {photos.length > 0 && (
              <div className="space-y-4 pt-4">
                <label className="text-[11px] uppercase font-bold text-muted">{t.detailsTitle}</label>
                <div className="grid grid-cols-1 gap-4">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="p-4 border border-border bg-paper/30 grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-8 flex flex-col gap-2">
                        <input 
                          type="text" 
                          value={photo.name}
                          onChange={e => updatePhotoInfo(idx, { name: e.target.value })}
                          className="w-full border-b border-border bg-transparent p-1 text-sm font-bold outline-none focus:border-ink"
                          placeholder={t.photoName}
                        />
                        <textarea 
                          value={photo.description}
                          onChange={e => updatePhotoInfo(idx, { description: e.target.value })}
                          className="w-full text-[11px] bg-white border border-border p-2 mt-2 h-16 outline-none resize-none"
                          placeholder={t.photoDesc}
                        />
                      </div>
                      <div className="col-span-4 flex flex-col gap-2">
                        <select 
                          value={photo.category}
                          onChange={e => updatePhotoInfo(idx, { category: e.target.value as "A" | "B" })}
                          className="w-full border border-border p-2 text-xs font-bold uppercase outline-none bg-white"
                        >
                          <option value="A">{settings?.catA.split(" / ")[0] || t.catA}</option>
                          <option value="B">{settings?.catB.split(" / ")[0] || t.catB}</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-6 space-y-4">
              {error && <p className="text-red-600 text-[11px] font-bold uppercase mb-4">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={loading || photos.length === 0}
                className={cn(
                  "w-full py-4 bg-ink text-white text-sm font-bold uppercase tracking-[2px] transition-all hover:opacity-90 active:scale-[0.98]",
                  (loading || photos.length === 0) && "opacity-20 cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 size={20} className="mx-auto animate-spin" /> : t.submit}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
}
