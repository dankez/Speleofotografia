#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speleofotografia 2026 - Last Call Reminder Broadcast Tool
Posledná pripomienka pre účastníkov, ktorí zatiaľ neprihlásili fotografie.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import csv
import os
import sys
import time
import html
import random
import unicodedata

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
if not os.path.exists(ENV_PATH):
    ENV_PATH = "/home/dankez/speleof2026/.env"

PARTICIPANTS_CSV = "/home/dankez/unique_participants.csv"
RESULTS_CSV = os.path.join(BASE_DIR, "speleofotografia_vysledky_2026-09-14.csv")
LOG_FILE = os.path.join(BASE_DIR, "scripts", "reminder_broadcast.log")
REPORT_FILE = os.path.join(BASE_DIR, "scripts", "reminder_broadcast_report.txt")

SSJ_LOGO_PATH = "/home/dankez/Downloads/ssj.png"
SPELEOF_LOGO_PATH = "/home/dankez/Downloads/359788000_656330929866184_6636041576054129927_n.png"

ADMIN_EMAIL = "michal.danko@gmail.com"
ADMIN_NAME = "Michal Danko"

def log_broadcast(msg):
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")

def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                v = v.strip().strip('"').strip("'")
                env[k.strip()] = v
    return env

env = load_env(ENV_PATH)

def normalize_text(s):
    if not s:
        return ""
    s = html.unescape(s)
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    return ''.join(c.lower() for c in s if c.isalnum())

