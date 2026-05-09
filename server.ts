import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import nodemailer from "nodemailer";
import sharp from "sharp";
import exif from "exif-reader";
import archiver from "archiver";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

console.log("Modules loaded");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Initialize admins database
  if (!fs.existsSync(ADMINS_JSON)) {
    const initialAdmins = [
      { email: "admin@sss.sk", password: "adminblesk11", role: "superadmin" }
    ];
    fs.writeFileSync(ADMINS_JSON, JSON.stringify(initialAdmins, null, 2));
    console.log("Initialized admins.json with default admin");
  } else {
    // Ensure admin@sss.sk exists and has correct password for recovery
    try {
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      const adminIndex = admins.findIndex((a: any) => a.email.toLowerCase() === "admin@sss.sk");
      if (adminIndex === -1) {
        admins.push({ email: "admin@sss.sk", password: "adminblesk11", role: "superadmin" });
        console.log("Restored master admin to admins.json");
      } else {
        // Force reset password for the master admin to ensure access
        admins[adminIndex].password = "adminblesk11";
        console.log("Ensured master admin password is adminblesk11");
      }
      fs.writeFileSync(ADMINS_JSON, JSON.stringify(admins, null, 2));
    } catch (e) {
      console.error("Error updating admins.json during init:", e);
    }
  }

  // Initialize invitations storage
  if (!fs.existsSync(INVITATIONS_JSON)) {
    fs.writeFileSync(INVITATIONS_JSON, JSON.stringify([], null, 2));
  }
  console.log("Data files initialized");

  app.use(express.json());
  console.log("Middlewares configured");
  
  // Serve uploaded photos
  app.use("/uploads", express.static(UPLOADS_DIR));

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
    limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
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

const SETTINGS_JSON = path.join(DATA_DIR, "settings.json");

// Default settings
const DEFAULT_SETTINGS = {
  // Public settings
  contestName: "Speleofotografia 2025",
  museumName: "Slovenské múzeum ochrany prírody a jaskyniarstva",
  edition: "23. ročník",
  contestStatus: "submissions",
  categories: [
    { id: "A", name: "Krása jaskýň / Cave Beauty" },
    { id: "B", name: "Speleomoment / Speleomoment" }
  ],
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
  watermarkTemplate: "$author | Speleofotografia 2026",
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
  const allSettings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
  // Return only fields safe for the public registration form
  const publicFields = [
    "contestName", 
    "museumName", 
    "edition", 
    "contestStatus",
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
});

// Admin settings (full access - only called by authorized clients)
app.get("/api/admin/settings", (req, res) => {
  // In a real app we'd check session, here we rely on the client knowing the flow
  const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
  res.json(settings);
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
    console.log(`Login attempt for: "${email}"`);
    if (!email || !password) {
      console.log("Login failed: Missing email or password");
      return res.status(401).json({ error: "Chýbajúce údaje / Missing credentials" });
    }
    try {
      const admins = JSON.parse(fs.readFileSync(ADMINS_JSON, "utf8"));
      const admin = admins.find((a: any) => 
        a.email && a.email.toLowerCase().trim() === email.toLowerCase().trim() && 
        a.password && a.password.trim() === password.trim()
      );
      
      if (admin) {
        console.log(`Login success for: ${email}`);
        res.json({ success: true, email: admin.email, role: admin.role });
      } else {
        console.log(`Login failed for: ${email} - invalid credentials`);
        res.status(401).json({ error: "Nesprávne údaje / Incorrect credentials" });
      }
    } catch (e) {
      console.error(`Login error:`, e);
      res.status(500).json({ error: "Chyba pri prihlásení" });
    }
  });

  // Admin management
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
      if (settings.smtpUser && settings.smtpPass) {
        console.log(`Sending invitation email to ${email} via ${settings.smtpHost}`);
        const transporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: parseInt(settings.smtpPort),
          secure: settings.smtpSecure === "true",
          auth: { user: settings.smtpUser, pass: settings.smtpPass },
        });

        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const host = req.headers["x-forwarded-host"] || req.get("host");
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

      if (settings.smtpUser && settings.smtpPass) {
        console.log(`Attempting to send reset email to ${email} via ${settings.smtpHost}:${settings.smtpPort}`);
        const transporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: parseInt(settings.smtpPort),
          secure: settings.smtpSecure === "true",
          auth: { user: settings.smtpUser, pass: settings.smtpPass },
        });

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
  app.post("/api/register", upload.array("photos", 10), async (req, res) => {
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

        // SVG overlay for watermark
        const svgWatermark = `
          <svg width="1000" height="100">
            <style>
              .text { fill: rgba(255,255,255,0.4); font-family: sans-serif; font-size: 24px; font-weight: bold; }
            </style>
            <text x="980" y="80" text-anchor="end" class="text">${watermarkText}</text>
          </svg>
        `;

        await sharp(newOriginalPath)
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
          "false" // shortlisted
        ].join(",");
        rows.push(row);
      }

      fs.appendFileSync(REGISTRATIONS_CSV, rows.join("\n") + "\n");

      // Send success email
      const sendEmail = async () => {
        try {
          const settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
          
          if (!settings.smtpUser || !settings.smtpPass) {
            console.warn("SMTP credentials not configured in settings. Skipping email.");
            return;
          }

          const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: parseInt(settings.smtpPort),
            secure: settings.smtpSecure === "true",
            auth: {
              user: settings.smtpUser,
              pass: settings.smtpPass,
            },
          });

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
        photos = photos.filter(p => p.shortlisted);
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
          name: parts[9].replace(/^"|"$/g, '').replace(/""/g, '"'),
          webPath: parts[11],
          description: parts[12].replace(/^"|"$/g, '').replace(/""/g, '"'),
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
      const { photoId } = req.body;
      if (!photoId) return res.status(400).json({ error: "Chýbajúce údaje" });

      const row = `${photoId},${new Date().toISOString()}\n`;
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
        const [photoId] = line.split(",");
        counts[photoId] = (counts[photoId] || 0) + 1;
      });

      res.json(counts);
    } catch (e) {
      res.json({});
    }
  });

  app.get("/api/admin/export/photos-zip", (req, res) => {
    try {
      const archive = archiver("zip", { zlib: { level: 9 } });
      res.attachment("contest_photos.zip");
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
      
      if (!settings.smtpUser || !settings.smtpPass) {
        return res.status(400).json({ error: "SMTP credentials not configured" });
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: parseInt(settings.smtpPort),
        secure: settings.smtpSecure === "true",
        auth: { user: settings.smtpUser, pass: settings.smtpPass },
      });

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
    fs.appendFileSync(RATINGS_CSV, `${evalId},${evalName},${photoId},${score},${timestamp}\n`);
    res.json({ success: true });
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

console.log("Starting server...");
startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
  process.exit(1);
});
