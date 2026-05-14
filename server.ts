import express from "express";
// import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import nodemailer from "nodemailer";
import sharp from "sharp";
import exif from "exif-reader";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { ZipArchive } from "archiver";
import "dotenv/config";

console.log("Modules loaded");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Directories for storage
  const UPLOADS_DIR = path.join(__dirname, "uploads");
  const DATA_DIR = path.join(__dirname, "data");
  
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  console.log("Directories ready");

  const REGISTRATIONS_CSV = path.join(DATA_DIR, "registrations.csv");
  const RATINGS_CSV = path.join(DATA_DIR, "ratings.csv");
  const EVALUATORS_CSV = path.join(DATA_DIR, "evaluators.csv");
  const ADMINS_JSON = path.join(DATA_DIR, "admins.json");
  const INVITATIONS_JSON = path.join(DATA_DIR, "invitations.json");
  const PUBLIC_VOTES_CSV = path.join(DATA_DIR, "public_votes.csv");
  const SETTINGS_JSON = path.join(DATA_DIR, "settings.json");
  const VISITS_CSV = path.join(DATA_DIR, "visits.csv");

  // Helper to get client IP
  const getClientIp = (req: express.Request) => {
    return (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0];
  };

  // Track visits
  app.use((req, res, next) => {
    const p = req.path;
    if (p === "/" || p === "/index.html" || p.startsWith("/admin")) {
      try {
        const ip = getClientIp(req);
        const date = new Date().toISOString().split("T")[0];
        const ua = (req.headers["user-agent"] || "unknown").replace(/,/g, " ");
        fs.appendFileSync(VISITS_CSV, `${date},${ip},${ua}\n`);
      } catch (e) {
        // Ignore logging errors
      }
    }
    next();
  });
  
  // Helper to remove diacritics and special characters for safe filenames
  const removeDiacritics = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-zA-Z0-9.\-_ ]/g, "_") // Replace other special chars with underscore
      .replace(/\s+/g, "_") // Replace spaces with underscore
      .trim();
  };

  // Initialize CSVs with headers if they don't exist
  if (!fs.existsSync(REGISTRATIONS_CSV)) {
    fs.writeFileSync(REGISTRATIONS_CSV, "id,author,email,instagram,webpage,address,gdprConsent,rulesConsent,category,photoName,originalPath,webPath,description,metadata,createdAt,shortlisted\n");
  }
  if (!fs.existsSync(RATINGS_CSV)) {
    fs.writeFileSync(RATINGS_CSV, "evalId,evalName,photoId,score,createdAt\n");
  }
  if (!fs.existsSync(EVALUATORS_CSV)) {
    fs.writeFileSync(EVALUATORS_CSV, "id,name,role\n");
  }
  if (!fs.existsSync(PUBLIC_VOTES_CSV)) {
    fs.writeFileSync(PUBLIC_VOTES_CSV, "photoId,createdAt\n");
  }

  // Initialize admins database with default admin from settings if empty
  if (!fs.existsSync(ADMINS_JSON)) {
    const defaultAdmins = [
      {
        email: DEFAULT_SETTINGS.adminEmail,
        password: DEFAULT_SETTINGS.adminPass,
        role: "superadmin",
        mustChangePassword: false
      }
    ];
    fs.writeFileSync(ADMINS_JSON, JSON.stringify(defaultAdmins, null, 2));
    console.log(`Initialized default admin: ${DEFAULT_SETTINGS.adminEmail}`);
  }

  // Initialize invitations storage
  if (!fs.existsSync(INVITATIONS_JSON)) {
    fs.writeFileSync(INVITATIONS_JSON, JSON.stringify([], null, 2));
    console.log("Initialized empty invitations.json");
  }

  // Initialize settings
  if (!fs.existsSync(SETTINGS_JSON)) {
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify({}, null, 2));
    console.log("Initialized empty settings.json");
  }

  if (!fs.existsSync(VISITS_CSV)) fs.writeFileSync(VISITS_CSV, "date,ip,ua\n");

  console.log("Data files initialized and verified");
  console.log("Middlewares configured");
  
  // Direct access to /uploads is disabled for security. 
  // Photos are served via /api/photo/:id proxy with anti-hotlinking.
  // app.use("/uploads", express.static(UPLOADS_DIR));

  // Configure Multer
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".tiff", ".tif"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Nepodporovaný formát súboru"));
      }
    },
  });