def get_contest_and_recipient_stats():
    """
    Parses current 2026 submissions and original participants.
    Returns:
      stats: dict with photo count, author count, etc.
      already_submitted: list of (email, name, reason)
      pending_to_send: list of (email, name)
      excluded: list of (email, name, reason)
    """
    reg_authors = {}
    reg_emails = set()
    total_photos = 0
    unique_contest_authors = set()

    if os.path.exists(RESULTS_CSV):
        with open(RESULTS_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_photos += 1
                em = row.get("Email", "").strip().lower()
                if em:
                    reg_emails.add(em)
                auth = row.get("Autor", "").strip()
                if auth:
                    unique_contest_authors.add(auth)
                    reg_authors[normalize_text(auth)] = (auth, em)

    old_list = []
    if os.path.exists(PARTICIPANTS_CSV):
        with open(PARTICIPANTS_CSV, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            try:
                next(reader) # Header
            except StopIteration:
                pass
            for row in reader:
                if row and len(row) >= 2:
                    old_list.append((row[0].strip().lower(), row[1].strip()))

    already_submitted = []
    pending_to_send = []
    excluded = []

    for email, name in old_list:
        if "test@test.sk" in email or "peter.laucik@smopaj.sk" in email or email == ADMIN_EMAIL.lower():
            excluded.append((email, name, "admin/test adresa"))
            continue

        n_name = normalize_text(name)
        if email in reg_emails:
            already_submitted.append((email, name, "zhoda emailu"))
        elif n_name in reg_authors:
            reg_auth, reg_em = reg_authors[n_name]
            already_submitted.append((email, name, f"zhoda mena s registráciou: {reg_auth} <{reg_em}>"))
        else:
            pending_to_send.append((email, name))

    stats = {
        "total_contest_photos": total_photos,
        "unique_contest_emails": len(reg_emails),
        "unique_contest_authors": len(unique_contest_authors),
        "total_original_participants": len(old_list),
        "already_submitted_count": len(already_submitted),
        "pending_count": len(pending_to_send),
        "excluded_count": len(excluded)
    }

    return stats, already_submitted, pending_to_send, excluded

# HTML Reminder Email Template
def get_email_html(recipient_name=""):
    greeting_en = f"Dear {html.escape(recipient_name)}," if recipient_name else "Dear Photographer,"
    greeting_sk = f"Vážený/á {html.escape(recipient_name)}," if recipient_name else "Vážený fotograf / Vážená fotografka,"

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPELEOFOTOGRAFIA 2026 - Last Call Reminder</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }}
    table {{
      border-collapse: collapse;
      width: 100%;
    }}
    .wrapper {{
      width: 100%;
      background-color: #f4f6f8;
      padding: 30px 0;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
      border: 1px solid #e1e4e8;
    }}
    .header {{
      background-color: #1e252b;
      padding: 35px 25px;
      text-align: center;
      border-bottom: 4px solid #e67e22;
    }}
    .header-badge {{
      display: inline-block;
      background-color: #e67e22;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 12px;
    }}
    .header h1 {{
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }}
    .header p {{
      margin: 8px 0 0 0;
      color: #bdc3c7;
      font-size: 13px;
      letter-spacing: 0.5px;
    }}
    .content {{
      padding: 35px 25px;
      color: #2c3e50;
      font-size: 15px;
      line-height: 1.6;
    }}
    .intro {{
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 15px;
    }}
    .urgency-box {{
      background-color: #fff9e6;
      border-left: 4px solid #f39c12;
      padding: 16px 20px;
      margin: 22px 0;
      border-radius: 4px;
    }}
    .urgency-box h3 {{
      margin: 0 0 8px 0;
      color: #d35400;
      font-size: 16px;
      display: flex;
      align-items: center;
    }}
    .urgency-box p {{
      margin: 0;
      font-size: 14.5px;
      color: #7f5200;
    }}
    .button-container {{
      text-align: center;
      margin: 28px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #27ae60;
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      font-size: 15px;
      letter-spacing: 0.5px;
    }}
    .btn:hover {{
      background-color: #219653;
    }}
    .divider {{
      border-top: 1px solid #eaedd0;
      margin: 35px 0;
    }}
    .summary-list {{
      background-color: #f8f9fa;
      border-radius: 6px;
      padding: 15px 20px;
      margin: 18px 0;
    }}
    .summary-list ul {{
      margin: 0;
      padding-left: 20px;
    }}
    .summary-list li {{
      margin-bottom: 8px;
      font-size: 14px;
    }}
    .footer {{
      background-color: #f8f9fa;
      padding: 25px;
      text-align: center;
      font-size: 12px;
      color: #7f8c8d;
      line-height: 1.5;
    }}
    .footer a {{
      color: #2980b9;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <div class="header-badge">LAST CALL / POSLEDNÁ VÝZVA</div>
        <h1>Speleofotografia 2026</h1>
        <p>23rd International Competitive Photo Exhibition with Caving Theme</p>
      </div>
      
      <!-- CONTENT -->
      <div class="content">
        
        <!-- ENGLISH VERSION -->
        <div class="intro">{greeting_en}</div>
        <p>
          We are reaching out with a final friendly reminder: the submission deadline for the <strong>23rd edition of SPELEOFOTOGRAFIA 2026</strong> is rapidly approaching!
        </p>
        <p>
          As a valued participant in speleo-photography, your unique underground perspective has always enriched this contest. We noticed that <strong>we haven't received your photos for this year's edition yet</strong>, and we would be honored to showcase your work among the world's best cave imagery.
        </p>
        
        <div class="urgency-box">
          <h3>⏳ Final Days to Submit</h3>
          <p>
            Entry is <strong>completely free of charge</strong>. The deadline is <strong>September 15, 2026</strong>. Don't miss the opportunity to participate!
          </p>
        </div>

        <div class="summary-list">
          <strong>Categories:</strong>
          <ul>
            <li><strong>Category A (Cave Beauty):</strong> Aesthetics of underground spaces (title, karst area, country).</li>
            <li><strong>Category B (Speleomoment + Story):</strong> Exploration, expedition reportage with a short story context.</li>
          </ul>
        </div>

        <div class="button-container">
          <a href="https://speleof26.sss.sk/" class="btn">Submit Your Photos Online &raquo;</a>
        </div>
        
        <p style="font-size: 13.5px; color: #7f8c8d; text-align: center;">
          Direct link: <a href="https://speleof26.sss.sk/">https://speleof26.sss.sk/</a><br>
          If you need any assistance, contact the administrator at <a href="mailto:michal.danko@gmail.com">michal.danko@gmail.com</a>.
        </p>

        <!-- ENGLISH LOGOS SECTION -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 25px auto 0 auto; background-color: #ffffff; width: 100%; border-collapse: collapse;">
          <tr>
            <!-- SMOPaJ -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://smopaj.sk" target="_blank" style="text-decoration: none;">
                <img src="https://speleofotografia.sss.sk/wp-content/uploads/2026/06/logo_muzea_2.png" alt="SMOPaJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://smopaj.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; display: block; margin-bottom: 8px;">smopaj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: 0 6px;">
                    <a href="https://www.facebook.com/SMOPAJ/" target="_blank"><img src="https://img.icons8.com/color/48/facebook-new.png" alt="FB" height="32" width="32" style="display: block; border: 0;"></a>
                  </td>
                  <td align="center" style="padding: 0 6px;">
                    <a href="https://www.instagram.com/smopaj/" target="_blank"><img src="https://img.icons8.com/color/48/instagram-new.png" alt="IG" height="32" width="32" style="display: block; border: 0;"></a>
                  </td>
                </tr>
              </table>
            </td>

            <!-- SSS -->
            <td align="center" valign="top" style="width: 34%; padding: 10px; border-left: 1px solid #f1f2f6; border-right: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://sss.sk" target="_blank" style="text-decoration: none;">
                <img src="https://sss.sk/wp-content/uploads/2022/05/SSS_logo.jpg" alt="SSS" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; display: block; margin-bottom: 8px;">sss.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: 0 6px;">
                    <a href="https://www.facebook.com/slovenskaspeleologickaspolocnost" target="_blank"><img src="https://img.icons8.com/color/48/facebook-new.png" alt="FB" height="32" width="32" style="display: block; border: 0;"></a>
                  </td>
                  <td align="center" style="padding: 0 6px;">
                    <a href="https://www.instagram.com/slovakspeleo" target="_blank"><img src="https://img.icons8.com/color/48/instagram-new.png" alt="IG" height="32" width="32" style="display: block; border: 0;"></a>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- SSJ -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="http://www.ssj.sk/" target="_blank" style="text-decoration: none;">
                <img src="cid:ssj_logo" alt="SSJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="http://www.ssj.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; display: block; margin-bottom: 8px;">ssj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: 0 6px;">
                    <a href="https://www.facebook.com/sprava.slovenskych.jaskyn/" target="_blank"><img src="https://img.icons8.com/color/48/facebook-new.png" alt="FB" height="32" width="32" style="display: block; border: 0;"></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Row 2: Mesto LM and Speleofotografia -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 25px auto; background-color: #ffffff; width: 100%; max-width: 400px; border-collapse: collapse;">
          <tr>
            <td align="center" valign="top" style="width: 50%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://www.mikulas.sk/" target="_blank" style="text-decoration: none;">
                <img src="https://www.mikulas.sk/filesII/erb-lm.png" alt="Mesto Liptovský Mikuláš" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://www.mikulas.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; display: block; margin-bottom: 8px;">mikulas.sk</a>
            </td>
            <td align="center" valign="top" style="width: 50%; padding: 10px; border-left: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://speleofotografia.sss.sk" target="_blank" style="text-decoration: none;">
                <img src="cid:speleof_logo" alt="Speleofotografia" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://speleofotografia.sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; display: block; margin-bottom: 8px;">speleofotografia.sss.sk</a>
            </td>
          </tr>
        </table>

        <!-- DIVIDER -->
        <div class="divider"></div>

        <!-- SLOVAK VERSION -->
        <div class="intro">{greeting_sk}</div>
        <p>
          dovoľujeme si Vás osloviť s poslednou priateľskou pripomienkou: uzávierka <strong>23. ročníka medzinárodnej súťaže SPELEOFOTOGRAFIA 2026</strong> sa nezadržateľne blíži!
        </p>
        <p>
          Vaše snímky z podzemia vždy patrili medzi obohatenie našej výstavy. Všimli sme si, že <strong>v tomto ročníku od Vás zatiaľ nemáme prihlásené žiadne fotografie</strong> a bola by obrovská škoda, keby Vaša tvorba v súťažnej kolekcii chýbala.
        </p>

        <div class="urgency-box">
          <h3>⏳ Posledné dni na prihlásenie</h3>
          <p>
            Účasť v súťaži je <strong>úplne bezplatná</strong>. Uzávierka prihlášok je <strong>15. septembra 2026</strong>. Nezmeškajte možnosť zapojiť sa!
          </p>
        </div>

        <div class="summary-list">
          <strong>Súťažné kategórie:</strong>
          <ul>
            <li><strong>Kategória A (Krása jaskýň):</strong> Estetika podzemných priestorov (názov, krasové územie, krajina).</li>
            <li><strong>Kategória B (Speleomoment + Príbeh):</strong> Prieskum a expedície doplnené krátkym sprievodným príbehom/kontextom.</li>
          </ul>
        </div>

        <div class="button-container">
          <a href="https://speleof26.sss.sk/" class="btn">Prihlásiť fotografie do súťaže &raquo;</a>
        </div>
        
        <p style="font-size: 13.5px; color: #7f8c8d; text-align: center;">
          Priamy odkaz na registráciu: <a href="https://speleof26.sss.sk/">https://speleof26.sss.sk/</a><br>
          V prípade akýchkoľvek otázok alebo pomoci kontaktujte administrátora: <a href="mailto:michal.danko@gmail.com">michal.danko@gmail.com</a>.
        </p>

      </div>
      
      <!-- FOOTER -->
      <div class="footer">
        <p>Organizátori: Slovenské múzeum ochrany prírody a jaskyniarstva &bull; Slovenská speleologická spoločnosť &bull; Správa slovenských jaskýň &bull; Mesto Liptovský Mikuláš</p>
        <p>Ak si neželáte dostávať ďalšie informácie o súťaži Speleofotografia, odpovedzte na tento e-mail.</p>
      </div>

    </div>
  </div>
</body>
</html>
"""

def get_email_text(recipient_name=""):
    greeting_en = f"Dear {recipient_name}," if recipient_name else "Dear Photographer,"
    greeting_sk = f"Vážený/á {recipient_name}," if recipient_name else "Vážený fotograf / Vážená fotografka,"

    return f"""[LAST CALL] SPELEOFOTOGRAFIA 2026 – Final days to submit! / Posledné dni na prihlásenie!
================================================================================

ENGLISH:
{greeting_en}

This is a final friendly reminder that the submission deadline for the 23rd edition of SPELEOFOTOGRAFIA 2026 is rapidly approaching!

We noticed that we haven't received your photos for this year's edition yet, and we would love to have your underground imagery featured in this year's contest.

- Entry is FREE of charge.
- Deadline: September 15, 2026.
- Categories:
  * Category A (Cave Beauty)
  * Category B (Speleomoment + Story)

Submit your photos online at:
https://speleof26.sss.sk/

If you need any assistance, please contact the administrator: michal.danko@gmail.com

--------------------------------------------------------------------------------

SLOVENSKY:
{greeting_sk}

Obraciame sa na Vás s poslednou priateľskou pripomienkou: uzávierka 23. ročníka medzinárodnej súťaže SPELEOFOTOGRAFIA 2026 je už o pár dní (15. september 2026)!

Všimli sme si, že v tomto ročníku od Vás zatiaľ nemáme prihlásené žiadne fotografie a bola by veľká škoda, keby Vaša tvorba v súťaži chýbala.

- Účasť v súťaži je BEZPLATNÁ.
- Uzávierka: 15. septembra 2026.
- Kategórie:
  * Kategória A (Krása jaskýň)
  * Kategória B (Speleomoment + Príbeh)

Prihlásiť fotografie môžete priamo na:
https://speleof26.sss.sk/

V prípade akýchkoľvek otázok kontaktujte administrátora: michal.danko@gmail.com

================================================================================
Organizátori: SMOPaJ, SSS, SSJ, Mesto Liptovský Mikuláš
"""

def send_reminder_email(to_email, to_name, is_test=False):
    if not env.get("SMTP_HOST"):
        print("ERROR: SMTP configuration not found in .env!")
        return False

    from_addr = f"Speleofotografia <{env.get('SMTP_USER', 'admin@sss.sk')}>"
    reply_to = "speleof26@sss.sk"
    
    subject = "[LAST CALL] SPELEOFOTOGRAFIA 2026 – Final days to submit your photos! / Posledné dni na prihlásenie fotografií!"
    if is_test:
        subject = "[TEST NÁHĽAD] " + subject

    msg = MIMEMultipart('related')
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = f'"{to_name}" <{to_email}>' if to_name else to_email
    msg['Reply-To'] = reply_to

    msg_alt = MIMEMultipart('alternative')
    msg_alt.attach(MIMEText(get_email_text(to_name), 'plain', 'utf-8'))
    msg_alt.attach(MIMEText(get_email_html(to_name), 'html', 'utf-8'))
    msg.attach(msg_alt)

    # Attach inline SSJ logo
    if os.path.exists(SSJ_LOGO_PATH):
        try:
            with open(SSJ_LOGO_PATH, "rb") as f:
                img = MIMEImage(f.read())
            img.add_header('Content-ID', '<ssj_logo>')
            img.add_header('Content-Disposition', 'inline', filename="ssj.png")
            msg.attach(img)
        except Exception as e:
            print(f"Warning: Could not attach SSJ logo: {e}")

    # Attach inline Speleofotografia logo
    if os.path.exists(SPELEOF_LOGO_PATH):
        try:
            with open(SPELEOF_LOGO_PATH, "rb") as f:
                img = MIMEImage(f.read())
            img.add_header('Content-ID', '<speleof_logo>')
            img.add_header('Content-Disposition', 'inline', filename="speleof_logo.png")
            msg.attach(img)
        except Exception as e:
            print(f"Warning: Could not attach Speleofotografia logo: {e}")

    try:
        if env.get("SMTP_SECURE", "true").lower() == "true":
            server = smtplib.SMTP_SSL(env["SMTP_HOST"], int(env["SMTP_PORT"]))
        else:
            server = smtplib.SMTP(env["SMTP_HOST"], int(env["SMTP_PORT"]))
            server.starttls()
            
        server.login(env["SMTP_USER"], env["SMTP_PASS"])
        server.sendmail(env["SMTP_USER"], [to_email], msg.as_string())
        server.quit()
        
        print(f"[{'TEST' if is_test else 'LIVE'}] Sent to: {to_email} ({to_name})")
        if not is_test:
            log_broadcast(f"SUCCESS: {to_email}")
        return True
    except Exception as e:
        print(f"ERROR sending to {to_email}: {e}")
        if not is_test:
            log_broadcast(f"FAILED: {to_email} - {e}")
        return False

def send_summary_report_to_admin(stats, sent_count, failed_emails, skipped_count, duration_seconds):
    """
    Sends the final execution report to admin email.
    """
    if not env.get("SMTP_HOST"):
        print("ERROR: Cannot send admin report, SMTP not configured!")
        return False

    minutes = int(duration_seconds // 60)
    seconds = int(duration_seconds % 60)

    report_content = f"""VÝSLEDNÝ REPORT: ODOSLANIE POSLEDNEJ PRIPOMIENKY (SPELEOFOTOGRAFIA 2026)
================================================================================
Čas ukončenia:          {time.strftime('%Y-%m-%d %H:%M:%S')}
Celkové trvanie:        {minutes}m {seconds}s

ŠTATISTIKA SÚŤAŽE K DNEŠNÉMU DŇU:
--------------------------------------------------------------------------------
- Celkový počet prihlásených fotografií v ročníku:  {stats['total_contest_photos']}
- Unikátnych registrovaných autorov v ročníku:     {stats['unique_contest_authors']}
- Unikátnych registrovaných e-mailov v ročníku:    {stats['unique_contest_emails']}

ŠTATISTIKA DATABÁZY A ODOSIELANIA:
--------------------------------------------------------------------------------
- Celkový počet kontaktov v pôvodnej databáze:     {stats['total_original_participants']}
- Už prihlásení autori (e-mail im NEBOL zaslaný):  {stats['already_submitted_count']}
- Cieľová skupina pre pripomienku (neprihlásení):   {stats['pending_count']}
- Úspešne odoslaných pripomienok v tejto dávke:    {sent_count}
- Zlyhaných odoslaní:                              {len(failed_emails)}
- Preskočených (už odoslané v predchádzajúcom behu):{skipped_count}
"""

    if failed_emails:
        report_content += "\nZOZNAM NEÚSPEŠNÝCH ADRIES:\n"
        for fe in failed_emails:
            report_content += f"  - {fe}\n"
    else:
        report_content += "\nVšetky pripomienky boli odoslané na 100% bez zlyhania.\n"

    report_content += """================================================================================
Systém: Speleofotografia 2026 Broadcast Service
"""

    # Save report locally
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"\nReport uložený do: {REPORT_FILE}")

    # Send report via email
    try:
        from_addr = f"Speleofotografia Robot <{env.get('SMTP_USER', 'admin@sss.sk')}>"
        msg = MIMEText(report_content, 'plain', 'utf-8')
        msg['Subject'] = f"[REPORT] Speleofotografia 2026 – Výsledky odoslania pripomienky ({sent_count} odoslaných, {stats['total_contest_photos']} fotiek v súťaži)"
        msg['From'] = from_addr
        msg['To'] = ADMIN_EMAIL

        if env.get("SMTP_SECURE", "true").lower() == "true":
            server = smtplib.SMTP_SSL(env["SMTP_HOST"], int(env["SMTP_PORT"]))
        else:
            server = smtplib.SMTP(env["SMTP_HOST"], int(env["SMTP_PORT"]))
            server.starttls()

        server.login(env["SMTP_USER"], env["SMTP_PASS"])
        server.sendmail(env["SMTP_USER"], [ADMIN_EMAIL], msg.as_string())
        server.quit()
        print(f"Výsledný súhrnný report bol úspešne odoslaný na e-mail: {ADMIN_EMAIL}")
        return True
    except Exception as e:
        print(f"CHYBA pri odosielaní reportu na administrátorský e-mail: {e}")
        return False

def run():
    print("=================================================================")
    print("Speleofotografia 2026 - Last Call Reminder Broadcast Tool")
    print("=================================================================")

    if len(sys.argv) < 2:
        print("Použitie:")
        print("  python3 send_reminder.py --check             Kontrola cieľovej skupiny a stavu databázy")
        print("  python3 send_reminder.py --test              Odoslanie 1 testovacieho emailu na admina")
        print("  python3 send_reminder.py --live              Ostré rozoslanie na všetkých neprihlásených")
        print("  python3 send_reminder.py --start-at <email>  Pokračovanie rozosielania od konkrétneho emailu")
        sys.exit(1)

    mode = sys.argv[1]
    start_at_email = None

    if mode == "--start-at":
        if len(sys.argv) < 3:
            print("CHYBA: Zadajte emailovú adresu, od ktorej sa má začať.")
            sys.exit(1)
        start_at_email = sys.argv[2].strip().lower()
        mode = "--live"

    stats, already_submitted, pending_to_send, excluded = get_contest_and_recipient_stats()

    # Load already sent from log to allow resuming
    sent_emails = set()
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r", encoding="utf-8") as lf:
            for line in lf:
                if "SUCCESS:" in line:
                    parts = line.strip().split("SUCCESS:")
                    if len(parts) > 1:
                        sent_emails.add(parts[1].strip().lower())

    if mode == "--check":
        print(f"\n--- AKTUÁLNY STAV SÚŤAŽE 2026 ---")
        print(f"Prihlásených fotografií v súťaži:   {stats['total_contest_photos']}")
        print(f"Unikátnych registrovaných autorov:  {stats['unique_contest_authors']}")
        print(f"Unikátnych registrovaných e-mailov: {stats['unique_contest_emails']}")
        print(f"\n--- ANALÝZA ADRESÁTA PRE PRIPOMIENKU ---")
        print(f"Pôvodná databáza účastníkov:        {stats['total_original_participants']}")
        print(f"Už prihlásení (NEBUDÚ kontaktovaní):{stats['already_submitted_count']}")
        print(f"Vylúčené test/admin adresy:         {stats['excluded_count']}")
        print(f"Zostáva poslať pripomienku:         {stats['pending_count']}")
        print(f"Z nich už odoslané v tomto logu:    {len(sent_emails.intersection({em for em, _ in pending_to_send}))}")
        
        print("\nZoznam autorov, ktorí UŽ prihlásili fotky (vyradení z pripomienky):")
        for em, nm, r in already_submitted:
            print(f"  ✓ {nm} <{em}> ({r})")
            
        print("\nUkážka prvých 10 adresátov, ktorí DOSTANÚ pripomienku:")
        for em, nm in pending_to_send[:10]:
            status = "Už odoslané" if em in sent_emails else "Čaká na odoslanie"
            print(f"  ✉ {nm} <{em}> [{status}]")
        print("-----------------------------------------------------------------\n")
        return

    elif mode == "--test":
        print(f"\nOdosielam testovací náhľad na admin email: {ADMIN_EMAIL}...")
        send_reminder_email(ADMIN_EMAIL, f"{ADMIN_NAME} (Test Pripomienky)", is_test=True)
        return

    elif mode == "--live":
        remaining = [(em, nm) for em, nm in pending_to_send if em not in sent_emails]
        print(f"\nNa odoslanie zostáva: {len(remaining)} adries (z celkovo {len(pending_to_send)} neprihlásených).")
        if not remaining:
            print("Všetky pripomienky už boli úspešne odoslané podľa logu!")
            return

        print("Spúšťam ostré rozosielanie pripomienky...")
        success_count = 0
        failed_emails = []
        skipped_count = 0
        start_sending = (start_at_email is None)
        start_time = time.time()

        for idx, (email, name) in enumerate(pending_to_send, 1):
            if not start_sending:
                if email == start_at_email:
                    start_sending = True
                    print(f"\nDosiahnutý checkpoint '{email}'. Začínam odosielať...")
                else:
                    skipped_count += 1
                    continue

            if email in sent_emails:
                skipped_count += 1
                continue

            print(f"[{idx}/{len(pending_to_send)}] Odosielam na: {email} ({name})...")
            if send_reminder_email(email, name, is_test=False):
                success_count += 1
            else:
                failed_emails.append(f"{email} ({name})")

            # Delay to comply with SMTP rate limits and avoid spam filters
            if idx < len(pending_to_send):
                delay = random.uniform(5.0, 10.0)
                print(f"Čakám {delay:.1f}s pred ďalším e-mailom...")
                time.sleep(delay)

        duration = time.time() - start_time
        print("\nOdosielanie dokončené!")
        print(f"Úspešne: {success_count}, Zlyhalo: {len(failed_emails)}, Preskočené: {skipped_count}")

        # Send summary report to admin
        send_summary_report_to_admin(stats, success_count, failed_emails, skipped_count, duration)

if __name__ == "__main__":
    run()
