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

def log_broadcast(msg):
    log_file = "/home/dankez/speleof2026/scripts/broadcast.log"
    with open(log_file, "a", encoding="utf-8") as f:
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
                # strip quotes if present
                v = v.strip().strip('"').strip("'")
                env[k.strip()] = v
    return env

env = load_env("/home/dankez/speleof2026/.env")

# HTML Template for the email
html_content = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPELEOFOTOGRAFIA 2026</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 30px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
      border: 1px solid #e1e4e8;
    }
    .header {
      background-color: #1e252b; /* Reverted to dark theme */
      padding: 35px 25px;
      text-align: center;
      border-bottom: 4px solid #f39c12; /* Golden headlight glow */
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #bdc3c7;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .content {
      padding: 35px 25px;
      color: #2c3e50;
      font-size: 15px;
      line-height: 1.6;
    }
    .intro {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 15px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1e252b;
      margin-top: 25px;
      margin-bottom: 10px;
      border-bottom: 2px solid #f39c12;
      padding-bottom: 4px;
      display: inline-block;
    }
    .rule-update-box {
      background-color: #fdfaf4;
      border-left: 4px solid #f39c12;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .rule-update-box h3 {
      margin: 0 0 10px 0;
      color: #d35400;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .rule-update-box ul {
      margin: 0;
      padding-left: 20px;
      font-size: 14.5px;
    }
    .rule-update-box li {
      margin-bottom: 10px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      background-color: #27ae60;
      color: #ffffff !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 15px;
      letter-spacing: 0.5px;
    }
    .btn:hover {
      background-color: #219653;
    }
    .divider {
      border-top: 1px solid #eaedd0;
      margin: 35px 0;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 25px;
      text-align: center;
      font-size: 12px;
      color: #7f8c8d;
      line-height: 1.5;
    }
    .footer a {
      color: #2980b9;
      text-decoration: none;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer-logos {
      margin-top: 15px;
      font-size: 11px;
      color: #95a5a6;
      border-top: 1px solid #ecf0f1;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <h1>Speleofotografia 2026</h1>
        <p>23rd International Competitive Photo Exhibition with Caving Theme</p>
      </div>
      
      <!-- CONTENT -->
      <div class="content">
        
        <!-- ENGLISH VERSION -->
        <div class="intro">Dear Photographer,</div>
        <p>
          We would like to invite you to participate in the upcoming <strong>23rd edition of SPELEOFOTOGRAFIA 2026</strong>. 
          We highly value your past photographic contributions and would be delighted if you submitted your outstanding underground works to this year's competition.
        </p>
        <p>
          The competition is <strong>free of charge</strong>. The deadline for entries is <strong>September 15, 2026</strong>.
        </p>

        <div class="rule-update-box">
          <h3>⚠️ Important Rule Updates for 2026:</h3>
          <ul>
            <li>
              <strong>Category A (Cave Beauty):</strong> Focused on the aesthetics of underground spaces. 
              <em>New condition:</em> You must provide the photo title, country, and karst type/general location in English. 
              <strong>To protect sensitive cave locations</strong>, you do not need to specify exact cave names—the karst area/region and country are sufficient.
            </li>
            <li>
              <strong>Category B (Speleomoment + Story):</strong> Caving exploration and expeditions reportage. 
              <em>New condition:</em> Each photograph <strong>must</strong> include a short textual story/context (up to 5,000 characters) in English or Slovak. 
              You can describe the technical complexity, context of the exploration, express gratitude to your team, or convey the emotion of the captured moment.
            </li>
          </ul>
        </div>

        <p>The registration and photo submission form is available online at:</p>
        
        <div class="button-container">
          <a href="https://speleof26.sss.sk/" class="btn">Submit Your Entry</a>
        </div>
           <p style="font-size: 14px; color: #7f8c8d;">
          If you encounter any technical upload problems, please contact the 
          <a href="mailto:michal.danko@gmail.com">Contest Administrator</a>.
        </p>

        <!-- ENGLISH LOGOS SECTION -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 25px auto 0 auto; background-color: #ffffff; width: 100%; border-collapse: collapse;">
          <tr>
            <!-- SMOPaJ -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://smopaj.sk" target="_blank" style="text-decoration: none;">
                <img src="https://speleofotografia.sss.sk/wp-content/uploads/2026/06/logo_muzea_2.png" alt="SMOPaJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://smopaj.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">smopaj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/SMOPAJ/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/smopaj/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>

            <!-- Slovenská speleologická spoločnosť -->
            <td align="center" valign="top" style="width: 34%; padding: 10px; border-left: 1px solid #f1f2f6; border-right: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://sss.sk" target="_blank" style="text-decoration: none;">
                <img src="https://sss.sk/wp-content/uploads/2022/05/SSS_logo.jpg" alt="SSS" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">sss.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/slovenskaspeleologickaspolocnost" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/slovakspeleo" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Správa slovenských jaskýň (SSJ) -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="http://www.ssj.sk/" target="_blank" style="text-decoration: none;">
                <img src="cid:ssj_logo" alt="SSJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="http://www.ssj.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">ssj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/sprava.slovenskych.jaskyn/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Row 2: Mesto Liptovský Mikuláš and Speleofotografia -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 25px auto; background-color: #ffffff; width: 100%; max-width: 400px; border-collapse: collapse;">
          <tr>
            <!-- Mesto Liptovský Mikuláš -->
            <td align="center" valign="top" style="width: 50%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://www.mikulas.sk/" target="_blank" style="text-decoration: none;">
                <img src="https://www.mikulas.sk/filesII/erb-lm.png" alt="Mesto Liptovský Mikuláš" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://www.mikulas.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">mikulas.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/MestoLM/?locale=sk_SK" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/liptovskymikulas_mesto/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Speleofotografia -->
            <td align="center" valign="top" style="width: 50%; padding: 10px; border-left: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://speleofotografia.sss.sk" target="_blank" style="text-decoration: none;">
                <img src="cid:speleof_logo" alt="Speleofotografia" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://speleofotografia.sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">speleofotografia.sss.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/speleofotografia" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/speleof" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>





        <!-- DIVIDER -->
        <div class="divider"></div>

        <!-- SLOVAK VERSION -->
        <div class="intro">Vážený fotograf / Vážená fotografka,</div>
        <p>
          dovoľujeme si Vás pozvať do nového ročníka <strong>SPELEOFOTOGRAFIA 2026</strong> – 23. ročníka medzinárodnej súťažnej výstavy jaskyniarskej fotografie. 
          Veľmi si vážime Vašu doterajšiu fotografickú prácu a budeme nesmierne radi, ak sa zapojíte aj do tohto ročníka.
        </p>
        <p>
          Účasť v súťaži je <strong>bezplatná</strong>. Uzávierka prihlášok je <strong>15. septembra 2026</strong>.
        </p>

        <div class="rule-update-box">
          <h3>⚠️ Dôležité zmeny v pravidlách pre ročník 2026:</h3>
          <ul>
            <li>
              <strong>Kategória A (Krása jaskýň):</strong> Zameraná na estetiku podzemných priestorov. 
              <em>Nová podmienka:</em> Povinný názov v angličtine + uvedenie krajiny a krasového územia/lokality. 
              <strong>Z dôvodu dôrazu na ochranu jaskýň</strong> nemusíte uvádzať konkrétny názov jaskyne, ak ide o citlivú lokalitu – úplne postačuje uviesť krasovú oblasť a krajinu.
            </li>
            <li>
              <strong>Kategória B (Speleomoment + Príbeh):</strong> Reportážna fotografia z jaskyniarskych akcií, prieskumu a expedícií. 
              <em>Nová podmienka:</em> Každá fotografia <strong>musí byť doplnená</strong> krátkym príbehom/kontextom (v rozsahu do 5 000 znakov) v slovenskom alebo anglickom jazyku. 
              Môžete opísať zložitosť technického vyhotovenia, kontext akcie, vyjadriť poďakovanie tímu alebo priblížiť emóciu zachyteného momentu.
            </li>
          </ul>
        </div>

        <p>Súťažný registračný formulár je dostupný na:</p>
        
        <div class="button-container">
          <a href="https://speleof26.sss.sk/" class="btn">Prihlásiť sa do súťaže</a>
        </div>
        
        <p style="font-size: 14px; color: #7f8c8d;">
          V prípade akýchkoľvek technických problémov s uploadom fotiek kontaktujte 
          <a href="mailto:michal.danko@gmail.com">Administrátora súťaže</a>.
        </p>

        <!-- SLOVAK LOGOS SECTION -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 25px auto 0 auto; background-color: #ffffff; width: 100%; border-collapse: collapse;">
          <tr>
            <!-- SMOPaJ -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://smopaj.sk" target="_blank" style="text-decoration: none;">
                <img src="https://speleofotografia.sss.sk/wp-content/uploads/2026/06/logo_muzea_2.png" alt="SMOPaJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://smopaj.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">smopaj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/SMOPAJ/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/smopaj/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>

            <!-- Slovenská speleologická spoločnosť -->
            <td align="center" valign="top" style="width: 34%; padding: 10px; border-left: 1px solid #f1f2f6; border-right: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://sss.sk" target="_blank" style="text-decoration: none;">
                <img src="https://sss.sk/wp-content/uploads/2022/05/SSS_logo.jpg" alt="SSS" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">sss.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/slovenskaspeleologickaspolocnost" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/slovakspeleo" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Správa slovenských jaskýň (SSJ) -->
            <td align="center" valign="top" style="width: 33%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="http://www.ssj.sk/" target="_blank" style="text-decoration: none;">
                <img src="cid:ssj_logo" alt="SSJ" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="http://www.ssj.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">ssj.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/sprava.slovenskych.jaskyn/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Row 2: Mesto Liptovský Mikuláš and Speleofotografia -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 25px auto; background-color: #ffffff; width: 100%; max-width: 400px; border-collapse: collapse;">
          <tr>
            <!-- Mesto Liptovský Mikuláš -->
            <td align="center" valign="top" style="width: 50%; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://www.mikulas.sk/" target="_blank" style="text-decoration: none;">
                <img src="https://www.mikulas.sk/filesII/erb-lm.png" alt="Mesto Liptovský Mikuláš" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://www.mikulas.sk/" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">mikulas.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/MestoLM/?locale=sk_SK" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/liptovskymikulas_mesto/" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Speleofotografia -->
            <td align="center" valign="top" style="width: 50%; padding: 10px; border-left: 1px solid #f1f2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="https://speleofotografia.sss.sk" target="_blank" style="text-decoration: none;">
                <img src="cid:speleof_logo" alt="Speleofotografia" height="70" style="height: 70px; width: auto; display: block; border: 0; margin: 0 auto 8px auto;">
              </a>
              <a href="https://speleofotografia.sss.sk" target="_blank" style="font-size: 12px; color: #2980b9; font-weight: bold; text-decoration: none; font-family: inherit; display: block; margin-bottom: 8px;">speleofotografia.sss.sk</a>
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse; text-align: center;">
                <tr>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.facebook.com/speleofotografia" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                  <td align="center" style="padding: 0 6px; vertical-align: middle;">
                    <a href="https://www.instagram.com/speleof" target="_blank" style="text-decoration: none;">
                      <img src="https://img.icons8.com/color/48/instagram-new.png" alt="Instagram" height="40" width="40" style="height: 40px; width: 40px; display: block; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>





      </div>

      
      <!-- FOOTER -->
      <div class="footer">
        <p><strong>Speleofotografia 2026</strong></p>
        <p>Contact / Kontakt: <a href="mailto:smopaj@smopaj.sk">smopaj@smopaj.sk</a></p>
        <p>Official Website / Oficiálny web: <a href="https://speleofotografia.sss.sk/?lang=en">speleofotografia.sss.sk</a></p>

        <div class="footer-logos">
          Organizers / Organizátori:<br>
          Slovenská speleologická spoločnosť (SSS) | Správa slovenských jaskýň (ŠOP SR - SSJ)<br>
          Slovenské múzeum ochrany prírody a jaskyniarstva (SMOPaJ) | Mesto Liptovský Mikuláš
        </div>
        
        <p style="font-size: 11px; margin-top: 15px; color: #95a5a6; border-top: 1px solid #ecf0f1; padding-top: 10px; line-height: 1.4;">
          If you do not wish to receive further updates about the Speleofotografia contest, please reply to this email. / <br>
          Ak si neželáte dostávať ďalšie informácie o súťaži Speleofotografia, odpovedzte na tento e-mail.
        </p>

      </div>
      
    </div>
  </div>
</body>
</html>
"""


def send_email(to_email, to_name, is_test=False):
    if not env.get("SMTP_HOST"):
        print("ERROR: SMTP configuration not loaded from .env file!")
        return False
    
    from_addr = f"Speleofotografia <{env['SMTP_USER']}>"
    reply_to = "speleof26@sss.sk"
    cc_addr = "zelmira.rybkova@smopaj.sk"
    
    msg = MIMEMultipart('related')
    msg['Subject'] = "SPELEOFOTOGRAFIA 2026 – Invitation to the 23rd edition / Pozvánka na 23. ročník"
    msg['From'] = from_addr
    msg['To'] = f'"{to_name}" <{to_email}>' if to_name else to_email
    msg['Reply-To'] = reply_to
    if not is_test:
        msg['Cc'] = cc_addr
    
    # Add plain text alternative
    text_content = f"""SPELEOFOTOGRAFIA 2026
23rd International Competitive Photo Exhibition with Caving Theme / 23. ročník medzinárodnej súťaže jaskyniarskej fotografie

English:
Dear Photographer,
We invite you to participate in SPELEOFOTOGRAFIA 2026. Entry is free of charge. Deadline: September 15, 2026.
Important Updates:
- Category A (Cave Beauty): Title, country, and karst type/general location in English are required. Specific cave names are optional for conservation reasons.
- Category B (Speleomoment + Story): Each photo must include a story/context (up to 5,000 characters) in English or Slovak.
Submit your photos at: https://speleof26.sss.sk/
Technical support: contact the Contest Administrator at mailto:michal.danko@gmail.com
General organizer contact: smopaj@smopaj.sk

---

Slovensky:
Vážený fotograf / Vážená fotografka,
pozývame Vás do nového ročníka SPELEOFOTOGRAFIA 2026. Účasť je bezplatná. Uzávierka: 15. septembra 2026.
Dôležité zmeny:
- Krása jaskýň (Kategória A): Povinná lokalita a krajina v angličtine. Názov konkrétnej jaskyne nemusíte uvádzať kvôli jej ochrane.
- Speleomoment + Príbeh (Kategória B): Povinný textový príbeh/kontext k fotke (do 5 000 znakov) v slovenčine alebo angličtine.
Prihlasovací formulár nájdete na: https://speleof26.sss.sk/
Technická podpora: kontaktujte Administrátora súťaže na mailto:michal.danko@gmail.com
Organizačný kontakt: smopaj@smopaj.sk

Social Networks / Sociálne siete:
- SMOPaJ Website: https://smopaj.sk/
- SMOPaJ Facebook: https://www.facebook.com/SMOPAJ/
- SMOPaJ Instagram: https://www.instagram.com/smopaj/
- SSS Website: https://sss.sk/
- SSS Facebook: https://www.facebook.com/slovenskaspeleologickaspolocnost
- SSS Instagram: https://www.instagram.com/slovakspeleo
- SSJ Website: http://www.ssj.sk/
- SSJ Facebook: https://www.facebook.com/sprava.slovenskych.jaskyn/
- Mesto Liptovský Mikuláš Website: https://www.mikulas.sk/
- Mesto Liptovský Mikuláš Facebook: https://www.facebook.com/MestoLM/?locale=sk_SK
- Mesto Liptovský Mikuláš Instagram: https://www.instagram.com/liptovskymikulas_mesto/
- Speleofotografia Website: https://speleofotografia.sss.sk/
- Speleofotografia Facebook: https://www.facebook.com/speleofotografia
- Speleofotografia Instagram: https://www.instagram.com/speleof


If you do not wish to receive further updates about the Speleofotografia contest, please reply to this email. / Ak si neželáte dostávať ďalšie informácie o súťaži Speleofotografia, odpovedzte na tento e-mail.

"""
    msg_alternative = MIMEMultipart('alternative')
    msg_alternative.attach(MIMEText(text_content, 'plain', 'utf-8'))
    msg_alternative.attach(MIMEText(html_content, 'html', 'utf-8'))
    msg.attach(msg_alternative)
    
    # Attach inline SSJ logo
    ssj_logo_path = "/home/dankez/Downloads/ssj.png"
    if os.path.exists(ssj_logo_path):
        try:
            with open(ssj_logo_path, "rb") as img_file:
                msg_image = MIMEImage(img_file.read())
            msg_image.add_header('Content-ID', '<ssj_logo>')
            msg_image.add_header('Content-Disposition', 'inline', filename=os.path.basename(ssj_logo_path))
            msg.attach(msg_image)
        except Exception as img_err:
            print(f"WARNING: Could not attach inline SSJ logo: {img_err}")
    else:
        print(f"WARNING: SSJ logo file not found at {ssj_logo_path}")
        
    # Attach inline Speleofotografia logo
    speleof_logo_path = "/home/dankez/Downloads/359788000_656330929866184_6636041576054129927_n.png"
    if os.path.exists(speleof_logo_path):
        try:
            with open(speleof_logo_path, "rb") as img_file:
                msg_image2 = MIMEImage(img_file.read())
            msg_image2.add_header('Content-ID', '<speleof_logo>')
            msg_image2.add_header('Content-Disposition', 'inline', filename=os.path.basename(speleof_logo_path))
            msg.attach(msg_image2)
        except Exception as img_err:
            print(f"WARNING: Could not attach inline Speleofotografia logo: {img_err}")
    else:
        print(f"WARNING: Speleofotografia logo file not found at {speleof_logo_path}")
    
    try:
        if env.get("SMTP_SECURE", "true").lower() == "true":
            server = smtplib.SMTP_SSL(env["SMTP_HOST"], int(env["SMTP_PORT"]))
        else:
            server = smtplib.SMTP(env["SMTP_HOST"], int(env["SMTP_PORT"]))
            server.starttls()
            
        server.login(env["SMTP_USER"], env["SMTP_PASS"])
        
        # Build envelope recipients
        recipients = [to_email]
        if not is_test:
            recipients.append(cc_addr)
            
        server.sendmail(env["SMTP_USER"], recipients, msg.as_string())
        server.quit()
        print(f"[{'TEST' if is_test else 'LIVE'}] Email successfully sent to: {to_email} ({to_name})")
        if not is_test:
            log_broadcast(f"SUCCESS: {to_email}")
        return True
    except Exception as e:
        print(f"ERROR sending to {to_email}: {e}")
        if not is_test:
            log_broadcast(f"FAILED: {to_email} - {e}")
        return False

def run():
    print("Speleofotografia 2026 Newsletter Broadcast Tool")
    print("---------------------------------------------")
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 send_newsletter.py --test               Send a single test email to the admin (michal.danko@gmail.com)")
        print("  python3 send_newsletter.py --live               Send the email to all remaining unique participants")
        print("  python3 send_newsletter.py --start-at <email>   Resume live sending starting exactly from this email address")
        print("  python3 send_newsletter.py --check              Dry-run checking progress, completed, and next recipients")
        sys.exit(1)
        
    mode = sys.argv[1]
    start_at_email = None
    
    if mode == "--start-at":
        if len(sys.argv) < 3:
            print("ERROR: Please specify the email address to start at.")
            sys.exit(1)
        start_at_email = sys.argv[2].strip().lower()
        mode = "--live"
        
    if mode == "--test":
        print("Sending test email...")
        send_email("michal.danko@gmail.com", "Michal Danko (Admin Test)", is_test=True)
        return

    participants_file = "/home/dankez/unique_participants.csv"
    if not os.path.exists(participants_file):
        print(f"ERROR: {participants_file} not found! Please run the extraction script first.")
        sys.exit(1)
        
    # Load already sent emails from log to support resuming
    sent_emails = set()
    log_file = "/home/dankez/speleof2026/scripts/broadcast.log"
    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8") as lf:
            for line in lf:
                if "SUCCESS:" in line:
                    parts = line.strip().split("SUCCESS:")
                    if len(parts) > 1:
                        sent_emails.add(parts[1].strip().lower())

    if mode == "--check":
        total_count = 0
        sent_count = 0
        remaining_recipients = []
        excluded_recipients = []
        
        with open(participants_file, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            for row in reader:
                if not row or len(row) < 2:
                    continue
                email = row[0].strip().lower()
                name = html.unescape(row[1].strip())
                
                if "test@test.sk" in email or "peter.laucik@smopaj.sk" in email or email == "michal.danko@gmail.com":
                    excluded_recipients.append((email, name))
                    continue
                
                total_count += 1
                if email in sent_emails:
                    sent_count += 1
                else:
                    remaining_recipients.append((email, name))
                    
        print("\n--- SPELEOFOTOGRAFIA 2026 BROADCAST CHECK ---")
        print(f"Total unique target recipients: {total_count}")
        print(f"Successfully sent:             {sent_count} ({sent_count/total_count*100:.1f}%)")
        print(f"Remaining to send:             {len(remaining_recipients)}")
        print(f"Excluded (test/admin):         {len(excluded_recipients)}")
        
        if remaining_recipients:
            print(f"\nNext recipient to send to:     {remaining_recipients[0][0]} ({remaining_recipients[0][1]})")
            print("\nFirst 5 remaining recipients:")
            for email, name in remaining_recipients[:5]:
                print(f"  - {email} ({name})")
        else:
            print("\nAll emails have been successfully sent!")
        print("---------------------------------------------\n")
        return

    elif mode == "--live":
        print(f"Loaded {len(sent_emails)} already successfully sent emails from log.")
        
        # Count remaining
        remaining_count = 0
        all_recipients = []
        with open(participants_file, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            for row in reader:
                if not row or len(row) < 2:
                    continue
                email = row[0].strip().lower()
                name = html.unescape(row[1].strip())
                if "test@test.sk" in email or "peter.laucik@smopaj.sk" in email or email == "michal.danko@gmail.com":
                    continue
                all_recipients.append((email, name))
                if email not in sent_emails:
                    remaining_count += 1

        print(f"Remaining unique target recipients to process: {remaining_count} (out of {len(all_recipients)} total).")
        if remaining_count == 0:
            print("All emails are already sent according to broadcast.log. Nothing to do!")
            return
            
        print("Starting live broadcast...")
        success_count = 0
        fail_count = 0
        skipped_count = 0
        excluded_count = 0
        failed_emails = []
        
        start_time = time.time()
        start_sending = (start_at_email is None)
        
        for email, name in all_recipients:
            # Handle start-at checkpoint if specified
            if not start_sending:
                if email == start_at_email:
                    start_sending = True
                    print(f"\nCheckpoint email '{email}' reached! Starting sending from here...")
                else:
                    skipped_count += 1
                    continue
                    
            if email in sent_emails:
                skipped_count += 1
                continue
                
            print(f"\n[{success_count + fail_count + 1}/{remaining_count}] Sending to {email} ({name})...")
            if send_email(email, name, is_test=False):
                success_count += 1
            else:
                fail_count += 1
                failed_emails.append(f"{email} ({name})")
                
            # Random delay between 5 and 15 seconds to simulate natural patterns and respect host SMTP limits
            if success_count + fail_count < remaining_count:
                delay = random.uniform(5.0, 15.0)
                print(f"Waiting {delay:.1f} seconds before next send...")
                time.sleep(delay)
                
        end_time = time.time()
        duration = end_time - start_time
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        
        report_text = f"""=============================================
          BROADCAST REPORT / SPRÁVA          
=============================================
Finished at:         {time.strftime('%Y-%m-%d %H:%M:%S')}
Total duration:      {minutes}m {seconds}s
Successfully Sent:   {success_count}
Failed to Send:      {fail_count}
Skipped (Previously sent/Checkpoint): {skipped_count}
"""
        if failed_emails:
            report_text += "\nFailed Email Addresses:\n"
            for fe in failed_emails:
                report_text += f"  - {fe}\n"
            report_text += "\nYou can resume/retry sending to failed addresses using:\n"
            report_text += "  python3 send_newsletter.py --live\n"
        report_text += "=============================================\n"
        
        # Print report to screen
        print("\n" + report_text)
        
        # Save report to file
        report_path = "/home/dankez/speleof2026/scripts/broadcast_report.txt"
        with open(report_path, "w", encoding="utf-8") as rf:
            rf.write(report_text)
        print(f"Report saved to: {report_path}")
        
    else:
        print("Unknown argument. Use --test, --live, --start-at, or --check.")

if __name__ == "__main__":
    run()