const getTransporter = (settings: any) => {
  const host = process.env.SMTP_HOST || settings.smtpHost;
  const port = parseInt(process.env.SMTP_PORT || settings.smtpPort);
  const secure = (process.env.SMTP_SECURE || settings.smtpSecure) === "true";
  const user = process.env.SMTP_USER || settings.smtpUser;
  const pass = process.env.SMTP_PASS || settings.smtpPass;

  if (!user || !pass || !host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

// Default settings
const DEFAULT_SETTINGS = {
  // Public settings
  contestNameSk: "Speleofotografia 2026",
  contestNameEn: "Speleophotography 2026",
  museumNameSk: "Slovenské múzeum ochrany prírody a jaskyniarstva",
  museumNameEn: "Slovak Museum of Nature Protection and Caving",
  edition: "23. ročník",
  contestStatus: "submissions",
  submissionStart: "",
  submissionEnd: "",
  judgingStart: "",
  judgingEnd: "2026-05-31",
  categories: [
    { id: "A", nameSk: "Krása jaskýň", nameEn: "Beauty of Caves", minDesc: 100, maxDesc: 5000, descRequired: true },
    { id: "B", nameSk: "Jaskyniari", nameEn: "Cavers", minDesc: 0, maxDesc: 5000, descRequired: false },
    { id: "C", nameSk: "Kras v krajine", nameEn: "Karst in Landscape", minDesc: 0, maxDesc: 5000, descRequired: false }
  ],
  watermarkFontSize: 24,
  watermarkColor: "rgba(255,255,255,0.4)",
  fieldRequirements: {
    author: true,
    email: true,
    instagram: false,
    address: true
  },
  rulesSk: "Maximálne 5 fotografií na kategóriu. Tlačová kvalita...",
  rulesEn: "Maximum 5 photos per category. Print quality...",
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
  debugMode: false,
  maxPhotosPerCategory: "5",
  watermarkTemplate: "Speleofotografia 2026",
  logoUrl: "",
  
  // SMTP Settings
  smtpHost: "smtp.example.com",
  smtpPort: "587",
  smtpSecure: "false",
  smtpUser: "",
  smtpPass: "",
  emailFrom: "info@speleofoto.sk",
  adminEmail: "admin@sss.sk",
  adminPass: "adminblesk11"
};

if (!fs.existsSync(SETTINGS_JSON)) {
  fs.writeFileSync(SETTINGS_JSON, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

// API Routes

// Public settings (strictly limited fields)
app.get("/api/settings", (req, res) => {
  try {
    const allSettings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
    const publicFields = [
      "contestNameSk", 
      "contestNameEn", 
      "museumNameSk", 
      "museumNameEn", 
      "edition", 
      "contestStatus",
      "submissionStart",
      "submissionEnd",
      "judgingStart",
      "judgingEnd",
      "categories",
      "fieldRequirements",
      "rulesSk", 
      "rulesEn", 
      "rulesText",
      "debugMode",
      "maxPhotosPerCategory",
      "logoUrl"
    ];
    
    const publicSettings = Object.fromEntries(
      Object.entries(allSettings).filter(([key]) => publicFields.includes(key))
    );
    
    res.json(publicSettings);
  } catch (e) {
    res.json({ contestStatus: "active", categories: [] });
  }
});

// Admin settings (full access - only called by authorized clients)
app.get("/api/admin/settings", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
    res.json(settings);
  } catch (e) {
    res.json({});
  }
});

app.post("/api/admin/settings", (req, res) => {
  const currentSettings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
  const newSettings = { ...currentSettings, ...req.body };
  fs.writeFileSync(SETTINGS_JSON, JSON.stringify(newSettings, null, 2));
  res.json({ success: true });
});

// Admin: Upload logo
app.post("/api/admin/upload-logo", upload.single("logo"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const webPath = `/uploads/${req.file.filename}`;
    
    // Update settings
    const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
    settings.logoUrl = webPath;
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
    
    res.json({ success: true, url: webPath });
  } catch (e) {
    res.status(500).json({ error: "Error uploading logo" });
  }
});

// Admin login
app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json({ error: "Chýbajúce údaje / Missing credentials" });
    }
    try {
      if (!fs.existsSync(ADMINS_JSON)) {
        throw new Error("admins.json does not exist");
      }
      const content = fs.readFileSync(ADMINS_JSON, "utf8");
      const admins = JSON.parse(content);
      
      if (!Array.isArray(admins)) {
        throw new Error("admins.json is not an array");
      }

      const admin = admins.find((a: any) => 
        a && a.email && a.email.toLowerCase().trim() === email.toLowerCase().trim() && 
        a.password && a.password.trim() === password.trim()
      );
      
      if (admin) {
        console.log(`Successful login for: ${email}`);
        res.json({ 
          success: true, 
          user: { email: admin.email, role: admin.role },
          mustChangePassword: false 
        });
      } else {
        console.warn(`Failed login attempt for: ${email} (Password mismatch or user not found)`);
        // Check if the user exists at all to provide better log info
        const userExists = admins.some((a: any) => a && a.email && a.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (!userExists) {
            console.warn(`User ${email} does not exist in ${ADMINS_JSON}`);
        } else {
            console.warn(`User ${email} found, but password did not match.`);
        }
        res.status(401).json({ error: "Nesprávne údaje / Incorrect credentials" });
      }
    } catch (e: any) {
      console.error(`Login critical error:`, e);
      res.status(500).json({ 
        error: "Chyba pri prihlásení (Server Error)",
        details: e.message
      });
    }
  });

  app.post("/api/admin/change-password", (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    try {
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      const adminIndex = admins.findIndex((a: any) => 
        a.email.toLowerCase().trim() === email.toLowerCase().trim() && 
        a.password.trim() === oldPassword.trim()
      );

      if (adminIndex !== -1) {
        admins[adminIndex].password = newPassword;
        admins[adminIndex].mustChangePassword = false;
        fs.writeFileSync(ADMINS_JSON, JSON.stringify(admins, null, 2));
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Nesprávne staré heslo" });
      }
    } catch (e) {
      res.status(500).json({ error: "Chyba pri zmene hesla" });
    }
  });

  app.get("/api/admin/list", (req, res) => {
    try {
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      // Filter out passwords
      res.json(admins.map(({ password, ...rest }: any) => rest));
    } catch (e) {
      res.status(500).json({ error: "Chyba pri načítaní administrátorov" });
    }
  });

  app.delete("/api/admin/list/:email", (req, res) => {
    try {
      const { email } = req.params;
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      
      if (admins.length <= 1) {
        return res.status(400).json({ error: "Nemožno zmazať posledného administrátora" });
      }

      const filtered = admins.filter((a: any) => a.email.toLowerCase() !== email.toLowerCase());
      fs.writeFileSync(ADMINS_JSON, JSON.stringify(filtered, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Chyba pri mazaní administrátora" });
    }
  });

  // Invitation workflow
  app.post("/api/admin/invite", async (req, res) => {
    try {
      const { email } = req.body;
      console.log(`Inviting admin: ${email}`);
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));

      if (admins.some((a: any) => a.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: "Užívateľ s týmto emailom už existuje" });
      }

      const token = uuidv4();
      const invitations = JSON.parse(fs.readFileSync(INVITATIONS_JSON, "utf8"));
      invitations.push({ email, token, createdAt: new Date().toISOString() });
      fs.writeFileSync(INVITATIONS_JSON, JSON.stringify(invitations, null, 2));

      // Send email
      const transporter = getTransporter(settings);
      if (transporter) {
        console.log(`Sending invitation email to ${email}`);

        const protocol = req.headers["x-forwarded-proto"] || (req.secure ? 'https' : 'http');
        const host = req.headers["x-forwarded-host"] || req.headers["host"];
        const setupLink = `${protocol}://${host}/admin/setup?token=${token}`;
        console.log(`Generated invitation link: ${setupLink}`);

        await transporter.sendMail({
          from: `"${settings.contestName}" <${settings.emailFrom}>`,
          to: email,
          subject: "Pozvánka do administrácie / Admin Invitation",
          html: `
            <h3>Pozvánka do administrácie ${settings.contestName}</h3>
            <p>Boli ste pozvaný ako správca súťaže. Svoje heslo si môžete nastaviť na nasledujúcom odkaze:</p>
            <p><a href="${setupLink}">${setupLink}</a></p>
            <hr/>
            <p>You have been invited as a competition admin. You can set your password using the link above.</p>
          `
        });
        console.log("Invitation email sent successfully");
      } else {
        console.warn("SMTP settings missing, invitation email not sent");
      }

      res.json({ success: true });
    } catch (e) {
      console.error("Invite error:", e);
      res.status(500).json({ error: "Chyba pri odosielaní pozvánky" });
    }
  });

  app.get("/api/admin/invite/:token", (req, res) => {
    const { token } = req.params;
    const invitations = JSON.parse(fs.readFileSync(INVITATIONS_JSON, "utf8"));
    const invite = invitations.find((i: any) => i.token === token);
    
    if (!invite) return res.status(404).json({ error: "Neplatný token" });
    res.json({ email: invite.email });
  });

  // Reset password workflow
  app.post("/api/admin/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      console.log(`Password reset requested for: ${email}`);
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));

      const admin = admins.find((a: any) => a.email.toLowerCase() === email.toLowerCase());
      if (!admin) {
        console.log(`Password reset failed: ${email} not found`);
        return res.status(404).json({ error: "Užívateľ s týmto emailom neexistuje" });
      }

      const token = uuidv4();
      const invitations = JSON.parse(fs.readFileSync(INVITATIONS_JSON, "utf8"));
      invitations.push({ email, token, type: "reset", createdAt: new Date().toISOString() });
      fs.writeFileSync(INVITATIONS_JSON, JSON.stringify(invitations, null, 2));

      const transporter = getTransporter(settings);
      if (transporter) {
        console.log(`Attempting to send reset email to ${email}`);

        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const host = req.headers["x-forwarded-host"] || req.get("host");
        const resetLink = `${protocol}://${host}/admin/setup?token=${token}`;
        console.log(`Generated reset link: ${resetLink}`);

        try {
          await transporter.sendMail({
            from: `"${settings.contestName}" <${settings.emailFrom}>`,
            to: email,
            subject: "Obnova hesla / Password Reset",
            html: `
              <h3>Obnova hesla pre ${settings.contestName}</h3>
              <p>Požiadali ste o obnovu hesla. Nové heslo si môžete nastaviť na nasledujúcom odkaze:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              <hr/>
              <p>You requested a password reset. You can set a new password using the link above.</p>
            `
          });
          console.log("Reset email sent successfully to " + email);
        } catch (mailErr) {
          console.error("Mail transport error:", mailErr);
          throw mailErr;
        }
      } else {
        console.warn("SMTP settings incomplete. User:", settings.smtpUser ? "set" : "MISSING", "Pass:", settings.smtpPass ? "set" : "MISSING");
      }

      res.json({ success: true });
    } catch (e) {
      console.error("Reset password error:", e);
      res.status(500).json({ error: "Chyba pri odosielaní emailu" });
    }
  });

  app.post("/api/admin/setup-password", (req, res) => {
    const { token, password } = req.body;
    try {
      const invitations = JSON.parse(fs.readFileSync(INVITATIONS_JSON, "utf8"));
      const index = invitations.findIndex((i: any) => i.token === token);
      
      if (index === -1) return res.status(404).json({ error: "Pozvánka/Token neexistuje alebo už expiroval" });
      
      const invite = invitations[index];
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      
      if (invite.type === "reset") {
        const adminIndex = admins.findIndex((a: any) => a.email === invite.email);
        if (adminIndex !== -1) {
          admins[adminIndex].password = password;
        }
      } else {
        admins.push({ email: invite.email, password, role: "admin" });
      }
      
      fs.writeFileSync(ADMINS_JSON, JSON.stringify(admins, null, 2));

      // Remove invitation/token
      invitations.splice(index, 1);
      fs.writeFileSync(INVITATIONS_JSON, JSON.stringify(invitations, null, 2));

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Chyba pri ukladaní" });
    }
  });

  // Stats for progress/admin
  app.get("/api/stats", (req, res) => {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      if (!fs.existsSync(REGISTRATIONS_CSV)) {
        const initialStats: any = { total: 0, uniqueEmails: 0 };
        settings.categories.forEach((cat: any) => initialStats[`cat${cat.id}`] = 0);
        return res.json(initialStats);
      }
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const stats: any = {
        total: lines.length,
        uniqueEmails: new Set(lines.map(l => {
          const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return parts[2] ? parts[2].replace(/^"|"$/g, '') : "";
        })).size
      };
      
      settings.categories.forEach((cat: any) => {
        stats[`cat${cat.id}`] = lines.filter(l => {
          const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return parts[8] === cat.id;
        }).length;
      });
      
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: "Chyba pri čítaní štatistík" });
    }
  });

  // Registration endpoint
  app.post("/api/register", (req, res, next) => {
    upload.array("photos", 10)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Súbor je príliš veľký (max 500MB)" });
        return res.status(400).json({ error: err.message });
      } else if (err) return res.status(500).json({ error: err.message });
      next();
    });
  }, async (req, res) => {
    try {
      const body = req.body;
      const files = req.files as Express.Multer.File[];
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Neboli nahrané žiadne fotografie / No photos uploaded" });
      }

      const rows: string[] = [];
      const timestamp = new Date().toISOString();
      const authorSafe = body.author.replace(/[^a-z0-9]/gi, '_');

      // Process each photo
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const photoInfo = JSON.parse(body.photoInfo)[index];
        const photoId = uuidv4();
        
        // 1. Rename logic: category-author-num-original.ext
        const ext = path.extname(file.originalname);
        const originalNameBase = path.basename(file.originalname, ext);
        const newOriginalName = `${photoInfo.category}-${authorSafe}-${index + 1}-${originalNameBase}${ext}`;
        const newOriginalPath = path.join(UPLOADS_DIR, newOriginalName);
        
        // Move original file to its permanent name
        fs.renameSync(file.path, newOriginalPath);

        // 2. Extract EXIF
        let metadata: any = {};
        try {
          const image = sharp(newOriginalPath);
          const meta = await image.metadata();
          if (meta.exif) {
            const parsedExif = exif(meta.exif) as any;
            metadata = {
              camera: parsedExif?.image?.Model || parsedExif?.Image?.Model,
              lens: parsedExif?.exif?.LensModel || parsedExif?.Exif?.LensModel,
              settings: parsedExif?.exif ? `${parsedExif.exif.ExposureTime}s f/${parsedExif.exif.FNumber} ISO ${parsedExif.exif.ISO}` : (parsedExif?.Exif ? `${parsedExif.Exif.ExposureTime}s f/${parsedExif.Exif.FNumber} ISO ${parsedExif.Exif.ISO}` : null),
              width: meta.width,
              height: meta.height
            };
          }
        } catch (mErr) {
          console.warn("Could not extract EXIF", mErr);
        }

        // 3. Create Web-Optimized version with Watermark
        const webName = `${photoId}.webp`;
        const webPath = path.join(UPLOADS_DIR, webName);
        
        const watermarkText = (settings.watermarkTemplate || "$author")
          .replace("$author", body.author);

        // Get dimensions to ensure watermark fits
        const imageForWeb = sharp(newOriginalPath);
        const webMeta = await imageForWeb.metadata();
        let targetWidth = webMeta.width || 2200;
        let targetHeight = webMeta.height || 2200;
        
        // Match sharp's 'inside' resize logic
        if (targetWidth > 2200 || targetHeight > 2200) {
          const ratio = Math.min(2200 / targetWidth, 2200 / targetHeight);
          targetWidth = Math.floor(targetWidth * ratio);
          targetHeight = Math.floor(targetHeight * ratio);
        }

        const wWidth = Math.min(targetWidth, 1000);
        const wX = wWidth - 20;

        // SVG overlay for watermark - width must be <= targetWidth
        const svgWatermark = `
          <svg width="${wWidth}" height="100">
            <style>
              .text { fill: ${settings.watermarkColor || "rgba(255,255,255,0.4)"}; font-family: sans-serif; font-size: ${settings.watermarkFontSize || 24}px; font-weight: bold; }
            </style>
            <text x="${wX}" y="80" text-anchor="end" class="text">${watermarkText}</text>
          </svg>
        `;

        await imageForWeb
          .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .composite([{
            input: Buffer.from(svgWatermark),
            gravity: 'southeast',
          }])
          .toFile(webPath);

        // 4. Save to CSV
        // id,author,email,instagram,webpage,address,category,photoName,originalPath,webPath,description,metadata,createdAt
        const row = [
          photoId,
          `"${body.author.replace(/"/g, '""')}"`,
          `"${body.email.replace(/"/g, '""')}"`,
          `"${body.instagram.replace(/"/g, '""')}"`,
          `"${(body.webpage || "").replace(/"/g, '""')}"`,
          `"${body.address.replace(/"/g, '""')}"`,
          body.gdprConsent || "false",
          body.rulesConsent || "false",
          photoInfo.category,
          `"${photoInfo.name.replace(/"/g, '""')}"`,
          newOriginalName,
          webName,
          `"${photoInfo.description.replace(/"/g, '""')}"`,
          `"${JSON.stringify(metadata).replace(/"/g, '""')}"`,
          timestamp,
          "true" // shortlisted
        ].join(",");
        rows.push(row);
      }

      fs.appendFileSync(REGISTRATIONS_CSV, rows.join("\n") + "\n");

      // Send success email
      const sendEmail = async () => {
        try {
          const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
          const transporter = getTransporter(settings);
          
          if (!transporter) {
            console.warn("SMTP credentials not configured. Skipping email.");
            return;
          }

          await transporter.sendMail({
            from: `"${settings.contestName}" <${settings.emailFrom}>`,
            to: body.email,
            subject: "Potvrdenie prihlášky / Application Confirmation",
            text: `Dobrý deň ${body.author},\n\nVaša prihláška do súťaže ${settings.contestName} bola úspešne prijatá. Nahrali ste ${files.length} fotografií.\n\nĎakujeme za účasť!\n\n---\n\nHello ${body.author},\n\nYour application for ${settings.contestName} has been successfully received. You uploaded ${files.length} photos.\n\nThank you for participating!`,
            html: `<h3>Potvrdenie prihlášky</h3><p>Dobrý deň <b>${body.author}</b>,</p><p>Vaša prihláška do súťaže ${settings.contestName} bola úspešne prijatá. Nahrali ste ${files.length} fotografií.</p><p>Ďakujeme za účasť!</p><hr/><p>Hello <b>${body.author}</b>,</p><p>Your application for ${settings.contestName} has been successfully received. You uploaded ${files.length} photos.</p><p>Thank you for participating!</p>`
          });
          console.log(`Email sent to ${body.email}`);
        } catch (error) {
          console.error("Email sending failed:", error);
        }
      };

      sendEmail();

      res.json({ success: true, message: "Prihláška bola úspešne odoslaná" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Interná chyba servera" });
    }
  });

  // Admin: Get all photos for management
  app.get("/api/admin/photos", (req, res) => {
    try {
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.json([]);
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const ratingsData = fs.existsSync(RATINGS_CSV) ? fs.readFileSync(RATINGS_CSV, "utf8").trim().split("\n").slice(1) : [];
      const votesData = fs.existsSync(PUBLIC_VOTES_CSV) ? fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").trim().split("\n").slice(1) : [];
      
      const photoRatings: Record<string, number[]> = {};
      ratingsData.forEach(r => {
        const parts = r.split(",");
        const pid = parts[2];
        const score = parseInt(parts[3]);
        if (!photoRatings[pid]) photoRatings[pid] = [];
        photoRatings[pid].push(score);
      });

      const photoVotes: Record<string, number> = {};
      votesData.forEach(v => {
        const [pid] = v.split(",");
        photoVotes[pid] = (photoVotes[pid] || 0) + 1;
      });

      const photos = lines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const pid = parts[0];
        const scores = photoRatings[pid] || [];
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        
        return {
          id: pid,
          author: (parts[1] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          email: (parts[2] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          category: parts[8] || "",
          name: (parts[9] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          originalPath: parts[10] || "",
          webPath: parts[11] || "",
          description: (parts[12] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          metadata: JSON.parse((parts[13] || "{}").replace(/^"|"$/g, '').replace(/""/g, '"') || "{}"),
          createdAt: parts[14] || "",
          shortlisted: parts[15] === "true",
          averageScore: parseFloat(avg.toFixed(2)),
          voteCount: photoVotes[pid] || 0
        };
      });
      res.json(photos);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Chyba pri načítaní fotografií" });
    }
  });

  // Jury: Get anonymized and randomized photos by category
  app.get("/api/jury/photos", (req, res) => {
    try {
      const { category } = req.query;
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.json([]);
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      
      let photos = lines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return {
          id: parts[0],
          category: parts[8] || "",
          name: (parts[9] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          webPath: parts[11] || "",
          description: (parts[12] || "").replace(/^"|"$/g, '').replace(/""/g, '"'),
          metadata: JSON.parse((parts[13] || "{}").replace(/^"|"$/g, '').replace(/""/g, '"') || "{}"),
          shortlisted: parts[15] === "true"
        };
      });

      if (category) {
        photos = photos.filter(p => p.category === category);
      }

      // If in final judging session, only show shortlisted photos
      if (settings.contestStatus === "judging") {
        const hasShortlisted = photos.some(p => p.shortlisted);
        if (hasShortlisted) {
          photos = photos.filter(p => p.shortlisted);
        }
      }

      // Shuffle randomized
      for (let i = photos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }

      res.json(photos);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Chyba pri načítaní súťažných fotografií" });
    }
  });

  // Public: Get anonymized and randomized photos for the whole contest
  // Secure Photo Proxy: Prevents direct hotlinking and hides real paths
  app.get("/api/photo/:id", (req, res) => {
    try {
      const { id } = req.params;
      const filename = id.includes(".") ? id : `${id}.webp`;
      
      // Simple anti-hotlinking: Check if referer is from our site
      const referer = req.headers.referer || "";
      const host = req.headers.host || "";
      
      // Bypass referer check in development or for admin requests
      const isDevelopment = process.env.NODE_ENV !== "production";
      const isInternal = referer.includes(host) || !referer; 

      if (!isDevelopment && referer && !isInternal) {
        console.warn(`Hotlinking blocked for ${filename} from ${referer}`);
        return res.status(403).send("Forbidden");
      }

      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(filePath);
      }
      res.status(404).send("Not found");
    } catch (e) {
      res.status(500).send("Error");
    }
  });

  app.get("/api/public/gallery", (req, res) => {
    try {
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.json([]);
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const photos = lines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return {
          id: parts[0],
          category: parts[8],
          name: parts[9] ? parts[9].replace(/^"|"$/g, '').replace(/""/g, '"') : "",
          webPath: parts[11],
          description: parts[12] ? parts[12].replace(/^"|"$/g, '').replace(/""/g, '"') : "",
        };
      });

      // Randomized shuffle
      for (let i = photos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }

      res.json(photos);
    } catch (e) {
      res.status(500).json({ error: "Chyba pri načítaní galérie" });
    }
  });

  // Public: Vote for a photo
  app.post("/api/public/vote", (req, res) => {
    try {
      const { photoId, fingerprint } = req.body;
      if (!photoId) return res.status(400).json({ error: "Chýbajúce údaje" });

      const ip = getClientIp(req);
      const voterId = fingerprint || ip; // Use fingerprint if available, fallback to IP

      // Check if already voted in current session (simple CSV scan for demo, ideally a Set or DB)
      if (fs.existsSync(PUBLIC_VOTES_CSV)) {
        const votes = fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").split("\n");
        const alreadyVoted = votes.some(v => {
          const [pid, , vip] = v.split(",");
          return pid === photoId && vip === voterId;
        });
        if (alreadyVoted) {
          return res.status(429).json({ error: "Z tohto zariadenia ste už za túto fotku hlasovali" });
        }
      }

      const row = `${photoId},${new Date().toISOString()},${voterId}\n`;
      fs.appendFileSync(PUBLIC_VOTES_CSV, row);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Chyba pri hlasovaní" });
    }
  });

  // Public: Check voted photos for current visitor (now handled client-side for privacy)
  app.get("/api/public/my-votes/:fingerprint", (req, res) => {
    res.json([]); // Explicitly empty to protect privacy
  });

  // Admin: Get public voting stats
  app.get("/api/admin/public-results", (req, res) => {
    try {
      const votesData = fs.readFileSync(PUBLIC_VOTES_CSV, "utf8");
      const votesLines = votesData.trim().split("\n").slice(1);
      
      const counts: Record<string, number> = {};
      votesLines.forEach(line => {
        const parts = line.split(",");
        const photoId = parts[0];
        counts[photoId] = (counts[photoId] || 0) + 1;
      });

      res.json(counts);
    } catch (e) {
      res.json({});
    }
  });

  // Admin: Get jury evaluation results
  app.get("/api/admin/dashboard-stats", (req, res) => {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      const registrations = fs.existsSync(REGISTRATIONS_CSV) ? fs.readFileSync(REGISTRATIONS_CSV, "utf8").trim().split("\n").slice(1) : [];
      const visits = fs.existsSync(VISITS_CSV) ? fs.readFileSync(VISITS_CSV, "utf8").trim().split("\n").slice(1) : [];
      const publicVotes = fs.existsSync(PUBLIC_VOTES_CSV) ? fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").trim().split("\n").slice(1) : [];

      const totalPhotos = registrations.length;
      const uniqueAuthors = new Set(registrations.map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)[2])).size;
      const totalPublicVotes = publicVotes.length;

      // Activity for the last 14 days
      const last14Days = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return d.toISOString().split("T")[0];
      });

      const visitsByDay = last14Days.map(day => ({
        day,
        visits: visits.filter(v => v.startsWith(day)).length,
        votes: publicVotes.filter(v => {
            const parts = v.split(",");
            return parts[1] && parts[1].startsWith(day);
        }).length
      }));

      res.json({
        totalPhotos,
        uniqueAuthors,
        totalPublicVotes,
        dailyAccess: visitsByDay[13].visits,
        activity: visitsByDay
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Admin: Get jury evaluation results
  app.get("/api/admin/jury-results", (req, res) => {
    try {
      if (!fs.existsSync(RATINGS_CSV)) return res.json([]);
      const data = fs.readFileSync(RATINGS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const summary: Record<string, { total: number, count: number }> = {};
      lines.forEach(l => {
        const parts = l.split(",");
        const pid = parts[2];
        const score = parseInt(parts[3]);
        if (pid && !isNaN(score)) {
          if (!summary[pid]) summary[pid] = { total: 0, count: 0 };
          summary[pid].total += score;
          summary[pid].count += 1;
        }
      });

      const results = Object.entries(summary).map(([id, s]) => ({
        id,
        avg: parseFloat((s.total / s.count).toFixed(2)),
        votes: s.count
      })).sort((a, b) => b.avg - a.avg);

      res.json(results);
    } catch (e) {
      res.status(500).json({ error: "Chyba pri výpočte výsledkov" });
    }
  });

  app.get("/api/admin/stats", (req, res) => {
    try {
      const stats: any = {
        totalPhotos: 0,
        totalVotes: 0,
        totalVisits: 0,
        dailyVisits: {} as Record<string, number>,
        dailyVotes: {} as Record<string, number>,
        categoryStats: {} as Record<string, number>,
      };

      if (fs.existsSync(VISITS_CSV)) {
        const visits = fs.readFileSync(VISITS_CSV, "utf8").trim().split("\n").slice(1);
        stats.totalVisits = visits.length;
        visits.forEach(v => {
          const [date] = v.split(",");
          stats.dailyVisits[date] = (stats.dailyVisits[date] || 0) + 1;
        });
      }

      if (fs.existsSync(REGISTRATIONS_CSV)) {
        const lines = fs.readFileSync(REGISTRATIONS_CSV, "utf8").trim().split("\n").slice(1);
        stats.totalPhotos = lines.length;
        lines.forEach(l => {
          const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          const cat = parts[8] || "N/A";
          stats.categoryStats[cat] = (stats.categoryStats[cat] || 0) + 1;
        });
      }

      if (fs.existsSync(PUBLIC_VOTES_CSV)) {
        const votes = fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").trim().split("\n").slice(1);
        stats.totalVotes = votes.length;
        votes.forEach(v => {
          const parts = v.split(",");
          const date = parts[1] ? parts[1].split("T")[0] : "unknown";
          stats.dailyVotes[date] = (stats.dailyVotes[date] || 0) + 1;
        });
      }

      res.json(stats);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  app.get("/api/admin/export/results-csv", (req, res) => {
    try {
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.status(404).send("No data");
      const photosData = fs.readFileSync(REGISTRATIONS_CSV, "utf8").trim().split("\n").slice(1);
      const ratingsData = fs.existsSync(RATINGS_CSV) ? fs.readFileSync(RATINGS_CSV, "utf8").trim().split("\n").slice(1) : [];
      const votesData = fs.existsSync(PUBLIC_VOTES_CSV) ? fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").trim().split("\n").slice(1) : [];
      
      const juryRatings: Record<string, number[]> = {};
      ratingsData.forEach(r => {
        const p = r.split(",");
        if (!juryRatings[p[0]]) juryRatings[p[0]] = [];
        juryRatings[p[0]].push(parseInt(p[3]));
      });

      const publicVotes: Record<string, number> = {};
      votesData.forEach(v => {
        const pid = v.split(",")[0];
        publicVotes[pid] = (publicVotes[pid] || 0) + 1;
      });

      let csv = "\uFEFFID,Autor,Kategória,Názov diela,Priemer poroty,Počet hlasov poroty,Hlasy verejnosti\n";
      photosData.forEach(line => {
        const p = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const pid = p[0];
        const scores = juryRatings[pid] || [];
        const avg = scores.length > 0 ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : "0";
        csv += `${pid},"${(p[1]||"").replace(/"/g,'')}",${p[8]},"${(p[9]||"").replace(/"/g,'')}",${avg},${scores.length},${publicVotes[pid]||0}\n`;
      });
      res.attachment("vysledky_sutaze.csv");
      res.send(csv);
    } catch (e) {
      console.error(e);
      res.status(500).send("Export failed");
    }
  });

  app.get("/api/admin/export/total-archive", async (req, res) => {
    try {
      const archive = new ZipArchive({ zlib: { level: 9 } });
      res.attachment("speleofotografia_komplet_export.zip");
      archive.pipe(res);

      if (!fs.existsSync(REGISTRATIONS_CSV)) {
         return res.status(404).send("No registrations found");
      }

      const photosRaw = fs.readFileSync(REGISTRATIONS_CSV, "utf8").trim().split("\n").slice(1);
      const ratingsRaw = fs.existsSync(RATINGS_CSV) ? fs.readFileSync(RATINGS_CSV, "utf8").trim().split("\n").slice(1) : [];
      const votesRaw = fs.existsSync(PUBLIC_VOTES_CSV) ? fs.readFileSync(PUBLIC_VOTES_CSV, "utf8").trim().split("\n").slice(1) : [];

      // 1. Process Ratings
      const juryScores: Record<string, number[]> = {};
      const juryBreakdown: Record<string, Record<string, number>> = {};
      ratingsRaw.forEach(r => {
        const parts = r.split(",");
        if (parts.length < 4) return;
        const [pId, evalId, _, score] = parts;
        if (!juryScores[pId]) juryScores[pId] = [];
        juryScores[pId].push(parseInt(score));
        if (!juryBreakdown[pId]) juryBreakdown[pId] = {};
        juryBreakdown[pId][evalId] = parseInt(score);
      });

      // 2. Process Public Votes
      const publicVotes: Record<string, number> = {};
      votesRaw.forEach(v => {
        const pid = v.split(",")[0];
        publicVotes[pid] = (publicVotes[pid] || 0) + 1;
      });

      // 3. Generate Complete Results CSV
      let resultsCsv = "\uFEFFID,Autor,Email,Instagram,Adresa,Kategória,Názov diela,Jazyk,Priemer poroty,Počet hlasov poroty,Verejné hlasy,Príbeh\n";
      
      // 4. Organize Photos into Folders
      photosRaw.forEach(line => {
        const p = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (p.length < 11) return;
        
        const pid = p[0];
        const author = p[1].replace(/"/g, '');
        const email = p[2].replace(/"/g, '');
        const address = p[5].replace(/"/g, '');
        const category = p[8];
        const title = p[9].replace(/"/g, '');
        const originalFile = p[10];
        const story = (p[12] || "").replace(/"/g, '""');

        const scores = juryScores[pid] || [];
        const avg = scores.length > 0 ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : "0";

        resultsCsv += `${pid},"${author}","${email}","${p[3]}","${address}",${category},"${title}",${p[7]},${avg},${scores.length},${publicVotes[pid]||0},"${story}"\n`;

        // Add photo file to zip in category folder
        const photoPath = path.join(UPLOADS_DIR, originalFile);
        if (fs.existsSync(photoPath)) {
          const safeTitle = removeDiacritics(title);
          const safeAuthor = removeDiacritics(author);
          const zipFileName = `fotografie/Kategoria_${category}/${category}_${safeAuthor}_${safeTitle}${path.extname(originalFile)}`;
          archive.file(photoPath, { name: zipFileName });
        }
      });

      archive.append(resultsCsv, { name: "vysledky_komplet.csv" });

      // 5. Generate Detailed Jury Breakdown CSV
      const evaluators = Array.from(new Set(ratingsRaw.map(r => r.split(",")[1])));
      let juryCsv = "\uFEFFID fotky,Názov diela," + evaluators.join(",") + ",Priemer\n";
      
      photosRaw.forEach(line => {
        const p = line.split(/,(?=(?:(?:[^"]*"){2})*[^()]*"$)/); // Using a simpler split for jury CSV if possible, but let's stick to the previous one
        const p_split = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (p_split.length < 10) return;
        const pid = p_split[0];
        const title = p_split[9].replace(/"/g, '');
        const scores = juryScores[pid] || [];
        const avg = scores.length > 0 ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : "0";

        let row = `${pid},"${title}"`;
        evaluators.forEach(evId => {
          row += `,${juryBreakdown[pid]?.[evId] || ""}`;
        });
        row += `,${avg}\n`;
        juryCsv += row;
      });
      
      archive.append(juryCsv, { name: "hlasovanie_podrobne.csv" });

      archive.finalize();
    } catch (e) {
      console.error("Export error:", e);
      if (!res.headersSent) res.status(500).send("Export failed");
    }
  });

  app.get("/api/admin/export/photos-zip", (req, res) => {
    try {
      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on("error", (err) => { throw err; });
      archive.pipe(res);
      
      // Add photos from UPLOADS_DIR
      // We only want authors' photos if possible, but let's just zip the whole directory for simplicity
      // and exclusion of processed webp files if preferred.
      const files = fs.readdirSync(UPLOADS_DIR);
      files.forEach(file => {
        // Only include non-webp files (original uploads)
        if (!file.endsWith(".webp")) {
          archive.file(path.join(UPLOADS_DIR, file), { name: file });
        }
      });
      
      archive.finalize();
    } catch (e) {
      res.status(500).send("Export error");
    }
  });

  app.post("/api/admin/communicate", async (req, res) => {
    try {
      const { email, subject, message } = req.body;
      const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
      
      const transporter = getTransporter(settings);
      
      if (!transporter) {
        return res.status(400).json({ error: "SMTP credentials not configured" });
      }

      await transporter.sendMail({
        from: `"${settings.contestName}" <${settings.emailFrom}>`,
        to: email,
        subject,
        text: message,
        html: `<div style="font-family:sans-serif;line-height:1.6;">${message.replace(/\n/g, '<br/>')}</div>`
      });

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.get("/api/check-uploads", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email || !fs.existsSync(REGISTRATIONS_CSV)) return res.json({});
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      
      const counts: Record<string, number> = {};
      lines.forEach(l => {
        const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const entryEmail = parts[2] ? parts[2].replace(/^"|"$/g, '').toLowerCase() : "";
        if (entryEmail === email.toLowerCase()) {
          const cat = parts[8];
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      res.json(counts);
    } catch (e) {
      res.status(500).json({ error: "Chyba pri kontrole limitov" });
    }
  });

  app.post("/api/admin/photos/bulk-delete", (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No IDs provided" });
      }

      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.status(404).json({ error: "Not found" });
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n");
      const header = lines[0];
      const registrations = lines.slice(1);

      const idSet = new Set(ids);
      const remaining: string[] = [];
      const toDelete: string[] = [];

      for (const line of registrations) {
        const id = line.split(",")[0];
        if (idSet.has(id)) {
          toDelete.push(line);
        } else {
          remaining.push(line);
        }
      }

      for (const line of toDelete) {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const originalName = parts[10];
        const webName = parts[11];
        if (originalName) {
           const op = path.join(UPLOADS_DIR, originalName);
           if (fs.existsSync(op)) fs.unlinkSync(op);
        }
        if (webName) {
           const wp = path.join(UPLOADS_DIR, webName);
           if (fs.existsSync(wp)) fs.unlinkSync(wp);
        }
      }

      fs.writeFileSync(REGISTRATIONS_CSV, header + "\n" + remaining.join("\n") + (remaining.length ? "\n" : ""));
      res.json({ success: true, count: toDelete.length });
    } catch (e) {
      console.error("Bulk delete error:", e);
      res.status(500).json({ error: "Chyba pri hromadnom mazaní" });
    }
  });

  app.post("/api/admin/photos/delete-all", (req, res) => {
    try {
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.json({ success: true, count: 0 });
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n");
      const header = lines[0];
      const registrations = lines.slice(1);

      for (const line of registrations) {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const originalName = parts[10];
        const webName = parts[11];
        if (originalName) {
           const op = path.join(UPLOADS_DIR, originalName);
           if (fs.existsSync(op)) fs.unlinkSync(op);
        }
        if (webName) {
           const wp = path.join(UPLOADS_DIR, webName);
           if (fs.existsSync(wp)) fs.unlinkSync(wp);
        }
      }

      fs.writeFileSync(REGISTRATIONS_CSV, header + "\n");
      res.json({ success: true, count: registrations.length });
    } catch (e) {
      console.error("Delete all error:", e);
      res.status(500).json({ error: "Chyba pri mazaní všetkého" });
    }
  });

  app.delete("/api/admin/photos/:id", (req, res) => {
    try {
      const { id } = req.params;
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.status(404).json({ error: "Not found" });
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n");
      const header = lines[0];
      const remaining = lines.slice(1).filter(l => !l.startsWith(id + ","));
      
      const deletedLine = lines.slice(1).find(l => l.startsWith(id + ","));
      if (deletedLine) {
        const parts = deletedLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const originalName = parts[10];
        const webName = parts[11];
        
        const originalPath = path.join(UPLOADS_DIR, originalName);
        const webPath = path.join(UPLOADS_DIR, webName);
        
        if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        if (fs.existsSync(webPath)) fs.unlinkSync(webPath);
      }

      fs.writeFileSync(REGISTRATIONS_CSV, header + "\n" + remaining.join("\n") + (remaining.length ? "\n" : ""));
      res.json({ success: true });
    } catch (e) {
      console.error("Delete error:", e);
      res.status(500).json({ error: "Chyba pri mazaní" });
    }
  });

  app.patch("/api/admin/photos/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      if (!fs.existsSync(REGISTRATIONS_CSV)) return res.status(404).json({ error: "Not found" });
      
      const data = fs.readFileSync(REGISTRATIONS_CSV, "utf8");
      const lines = data.trim().split("\n");
      const header = lines[0];
      const registrations = lines.slice(1);
      
      let found = false;
      const newLines = registrations.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts[0] === id) {
          found = true;
          // 0:id, 1:author, 2:email, 3:instagram, 4:webpage, 5:address, 6:gdpr, 7:rules, 8:category, 9:name, 10:orig, 11:web, 12:desc, 13:meta, 14:date
          if (updates.author !== undefined) parts[1] = `"${updates.author.replace(/"/g, '""')}"`;
          if (updates.email !== undefined) parts[2] = `"${updates.email.replace(/"/g, '""')}"`;
          if (updates.category !== undefined) parts[8] = updates.category;
          if (updates.name !== undefined) parts[9] = `"${updates.name.replace(/"/g, '""')}"`;
          if (updates.description !== undefined) parts[12] = `"${updates.description.replace(/"/g, '""')}"`;
          if (updates.shortlisted !== undefined) parts[15] = updates.shortlisted ? "true" : "false";
          return parts.join(",");
        }
        return line;
      });
      
      if (!found) return res.status(404).json({ error: "Photo not found" });
      
      fs.writeFileSync(REGISTRATIONS_CSV, header + "\n" + newLines.join("\n") + "\n");
      res.json({ success: true });
    } catch (e) {
      console.error("Update error:", e);
      res.status(500).json({ error: "Chyba pri aktualizácii" });
    }
  });
  // Direct bulk upload for testing from computer
  app.post("/api/admin/bulk-upload", (req, res, next) => {
    upload.array("photos")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Súbor je príliš veľký (max 500MB)" });
        return res.status(400).json({ error: err.message });
      } else if (err) return res.status(500).json({ error: err.message });
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files" });
      const result = await processStressFiles(files);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Bulk upload failed" });
    }
  });

  // Stress test import from /demo directory
  app.post("/api/admin/stress-upload", async (req, res) => {
    try {
      const demoDir = path.join(__dirname, "demo");
      if (!fs.existsSync(demoDir)) {
        return res.status(404).json({ error: "Demo directory not found at " + demoDir });
      }
      
      const files = fs.readdirSync(demoDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
      if (files.length === 0) {
        return res.status(400).json({ error: "No image files found in demo directory" });
      }

      // Convert local files to mock Multer objects for processStressFiles
      const mockFiles = files.map(filename => {
        const filePath = path.join(demoDir, filename);
        const destPath = path.join(UPLOADS_DIR, `temp_${uuidv4()}${path.extname(filename)}`);
        fs.copyFileSync(filePath, destPath);
        return {
          path: destPath,
          originalname: filename
        } as Express.Multer.File;
      });

      const result = await processStressFiles(mockFiles);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Stress import failed" });
    }
  });

  // Helper for processing stress test files
  async function processStressFiles(files: Express.Multer.File[]) {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
    const rows: string[] = [];
    const timestamp = new Date().toISOString();
    const dummyAuthors = ["Janko Hraško", "Ferko Mrkvička", "Zuzka Veselá", "Peter Jaskyniar", "Anna Hlboká", "Elena Speleo", "Marek Jaskyňa"];
    
    const results: any[] = [];
    console.log(`Starting stress process for ${files.length} files...`);

    for (const file of files) {
      try {
        const photoId = uuidv4();
        const author = dummyAuthors[Math.floor(Math.random() * dummyAuthors.length)];
        
        let category = settings.categories?.[0]?.id || "A";
        const baseName = file.originalname.toUpperCase();
        if (baseName.startsWith("B")) category = "B";
        else if (baseName.startsWith("A")) category = "A";

        const ext = path.extname(file.originalname);
        const newOriginalName = `stress_${category}_${photoId}${ext}`;
        const newOriginalPath = path.join(UPLOADS_DIR, newOriginalName);
        
        fs.renameSync(file.path, newOriginalPath);

        const webName = `${photoId}.webp`;
        const webPath = path.join(UPLOADS_DIR, webName);

        let watermarkStatus = "success";
        try {
          await sharp(newOriginalPath)
            .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .composite([{
              input: Buffer.from(`
                <svg width="800" height="100">
                  <text x="780" y="80" text-anchor="end" font-family="sans-serif" font-size="${settings.watermarkFontSize || 24}" font-weight="bold" fill="${settings.watermarkColor || "rgba(255,255,255,0.4)"}">${settings.watermarkTemplate || "Speleofotografia 2026"}</text>
                </svg>
              `),
              gravity: 'southeast',
            }])
            .toFile(webPath);
        } catch (sharpErr) {
          console.warn(`Sharp failed for ${file.originalname}, using fallback`, sharpErr);
          fs.copyFileSync(newOriginalPath, webPath);
          watermarkStatus = "fallback (no watermark)";
        }

        const originalName = file.originalname;
        // Basic encoding fix: if it looks like broken UTF-8 interpreted as Latin1
        const safeOriginalName = Buffer.from(originalName, 'binary').toString('utf8').replace(/[^\x20-\x7E\u00A0-\u017F]/g, '');

        const row = [
          photoId, `"${author}"`, `"stress@test.com"`, `""`, `""`, `"Stress Test St 1"`,
          "true", "true", category, `"${safeOriginalName.replace(/"/g, '""')}"`,
          newOriginalName, webName, `"Stress test import"`, `"{}"`, timestamp, "true"
        ].join(",");
        rows.push(row);
        
        results.push({ name: safeOriginalName, status: "success", watermark: watermarkStatus });
        console.log(`[OK] Processed ${safeOriginalName} -> ${category}`);
      } catch (err: any) {
        console.error(`[ERROR] Failed to process ${file.originalname}:`, err);
        results.push({ name: file.originalname, status: "error", error: err.message });
      }
    }

    if (rows.length > 0) {
      fs.appendFileSync(REGISTRATIONS_CSV, rows.join("\n") + "\n");
    }
    
    return { count: rows.length, details: results };
  }


  app.post("/api/admin/generate-test-data", (req, res) => {
    try {
      const settings = fs.existsSync(SETTINGS_JSON) ? JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8")) : {};
      if (!settings.debugMode) {
        return res.status(403).json({ error: "Debug mode is disabled" });
      }

      const id = Date.now().toString();
      const author = "TEST";
      const email = "test@example.com";
      const category = settings.categories?.[0]?.id || "A";
      const photoName = "Test Photo " + id;
      
      // Use existing file if available, otherwise write dummy
      const existingFiles = fs.readdirSync(UPLOADS_DIR).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
      let fileName = "";
      if (existingFiles.length > 0) {
        const ext = path.extname(existingFiles[0]);
        const baseName = `test_${id}`;
        fileName = baseName + ext;
        const targetPath = path.join(UPLOADS_DIR, fileName);
        fs.copyFileSync(path.join(UPLOADS_DIR, existingFiles[0]), targetPath);
      } else {
        fileName = `test_${id}.jpg`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fileName), "dummy jpeg content");
      }

      const row = [
        id,
        `"${author}"`,
        `"${email}"`,
        `""`, // instagram
        `""`, // webpage
        `"Test Address"`,
        `"true"`, // gdpr
        `"true"`, // rules
        `"${category}"`,
        `"${photoName}"`,
        `"${fileName}"`, // original
        `"${fileName}"`, // web
        `"Test description for debug purposes."`,
        `""`, // metadata
        `"${new Date().toISOString()}"`,
        `"false"` // shortlisted
      ].join(",");

      fs.appendFileSync(REGISTRATIONS_CSV, row + "\n");
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to generate test data" });
    }
  });

  // Admin: Get evaluators
  app.get("/api/evaluators", (req, res) => {
    try {
      const data = fs.readFileSync(EVALUATORS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      const evals = lines.map(line => {
        const parts = line.split(",");
        return { id: parts[0], name: parts[1], role: parts[2] };
      });
      res.json(evals);
    } catch (e) {
      res.status(500).json({ error: "Chyba pri načítaní hodnotiteľov" });
    }
  });

  // Admin: Create evaluator
  app.post("/api/evaluators", (req, res) => {
    const { name } = req.body;
    const id = uuidv4();
    fs.appendFileSync(EVALUATORS_CSV, `${id},${name},evaluator\n`);
    res.json({ id, name });
  });

  // Evaluator: Submit rating
  app.post("/api/rate", (req, res) => {
    const { evalId, evalName, photoId, score } = req.body;
    const timestamp = new Date().toISOString();
    
    try {
      let content = "";
      if (fs.existsSync(RATINGS_CSV)) {
        content = fs.readFileSync(RATINGS_CSV, "utf8");
      }
      
      const lines = content.trim().split("\n");
      const header = lines[0] || "evalId,evalName,photoId,score,createdAt";
      
      // Filter out previous rating from this evaluator for this photo
      const otherLines = lines.slice(1).filter(line => {
        if (!line.trim()) return false;
        const parts = line.split(",");
        // evalId is index 0, photoId is index 2
        return !(parts[0] === evalId && parts[2] === photoId);
      });
      
      const newLine = `${evalId},${evalName},${photoId},${score},${timestamp}`;
      const newContent = [header, ...otherLines, newLine].filter(l => l.trim()).join("\n") + "\n";
      
      fs.writeFileSync(RATINGS_CSV, newContent);
      res.json({ success: true });
    } catch (e) {
      console.error("Error saving rating:", e);
      res.status(500).json({ error: "Chyba pri ukladaní hodnotenia" });
    }
  });

  // Evaluator: Get my ratings
  app.get("/api/ratings/:evalId", (req, res) => {
    try {
      if (!fs.existsSync(RATINGS_CSV)) return res.json([]);
      const data = fs.readFileSync(RATINGS_CSV, "utf8");
      const lines = data.trim().split("\n").slice(1);
      const ratings = lines
        .filter(l => l.startsWith(req.params.evalId))
        .map(line => {
          const parts = line.split(",");
          return { photoId: parts[2], score: parseInt(parts[3]) };
        });
      res.json(ratings);
    } catch (e) {
      res.json([]);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite dev server...");
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const listenPath = isProduction ? path.join(process.cwd(), 'server.sock') : PORT;

  if (isProduction && fs.existsSync(listenPath)) {
    fs.unlinkSync(listenPath);
  }

  app.listen(listenPath, () => {
    console.log(`Server running on ${isProduction ? 'unix:' + listenPath : 'http://localhost:' + PORT}`);
    if (isProduction) {
      fs.chmodSync(listenPath, '0777');
    }
  });
}

console.log("Starting server...");
startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
  process.exit(1);
});
