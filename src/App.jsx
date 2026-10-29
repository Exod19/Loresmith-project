/* =========================================================================
   LORESMITH — Game Master Console  (v2)
   StackBlitz / Vite setup:
     1) This is your App component (e.g. src/App.jsx). Render <App/> from main.jsx.
     2) Install the PDF reader once:   npm i pdfjs-dist
     3) Open Settings (gear, top-right) and paste an API key for any provider.
        Free options: Google Gemini (Flash), OpenRouter (:free models), Groq.
   Data is saved to your browser (IndexedDB). Use Universes → Backups to
   export/import a .json file so you never lose a campaign.
   ========================================================================= */
import React, {
  useState,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useContext,
  createContext,
} from 'react';
import { Download, Upload, Settings, ExternalLink, Undo2, Keyboard, MonitorPlay, Trash2, Move, Square, Ruler, Grid3x3, EyeOff, Eye, Eraser, Swords, SkipForward, Dices, Pencil, RefreshCw, Users, Plus, ChevronLeft, RotateCcw } from 'lucide-react';
import MapsPage from './maps/MapsPage';
import TableMap, { tableMapId } from './maps/TableMap';
import { setMapIntent } from './maps/intent';
import { placeTokens as placeOnBoard, effectiveOf } from './maps/battle/placement';
import { tacticalNotes, profileFromStat, coverAgainst } from './maps/battle/tactics';
import MiniBattle from './maps/battle/MiniBattle';
import { sightFor } from './maps/battle/combat';
import { propose as proposeEncounter, placeTactically, rate as rateEncounter, thresholds as encounterThresholds, xpOf, crOf, THEMES as SKIRMISH_THEMES } from './maps/battle/skirmish';
import { registerStat, quickStat, QUICK_CRS, customStats } from './maps/atlas/customStats';
import ArchivesPage from './feeds/ArchivesPage';
import { attackFamily, attackLine } from './combat/flavour';
import ArchivesLinkPanel from './feeds/ArchivesLink';
import Dossier, { LibraryCard } from './library/Dossier';
import StageControl from './present/StageControl';
import { DiceFloater } from './dice/DiceRoller3D';
import DmCopilot from './copilot/DmCopilot';
import { hostStage } from './present/stage';
import { UNDERDARK_LINK, useUnderdarkFeed } from './feeds/underdark';
import { FAUNA_RULE, faunaNames, speaksByName } from './feeds/fauna';
import { Sidebar, Topbar, MobileBar, CommandPalette, NAV } from './shell/Shell';
import UniverseHome from './shell/Home';
import { askPersistence, loadState, saveState as persistState } from './store/persist';
import { repairJson } from './ai/json';
import {
  VOICE_MODELS,
  VOICE_NAMES,
  VOICE_PRESETS,
  cleanForSpeech,
  resolveVoiceProfile,
  synthesizeSpeech,
} from './voice/elevenlabs';
import { SceneLore, SessionLore, createCreatureSheet } from './forge/LoreEditor';
import CampaignStudio from './studio/CampaignStudio';
import { migrateCampaign, migrateState } from './studio/migrate';
import { atlasPlaces, buildLoreContext, feedFor, norm as normName } from './ai/loreContext';
import {
  BRIEF_FIELDS,
  FORMATS,
  emptyBrief,
  forgeBible,
  forgeSession,
  librarySuggestionsFrom,
  outlineScenes,
  previousDigest,
  proposeBrief,
  toScene,
} from './forge/campaignPipeline';
import './forge/forge.css';
import './combat/wartable.css';
import { entityFromSrd, generateEntities } from './bestiary/entityGen';
import StatSheet from './bestiary/StatSheet';
import ArchiveImagePicker from './media/ArchiveImagePicker';
import { CLANS, archiveImageIndex, clanPaintBrief, fileToCompressed, generatePortrait, makeToken, matchArchiveImages, matchPortrait } from './media/images';
import { STATS } from './maps/atlas/statblocks';
import { tokenImage } from './maps/battle/vignettes';

/* ----------------------------- styles (gold / ornate) ------------------- */
const STYLE = `
   @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Spectral:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap');
   :root{
     --bg:#0b0906; --ink-2:#100c07; --panel:#16110a; --panel-2:#1c150c; --panel-3:#221a0e;
     --gold:#c9a24a; --gold-lt:#ecd289; --gold-dk:#7d6128; --gold-fade:#5a481f;
     --txt:#e7d8b0; --muted:#9a8a63; --faint:#6f6038;
     --arcane:#c9a24a; --arcane-deep:#7d6128; --glow:rgba(201,162,74,.28);
     --ember:#e0a23b; --blood:#c0492f; --verdant:#7fb05a; --teal:#54d8c6;
     --parch:#e7d8b0; --parch-line:#bda36e; --parch-ink:#382b14;
     --ink:var(--bg); --line:rgba(201,162,74,.20); --line-2:rgba(201,162,74,.40);
     --r:6px; --r-sm:5px;
   }
   *{box-sizing:border-box}
   .ls-root{font-family:'EB Garamond',Georgia,serif;color:var(--txt);min-height:100%;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased;
     background:radial-gradient(1100px 560px at 50% -10%,rgba(201,162,74,.08),transparent 60%),radial-gradient(900px 500px at 92% 0%,rgba(84,216,198,.05),transparent 55%),var(--bg);background-attachment:fixed;}
   .ls-root *::-webkit-scrollbar{width:11px;height:11px}
   .ls-root *::-webkit-scrollbar-thumb{background:#2a2110;border-radius:8px;border:2px solid var(--bg)}
   button{font-family:inherit;cursor:pointer}
   input,textarea,select{font-family:inherit}
   h1,h2,h3{font-family:'Cinzel',serif}
   .top{display:flex;align-items:center;gap:16px;padding:12px 22px;border-bottom:1px solid var(--gold-dk);position:sticky;top:0;z-index:30;background:linear-gradient(180deg,#140f08,#0c0905);box-shadow:0 2px 18px rgba(0,0,0,.55)}
   .brand{display:flex;align-items:center;gap:11px;user-select:none}
   .brand-emblem{
    width:42px;
    height:42px;
    object-fit:contain;
    flex:none;
    filter:drop-shadow(0 0 8px rgba(201,162,74,.18));
  }
  
  .brand-text{
    display:flex;
    flex-direction:column;
    justify-content:center;
    gap:2px;
  }
  
  .brand-wordmark{
    width:158px;
    height:auto;
    display:block;
    object-fit:contain;
    filter:drop-shadow(0 0 6px rgba(201,162,74,.12));
  }
   .brand b{font-family:'Cinzel',serif;font-weight:700;letter-spacing:.18em;font-size:16px;color:#f0e2bb}
   .brand span{
    display:block;
    white-space:nowrap;
    font-size:9px;
    letter-spacing:.26em;
    color:var(--faint);
    margin-top:0;
    font-family:'Cinzel',serif;
  }
  .dashboard-brand-mark{
    display:flex;
    align-items:center;
    margin-bottom:18px;
  }
  
  .dashboard-brand-mark img{
    width:min(360px,100%);
    height:auto;
    object-fit:contain;
    filter:drop-shadow(0 0 12px rgba(201,162,74,.16));
  }
   .uni-switch{display:flex;align-items:center;gap:8px;margin-left:8px}
   .uni-switch select{background:var(--panel-3);color:var(--txt);border:1px solid var(--line-2);border-radius:99px;padding:8px 14px;font-size:13px;font-family:'Cinzel';outline:none;max-width:210px}
   .uni-switch select:focus{border-color:var(--gold)}
   .top{flex-wrap:wrap;row-gap:8px}
   .nav{order:3;width:100%;display:flex;gap:4px 12px;flex-wrap:nowrap;align-items:center;overflow-x:auto;scrollbar-width:none;padding-top:8px;border-top:1px solid var(--line)}
   .nav::-webkit-scrollbar{display:none}
   .nav-group{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;flex:none}
   .nav button{white-space:nowrap}
   .nav-group+.nav-group{padding-left:12px;border-left:1px solid var(--line)}
   .nav-group-label{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);margin-right:4px}
   .top-actions{display:flex;align-items:center;gap:4px;flex:none;margin-left:auto}
   .ls-root :is(button,a,select,input,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--gold-lt);outline-offset:2px}
   .nav button{background:transparent;border:1px solid transparent;color:var(--muted);padding:8px 13px;border-radius:4px;font-size:13px;font-family:'Cinzel';letter-spacing:.03em;transition:.15s}
   .nav button:hover{color:var(--gold-lt)}
   .nav button[data-on="1"]{color:#f3e6c0;border-color:var(--gold-dk);background:linear-gradient(180deg,rgba(201,162,74,.16),rgba(201,162,74,.04));box-shadow:inset 0 0 10px rgba(201,162,74,.14)}
   .iconbtn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--gold);font-size:15px;transition:.15s}
   .stat-card{display:block;width:100%;text-align:left;color:inherit;font:inherit;transition:border-color .15s,transform .15s}
   .stat-card:hover{border-color:var(--gold);transform:translateY(-1px)}
   .block-text{white-space:pre-wrap;font-size:14px;line-height:1.55}
   .block-list{list-style:disc;margin:4px 0 0;padding-left:18px;font-size:14px;line-height:1.5}
   .linkbtn{background:none;border:0;padding:0;color:var(--gold-lt);text-decoration:underline;font:inherit;cursor:pointer}
   .iconbtn.wide{width:auto;display:inline-flex;align-items:center;gap:6px;padding:0 10px;font-family:'Cinzel',serif;font-size:12px;letter-spacing:.04em}
   .iconbtn:hover{border-color:var(--gold);color:var(--gold-lt)}
   .wrap{flex:1;max-width:1200px;width:100%;margin:0 auto;padding:26px 22px 90px}
   h1.view{font-family:'Cinzel',serif;font-weight:600;letter-spacing:.02em;font-size:26px;margin:0 0 4px;color:#f3e7c2}
   .sub{color:var(--muted);font-size:14.5px;margin:0 0 22px;max-width:66ch;line-height:1.55}
   .eyebrow{font-family:'Cinzel',serif;letter-spacing:.22em;font-size:11px;color:var(--gold);text-transform:uppercase;display:flex;align-items:center;gap:10px;margin:30px 0 14px}
   .eyebrow::after{content:"";height:1px;flex:1;background:linear-gradient(90deg,var(--gold-fade),transparent)}
   .panel{position:relative;background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--gold-dk);border-radius:var(--r);padding:18px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.5),inset 0 0 22px rgba(0,0,0,.45)}
   .panel::before,.panel::after{content:"";position:absolute;width:12px;height:12px;border:1.5px solid var(--gold);opacity:.8;pointer-events:none}
   .panel::before{top:4px;left:4px;border-right:0;border-bottom:0}
   .panel::after{bottom:4px;right:4px;border-left:0;border-top:0}
   .grid{display:grid;gap:16px}
   .cols-2{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
   .cols-3{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
   .btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-2);background:var(--panel-3);color:var(--txt);padding:10px 16px;border-radius:var(--r-sm);font-size:13px;font-family:'Cinzel';letter-spacing:.03em;transition:.15s}
   .btn:hover{border-color:var(--gold);color:var(--gold-lt);box-shadow:0 0 0 2px var(--glow)}
   .btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;border-color:var(--line-2);color:var(--txt)}
   .btn.primary{background:linear-gradient(180deg,var(--gold),var(--gold-dk));border-color:var(--gold-lt);color:#241a08;font-weight:600}
   .btn.primary:hover{filter:brightness(1.08);color:#241a08}
   .btn.ember{background:linear-gradient(180deg,var(--gold),var(--gold-dk));border-color:var(--gold-lt);color:#241a08}
   .btn.ghost{background:transparent}
   .btn.sm{padding:6px 11px;font-size:12px}
   .btn.danger:hover{border-color:var(--blood);color:#e89a8a;box-shadow:0 0 0 2px rgba(192,73,47,.2)}
   label.fl{display:block;font-size:10.5px;font-family:'Cinzel';font-weight:600;color:var(--gold);margin:0 0 6px;letter-spacing:.1em;text-transform:uppercase}
   .in,textarea.in,select.in{width:100%;background:var(--ink-2);border:1px solid var(--line-2);color:var(--txt);border-radius:var(--r-sm);padding:11px 13px;font-size:14.5px;outline:none;transition:.15s}
   .in:focus,textarea.in:focus,select.in:focus{border-color:var(--gold);box-shadow:0 0 0 2px var(--glow)}
   textarea.in{resize:vertical;min-height:80px;line-height:1.5}
   .row{display:flex;gap:12px;flex-wrap:wrap}
   .row>*{flex:1;min-width:120px}
   .field{margin-bottom:14px}
   .tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:var(--panel-3);border:1px solid var(--line-2);color:var(--muted);text-transform:capitalize;font-family:'Cinzel';letter-spacing:.04em}
   .tag.arcane{color:#e9cf8e;border-color:var(--gold-dk)}
   .tag.ember{color:#f0c474;border-color:rgba(224,162,59,.5)}
   .tag.blood{color:#eaa093;border-color:rgba(192,73,47,.5)}
   .scroll{position:relative;background:linear-gradient(175deg,#f0e2bd,var(--parch) 45%,#dcc99e);color:var(--parch-ink);border:1px solid var(--parch-line);border-radius:8px;padding:20px;font-family:'Spectral','EB Garamond',serif;font-size:16px;line-height:1.62;box-shadow:inset 0 0 60px rgba(120,90,40,.2),0 3px 0 rgba(0,0,0,.22);margin-top:14px}
   .scroll::before{content:"\\276F À LIRE AUX JOUEURS";position:absolute;top:-10px;left:14px;background:var(--parch);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;color:#8a6a2c;padding:2px 8px;border:1px solid var(--parch-line);border-radius:6px}
   .token{border-radius:50%;border:2px solid var(--gold-dk);flex:none;overflow:hidden;background:var(--ink-2)}
   .statblock{font-size:13px;line-height:1.55}
   .abil{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0;text-align:center}
   .abil div{background:var(--ink-2);border:1px solid var(--line);border-radius:6px;padding:7px 4px}
   .abil .ab{font-family:'Cinzel',serif;font-weight:700;color:var(--gold);font-size:15px}
   .abil .lbl{font-size:10px;color:var(--muted);letter-spacing:.06em}
   .feat{margin:7px 0;font-size:13px}
   .feat b{color:#e9cf8e}
   .qbar{height:7px;border-radius:99px;background:var(--ink-2);overflow:hidden;margin:8px 0 12px;border:1px solid rgba(0,0,0,.4)}
   .qbar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-dk),var(--gold-lt));transition:.3s}
   .check{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
   .check .box{width:20px;height:20px;border-radius:5px;border:1.5px solid var(--line-2);flex:none;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:.15s;background:var(--ink-2);font-size:13px;cursor:pointer;color:transparent}
   .check .box[data-on="1"]{background:var(--gold);border-color:var(--gold-lt);color:#241a08}
   .check span.lab{font-size:14px;line-height:1.45;flex:1}
   .check span.lab[data-on="1"]{color:var(--faint);text-decoration:line-through}
   .combatant{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--ink-2);margin-bottom:10px}
   .hpbar{height:9px;border-radius:99px;background:#33180f;overflow:hidden;margin-top:6px;border:1px solid rgba(0,0,0,.4)}
   .hpbar i{display:block;height:100%;transition:.25s}
   .mini{width:62px;background:var(--ink-2);border:1px solid var(--line-2);color:var(--txt);border-radius:5px;padding:7px;text-align:center;font-family:'Cinzel',serif;font-size:14px;outline:none}
   .mini:focus{border-color:var(--gold)}
   .scrim{position:fixed;inset:0;background:rgba(6,4,2,.78);backdrop-filter:blur(4px);z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:40px 18px;overflow:auto}
   .modal{position:relative;background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--gold-dk);border-radius:10px;width:100%;max-width:640px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 0 0 1px rgba(0,0,0,.4)}
   .modal::before,.modal::after{content:"";position:absolute;width:13px;height:13px;border:1.5px solid var(--gold);opacity:.85;pointer-events:none}
   .modal::before{top:5px;left:5px;border-right:0;border-bottom:0}
   .modal::after{bottom:5px;right:5px;border-left:0;border-top:0}
   .modal h3{font-family:'Cinzel',serif;font-weight:600;margin:0 0 4px;font-size:19px;color:#f3e7c2}
   .empty{text-align:center;padding:48px 20px;color:var(--muted)}
   .empty .big{font-family:'Cinzel',serif;font-size:18px;color:var(--txt);margin-bottom:6px}
   .card-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
   .muted{color:var(--muted)}.faint{color:var(--faint)}
   .spin{width:15px;height:15px;border:2px solid rgba(236,210,137,.3);border-top-color:var(--gold-lt);border-radius:50%;animation:sp .7s linear infinite;display:inline-block}
   @keyframes sp{to{transform:rotate(360deg)}}
   .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--panel-3);border:1px solid var(--gold-dk);padding:11px 20px;border-radius:99px;font-size:13px;font-family:'Cinzel';color:var(--gold-lt);z-index:80;box-shadow:0 12px 40px rgba(0,0,0,.55)}
   .warnbar{background:rgba(84,216,198,.07);border:1px solid rgba(84,216,198,.3);border-radius:8px;padding:11px 14px;font-size:13px;color:#9fe7dd;margin-bottom:18px;line-height:1.55}
   .logentry{border-left:2px solid var(--gold-dk);padding:4px 0 12px 14px;margin-left:4px;position:relative}
   .logentry::before{content:"";position:absolute;left:-5px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--gold)}
   /* chat */
   .chatwrap{display:flex;flex-direction:column;height:min(70vh,640px)}
   .chatlog{flex:1;overflow-y:auto;padding:6px 2px;display:flex;flex-direction:column;gap:12px}
   .msg{max-width:80%;padding:12px 15px;border-radius:10px;font-size:14.5px;line-height:1.55;white-space:pre-wrap}
   .msg.user{align-self:flex-end;background:linear-gradient(180deg,var(--panel-3),var(--panel));border:1px solid var(--line-2);color:var(--txt)}
   .msg.ai{align-self:flex-start;background:linear-gradient(175deg,#f0e2bd,var(--parch));border:1px solid var(--parch-line);color:var(--parch-ink);font-family:'Spectral',serif}
   .chatbar{display:flex;gap:10px;margin-top:14px}
   .chatbar textarea{flex:1;min-height:46px;max-height:140px}
   .generator-mode-row{
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
    margin-bottom:14px;
  }
  
  .generator-chat-layout{
    display:grid;
    grid-template-columns:280px minmax(0,1fr);
    gap:14px;
    align-items:stretch;
  }
  
  .generator-chat-main{
    min-width:0;
  }
  
  .chat-thread-sidebar{
    border:1px solid rgba(201,162,74,.28);
    background:linear-gradient(180deg,#120d07,#080604);
    border-radius:8px;
    padding:12px;
    min-height:min(70vh,640px);
    max-height:min(70vh,640px);
    overflow-y:auto;
  }
  
  .chat-thread-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    border-bottom:1px solid rgba(201,162,74,.22);
    padding-bottom:10px;
    margin-bottom:10px;
  }
  
  .chat-thread-head b{
    display:block;
    font-family:'Cinzel',serif;
    color:var(--gold-lt);
    font-size:13px;
    letter-spacing:.05em;
  }
  
  .chat-thread-head span{
    display:block;
    color:var(--muted);
    font-size:12px;
    margin-top:2px;
  }
  
  .chat-thread-new{
    width:30px;
    height:30px;
    display:grid;
    place-items:center;
    border-radius:50%;
    border:1px solid var(--gold-dk);
    color:#241a08;
    background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
    font-family:'Cinzel',serif;
    font-size:18px;
    line-height:1;
  }
  
  .chat-thread-group{
    margin-top:12px;
  }
  
  .chat-thread-group-title{
    font-family:'Cinzel',serif;
    color:var(--gold);
    text-transform:uppercase;
    letter-spacing:.13em;
    font-size:10px;
    margin:0 0 7px;
  }
  
  .chat-thread-row{
    position:relative;
    border:1px solid rgba(201,162,74,.2);
    background:#0b0804;
    border-radius:7px;
    margin-bottom:8px;
    overflow:hidden;
  }
  
  .chat-thread-row[data-on="1"]{
    border-color:var(--gold);
    background:linear-gradient(180deg,rgba(201,162,74,.13),rgba(201,162,74,.04));
    box-shadow:inset 0 0 16px rgba(201,162,74,.08);
  }
  
  .chat-thread-button{
    width:100%;
    display:block;
    border:0;
    background:transparent;
    color:var(--txt);
    text-align:left;
    padding:9px 34px 9px 10px;
  }
  
  .chat-thread-button:hover{
    background:rgba(201,162,74,.05);
  }
  
  .chat-thread-title{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:12px;
    line-height:1.25;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  
  .chat-thread-meta{
    display:block;
    color:var(--muted);
    font-size:11.5px;
    line-height:1.25;
    margin-top:2px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  
  .chat-thread-preview{
    display:block;
    color:var(--faint);
    font-size:11.5px;
    line-height:1.3;
    margin-top:5px;
  }

  .linked-scene-chips{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-top:10px;
  }
  
  .linked-scene-chips span{
    border:1px solid rgba(201,162,74,.32);
    background:#0b0804;
    color:var(--muted);
    border-radius:999px;
    padding:4px 8px;
    font-size:11.5px;
  }

  .campaign-suggestion-box{
    border:1px solid rgba(201,162,74,.24);
    background:rgba(201,162,74,.05);
    border-radius:8px;
    padding:12px;
    margin:14px 0;
  }
  
  .campaign-suggestion-box b{
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
  }
  
  .campaign-suggestion-box p{
    color:var(--muted);
    font-size:12.5px;
    line-height:1.45;
    margin:4px 0 0;
  }
  
  .campaign-suggestion-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
    gap:10px;
    margin-top:12px;
  }
  
  .campaign-suggestion-card{
    border:1px solid rgba(201,162,74,.22);
    background:#0b0804;
    border-radius:7px;
    padding:10px;
  }
  
  .campaign-suggestion-card b{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:12.5px;
    margin-bottom:5px;
  }
  
  .campaign-suggestion-card p{
    color:var(--muted);
    font-size:12.5px;
    line-height:1.4;
    margin:0 0 9px;
  }
  
  .campaign-suggestion-type{
    display:inline-flex;
    border:1px solid rgba(201,162,74,.28);
    color:var(--gold);
    border-radius:999px;
    padding:2px 7px;
    font-family:'Cinzel',serif;
    font-size:10px;
    text-transform:uppercase;
    letter-spacing:.08em;
    margin-bottom:7px;
  }
  
  .long-campaign-lore-block{
    border:1px solid rgba(201,162,74,.22);
    background:rgba(0,0,0,.16);
    border-radius:8px;
    padding:12px;
    margin-top:10px;
  }
  
  .long-campaign-lore-block h4{
    margin:0 0 6px;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:13px;
  }
  
  .long-campaign-lore-block p{
    color:var(--muted);
    font-size:13px;
    line-height:1.5;
    margin:0 0 8px;
  }
  
  .session-detail-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
    gap:10px;
    margin-top:10px;
  }
  
  .chat-thread-count{
    display:inline-block;
    color:var(--gold);
    border:1px solid rgba(201,162,74,.28);
    border-radius:999px;
    padding:2px 6px;
    font-size:10.5px;
    margin-top:6px;
  }
  
  .chat-thread-delete{
    position:absolute;
    right:6px;
    top:6px;
    width:22px;
    height:22px;
    display:grid;
    place-items:center;
    border:1px solid rgba(201,162,74,.25);
    border-radius:50%;
    color:var(--muted);
    background:#070604;
    font-size:15px;
    line-height:1;
  }
  
  .chat-thread-delete:hover{
    color:#e89a8a;
    border-color:var(--blood);
  }
  
  .chat-thread-empty{
    border:1px dashed rgba(201,162,74,.32);
    color:var(--muted);
    border-radius:7px;
    padding:14px;
    font-size:12.5px;
    line-height:1.4;
    text-align:center;
  }
  
  @media (max-width:900px){
    .generator-chat-layout{
      grid-template-columns:1fr;
    }
  
    .chat-thread-sidebar{
      min-height:auto;
      max-height:260px;
    }
  }

  .npc-generator-panel{
    border:1px solid rgba(201,162,74,.24);
    background:rgba(201,162,74,.04);
    border-radius:8px;
    padding:14px;
    margin-bottom:16px;
  }
  
  .npc-generator-controls{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:12px;
  }
  
  .npc-generator-scene-note{
    border:1px solid rgba(201,162,74,.22);
    background:#0c0905;
    border-radius:6px;
    padding:10px 12px;
    margin:4px 0 14px;
  }
  
  .npc-generator-scene-note b{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:13px;
    margin-bottom:4px;
  }
  
  .npc-generator-scene-note span{
    display:block;
    color:var(--muted);
    font-size:13px;
    line-height:1.4;
  }
  
  .npc-pill-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(118px,1fr));
    gap:10px;
  }
  
  .npc-voice-pill{
    min-height:138px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    gap:6px;
    border:1px solid rgba(201,162,74,.25);
    background:linear-gradient(180deg,#140f08,#0b0804);
    color:var(--txt);
    border-radius:8px;
    padding:11px 8px;
    text-align:center;
    transition:.15s;
  }
  
  .npc-voice-pill:hover{
    border-color:var(--gold);
    transform:translateY(-1px);
    box-shadow:0 0 0 2px rgba(201,162,74,.12);
  }
  
  .npc-voice-pill[data-on="1"]{
    border-color:var(--gold-lt);
    background:linear-gradient(180deg,rgba(201,162,74,.18),rgba(201,162,74,.05));
    box-shadow:inset 0 0 18px rgba(201,162,74,.12), 0 0 0 2px rgba(201,162,74,.14);
  }
  
  .npc-voice-portrait{
    width:64px;
    height:64px;
    border-radius:50%;
    overflow:hidden;
    display:block;
    border:2px solid var(--gold-dk);
    background:#050403;
  }
  
  .npc-voice-portrait img{
    width:64px;
    height:64px;
    object-fit:cover;
    display:block;
  }
  
  .npc-voice-name{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:12px;
    line-height:1.2;
    max-width:100%;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  
  .npc-voice-role{
    display:block;
    color:var(--muted);
    font-size:11.5px;
    line-height:1.2;
  }
  
  .npc-pill-empty{
    grid-column:1 / -1;
    border:1px dashed rgba(201,162,74,.35);
    color:var(--muted);
    padding:14px;
    border-radius:6px;
    text-align:center;
    font-size:13px;
  }
  
  .npc-selected-card{
    display:grid;
    grid-template-columns:54px minmax(0,1fr);
    gap:12px;
    align-items:center;
    border-top:1px solid rgba(201,162,74,.22);
    margin-top:14px;
    padding-top:14px;
  }
  
  .npc-selected-card img{
    width:54px;
    height:54px;
    object-fit:cover;
    border-radius:50%;
    border:1px solid var(--gold-dk);
    background:#050403;
    cursor:pointer;
  }
  
  .npc-selected-card b{
    display:block;
    font-family:'Cinzel',serif;
    color:var(--gold-lt);
    font-size:14px;
  }
  
  .npc-selected-card span{
    display:block;
    color:var(--muted);
    font-size:12px;
    margin-top:2px;
  }
  
  .npc-selected-card p{
    color:var(--muted);
    font-size:12.5px;
    line-height:1.4;
    margin:5px 0 0;
  }
  
  @media (max-width:760px){
    .npc-generator-controls{
      grid-template-columns:1fr;
    }
  
    .npc-pill-grid{
      grid-template-columns:repeat(auto-fill,minmax(96px,1fr));
    }
  }
   .scene-shell{
    width:100%;
    display:grid;
    grid-template-columns:280px minmax(420px,1fr) 300px;
    gap:14px;
    min-height:calc(100vh - 110px);
  }
  .scene-left,.scene-right{display:flex;flex-direction:column;gap:12px}
  .scene-main{display:flex;flex-direction:column;gap:12px}
  .scene-card{
    position:relative;
    background:linear-gradient(180deg,#171008,#090704);
    border:1px solid var(--gold-dk);
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.7), inset 0 0 22px rgba(0,0,0,.65);
    padding:14px;
    border-radius:4px;
  }
  .scene-label{
    font-family:'Cinzel',serif;
    text-transform:uppercase;
    letter-spacing:.16em;
    color:var(--gold);
    font-size:10px;
    margin-bottom:8px;
  }
  .scene-label.dark{color:#382b14}
  .scene-select{
    border:1px solid var(--gold-dk);
    background:#0c0905;
    padding:10px;
    color:#f0e2bb;
    font-family:'Cinzel',serif;
  }
  .campaign-panel h2,.scene-card h3{
    font-family:'Cinzel',serif;
    color:#f0e2bb;
    margin:4px 0 8px;
    font-size:18px;
  }
  .campaign-panel p,.scene-card p{
    color:var(--muted);
    font-size:13px;
    line-height:1.4;
  }
  .scene-progress{
    height:7px;
    background:#070604;
    border:1px solid var(--gold-dk);
    margin:12px 0;
  }
  .scene-progress i{
    display:block;
    height:100%;
    background:linear-gradient(90deg,#315d3a,#9fc16a);
  }
  .scene-mini-btn{
    border:1px solid var(--gold-dk);
    background:#110c06;
    color:var(--gold-lt);
    padding:7px 10px;
    font-family:'Cinzel',serif;
    border-radius:3px;
  }
  .scene-party-row{
    display:grid;
    grid-template-columns:38px 1fr auto;
    gap:10px;
    align-items:center;
    border:1px solid rgba(201,162,74,.25);
    padding:8px;
    margin-bottom:7px;
    background:#0d0a06;
  }
  .scene-muted{
    color:var(--muted);
    font-size:12.5px;
    line-height:1.45;
  }
  
  .scene-list{
    display:flex;
    flex-direction:column;
    gap:6px;
    margin-top:8px;
  }
  
  .scene-list button{
    text-align:left;
    border:1px solid rgba(201,162,74,.22);
    background:#0c0905;
    color:var(--muted);
    padding:8px 10px;
    border-radius:3px;
    font-family:'EB Garamond',serif;
  }
  
  .scene-list button[data-on="1"]{
    color:var(--gold-lt);
    border-color:var(--gold);
    background:rgba(201,162,74,.12);
  }
  
  .scene-dialogue-tools{
    display:flex;
    gap:8px;
    margin-top:10px;
  }
  
  .scene-dialogue-tools textarea{
    min-height:64px;
  }
  .scene-party-row b{display:block;color:#f0e2bb}
  .scene-party-row span{display:block;color:var(--muted);font-size:12px}
  .scene-party-row em{color:var(--gold);font-style:normal;font-size:12px}
  .scene-mini-portrait{
    width:38px;
    height:38px;
    object-fit:cover;
    border-radius:50%;
    border:1px solid var(--gold-dk);
  }
  .scene-actions{display:flex;flex-direction:column;gap:8px}
  .scene-actions button,.end-turn{
    border:1px solid var(--gold-dk);
    background:linear-gradient(180deg,#16382f,#07130f);
    color:#f0e2bb;
    padding:13px;
    font-family:'Cinzel',serif;
    text-align:left;
  }
  .scene-actions button:nth-child(3){background:linear-gradient(180deg,#3a1d10,#100704)}
  .scene-titlebar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    border:1px solid var(--gold-dk);
    background:#0b0804;
    padding:14px 18px;
  }
  .scene-titlebar h1{
    margin:0;
    font-family:'Cinzel',serif;
    color:#f4e7bf;
    font-size:24px;
  }
  .scene-pill{
    border:1px solid var(--gold-dk);
    background:#130e07;
    color:var(--gold-lt);
    padding:8px 12px;
    font-family:'Cinzel',serif;
    font-size:12px;
  }
  .readaloud-panel{
    position:relative;
    min-height:210px;
    background:linear-gradient(100deg,#ead9ad,#d7bd7e);
    color:#2e210e;
    border:1px solid #8a6a2c;
    padding:26px 32px;
    overflow:hidden;
    box-shadow:inset 0 0 70px rgba(90,55,10,.22);
  }
  .readaloud-panel p{
    position:relative;
    z-index:2;
    max-width:62%;
    font-size:18px;
    line-height:1.5;
    margin:0;
  }
  .readaloud-art{
    position:absolute;
    right:40px;
    top:28px;
    width:190px;
    height:150px;
    border:1px solid rgba(80,50,15,.25);
    display:grid;
    place-items:center;
    font-size:80px;
    color:rgba(80,50,15,.22);
  }
  .scene-grid-two{
    display:grid;
    grid-template-columns:1.2fr 1fr;
    gap:12px;
  }
  .dialogue-row{
    display:flex;
    align-items:center;
    gap:18px;
  }
  .speech-bubble{
    background:#d9c08a;
    color:#2e210e;
    border:1px solid #8a6a2c;
    padding:18px;
    font-size:17px;
    line-height:1.4;
    border-radius:4px;
  }
  .info-block{
    border-bottom:1px solid rgba(201,162,74,.25);
    padding:6px 0 9px;
  }
  .info-block b{
    color:var(--gold);
    font-family:'Cinzel',serif;
    text-transform:uppercase;
    font-size:11px;
  }
  .info-block p{
    margin:3px 0 0;
    color:var(--muted);
    font-size:12.5px;
  }
  .scene-play-block{
    border-top:1px solid rgba(201,162,74,.24);
    padding-top:12px;
  }
  
  .scene-play-block-head{
    display:grid;
    grid-template-columns:34px minmax(0,1fr);
    gap:10px;
    align-items:center;
    margin-bottom:10px;
  }
  
  .scene-play-block-head b{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    text-transform:uppercase;
    letter-spacing:.08em;
    font-size:12px;
  }
  
  .scene-play-block-head small{
    display:block;
    color:var(--muted);
    font-size:12px;
    margin-top:2px;
  }
  
  .scene-play-icon{
    width:34px;
    height:34px;
    display:grid;
    place-items:center;
    border-radius:50%;
    color:#241a08;
    background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
    border:1px solid var(--gold-lt);
    box-shadow:0 0 16px rgba(201,162,74,.18);
    font-family:'Cinzel',serif;
  }
  
  .scene-check-list,
  .scene-outcome-cards{
    display:flex;
    flex-direction:column;
    gap:8px;
  }
  
  .scene-check-card,
  .scene-outcome-card{
    border:1px solid rgba(201,162,74,.24);
    background:linear-gradient(180deg,rgba(18,13,7,.92),rgba(9,7,4,.94));
    border-radius:7px;
    overflow:hidden;
  }
  
  .scene-check-card[data-open="1"],
  .scene-outcome-card[data-open="1"]{
    border-color:rgba(201,162,74,.55);
    box-shadow:inset 0 0 20px rgba(0,0,0,.45), 0 0 0 1px rgba(201,162,74,.08);
  }
  
  .scene-check-toggle,
  .scene-outcome-toggle{
    width:100%;
    display:grid;
    align-items:center;
    gap:10px;
    border:0;
    background:transparent;
    color:var(--txt);
    text-align:left;
    padding:10px;
  }
  
  .scene-check-toggle{
    grid-template-columns:28px minmax(0,1fr) auto 26px;
  }
  
  .scene-outcome-toggle{
    grid-template-columns:28px minmax(0,1fr) 26px;
  }
  
  .scene-check-toggle:hover,
  .scene-outcome-toggle:hover{
    background:rgba(201,162,74,.06);
  }
  
  .scene-check-number,
  .scene-outcome-icon{
    width:28px;
    height:28px;
    display:grid;
    place-items:center;
    border-radius:6px;
    background:#0b0804;
    border:1px solid rgba(201,162,74,.35);
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:12px;
  }
  
  .scene-check-main,
  .scene-outcome-main{
    min-width:0;
    display:flex;
    flex-direction:column;
    gap:2px;
  }
  
  .scene-check-name,
  .scene-outcome-title{
    color:#f0e2bb;
    font-family:'Cinzel',serif;
    font-size:12.5px;
    line-height:1.25;
  }
  
  .scene-check-hint,
  .scene-outcome-condition{
    color:var(--muted);
    font-size:12px;
    line-height:1.35;
  }
  
  .scene-outcome-condition{
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  
  .scene-dc-badge{
    border:1px solid rgba(201,162,74,.5);
    color:var(--gold-lt);
    background:rgba(201,162,74,.08);
    border-radius:999px;
    padding:4px 8px;
    font-family:'Cinzel',serif;
    font-size:11px;
    white-space:nowrap;
  }
  
  .scene-check-open{
    width:24px;
    height:24px;
    display:grid;
    place-items:center;
    border-radius:50%;
    border:1px solid rgba(201,162,74,.32);
    color:var(--gold-lt);
    background:#080604;
    font-family:'Cinzel',serif;
    font-size:16px;
    line-height:1;
  }
  
  .scene-check-details,
  .scene-outcome-details{
    border-top:1px solid rgba(201,162,74,.2);
    background:rgba(201,162,74,.04);
    padding:10px;
  }
  
  .scene-result{
    display:grid;
    grid-template-columns:28px minmax(0,1fr);
    gap:9px;
    padding:9px;
    border-radius:6px;
    border:1px solid rgba(201,162,74,.18);
    background:rgba(0,0,0,.18);
  }
  
  .scene-result + .scene-result{
    margin-top:8px;
  }
  
  .scene-result span{
    width:28px;
    height:28px;
    display:grid;
    place-items:center;
    border-radius:50%;
    font-family:'Cinzel',serif;
    font-size:13px;
  }
  
  .scene-result.success span{
    color:#dff2c2;
    border:1px solid rgba(127,176,90,.5);
    background:rgba(127,176,90,.12);
  }
  
  .scene-result.failure span{
    color:#f0c474;
    border:1px solid rgba(224,162,59,.5);
    background:rgba(224,162,59,.12);
  }
  
  .scene-result b{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.08em;
    margin-bottom:2px;
  }
  
  .scene-result p{
    margin:0;
    color:var(--muted);
    font-size:12.5px;
    line-height:1.45;
  }
  
  .scene-outcome-details{
    display:grid;
    grid-template-columns:28px minmax(0,1fr);
    gap:9px;
    align-items:start;
  }
  
  .scene-arrow{
    width:28px;
    height:28px;
    display:grid;
    place-items:center;
    border-radius:50%;
    color:#241a08;
    background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
    font-family:'Cinzel',serif;
  }
  
  .scene-outcome-details p{
    margin:2px 0 0;
    color:var(--muted);
    font-size:12.5px;
    line-height:1.5;
  }
  
  .scene-outcome-action{
    grid-column:2;
    justify-self:start;
    margin-top:8px;
    border:1px solid rgba(201,162,74,.36);
    background:#0b0804;
    color:var(--gold-lt);
    border-radius:999px;
    padding:6px 10px;
    font-family:'Cinzel',serif;
    font-size:10.5px;
    letter-spacing:.04em;
  }
  
  .scene-outcome-action:hover{
    border-color:var(--gold);
    box-shadow:0 0 0 2px rgba(201,162,74,.12);
  }
  
  @media (max-width:700px){
    .scene-check-toggle{
      grid-template-columns:28px minmax(0,1fr) 26px;
    }
  
    .scene-dc-badge{
      grid-column:2;
      justify-self:start;
    }
  }
  .combat-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
  }
  .scene-combat-table{
    width:100%;
    border-collapse:collapse;
    font-size:13px;
  }
  .scene-combat-table th,.scene-combat-table td{
    border-bottom:1px solid rgba(201,162,74,.18);
    padding:7px;
    text-align:left;
  }
  .scene-combat-table th{color:var(--gold);font-family:'Cinzel',serif;font-size:11px}
  .quest-mini{
    border-bottom:1px solid rgba(201,162,74,.2);
    padding:8px 0;
  }
  .quest-mini b{
    display:block;
    color:#f0e2bb;
    margin-bottom:5px;
  }
  .quest-mini span{
    display:block;
    color:var(--muted);
    font-size:12px;
    margin:2px 0;
  }
  .loot-row{
    display:flex;
    justify-content:space-between;
    color:#f0e2bb;
    border-bottom:1px solid rgba(201,162,74,.2);
    padding:8px 0;
  }
  .loot-row em{
    color:var(--gold);
    font-style:normal;
  }
  .end-turn{
    text-align:center;
    background:linear-gradient(180deg,#2a1c08,#100904);
    font-size:16px;
  }
  @media (max-width:1050px){
    .scene-shell{grid-template-columns:1fr}
  }
  .asset-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
    gap:14px;
  }
  
  .asset-card{
    position:relative;
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    border:1px solid var(--gold-dk);
    border-radius:6px;
    padding:10px;
  }
  
  .asset-card img{
    width:100%;
    height:170px;
    object-fit:cover;
    border:1px solid rgba(201,162,74,.35);
    border-radius:4px;
    background:#050403;
    display:block;
    margin-bottom:9px;
  }
  
  .asset-card b{
    display:block;
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
    font-size:13px;
  }
  
  .asset-card span{
    display:block;
    color:var(--muted);
    font-size:12px;
    margin-top:3px;
  }
  
  .asset-card button{
    position:absolute;
    top:8px;
    right:8px;
  }
  
  .scene-portrait{
    width:96px;
    height:96px;
    object-fit:cover;
    border-radius:8px;
    border:1px solid var(--gold-dk);
    display:block;
    margin-bottom:10px;
    background:#050403;
  }
  
  .scene-portrait.monster{
    width:100%;
    height:180px;
    border-radius:4px;
  }
  
  .dialogue-block{
    background:rgba(201,162,74,.06);
    border:1px solid rgba(201,162,74,.22);
    padding:10px 12px;
    border-radius:5px;
    margin:8px 0;
  }
  
  .dialogue-block b{
    color:var(--gold-lt);
    font-family:'Cinzel',serif;
  }
  
  .dialogue-block span{
    color:var(--muted);
    font-size:12px;
  }
  
  .dialogue-block p{
    margin:6px 0 0;
    color:var(--txt);
    font-size:15px;
    line-height:1.45;
  }
   @media (max-width:1500px){.nav-group-label{display:none}.nav button{padding:8px 10px}.nav{gap:4px 8px}.nav-group+.nav-group{padding-left:8px}}
   @media (max-width:900px){
     .top{gap:10px;padding:10px 16px}
     .nav{margin:0 -16px;padding:6px 16px 2px;width:calc(100% + 32px);-webkit-overflow-scrolling:touch}
     .nav-group-label{display:inline}
     .nav button{min-height:44px}
     .nav{-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
     .dashboard-brand-mark{display:none}
     .grid.cols-3:has(> .stat-card){grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
     .stat-card{padding:12px 14px}
     .iconbtn{width:44px;height:44px}
     .iconbtn.wide{display:none}
   }
   /* ---------- Scene Runner v2 : cleaner play layout ---------- */

.scene-shell{
  max-width:1600px;
  margin:0 auto;
  display:grid;
  grid-template-columns:260px minmax(620px,1fr) 280px;
  gap:16px;
  align-items:start;
}

.scene-left,
.scene-right,
.scene-main{
  min-width:0;
}

.scene-card{
  overflow:hidden;
}

.scene-main{
  display:flex;
  flex-direction:column;
  gap:16px;
}

.scene-titlebar{
  min-height:64px;
}

.scene-titlebar h1{
  font-size:24px;
  line-height:1.2;
}

.readaloud-panel p{
  max-width:none;
  font-size:18px;
  line-height:1.55;
  margin:0;
}

.readaloud-panel{
  display:block;
  min-height:0;
  padding:28px;
  background:linear-gradient(175deg,#ead9ad,#d7bd7e);
  color:#2e210e;
  border:1px solid #8a6a2c;
  box-shadow:inset 0 0 70px rgba(90,55,10,.22);
}

.readaloud-panel p{
  max-width:none;
  font-size:17px;
  line-height:1.6;
  margin:0;
}

.readaloud-banner-wrap{
  margin:12px 0 22px;
}

.readaloud-banner{
  width:100%;
  height:260px;
  object-fit:cover;
  object-position:center;
  display:block;
  border:1px solid rgba(80,50,15,.45);
  border-radius:5px;
  background:#120c05;
  cursor:pointer;
  box-shadow:0 8px 18px rgba(70,45,15,.22);
}

.readaloud-text{
  max-width:72ch;
}

.readaloud-thumbs{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(72px,1fr));
  gap:7px;
  margin-top:8px;
}

.readaloud-thumbs img{
  width:100%;
  height:62px;
  object-fit:cover;
  border:1px solid rgba(80,50,15,.35);
  border-radius:3px;
  cursor:pointer;
  opacity:.82;
}

.readaloud-thumbs img:hover{
  opacity:1;
  border-color:#8a6a2c;
}

.readaloud-thumbs{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:6px;
}

.readaloud-thumbs img{
  width:100%;
  height:58px;
  object-fit:cover;
  border:1px solid rgba(80,50,15,.35);
  border-radius:3px;
  cursor:pointer;
  opacity:.78;
}

.readaloud-thumbs img:hover{
  opacity:1;
  border-color:#8a6a2c;
}

.scene-grid-two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:16px;
}

.scene-grid-dialogue{
  display:grid;
  grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);
  gap:16px;
  align-items:stretch;
}

.scene-dialogue-card{
  min-height:280px;
}

.scene-dialogue-header{
  display:flex;
  align-items:center;
  gap:14px;
  margin-bottom:14px;
}

.scene-dialogue-avatar{
  width:74px;
  height:74px;
  border-radius:50%;
  object-fit:cover;
  border:2px solid var(--gold-dk);
  background:#080604;
  flex:none;
}

.scene-dialogue-name{
  font-family:'Cinzel',serif;
  color:var(--gold-lt);
  font-size:16px;
  line-height:1.2;
}

.scene-dialogue-voice{
  color:var(--muted);
  font-size:12.5px;
  margin-top:3px;
}

.scene-dialogue-lines{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.scene-dialogue-line{
  background:linear-gradient(175deg,#ead9ad,#d7bd7e);
  color:#2e210e;
  border:1px solid #8a6a2c;
  border-radius:6px;
  padding:14px 16px;
  font-size:15px;
  line-height:1.55;
}

.scene-dialogue-line small{
  display:block;
  font-family:'Cinzel',serif;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:#7b5d25;
  font-size:9.5px;
  margin-bottom:5px;
}

.scene-dialogue-prompt{
  margin-top:14px;
  border-top:1px solid rgba(201,162,74,.22);
  padding-top:12px;
}

.scene-dialogue-prompt textarea{
  min-height:74px;
}

.scene-notes-textarea{
  width:100%;
  min-height:110px;
  background:#0c0905;
  color:var(--txt);
  border:1px solid rgba(201,162,74,.35);
  border-radius:5px;
  padding:10px;
  font-family:'EB Garamond',serif;
  font-size:13.5px;
  line-height:1.45;
  resize:vertical;
}

.scene-notes-stack{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.scene-outcome-list{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.scene-outcome-list button{
  text-align:left;
  border:1px solid rgba(201,162,74,.22);
  background:#0c0905;
  color:var(--muted);
  padding:9px 10px;
  border-radius:3px;
  font-family:'EB Garamond',serif;
  line-height:1.35;
}

.scene-outcome-list button:hover{
  color:var(--gold-lt);
  border-color:var(--gold);
}

@media (max-width:1100px){
  .scene-grid-dialogue{
    grid-template-columns:1fr;
  }
}

.dialogue-row{
  display:grid;
  grid-template-columns:74px minmax(0,1fr);
  gap:14px;
  align-items:start;
}

.speech-bubble{
  font-size:15px;
  line-height:1.5;
}

.dialogue-block p{
  font-size:14px;
  line-height:1.5;
}

.scene-card p{
  font-size:13px;
  line-height:1.45;
}

.scene-portrait{
  width:100%;
  max-width:160px;
  height:160px;
  object-fit:cover;
  border-radius:6px;
  margin-bottom:10px;
}

.scene-portrait.monster{
  width:100%;
  height:180px;
  object-fit:cover;
}

.scene-mini-portrait{
  width:38px;
  height:38px;
  object-fit:cover;
  border-radius:50%;
  border:1px solid var(--gold-dk);
}

.scene-list button{
  line-height:1.35;
}

.scene-list span{
  font-size:11px;
  color:var(--faint);
}

.scene-actions{
  display:none;
}

.scene-dialogue-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.scene-dialogue-collapsible{
  border:1px solid rgba(201,162,74,.32);
  background:rgba(8,6,4,.55);
  border-radius:7px;
  overflow:hidden;
}

.scene-dialogue-collapsible[data-open="1"]{
  border-color:rgba(201,162,74,.62);
  box-shadow:0 0 0 1px rgba(201,162,74,.08), inset 0 0 22px rgba(0,0,0,.35);
}

.scene-dialogue-toggle{
  width:100%;
  display:grid;
  grid-template-columns:52px minmax(0,1fr) 32px;
  align-items:center;
  gap:12px;
  padding:10px 12px;
  border:0;
  background:linear-gradient(180deg,#140f08,#0c0905);
  color:var(--txt);
  text-align:left;
}

.scene-dialogue-toggle:hover{
  background:linear-gradient(180deg,#1a1209,#0c0905);
}

.scene-dialogue-toggle-icon{
  width:52px;
  height:52px;
  display:block;
  border-radius:50%;
  overflow:hidden;
  flex:none;
}

.scene-dialogue-toggle-icon img{
  width:52px;
  height:52px;
  object-fit:cover;
  display:block;
  border-radius:50%;
  border:1px solid var(--gold-dk);
  background:#050403;
}

.scene-dialogue-toggle-main{
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:3px;
}

.scene-dialogue-toggle-name{
  font-family:'Cinzel',serif;
  color:var(--gold-lt);
  font-size:14px;
  line-height:1.2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.scene-dialogue-toggle-meta{
  color:var(--muted);
  font-size:12px;
  line-height:1.3;
}

.scene-dialogue-chevron{
  width:28px;
  height:28px;
  border:1px solid rgba(201,162,74,.36);
  border-radius:50%;
  display:grid;
  place-items:center;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:18px;
  line-height:1;
  background:#0b0804;
}

.scene-dialogue-body{
  background:linear-gradient(175deg,#ead9ad,#d7bd7e);
  color:#2e210e;
  border-top:1px solid #8a6a2c;
  padding:16px 18px;
}

.scene-dialogue-body p{
  margin:0;
  color:#2e210e;
  font-size:15.5px;
  line-height:1.6;
}

.scene-dialogue-empty{
  border:1px dashed rgba(201,162,74,.35);
  border-radius:6px;
  padding:16px;
  color:var(--muted);
  background:rgba(201,162,74,.04);
}

.scene-dialogue-empty-title{
  font-family:'Cinzel',serif;
  color:var(--gold-lt);
  font-size:13px;
  margin-bottom:5px;
}

@media (max-width:1200px){
  .scene-shell{
    grid-template-columns:220px minmax(520px,1fr);
  }

  .scene-right{
    grid-column:1 / -1;
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:12px;
  }
}

.scene-entity-card{
  padding:13px;
}

.scene-entity-list{
  display:flex;
  flex-direction:column;
  gap:9px;
}

.scene-entity-item{
  border:1px solid rgba(201,162,74,.25);
  background:linear-gradient(180deg,#120d07,#080604);
  border-radius:7px;
  overflow:hidden;
}

.scene-entity-item[data-open="1"]{
  border-color:rgba(201,162,74,.6);
  box-shadow:inset 0 0 18px rgba(0,0,0,.45), 0 0 0 1px rgba(201,162,74,.08);
}

.scene-entity-toggle{
  width:100%;
  display:grid;
  grid-template-columns:46px minmax(0,1fr) 26px;
  gap:10px;
  align-items:center;
  border:0;
  background:transparent;
  color:var(--txt);
  text-align:left;
  padding:9px;
}

.scene-entity-toggle:hover{
  background:rgba(201,162,74,.06);
}

.scene-entity-portrait{
  width:46px;
  height:46px;
  display:block;
  border-radius:50%;
  overflow:hidden;
  border:1px solid var(--gold-dk);
  background:#050403;
}

.scene-entity-portrait img{
  width:46px;
  height:46px;
  object-fit:cover;
  display:block;
}

.scene-entity-main{
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:2px;
}

.scene-entity-name{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12.5px;
  line-height:1.2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.scene-entity-role{
  color:var(--muted);
  font-size:11.5px;
  line-height:1.25;
}

.scene-entity-chevron{
  width:24px;
  height:24px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(201,162,74,.35);
  color:var(--gold-lt);
  background:#080604;
  font-family:'Cinzel',serif;
  font-size:16px;
}

.scene-entity-details{
  border-top:1px solid rgba(201,162,74,.22);
  padding:10px;
  background:rgba(201,162,74,.035);
}

.scene-entity-details p{
  margin:0 0 8px;
  color:var(--muted);
  font-size:12.5px;
  line-height:1.45;
}

.scene-entity-meta{
  display:flex;
  flex-direction:column;
  gap:5px;
  margin:8px 0;
}

.scene-entity-meta span{
  color:var(--muted);
  font-size:12px;
  line-height:1.35;
  border-left:2px solid rgba(201,162,74,.35);
  padding-left:7px;
}

.scene-monster-stats{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:6px;
  margin:9px 0;
}

.scene-monster-stats span{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  color:var(--gold-lt);
  border-radius:5px;
  padding:6px 4px;
  text-align:center;
  font-family:'Cinzel',serif;
  font-size:11px;
}

.scene-loot-preview{
  margin-top:10px;
  border-top:1px solid rgba(201,162,74,.18);
  padding-top:9px;
}

.scene-loot-preview b{
  display:block;
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.08em;
  font-size:10.5px;
  margin-bottom:5px;
}

.scene-loot-preview p{
  color:var(--faint);
  font-size:12px;
  line-height:1.35;
  margin:0;
}

.scene-loot-chips{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
}

.scene-loot-chips span{
  border:1px solid rgba(201,162,74,.32);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:4px 7px;
  font-size:11.5px;
}

.scene-entity-sheet-btn{
  width:100%;
  margin-top:9px;
  border:1px solid rgba(201,162,74,.36);
  background:#0b0804;
  color:var(--gold-lt);
  border-radius:999px;
  padding:7px 10px;
  font-family:'Cinzel',serif;
  font-size:10.5px;
  letter-spacing:.04em;
}

.scene-entity-sheet-btn:hover{
  border-color:var(--gold);
  box-shadow:0 0 0 2px rgba(201,162,74,.12);
}

.scene-sheet-modal{
  display:grid;
  grid-template-columns:140px minmax(0,1fr);
  gap:18px;
}

.scene-sheet-portrait-wrap{
  display:flex;
  justify-content:center;
  align-items:flex-start;
}

.scene-sheet-portrait{
  width:120px;
  height:120px;
  object-fit:cover;
  border-radius:10px;
  border:1px solid var(--gold-dk);
  background:#050403;
  cursor:pointer;
}

.scene-sheet-content h3{
  margin:0 0 3px;
  font-family:'Cinzel',serif;
  color:var(--gold-lt);
}

.scene-sheet-section{
  border-top:1px solid rgba(201,162,74,.22);
  margin-top:12px;
  padding-top:10px;
}

.scene-sheet-section b{
  display:block;
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.08em;
  font-size:11px;
  margin-bottom:6px;
}

.scene-sheet-section p{
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
  margin:5px 0;
}

.scene-sheet-stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(90px,1fr));
  gap:7px;
}

.scene-sheet-stats span{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  color:var(--gold-lt);
  border-radius:5px;
  padding:7px;
  text-align:center;
  font-family:'Cinzel',serif;
  font-size:11px;
}

@media (max-width:700px){
  .scene-sheet-modal{
    grid-template-columns:1fr;
  }

  .scene-sheet-portrait-wrap{
    justify-content:flex-start;
  }
}

.bestiary-forge-panel{
  overflow:visible;
}

.bestiary-toggle{
  display:inline-grid;
  grid-template-columns:1fr 1fr;
  border:1px solid rgba(201,162,74,.35);
  background:#0b0804;
  border-radius:999px;
  padding:4px;
  margin-bottom:16px;
}

.bestiary-toggle button{
  border:0;
  background:transparent;
  color:var(--muted);
  border-radius:999px;
  padding:8px 18px;
  font-family:'Cinzel',serif;
  font-size:12px;
}

.bestiary-toggle button[data-on="1"]{
  color:#241a08;
  background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
}

.scene-link-box{
  max-height:126px;
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:6px;
  border:1px solid rgba(201,162,74,.25);
  background:#0b0804;
  border-radius:6px;
  padding:8px;
}

.scene-link-box span{
  color:var(--muted);
  font-size:13px;
}

.scene-link-box button{
  text-align:left;
  border:1px solid rgba(201,162,74,.2);
  background:#100c07;
  color:var(--muted);
  border-radius:5px;
  padding:7px 9px;
  font-size:12px;
}

.scene-link-box button[data-on="1"]{
  color:var(--gold-lt);
  border-color:var(--gold);
  background:rgba(201,162,74,.12);
}

.bestiary-card-title{
  font-family:'Cinzel',serif;
  font-size:18px;
  color:#f0e2bb;
}

.linked-scene-chips{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:10px;
}

.linked-scene-chips span{
  border:1px solid rgba(201,162,74,.32);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:4px 8px;
  font-size:11.5px;
}

.bestiary-detail{
  margin-top:12px;
}

.bestiary-section{
  border-top:1px solid rgba(201,162,74,.22);
  padding-top:11px;
  margin-top:11px;
}

.bestiary-section-title{
  font-family:'Cinzel',serif;
  color:var(--gold);
  text-transform:uppercase;
  letter-spacing:.12em;
  font-size:11px;
  margin-bottom:7px;
}

.bestiary-section p{
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
  margin:5px 0;
}

.bestiary-line{
  border:1px solid rgba(201,162,74,.18);
  background:rgba(0,0,0,.16);
  border-radius:6px;
  padding:8px 10px;
  margin-bottom:7px;
}

.bestiary-line b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
  margin-bottom:3px;
}

.bestiary-line span{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.4;
}

.action-card{
  border:1px solid rgba(201,162,74,.24);
  background:linear-gradient(180deg,#120d07,#080604);
  border-radius:7px;
  padding:10px;
  margin-bottom:8px;
}

.action-card-head{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:flex-start;
  margin-bottom:8px;
}

.action-card-head b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:13px;
}

.action-card-head span{
  display:block;
  color:var(--muted);
  font-size:11.5px;
  margin-top:2px;
}

.action-card-body p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.45;
  margin:4px 0;
}

.use-tracker{
  display:inline-flex;
  align-items:center;
  gap:5px;
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  border-radius:999px;
  padding:3px;
  flex:none;
}

.use-tracker button{
  width:22px;
  height:22px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(201,162,74,.28);
  background:#080604;
  color:var(--gold-lt);
  line-height:1;
}

.use-tracker span{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:11px;
  padding:0 4px;
}

.effect-card{
  border:1px solid rgba(201,162,74,.24);
  background:linear-gradient(180deg,#120d07,#080604);
  border-radius:7px;
  padding:9px;
  margin-bottom:8px;
}

.effect-card[data-active="1"]{
  border-color:var(--verdant);
  box-shadow:0 0 0 2px rgba(127,176,90,.12), inset 0 0 16px rgba(127,176,90,.08);
}

.effect-toggle{
  width:100%;
  display:grid;
  grid-template-columns:34px minmax(0,1fr) auto;
  gap:9px;
  align-items:center;
  border:0;
  background:transparent;
  color:var(--txt);
  text-align:left;
  padding:0;
}

.effect-icon{
  width:34px;
  height:34px;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:#0b0804;
  border:1px solid rgba(201,162,74,.35);
  color:var(--gold-lt);
}

.effect-main b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12.5px;
}

.effect-main small{
  display:block;
  color:var(--muted);
  font-size:11.5px;
  margin-top:2px;
}

.effect-state{
  border:1px solid rgba(201,162,74,.28);
  color:var(--muted);
  border-radius:999px;
  padding:4px 7px;
  font-family:'Cinzel',serif;
  font-size:10.5px;
}

.effect-card[data-active="1"] .effect-state{
  color:#dff2c2;
  border-color:rgba(127,176,90,.55);
  background:rgba(127,176,90,.12);
}

.effect-card p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.4;
  margin:8px 0 0;
}

.effect-uses{
  margin-top:8px;
}

.loot-table{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.loot-table-row{
  display:grid;
  grid-template-columns:58px minmax(0,1fr);
  gap:9px;
  border:1px solid rgba(201,162,74,.2);
  background:#0b0804;
  border-radius:7px;
  padding:8px;
}

.loot-roll{
  display:grid;
  place-items:center;
  border-radius:5px;
  color:#241a08;
  background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
  font-family:'Cinzel',serif;
  font-size:11px;
  text-align:center;
}

.loot-table-row b{
  display:block;
  color:var(--gold-lt);
  font-size:13px;
}

.loot-table-row p{
  margin:3px 0;
  color:var(--muted);
  font-size:12.5px;
  line-height:1.35;
}

.loot-table-row small{
  color:var(--faint);
  font-size:11px;
  text-transform:capitalize;
}

.combat-layout-advanced{
  display:grid;
  grid-template-columns:minmax(0,1fr) 340px;
  gap:16px;
  align-items:start;
}

.combat-main-col,
.combat-side-col{
  min-width:0;
}

.combat-side-col{
  display:flex;
  flex-direction:column;
  gap:16px;
}

.combat-control-panel{
  margin-bottom:18px;
}

.combatant-advanced{
  border:1px solid rgba(201,162,74,.24);
  border-radius:9px;
  background:linear-gradient(180deg,#130d07,#080604);
  padding:12px;
  margin-bottom:12px;
  box-shadow:inset 0 0 18px rgba(0,0,0,.45);
}

.combatant-advanced.pc{
  border-color:rgba(127,176,90,.42);
  background:
    linear-gradient(180deg,rgba(32,58,36,.22),rgba(8,6,4,.96)),
    #080604;
}

.combatant-advanced.enemy{
  border-color:rgba(192,73,47,.42);
  background:
    linear-gradient(180deg,rgba(70,20,14,.28),rgba(8,6,4,.96)),
    #080604;
}

.combatant-advanced[data-selected="1"]{
  box-shadow:0 0 0 2px rgba(236,210,137,.22), inset 0 0 22px rgba(0,0,0,.55);
}

.combatant-topline{
  display:grid;
  grid-template-columns:48px 42px minmax(0,1fr) auto;
  gap:12px;
  align-items:center;
}

.combat-init{
  width:48px;
}

.combatant-name-block{
  min-width:0;
}

.combatant-name-block b{
  color:#f0e2bb;
  font-family:'Cinzel',serif;
  font-size:14px;
}

.combatant-name-block span{
  color:var(--muted);
  font-size:12px;
}

.combat-type-badge{
  display:inline-flex;
  margin-left:7px;
  border-radius:999px;
  padding:2px 7px;
  font-family:'Cinzel',serif;
  font-size:10px;
  border:1px solid rgba(201,162,74,.28);
}

.combat-type-badge.pc{
  color:#dff2c2;
  border-color:rgba(127,176,90,.55);
  background:rgba(127,176,90,.12);
}

.combat-type-badge.enemy{
  color:#e89a8a;
  border-color:rgba(192,73,47,.55);
  background:rgba(192,73,47,.12);
}

.combat-hpbar{
  margin-top:7px;
}

.combat-hp-tools{
  display:flex;
  gap:8px;
  align-items:center;
}

.combatant-body{
  display:grid;
  grid-template-columns:1.15fr .85fr;
  gap:12px;
  margin-top:12px;
}

.combat-subpanel{
  border:1px solid rgba(201,162,74,.18);
  background:rgba(0,0,0,.16);
  border-radius:7px;
  padding:10px;
}

.combat-subtitle{
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.11em;
  font-size:10.5px;
  margin-bottom:8px;
}

.combat-small-muted{
  color:var(--muted);
  font-size:12.5px;
  margin:0;
}

.combat-attack-line{
  display:grid;
  grid-template-columns:minmax(0,1.4fr) minmax(100px,.55fr) minmax(120px,.7fr) auto;
  gap:8px;
  align-items:center;
  border:1px solid rgba(201,162,74,.18);
  background:#0b0804;
  border-radius:7px;
  padding:8px;
  margin-bottom:7px;
}

.combat-attack-main{
  display:grid;
  grid-template-columns:26px minmax(0,1fr);
  gap:8px;
  align-items:center;
}

.combat-info-dot,
.combat-effect-info{
  width:24px;
  height:24px;
  border-radius:50%;
  display:grid;
  place-items:center;
  border:1px solid rgba(201,162,74,.32);
  background:#070604;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
}

.combat-attack-main b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
  line-height:1.2;
}

.combat-attack-main span{
  display:block;
  color:var(--muted);
  font-size:11.5px;
  margin-top:2px;
}

.combat-roll-formula{
  border:1px solid rgba(201,162,74,.24);
  background:rgba(201,162,74,.05);
  border-radius:6px;
  padding:6px 8px;
}

.combat-roll-formula span{
  display:block;
  color:var(--muted);
  font-size:10.5px;
  text-transform:uppercase;
  letter-spacing:.06em;
}

.combat-roll-formula b{
  display:block;
  color:#f0e2bb;
  font-family:'JetBrains Mono',monospace;
  font-size:12px;
  margin-top:2px;
}

.combat-use-tracker{
  display:inline-flex;
  align-items:center;
  gap:4px;
  border:1px solid rgba(201,162,74,.25);
  background:#070604;
  border-radius:999px;
  padding:3px;
  white-space:nowrap;
}

.combat-use-tracker button{
  width:22px;
  height:22px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(201,162,74,.25);
  background:#0b0804;
  color:var(--gold-lt);
}

.combat-use-tracker span{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:10.5px;
  padding:0 4px;
}

.combat-use-tracker.compact{
  margin-top:6px;
}

.combat-effect-grid{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.combat-effect-chip{
  position:relative;
  border:1px solid rgba(201,162,74,.24);
  background:#0b0804;
  border-radius:8px;
  padding:7px;
  min-width:118px;
}

.combat-effect-chip[data-active="1"]{
  border-color:rgba(127,176,90,.6);
  background:rgba(127,176,90,.09);
  box-shadow:inset 0 0 14px rgba(127,176,90,.08);
}

.combat-effect-toggle{
  width:100%;
  display:grid;
  grid-template-columns:26px minmax(0,1fr);
  gap:6px;
  align-items:center;
  border:0;
  background:transparent;
  color:var(--txt);
  text-align:left;
  padding:0;
}

.combat-effect-toggle span{
  width:26px;
  height:26px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(201,162,74,.28);
  color:var(--gold-lt);
}

.combat-effect-toggle b{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:11px;
  line-height:1.2;
}

.combat-effect-info{
  position:absolute;
  top:5px;
  right:5px;
  width:20px;
  height:20px;
  font-size:10px;
}

.combat-panel-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-bottom:1px solid rgba(201,162,74,.22);
  padding-bottom:9px;
  margin-bottom:10px;
}

.combat-panel-head b{
  display:block;
  font-family:'Cinzel',serif;
  color:var(--gold-lt);
  font-size:13px;
}

.combat-panel-head span{
  display:block;
  color:var(--muted);
  font-size:12px;
  margin-top:2px;
}

.combat-map-grid{
  display:grid;
  grid-template-columns:repeat(12,1fr);
  gap:2px;
  aspect-ratio:1 / 1;
  border:1px solid rgba(201,162,74,.28);
  background:#070604;
  padding:4px;
  border-radius:7px;
}

.combat-map-cell{
  position:relative;
  border:1px solid rgba(201,162,74,.11);
  background:rgba(201,162,74,.025);
  min-width:0;
  min-height:0;
  padding:0;
}

.combat-map-cell[data-threat="1"]{
  background:rgba(224,162,59,.16);
}

.combat-map-cell:hover{
  border-color:rgba(201,162,74,.45);
}

.combat-map-token{
  position:absolute;
  inset:2px;
  display:grid;
  place-items:center;
  border-radius:50%;
  font-family:'Cinzel',serif;
  font-size:10px;
  font-weight:700;
  border:1px solid rgba(236,210,137,.5);
  color:#fff5d0;
}

.combat-map-token.pc{
  background:rgba(127,176,90,.55);
}

.combat-map-token.enemy{
  background:rgba(192,73,47,.6);
}

.combat-map-token[data-on="1"]{
  outline:2px solid var(--gold-lt);
  box-shadow:0 0 12px rgba(236,210,137,.45);
}

.dm-strategy-text p{
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
  margin:0 0 9px;
  border-left:2px solid rgba(201,162,74,.35);
  padding-left:9px;
}

.dm-strategy-section{
  border:1px solid rgba(201,162,74,.18);
  background:rgba(0,0,0,.14);
  border-radius:7px;
  padding:10px;
  margin-bottom:10px;
}

.dm-strategy-section-title{
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.1em;
  font-size:10.5px;
  margin-bottom:7px;
}

.dm-strategy-chip-grid{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}

.dm-strategy-chip{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:5px 8px;
  font-size:11.5px;
  line-height:1.25;
}

.dm-strategy-chip.active{
  border-color:rgba(127,176,90,.55);
  background:rgba(127,176,90,.12);
  color:#dff2c2;
}

.dm-strategy-chip.warning{
  border-color:rgba(224,162,59,.5);
  background:rgba(224,162,59,.1);
  color:#f0c474;
}

.dm-strategy-chip.danger{
  border-color:rgba(192,73,47,.55);
  background:rgba(192,73,47,.12);
  color:#e89a8a;
}

.dm-strategy-list{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.dm-strategy-list p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.42;
  margin:0;
  border-left:2px solid rgba(201,162,74,.35);
  padding-left:8px;
}

.dm-strategy-list b{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:11.5px;
}

.dm-turn-banner{
  border:1px solid rgba(201,162,74,.32);
  background:linear-gradient(180deg,rgba(201,162,74,.12),rgba(0,0,0,.12));
  border-radius:8px;
  padding:10px;
  margin-bottom:10px;
}

.dm-turn-banner b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:13px;
}

.dm-turn-banner span{
  display:block;
  color:var(--muted);
  font-size:12px;
  margin-top:3px;
}

.dm-effect-character{
  border:1px solid rgba(201,162,74,.2);
  background:rgba(0,0,0,.14);
  border-radius:8px;
  padding:9px;
  margin-bottom:9px;
}

.dm-effect-character[data-side="pc"]{
  border-color:rgba(127,176,90,.32);
}

.dm-effect-character[data-side="enemy"]{
  border-color:rgba(192,73,47,.32);
}

.dm-effect-character-head{
  display:flex;
  justify-content:space-between;
  gap:8px;
  align-items:flex-start;
  margin-bottom:7px;
}

.dm-effect-character-head b{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12.5px;
}

.dm-effect-character-head span{
  color:var(--muted);
  font-size:11.5px;
}

.dm-effect-chip-row{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}

.dm-effect-chip{
  position:relative;
  border:1px solid rgba(201,162,74,.3);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:5px 8px;
  font-size:11.5px;
  line-height:1.25;
}

.dm-effect-chip.active{
  color:#dff2c2;
  border-color:rgba(127,176,90,.55);
  background:rgba(127,176,90,.12);
}

.dm-effect-chip.available{
  color:#f0c474;
  border-color:rgba(224,162,59,.48);
  background:rgba(224,162,59,.1);
}

.dm-effect-chip.off{
  color:var(--faint);
}

.dm-effect-tooltip{
  display:none;
  position:absolute;
  z-index:70;
  left:0;
  bottom:calc(100% + 8px);
  width:260px;
  border:1px solid var(--gold-dk);
  background:linear-gradient(180deg,#171008,#080604);
  color:var(--txt);
  border-radius:8px;
  padding:10px;
  box-shadow:0 18px 45px rgba(0,0,0,.65);
  white-space:normal;
}

.dm-effect-chip:hover .dm-effect-tooltip{
  display:block;
}

.dm-effect-tooltip b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
  margin-bottom:5px;
}

.dm-effect-tooltip p{
  margin:0 0 6px;
  border-left:0;
  padding-left:0;
  color:var(--muted);
  font-size:12.5px;
  line-height:1.4;
}

.dm-tactic-card{
  border:1px solid rgba(201,162,74,.22);
  background:#0b0804;
  border-radius:8px;
  padding:10px;
  margin-bottom:8px;
}

.dm-tactic-card[data-severity="danger"]{
  border-color:rgba(192,73,47,.48);
  background:rgba(192,73,47,.08);
}

.dm-tactic-card[data-severity="warning"]{
  border-color:rgba(224,162,59,.48);
  background:rgba(224,162,59,.08);
}

.dm-tactic-card[data-severity="good"]{
  border-color:rgba(127,176,90,.42);
  background:rgba(127,176,90,.07);
}

.dm-tactic-card b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12.5px;
  margin-bottom:4px;
}

.dm-tactic-card p{
  margin:0;
  border-left:0;
  padding-left:0;
  color:var(--muted);
  font-size:12.5px;
  line-height:1.45;
}

.dm-rule-card{
  border-left:2px solid rgba(201,162,74,.42);
  padding-left:9px;
  margin-bottom:8px;
}

.dm-rule-card b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:11.5px;
  margin-bottom:2px;
}

.dm-rule-card p{
  margin:0;
  border-left:0;
  padding-left:0;
  color:var(--muted);
  font-size:12.5px;
  line-height:1.42;
}

.combat-map-tools{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin:10px 0 12px;
}

.combat-map-tools button{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:6px 10px;
  font-family:'Cinzel',serif;
  font-size:10.5px;
}

.combat-map-tools button[data-on="1"]{
  border-color:var(--gold);
  color:#241a08;
  background:linear-gradient(180deg,var(--gold-lt),var(--gold-dk));
}

.combat-map-help{
  color:var(--faint);
  font-size:12px;
  line-height:1.35;
  margin:0 0 10px;
}

.combat-map-cell[data-blocked="1"]{
  background:
    repeating-linear-gradient(
      45deg,
      rgba(0,0,0,.55),
      rgba(0,0,0,.55) 4px,
      rgba(201,162,74,.08) 4px,
      rgba(201,162,74,.08) 8px
    );
  border-color:rgba(201,162,74,.18);
}

.combat-map-cell[data-blocked="1"]::after{
  content:"";
  position:absolute;
  inset:22%;
  border-radius:2px;
  background:rgba(0,0,0,.45);
  border:1px solid rgba(201,162,74,.14);
}

.combat-map-cell[data-editing="1"]:hover{
  border-color:var(--gold-lt);
  box-shadow:inset 0 0 0 1px rgba(236,210,137,.35);
}

.combat-info-modal p{
  color:var(--muted);
  font-size:14px;
  line-height:1.5;
}

.combat-info-subtitle{
  color:var(--gold);
  font-family:'Cinzel',serif;
  font-size:12px;
  margin-bottom:8px;
}

.combat-rules-box{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  border-radius:7px;
  padding:12px;
  margin-top:12px;
}

.combat-rules-box b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
  margin-bottom:5px;
}

.combat-rules-box p{
  margin:0;
}

@media (max-width:1150px){
  .combat-layout-advanced{
    grid-template-columns:1fr;
  }

  .combat-side-col{
    display:grid;
    grid-template-columns:1fr 1fr;
  }
}

@media (max-width:820px){
  .combatant-topline{
    grid-template-columns:48px 42px minmax(0,1fr);
  }

  .combat-hp-tools{
    grid-column:1 / -1;
  }

  .combatant-body{
    grid-template-columns:1fr;
  }

  .combat-attack-line{
    grid-template-columns:1fr;
  }

  .combat-side-col{
    display:flex;
  }
}

.combat-edit-panel{
  margin-top:12px;
  border:1px solid rgba(201,162,74,.28);
  background:rgba(201,162,74,.04);
  border-radius:8px;
  padding:12px;
}

.combat-edit-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:10px;
}

.combat-edit-grid .field{
  margin-bottom:0;
}

.combat-edit-title{
  margin:14px 0 8px;
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.1em;
  font-size:11px;
}

.combat-edit-attacks{
  display:flex;
  flex-direction:column;
  gap:10px;
  margin-bottom:10px;
}

.combat-edit-attack{
  border:1px solid rgba(201,162,74,.22);
  background:#0b0804;
  border-radius:8px;
  padding:10px;
}

.attack-grid{
  grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  margin-bottom:10px;
}

.brain-panel{
  border:1px solid rgba(84,216,198,.28);
  background:
    radial-gradient(700px 220px at 0% 0%,rgba(84,216,198,.08),transparent 60%),
    linear-gradient(180deg,var(--panel-2),var(--panel));
}

.brain-panel textarea{
  min-height:130px;
}

.universe-builder-layout{
  display:grid;
  grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);
  gap:16px;
  align-items:start;
}

.universe-builder-main,
.universe-builder-side{
  min-width:0;
}

.ai-suggestion-stack{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.ai-suggestion-card{
  border:1px solid rgba(201,162,74,.24);
  background:linear-gradient(180deg,#120d07,#080604);
  border-radius:8px;
  padding:12px;
}

.ai-suggestion-card b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:13px;
  line-height:1.25;
  margin-bottom:5px;
}

.ai-suggestion-card p{
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
  margin:0 0 10px;
}

.ai-suggestion-meta{
  display:inline-flex;
  border:1px solid rgba(201,162,74,.28);
  color:var(--gold);
  border-radius:999px;
  padding:2px 7px;
  font-family:'Cinzel',serif;
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.08em;
  margin-bottom:7px;
}

.ai-question-card{
  border:1px solid rgba(84,216,198,.22);
  background:rgba(84,216,198,.045);
  border-radius:8px;
  padding:11px;
}

.ai-question-card p{
  color:#bfeee7;
  font-size:13px;
  line-height:1.45;
  margin:0 0 8px;
}

.ai-question-card textarea{
  min-height:62px;
  font-size:13px;
}

.ai-entity-grid{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.ai-entity-chip{
  border:1px solid rgba(201,162,74,.28);
  background:#0b0804;
  color:var(--muted);
  border-radius:999px;
  padding:5px 9px;
  font-size:12px;
  line-height:1.25;
}

.ai-entity-chip b{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:10.5px;
  text-transform:uppercase;
  letter-spacing:.06em;
  margin-right:5px;
}

.ai-empty-box{
  border:1px dashed rgba(201,162,74,.32);
  color:var(--muted);
  border-radius:8px;
  padding:14px;
  font-size:13px;
  line-height:1.45;
  text-align:center;
}

.lore-section-preview{
  border:1px solid rgba(201,162,74,.2);
  background:rgba(0,0,0,.14);
  border-radius:8px;
  padding:10px;
  margin-top:10px;
}

.lore-section-preview b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12px;
  margin-bottom:4px;
}

.lore-section-preview p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.45;
  margin:0;
}

@media (max-width:1000px){
  .universe-builder-layout{
    grid-template-columns:1fr;
  }
}

.memory-list{
  display:flex;
  flex-direction:column;
  gap:8px;
  margin-top:10px;
}

.memory-item{
  border:1px solid rgba(201,162,74,.2);
  background:#0b0804;
  border-radius:7px;
  padding:10px;
}

.memory-item b{
  display:block;
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:12.5px;
}

.memory-item p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.45;
  margin:5px 0 0;
}

.library-shell{
  display:grid;
  grid-template-columns:280px minmax(0,1fr);
  gap:16px;
  align-items:start;
}

.library-sidebar{
  position:sticky;
  top:86px;
}

.library-type-list{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.library-type-list button{
  text-align:left;
  border:1px solid rgba(201,162,74,.22);
  background:#0b0804;
  color:var(--muted);
  border-radius:7px;
  padding:9px 10px;
  font-family:'Cinzel',serif;
  font-size:11px;
}

.library-type-list button[data-on="1"]{
  border-color:var(--gold);
  color:var(--gold-lt);
  background:rgba(201,162,74,.12);
}

.library-main{
  min-width:0;
}

.library-create-panel{
  margin-bottom:16px;
}

.library-entry-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
  gap:14px;
}

.library-card{
  border:1px solid rgba(201,162,74,.26);
  background:
    linear-gradient(180deg,rgba(28,21,12,.96),rgba(10,7,4,.98));
  border-radius:8px;
  padding:12px;
  cursor:pointer;
}

.library-card:hover{
  border-color:var(--gold);
  box-shadow:0 0 0 2px rgba(201,162,74,.12);
}

.library-card[data-on="1"]{
  border-color:var(--gold-lt);
  box-shadow:inset 0 0 18px rgba(201,162,74,.08),0 0 0 2px rgba(201,162,74,.14);
}

.library-card img{
  width:100%;
  height:150px;
  object-fit:cover;
  border:1px solid rgba(201,162,74,.32);
  border-radius:5px;
  background:#050403;
  display:block;
  margin-bottom:10px;
}

.library-card-type{
  color:var(--gold);
  font-family:'Cinzel',serif;
  text-transform:uppercase;
  letter-spacing:.12em;
  font-size:10px;
  margin-bottom:5px;
}

.library-card-title{
  color:var(--gold-lt);
  font-family:'Cinzel',serif;
  font-size:15px;
  line-height:1.25;
}

.library-card p{
  color:var(--muted);
  font-size:12.5px;
  line-height:1.42;
  margin:7px 0 0;
}

.library-document{
  margin-top:16px;
  display:grid;
  grid-template-columns:220px minmax(0,1fr);
  gap:18px;
}

.library-document-image img{
  width:100%;
  height:220px;
  object-fit:cover;
  border:1px solid rgba(201,162,74,.38);
  border-radius:7px;
  background:#050403;
  display:block;
  margin-bottom:10px;
  cursor:pointer;
}

.library-document-paper{
  background:linear-gradient(175deg,#ead9ad,#d7bd7e);
  color:#2e210e;
  border:1px solid #8a6a2c;
  border-radius:8px;
  padding:22px;
  box-shadow:inset 0 0 70px rgba(90,55,10,.2);
}

.library-document-paper h2{
  color:#2e210e;
  font-family:'Cinzel',serif;
  margin:0 0 6px;
}

.library-document-paper .archive-meta{
  color:#71521d;
  font-family:'Cinzel',serif;
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.12em;
  margin-bottom:16px;
}

.library-document-paper p{
  color:#2e210e;
  font-size:16px;
  line-height:1.6;
  margin:0 0 12px;
}

.library-edit-panel{
  margin-top:16px;
}

.library-campaign-links{
  max-height:130px;
  overflow:auto;
  border:1px solid rgba(201,162,74,.25);
  background:#0b0804;
  border-radius:6px;
  padding:8px;
}

.library-campaign-links button{
  width:100%;
  text-align:left;
  border:1px solid rgba(201,162,74,.18);
  background:#100c07;
  color:var(--muted);
  border-radius:5px;
  padding:7px 9px;
  margin-bottom:6px;
  font-size:12px;
}

.library-campaign-links button[data-on="1"]{
  border-color:var(--gold);
  color:var(--gold-lt);
  background:rgba(201,162,74,.12);
}

/* ---------- Library archive pages : museum / atlas / dossier layouts ---------- */

.library-shell{
  grid-template-columns:240px minmax(0,1fr);
  max-width:1600px;
  margin:0 auto;
}

.library-main{
  min-width:0;
}

.archive-page{
  position:relative;
  margin-top:18px;
  padding:26px;
  color:#2e210e;
  background:
    radial-gradient(900px 420px at 50% 0%,rgba(255,245,215,.42),transparent 65%),
    linear-gradient(175deg,#ead9ad,#d7bd7e);
  border:1px solid #8a6a2c;
  border-radius:12px;
  box-shadow:
    inset 0 0 90px rgba(93,61,22,.22),
    inset 0 0 0 1px rgba(255,255,255,.22),
    0 20px 60px rgba(0,0,0,.45);
  overflow:hidden;
}

.archive-page::before{
  content:"";
  position:absolute;
  inset:8px;
  border:1px solid rgba(93,61,22,.22);
  border-radius:9px;
  pointer-events:none;
}

.archive-page::after{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  opacity:.22;
  background:
    radial-gradient(circle at 10% 20%,rgba(80,45,15,.18),transparent 18%),
    radial-gradient(circle at 90% 85%,rgba(80,45,15,.16),transparent 20%),
    repeating-linear-gradient(
      0deg,
      rgba(70,40,12,.035),
      rgba(70,40,12,.035) 1px,
      transparent 1px,
      transparent 5px
    );
}

.archive-page > *{
  position:relative;
  z-index:1;
}

.archive-breadcrumb{
  font-family:'Cinzel',serif;
  font-size:12px;
  color:#6f4e1f;
  margin-bottom:12px;
}

.archive-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
  margin-bottom:18px;
}

.archive-header h1{
  margin:0;
  font-family:'Cinzel',serif;
  font-size:46px;
  line-height:1.05;
  color:#2b1d0c;
  font-weight:500;
  letter-spacing:-.03em;
}

.archive-subtitle{
  margin-top:7px;
  font-family:'Cinzel',serif;
  color:#5d3a14;
  font-size:18px;
}

.archive-actions{
  position:absolute;
  top:20px;
  right:22px;
  z-index:5;
  display:flex;
  gap:8px;
}

.archive-icon-btn{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border:1px solid rgba(93,61,22,.4);
  border-radius:7px;
  background:rgba(230,205,155,.55);
  color:#2e210e;
  font-family:'Cinzel',serif;
  font-size:16px;
  cursor:pointer;
}

.archive-icon-btn:hover{
  background:rgba(245,226,181,.75);
  border-color:#8a6a2c;
}

.archive-icon-btn:disabled{
  opacity:.5;
  cursor:not-allowed;
}

.archive-panel{
  position:relative;
  background:rgba(239,220,176,.42);
  border:1px solid rgba(93,61,22,.28);
  border-radius:8px;
  padding:15px;
  box-shadow:
    inset 0 0 28px rgba(93,61,22,.08),
    0 2px 0 rgba(93,61,22,.08);
  min-width:0;
}

.archive-panel::before,
.archive-panel::after{
  content:"";
  position:absolute;
  width:16px;
  height:16px;
  border:1px solid rgba(93,61,22,.28);
  pointer-events:none;
}

.archive-panel::before{
  top:5px;
  left:5px;
  border-right:0;
  border-bottom:0;
}

.archive-panel::after{
  right:5px;
  bottom:5px;
  border-left:0;
  border-top:0;
}

.archive-panel-title{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:10px;
  font-family:'Cinzel',serif;
  color:#3a260e;
  text-transform:uppercase;
  letter-spacing:.02em;
  font-size:16px;
}

.archive-panel-title span{
  color:#7a5423;
}

.archive-panel-body p{
  margin:0 0 10px;
  color:#2e210e;
  font-size:15.5px;
  line-height:1.52;
}

.archive-muted{
  color:#7b5d2a;
  font-size:14px;
  font-style:italic;
}

.archive-list{
  margin:0;
  padding-left:18px;
  color:#2e210e;
}

.archive-list li{
  margin:6px 0;
  font-size:14.5px;
  line-height:1.4;
}

.archive-meta-table{
  display:grid;
  grid-template-columns:minmax(120px,.75fr) minmax(0,1fr);
  border:1px solid rgba(93,61,22,.18);
}

.archive-meta-label,
.archive-meta-value{
  padding:10px 12px;
  border-bottom:1px solid rgba(93,61,22,.18);
  color:#2e210e;
  font-size:14px;
}

.archive-meta-label{
  display:flex;
  align-items:center;
  gap:8px;
  font-family:'Cinzel',serif;
  background:rgba(120,80,30,.08);
  color:#4a3215;
}

.archive-meta-label span{
  width:18px;
  text-align:center;
  color:#7a5423;
}

.archive-meta-value{
  border-left:1px solid rgba(93,61,22,.18);
}

.archive-meta-label:nth-last-child(2),
.archive-meta-value:last-child{
  border-bottom:0;
}

.archive-grid{
  display:grid;
  gap:14px;
  margin-top:14px;
}

.archive-grid.two{
  grid-template-columns:repeat(2,minmax(0,1fr));
}

.archive-grid.three{
  grid-template-columns:repeat(3,minmax(0,1fr));
}

.archive-grid.four{
  grid-template-columns:repeat(4,minmax(0,1fr));
}

.archive-grid .span-two{
  grid-column:span 2;
}

.archive-mentions{
  list-style:none;
  padding:0;
  margin:0;
}

.archive-mentions li{
  display:grid;
  grid-template-columns:minmax(0,.8fr) minmax(0,1fr);
  gap:10px;
  padding:6px 0;
  border-bottom:1px solid rgba(93,61,22,.18);
  color:#2e210e;
}

.archive-mentions li:last-child{
  border-bottom:0;
}

.archive-mentions b{
  color:#3a260e;
}

.archive-mentions span{
  color:#6b4b20;
}

/* images */

.archive-hero-image{
  display:block;
  width:100%;
  object-fit:cover;
  background:#120c05;
  cursor:pointer;
}

.archive-image-empty{
  display:grid;
  place-items:center;
  width:100%;
  min-height:240px;
  border:1px dashed rgba(93,61,22,.45);
  background:rgba(70,40,12,.08);
  color:#7b5d2a;
  font-family:'Cinzel',serif;
}

.archive-hero-image.artifact{
  height:420px;
  object-fit:contain;
  padding:18px;
  background:
    radial-gradient(circle at 50% 45%,rgba(95,125,82,.25),transparent 45%),
    linear-gradient(180deg,#18170f,#080704);
  border-radius:12px;
}

.archive-hero-image.portrait{
  height:520px;
  object-position:center top;
  border-radius:8px;
}

.archive-hero-image.map{
  height:340px;
  border-radius:8px;
}

.archive-hero-image.engraving{
  height:300px;
  filter:saturate(.25) contrast(1.08);
  border-radius:4px;
}

.archive-hero-image.banner{
  height:420px;
  object-fit:cover;
  border-radius:8px;
}

.archive-hero-image.document{
  height:520px;
  object-fit:contain;
  padding:24px;
  background:
    radial-gradient(circle at 50% 45%,rgba(230,205,155,.1),transparent 60%),
    linear-gradient(180deg,#130e08,#070604);
  border-radius:8px;
}

/* artifact */

.artifact-layout{
  display:grid;
  grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);
  gap:18px;
  align-items:start;
}

.artifact-showcase{
  position:relative;
  border:2px solid #4d2f0d;
  border-radius:14px;
  padding:10px;
  background:linear-gradient(180deg,#2a1a08,#0b0703);
  box-shadow:inset 0 0 35px rgba(0,0,0,.65);
}

.artifact-plaque{
  position:absolute;
  left:50%;
  bottom:24px;
  transform:translateX(-50%);
  min-width:260px;
  text-align:center;
  padding:8px 18px;
  background:linear-gradient(180deg,#b88a36,#6f4616);
  border:1px solid #2c1a08;
  color:#1f1407;
  font-family:'Cinzel',serif;
  box-shadow:0 4px 10px rgba(0,0,0,.35);
}

.artifact-plaque b,
.artifact-plaque span{
  display:block;
}

.artifact-plaque span{
  font-size:12px;
}

/* person */

.person-layout{
  display:grid;
  grid-template-columns:380px minmax(0,1fr);
  gap:18px;
}

.person-portrait-card{
  position:relative;
}

.person-portrait-card img{
  border:3px solid #5a3510;
  box-shadow:0 10px 25px rgba(70,45,15,.25);
}

.person-quote{
  margin-top:-42px;
  position:relative;
  z-index:2;
  width:86%;
  margin-left:auto;
  margin-right:auto;
  padding:12px 16px;
  text-align:center;
  background:rgba(235,212,166,.9);
  border:1px solid rgba(93,61,22,.35);
  color:#3b2710;
  font-style:italic;
}

.person-main-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

/* place */

.place-header{
  align-items:center;
}

.archive-compass{
  width:110px;
  height:110px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(93,61,22,.26);
  color:#7a5423;
  font-family:'Cinzel',serif;
  text-align:center;
  background:rgba(120,80,30,.06);
}

.place-map-frame{
  position:relative;
  border:1px solid rgba(93,61,22,.35);
  border-radius:8px;
  padding:8px;
  background:rgba(120,80,30,.08);
}

.place-map-frame::after{
  content:"0        250        500        1000 m";
  position:absolute;
  left:34px;
  bottom:18px;
  padding:5px 12px;
  border:1px solid rgba(93,61,22,.28);
  background:rgba(235,212,166,.82);
  font-size:11px;
  color:#4a3215;
}

/* event */

.event-header{
  align-items:center;
}

.illuminated-letter{
  width:94px;
  height:94px;
  display:grid;
  place-items:center;
  flex:none;
  border:2px solid #8c451f;
  background:
    radial-gradient(circle at 50% 50%,rgba(236,210,137,.35),transparent 60%),
    linear-gradient(135deg,#7a1f12,#b06c32);
  color:#f5df9c;
  font-family:'Cinzel',serif;
  font-size:62px;
  line-height:1;
  box-shadow:inset 0 0 20px rgba(0,0,0,.28);
}

.event-header h1{
  color:#6a2118;
}

.event-engraving{
  border:1px solid rgba(93,61,22,.35);
  padding:8px;
  background:rgba(60,38,15,.1);
  margin-bottom:14px;
}

/* faction */

.faction-layout{
  display:grid;
  grid-template-columns:260px minmax(0,1fr) 330px;
  gap:18px;
  align-items:start;
}

.faction-banner{
  background:#0b0804;
  border:2px solid #4d2f0d;
  border-radius:8px;
  padding:8px;
}

.faction-motto{
  font-size:20px;
  line-height:1.45;
  font-style:italic;
  color:#3b2710;
  margin:4px 0 20px;
}

.confidential-panel{
  position:relative;
}

.confidential-stamp{
  display:inline-block;
  transform:rotate(-7deg);
  margin-top:14px;
  padding:5px 12px;
  border:3px solid #9b2f24;
  color:#9b2f24;
  font-family:'Cinzel',serif;
  font-size:24px;
  font-weight:700;
  opacity:.82;
}

/* mystery */

.archive-mystery{
  background:
    radial-gradient(600px 300px at 75% 70%,rgba(80,20,10,.18),transparent 65%),
    linear-gradient(175deg,#d9bd87,#b99558);
}

.mystery-header{
  align-items:center;
}

.mystery-progress{
  display:grid;
  grid-template-columns:repeat(4,auto);
  gap:14px;
  align-items:center;
  padding:14px 18px;
  background:rgba(235,212,166,.48);
  border:1px solid rgba(93,61,22,.28);
  color:#5d3a14;
  font-family:'Cinzel',serif;
  font-size:12px;
}

.mystery-board{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:18px;
}

.burned-note{
  background:
    radial-gradient(circle at 10% 0%,rgba(0,0,0,.35),transparent 24%),
    radial-gradient(circle at 90% 100%,rgba(0,0,0,.25),transparent 28%),
    rgba(217,190,135,.5);
  border-color:rgba(80,25,10,.45);
}

.dark-note,
.truth-panel{
  background:linear-gradient(180deg,#21170e,#0c0805);
  border-color:#6f4616;
  color:#e7d8b0;
}

.dark-note .archive-panel-title,
.truth-panel .archive-panel-title,
.dark-note p,
.truth-panel p,
.dark-note li,
.truth-panel li{
  color:#e7d8b0;
}

/* document */

.document-layout{
  display:grid;
  grid-template-columns:minmax(0,1fr) 360px;
  gap:18px;
  align-items:start;
}

.document-scan{
  border:3px solid #4d2f0d;
  border-radius:10px;
  padding:10px;
  background:linear-gradient(180deg,#191007,#070503);
  box-shadow:inset 0 0 35px rgba(0,0,0,.55);
}

/* responsive */

@media (max-width:1200px){
  .artifact-layout,
  .person-layout,
  .faction-layout,
  .document-layout{
    grid-template-columns:1fr;
  }

  .person-main-grid,
  .archive-grid.two,
  .archive-grid.three,
  .archive-grid.four,
  .mystery-board{
    grid-template-columns:1fr 1fr;
  }
}

@media (max-width:760px){
  .archive-page{
    padding:18px;
  }

  .archive-header h1{
    font-size:34px;
  }

  .person-main-grid,
  .archive-grid.two,
  .archive-grid.three,
  .archive-grid.four,
  .mystery-board{
    grid-template-columns:1fr;
  }

  .archive-grid .span-two{
    grid-column:auto;
  }

  .archive-actions{
    position:static;
    margin-bottom:12px;
  }
}

@media (max-width:900px){
  .library-shell,
  .library-document{
    grid-template-columns:1fr;
  }

  .library-sidebar{
    position:static;
  }
}

@media (max-width:850px){
  .scene-shell{
    grid-template-columns:1fr;
  }

  .readaloud-panel{
    grid-template-columns:1fr;
  }

  .scene-grid-two{
    grid-template-columns:1fr;
  }

  .scene-right{
    display:flex;
    flex-direction:column;
  }
}

/* ---------- Archive layout hardening ---------- */

.archive-page{
  max-width:100%;
  overflow:hidden;
}

.archive-page,
.archive-page *{
  overflow-wrap:anywhere;
}

.archive-header{
  padding-right:96px;
}

.archive-header h1{
  max-width:100%;
  overflow-wrap:break-word;
  hyphens:auto;
}

.archive-subtitle{
  max-width:100%;
  overflow-wrap:break-word;
}

.archive-panel{
  min-width:0;
  max-width:100%;
  overflow:hidden;
}

.archive-panel-body{
  min-width:0;
  max-width:100%;
}

.archive-panel-body p,
.archive-list li,
.archive-meta-value,
.archive-mentions span{
  overflow-wrap:anywhere;
  hyphens:auto;
}

.archive-meta-table{
  min-width:0;
  width:100%;
}

.archive-meta-label,
.archive-meta-value{
  min-width:0;
}

.archive-grid{
  align-items:start;
}

.person-main-grid,
.mystery-board,
.archive-grid.three,
.archive-grid.four{
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
}

.artifact-layout,
.person-layout,
.faction-layout,
.document-layout{
  grid-template-columns:minmax(0,1fr);
}

@media (min-width:1100px){
  .artifact-layout{
    grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);
  }

  .person-layout{
    grid-template-columns:minmax(300px,380px) minmax(0,1fr);
  }

  .faction-layout{
    grid-template-columns:minmax(190px,260px) minmax(0,1fr) minmax(280px,330px);
  }

  .document-layout{
    grid-template-columns:minmax(0,1fr) minmax(280px,360px);
  }
}

.archive-image-click-wrap{
  position:relative;
  display:block;
  cursor:pointer;
}

.archive-image-click-wrap img{
  transition:.18s ease;
}

.archive-image-click-wrap:hover img{
  filter:brightness(.78);
}

.archive-image-overlay{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  opacity:0;
  padding:8px 12px;
  border:1px solid rgba(236,210,137,.55);
  border-radius:999px;
  background:rgba(12,8,4,.78);
  color:#f3e6c0;
  font-family:'Cinzel',serif;
  font-size:12px;
  pointer-events:none;
  transition:.18s ease;
  white-space:nowrap;
}

.archive-image-click-wrap:hover .archive-image-overlay{
  opacity:1;
}

.archive-image-empty{
  cursor:pointer;
  min-height:260px;
  text-align:center;
  display:grid;
  place-items:center;
  gap:4px;
}

.archive-image-empty span,
.archive-image-empty small{
  display:block;
  font-family:'Cinzel',serif;
}

.archive-image-empty small{
  font-size:11px;
  color:#8a6a2c;
  opacity:.8;
}

.archive-image-empty:hover{
  background:rgba(70,40,12,.14);
  border-color:#8a6a2c;
}

.archive-hero-image.portrait{
  height:auto;
  max-height:560px;
  aspect-ratio:3 / 4;
}

.archive-hero-image.artifact{
  min-height:300px;
  max-height:460px;
}

.archive-hero-image.map,
.archive-hero-image.engraving{
  height:auto;
  min-height:220px;
  max-height:360px;
  aspect-ratio:16 / 7;
}

.archive-hero-image.document{
  height:auto;
  min-height:340px;
  max-height:620px;
}

.person-quote{
  overflow-wrap:anywhere;
}

.mystery-progress{
  max-width:100%;
  overflow:auto;
}
   `;

/* ----------------------------- utilities -------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function PortraitToken({ seed = 'x', size = 56 }) {
  const svg = useMemo(() => {
    const h = hashStr(seed);
    const hue = h % 360,
      hue2 = (hue + 40 + ((h >> 8) % 80)) % 360;
    const r = (n) => ((h >> n) & 0xff) / 255;
    const blobs = Array.from({ length: 4 }, (_, i) => {
      const cx = 20 + r(i * 3) * 60,
        cy = 20 + r(i * 3 + 1) * 60,
        rr = 12 + r(i * 3 + 2) * 26,
        hh = (hue2 + i * 33) % 360;
      return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="hsl(${hh} 55% ${
        26 + i * 9
      }%)" opacity="${0.5 + r(i) * 0.4}"/>`;
    }).join('');
    const init = (seed.match(/\b\w/g) || ['?'])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g${h}" cx="35%" cy="30%"><stop offset="0%" stop-color="hsl(${hue} 55% 28%)"/><stop offset="100%" stop-color="hsl(${
      (hue + 200) % 360
    } 45% 10%)"/></radialGradient></defs><rect width="100" height="100" fill="url(#g${h})"/>${blobs}<text x="50" y="53" font-family="Cinzel,serif" font-size="30" font-weight="700" fill="rgba(245,235,200,.92)" text-anchor="middle" dominant-baseline="central">${init}</text></svg>`;
  }, [seed]);
  return (
    <div
      className="token"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/* ----------------------------- AI layer (OpenAI-compatible) ------------- */
const AI_KEY = 'loresmith:ai:v1';
const AI_PRESETS = {
  gemini: {
    label: 'Google Gemini (gratuit · Flash)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    help: 'Clé gratuite : aistudio.google.com → « Get API key ». Si le modèle refuse, essaie gemini-3-flash.',
  },
  openrouter: {
    label: 'OpenRouter (modèles :free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-4-maverick:free',
    help: 'Compte sur openrouter.ai → Keys. Garde le suffixe :free sur le modèle.',
  },
  groq: {
    label: 'Groq (gratuit · très rapide)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    help: 'Clé gratuite : console.groq.com.',
  },
  openai: {
    label: 'OpenAI (payant, peu coûteux)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    help: 'Clé : platform.openai.com. Pas gratuit, mais gpt-4o-mini coûte très peu.',
  },
  custom: {
    label: 'Autre (compatible OpenAI)',
    baseUrl: '',
    model: '',
    help: 'Pour un LLM local (Ollama / LM Studio) ou une autre passerelle compatible OpenAI.',
  },
};
const defaultAI = () => ({
  provider: 'gemini',
  baseUrl: AI_PRESETS.gemini.baseUrl,
  model: AI_PRESETS.gemini.model,
  apiKey: '',
  elevenKey: '',
  voiceOutput: 'self', // "self" = je lis moi-même | "generate" = générer le son
});
const AIContext = createContext({ ai: defaultAI(), setAI: () => {} });

async function callAIMessages(ai, messages, json, opts = {}) {
  if (!ai || !ai.apiKey)
    throw new Error("Configure l'IA dans Réglages (clé API manquante).");
  // Le modèle est facultatif : à défaut, on prend celui du fournisseur choisi.
  const model = (ai.model || '').trim() || AI_PRESETS[ai.provider]?.model;
  if (!model) throw new Error('Indique le nom du modèle dans Réglages.');
  const url = (ai.baseUrl || '').replace(/\/$/, '') + '/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + ai.apiKey,
  };
  if (ai.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://loresmith.local';
    headers['X-Title'] = 'Loresmith';
  }
  const maxTokens = opts.maxTokens || (json ? 4000 : 1800);
  const send = (max) => fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: json
        ? [
            ...messages.slice(0, -1),
            {
              ...messages[messages.length - 1],
              content:
                messages[messages.length - 1].content +
                '\n\nIMPORTANT: Return ONLY valid JSON. No Markdown. No explanation. No code fences.',
            },
          ]
        : messages,
      temperature: opts.temperature ?? (json ? 0.2 : 0.85),
      max_tokens: max,
    }),
  });
  let res = await send(maxTokens);
  // Certains modèles refusent un plafond de réponse élevé : on réessaie avec le plafond habituel.
  if (res.status === 400 && maxTokens > 4000) res = await send(4000);
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 160);
    } catch {}
    if (res.status === 401)
      throw new Error('Clé refusée (401). Vérifie ta clé dans Réglages.');
    if (res.status === 404)
      throw new Error(
        'Modèle introuvable (404). Vérifie le nom du modèle dans Réglages.'
      );
    if (res.status === 429)
      throw new Error(
        'Limite atteinte (429). Attends un peu ou change de modèle.'
      );
    throw new Error('Erreur IA ' + res.status + '. ' + detail);
  }
  const data = await res.json();
  const text = (
    (data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content) ||
    ''
  ).trim();
  if (!json) return text;
  let clean = text.trim();

  // Enlève les blocs Markdown du type ```json ... ```
  clean = clean
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  // Essaie de trouver le premier vrai bloc JSON dans la réponse
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(clean);
  } catch {
    // Réponse coupée par le plafond de longueur : on garde tout ce qui est complet.
    const repaired = repairJson(text);
    if (repaired) return { ...repaired, _truncated: true };
    console.warn('Réponse IA non JSON. Utilisation du fallback texte.');
    console.warn("Réponse brute de l'IA:", text);

    return {
      _parseFailed: true,
      _rawText: text,
    };
  }
}
const callAI = (ai, { system, prompt, json = true, maxTokens, temperature }) =>
  callAIMessages(
    ai,
    (system ? [{ role: 'system', content: system }] : []).concat([
      { role: 'user', content: prompt },
    ]),
    json,
    { maxTokens, temperature }
  );
function getJsonStringField(text, key) {
  if (!text) return '';
  const re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 's');
  const match = text.match(re);

  if (!match) return '';

  try {
    return JSON.parse('"' + match[1] + '"');
  } catch {
    return match[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }
}

function cleanCampaignTitle(title, fallback) {
  const raw = (title || fallback || 'Generated Campaign').trim();

  return raw
    .replace(/^["'{\s]+/, '')
    .replace(/["'}\s]+$/, '')
    .slice(0, 80);
}

function fallbackSceneFromText(rawText) {
  const setting = getJsonStringField(rawText, 'setting');
  const readAloud = getJsonStringField(rawText, 'readAloud');

  return {
    setting:
      setting ||
      rawText ||
      'The AI returned text instead of structured scene data.',
    readAloud: readAloud || '',
    dialogues: [],
    npcs: [],
    encounters: [],
    skillChecks: [],
    branches: [],
    loot: [],
  };
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error('Impossible de lire le fichier image.'));

    reader.readAsDataURL(file);
  });
}

function getAssetsFor(state, targetType, targetId) {
  return Object.values(state.assets || {}).filter(
    (asset) => asset.targetType === targetType && asset.targetId === targetId
  );
}

function getPrimaryAsset(state, targetType, targetId) {
  return (
    getAssetsFor(state, targetType, targetId).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    )[0] || null
  );
}

function getUniverseAssets(state, universeId, category) {
  return Object.values(state.assets || {}).filter(
    (asset) =>
      asset.universeId === universeId &&
      (!category || asset.category === category)
  );
}

function buildImagePrompt({ type, name, description, universe }) {
  return `
    Dark fantasy tabletop RPG illustration.
    
    Subject type: ${type}
    Name: ${name || 'Unnamed subject'}
    Universe: ${universe.name}
    Tone: ${universe.tone}
    Canon: ${universe.lore}
    
    Description:
    ${
      description || 'Create an evocative fantasy image that fits the campaign.'
    }
    
    Style:
    ornate dark fantasy, painterly realism, dramatic lighting, detailed textures,
    cinematic composition, no text, no UI, no watermark.
    `.trim();
}
/* ----------------------------- store ------------------------------------ */
const BRAND = {
  emblem: '/brand/loresmith-emblem-gold-transparent.png',
  horizontal: '/brand/loresmith-horizontal-no-star-t-transparent.png',
  stacked: '/brand/loresmith-primary-stacked-no-star-t-transparent.png',
  wordmark: '/brand/loresmith-wordmark-no-star-t-transparent.png',
  horizontalGold: '/brand/loresmith-horizontal-gold-transparent.png',
  wordmarkGold: '/brand/loresmith-wordmark-gold-transparent.png',
};
const STORE_KEY = 'loresmith:store:v1';
function seedUniverse() {
  const id = uid();
  return {
    universes: {
      [id]: {
        id,
        name: 'The Sundered Reach',
        tone: 'high fantasy, hopeful but perilous',
        lore: 'A coastal frontier of drowned ruins and warring guilds, where old gods stir beneath the tide. Magic is feared by the church of the Pale Lantern.',
        createdAt: now(),
      },
    },
    activeUniverseId: id,
    characters: {},
    campaigns: {},
    npcs: {},
    quests: {},
    assets: {},
    libraryEntries: {},
    chatThreads: {},
    combat: { combatants: [], round: 1 },
    log: [],
  };
}
function reducer(s, a) {
  // Chaque chargement (et chaque import de sauvegarde) passe par la migration des campagnes vers le format V3.
  if (a.type === 'HYDRATE') return migrateState(a.state);
  if (!s) return seedUniverse();
  const U = s.activeUniverseId;
  switch (a.type) {
    case 'ADD_MAP':
      return { ...s, maps: { ...(s.maps || {}), [a.map.id]: a.map } };
    case 'UPDATE_MAP':
      return {
        ...s,
        maps: { ...(s.maps || {}), [a.id]: { ...s.maps[a.id], ...a.patch } },
      };
    case 'DELETE_MAP': {
      const maps = { ...(s.maps || {}) };
      delete maps[a.id];
      return { ...s, maps };
    }
    case 'ADD_UNIVERSE':
      return {
        ...s,
        universes: { ...s.universes, [a.u.id]: a.u },
        activeUniverseId: a.u.id,
      };
    case 'UPDATE_UNIVERSE':
      return {
        ...s,
        universes: {
          ...s.universes,
          [a.id]: { ...s.universes[a.id], ...a.patch },
        },
      };
    case 'DELETE_UNIVERSE': {
      const un = { ...s.universes };
      delete un[a.id];
      const rest = Object.keys(un);
      return { ...s, universes: un, activeUniverseId: rest[0] || null };
    }
    case 'SET_UNIVERSE':
      return { ...s, activeUniverseId: a.id };
    case 'ADD_CHARACTER':
      return {
        ...s,
        characters: { ...s.characters, [a.c.id]: { ...a.c, universeId: U } },
      };
    case 'UPDATE_CHARACTER':
      return {
        ...s,
        characters: {
          ...s.characters,
          [a.id]: { ...s.characters[a.id], ...a.patch },
        },
      };
    case 'DELETE_CHARACTER': {
      const c = { ...s.characters };
      delete c[a.id];
      return { ...s, characters: c };
    }
    case 'ADD_CAMPAIGN':
      return {
        ...s,
        campaigns: { ...s.campaigns, [a.c.id]: migrateCampaign({ ...a.c, universeId: U }) },
      };
    case 'UPDATE_SCENE': {
      const c = s.campaigns[a.cid];
      const scenes = c.scenes.map((sc) =>
        sc.id === a.sid ? { ...sc, ...a.patch } : sc
      );
      return { ...s, campaigns: { ...s.campaigns, [a.cid]: { ...c, scenes } } };
    }
    case 'DELETE_CAMPAIGN': {
      const c = { ...s.campaigns };
      delete c[a.id];
      return { ...s, campaigns: c };
    }
    case 'ADD_NPC':
      return { ...s, npcs: { ...s.npcs, [a.n.id]: { ...a.n, universeId: U } } };
    case 'UPDATE_NPC':
      return {
        ...s,
        npcs: {
          ...s.npcs,
          [a.id]: {
            ...s.npcs[a.id],
            ...a.patch,
          },
        },
      };
    case 'DELETE_NPC': {
      const n = { ...s.npcs };
      delete n[a.id];
      return { ...s, npcs: n };
    }
    case 'ADD_QUEST':
      return {
        ...s,
        quests: { ...s.quests, [a.q.id]: { ...a.q, universeId: U } },
      };
    case 'UPDATE_QUEST':
      return {
        ...s,
        quests: { ...s.quests, [a.id]: { ...s.quests[a.id], ...a.patch } },
      };
    case 'DELETE_QUEST': {
      const q = { ...s.quests };
      delete q[a.id];
      return { ...s, quests: q };
    }
    case 'ADD_ASSET':
      return {
        ...s,
        assets: {
          ...(s.assets || {}),
          [a.asset.id]: {
            ...a.asset,
            universeId: U,
          },
        },
      };

    case 'DELETE_ASSET': {
      const assets = { ...(s.assets || {}) };
      delete assets[a.id];
      return { ...s, assets };
    }

    case 'UPDATE_ASSET':
      return {
        ...s,
        assets: {
          ...(s.assets || {}),
          [a.id]: {
            ...(s.assets || {})[a.id],
            ...a.patch,
          },
        },
      };

    case 'IMPORT_ARCHIVE_ENTRIES': {
      // Ajoute les fiches des Archives qui ne sont pas encore dans la bibliothèque de l'univers : jamais d'écrasement.
      const libraryEntries = { ...(s.libraryEntries || {}) };
      for (const entry of a.entries) {
        const cur = libraryEntries[entry.id];
        // Fiche importée avant la mise en forme structurée : on la complète, sans toucher à ce qui a été modifié.
        if (!cur) libraryEntries[entry.id] = entry;
        else if (cur.sourceId && (!cur.sections || cur.imageSrcs === undefined)) libraryEntries[entry.id] = { ...entry, ...cur };
        // Reclassement d'une fiche importée dans l'ancien rayon « Documents » vers son rayon d'origine.
        else if (cur.sourceId && cur.archiveType === 'document' && entry.archiveType !== 'document') libraryEntries[entry.id] = { ...cur, archiveType: entry.archiveType };
      }
      const assets = { ...(s.assets || {}) };
      // Images des Archives : mises à jour à chaque import (elles ne sont jamais éditées à la main).
      for (const asset of a.assets || []) if (!assets[asset.id] || assets[asset.id].source === 'archives') assets[asset.id] = asset;
      // Import complet de l'univers : les images des Archives qui ne sont plus rattachées (doublons) sont retirées.
      if (a.full) {
        const wanted = new Set((a.assets || []).map((x) => x.id));
        for (const [id, x] of Object.entries(assets)) if (x.source === 'archives' && x.universeId === a.universeId && !wanted.has(id)) delete assets[id];
      }
      return { ...s, libraryEntries, assets };
    }
    case 'ADD_LIBRARY_ENTRY':
      return {
        ...s,
        libraryEntries: {
          ...(s.libraryEntries || {}),
          [a.entry.id]: {
            ...a.entry,
            universeId: U,
          },
        },
      };

    case 'UPDATE_LIBRARY_ENTRY':
      return {
        ...s,
        libraryEntries: {
          ...(s.libraryEntries || {}),
          [a.id]: {
            ...(s.libraryEntries || {})[a.id],
            ...a.patch,
            updatedAt: now(),
          },
        },
      };

    case 'DELETE_LIBRARY_ENTRY': {
      const libraryEntries = { ...(s.libraryEntries || {}) };
      delete libraryEntries[a.id];
      return { ...s, libraryEntries };
    }

    case 'UPDATE_CAMPAIGN':
      return {
        ...s,
        campaigns: {
          ...s.campaigns,
          [a.id]: {
            ...s.campaigns[a.id],
            ...a.patch,
          },
        },
      };

    case 'ADD_CHAT_THREAD':
      return {
        ...s,
        chatThreads: {
          ...(s.chatThreads || {}),
          [a.thread.id]: {
            ...a.thread,
            universeId: U,
          },
        },
      };

    case 'UPDATE_CHAT_THREAD':
      return {
        ...s,
        chatThreads: {
          ...(s.chatThreads || {}),
          [a.id]: {
            ...(s.chatThreads || {})[a.id],
            ...a.patch,
            updatedAt: now(),
          },
        },
      };

    case 'DELETE_CHAT_THREAD': {
      const chatThreads = { ...(s.chatThreads || {}) };
      delete chatThreads[a.id];
      return { ...s, chatThreads };
    }
    case 'COMBAT_SET':
      return { ...s, combat: { ...s.combat, ...a.patch } };
    case 'ADD_LOG':
      return {
        ...s,
        log: [
          { id: uid(), t: now(), universeId: U, ...a.entry },
          ...s.log,
        ].slice(0, 200),
      };
    case 'CLEAR_LOG':
      return { ...s, log: s.log.filter((l) => l.universeId !== U) };
    default:
      return s;
  }
}

/* ----------------------------- backups ---------------------------------- */
function exportBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    'loresmith-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ----------------------------- small UI --------------------------------- */
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={wide ? { maxWidth: 760 } : null}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="field">
      <label className="fl">{label}</label>
      {children}
    </div>
  );
}
function Spin() {
  return <span className="spin" />;
}

/* =========================================================================
      APP
      ========================================================================= */
export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () => null);
  const [hydrated, setHydrated] = useState(false);
  // Garde de parole : les créatures de faune ne parlent pas (feeds/fauna.ts).
  const { feed: faunaFeed } = useUnderdarkFeed();
  const faunaSet = useMemo(() => faunaNames(faunaFeed?.entries ?? []), [faunaFeed]);
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'dashboard';
  });
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saveState, setSaveState] = useState({ status: 'saved' });
  const saveRef = useRef(null);
  const importRef = useRef(null);

  const [ai, setAiState] = useState(() => {
    try {
      const r = localStorage.getItem(AI_KEY);
      return r ? { ...defaultAI(), ...JSON.parse(r) } : defaultAI();
    } catch {
      return defaultAI();
    }
  });
  const setAI = useCallback(
    (patch) =>
      setAiState((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(AI_KEY, JSON.stringify(next));
        } catch {}
        return next;
      }),
    []
  );

  // Liaison permanente : l'univers Underdark est relié aux Archives dès qu'il est ouvert.
  useEffect(() => {
    const u = state?.universes?.[state.activeUniverseId];
    if (u && /underdark/i.test(u.name) && !u.archives) {
      dispatch({ type: 'UPDATE_UNIVERSE', id: u.id, patch: { archives: UNDERDARK_LINK } });
    }
  }, [state]);

  // Console MJ : elle répond aux écrans joueurs qui se connectent et leur envoie la scène en cours.
  useEffect(() => {
    hostStage();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        askPersistence();
        const parsed = (await loadState(STORE_KEY)) || seedUniverse();

        dispatch({
          type: 'HYDRATE',
          state: {
            ...seedUniverse(),
            ...parsed,
            assets: parsed.assets || {},
            libraryEntries: parsed.libraryEntries || {},
            chatThreads: parsed.chatThreads || {},
            combat: parsed.combat || { combatants: [], round: 1 },
            log: parsed.log || [],
          },
        });
      } catch {
        dispatch({ type: 'HYDRATE', state: seedUniverse() });
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated || !state) return;
    clearTimeout(saveRef.current);
    setSaveState((prev) => (prev.status === 'error' ? prev : { status: 'pending' }));
    saveRef.current = setTimeout(async () => {
      try {
        await persistState(STORE_KEY, state);
        setSaveState({ status: 'saved' });
      } catch (err) {
        // Avant, l'échec (souvent un quota dépassé par des images) passait sous silence.
        const full = err && (err.name === 'QuotaExceededError' || err.code === 22);
        setSaveState({
          status: 'error',
          message: full
            ? 'Stockage du navigateur plein : exporte une sauvegarde et supprime des images lourdes.'
            : 'Sauvegarde locale impossible : ' + (err?.message || 'erreur inconnue'),
        });
      }
    }, 400);
  }, [state, hydrated]);

  useEffect(() => {
    if (saveState.status === 'error') flash(saveState.message);
  }, [saveState.status]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url.toString());
  }, [view]);

  function openViewInNewTab(nextView) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', nextView);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  const flash = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2200);
  }, []);

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !obj.universes) throw new Error('structure inconnue');
        if (confirm('Remplacer toutes les données actuelles par ce backup ?')) {
          dispatch({ type: 'HYDRATE', state: obj });
          persistState(STORE_KEY, obj).catch(() => {});
          flash('Backup restauré');
        }
      } catch (err) {
        flash('Fichier invalide : ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  if (!hydrated || !state)
    return (
      <>
        <style>{STYLE}</style>
        <div
          className="ls-root"
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="empty">
            <Spin />
            <div style={{ marginTop: 12 }}>Ouverture du grimoire…</div>
          </div>
        </div>
      </>
    );

  const U = state.activeUniverseId;
  const universe = state.universes[U] || null;
  const inU = (obj) => Object.values(obj).filter((x) => x.universeId === U);
  const party = inU(state.characters);
  const campaigns = inU(state.campaigns).sort(
    (a, b) => b.createdAt - a.createdAt
  );
  const npcs = inU(state.npcs).sort((a, b) => b.createdAt - a.createdAt);
  const quests = inU(state.quests);

  const universeImageAsset = universe
    ? getPrimaryAsset(state, 'universe', universe.id)
    : null;
  const universeImage = universeImageAsset?.dataUrl || universeImageAsset?.url || '';

  function goTo(nextView) {
    setView(nextView);
    window.scrollTo({ top: 0 });
  }

  const searchItems = buildSearchItems({ state, U, campaigns, npcs, quests, party });

  return (
    <AIContext.Provider value={{ ai, setAI }}>
      <>
        <style>{STYLE}</style>
        <div className="ls-root lsx-root">
          <Sidebar
            view={view}
            setView={goTo}
            brand={BRAND}
            universes={Object.values(state.universes)}
            universe={universe}
            universeImage={universeImage}
            onSwitchUniverse={(id) => dispatch({ type: 'SET_UNIVERSE', id })}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenDice={() => setDiceOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            open={sideOpen}
            onClose={() => setSideOpen(false)}
          />
          <div className="lsx-main" data-view={view}>
            <Topbar
              view={view}
              onMenu={() => setSideOpen(true)}
              onOpenSearch={() => setSearchOpen(true)}
              onExport={() => exportBackup(state)}
              onImport={() => importRef.current && importRef.current.click()}
              onSettings={() => setSettingsOpen(true)}
              onPopout={openViewInNewTab}
              saveState={saveState}
            />
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          <div className="wrap lsx-content" data-view={view}>
            {!universe ? (
              <NoUniverse dispatch={dispatch} />
            ) : view === 'dashboard' ? (
              <Dashboard
                {...{
                  state,
                  dispatch,
                  universe,
                  party,
                  campaigns,
                  npcs,
                  quests,
                  setView,
                  flash,
                  setSettingsOpen,
                  importRef,
                }}
              />
            ) : view === 'library' ? (
              <Library {...{ state, dispatch, universe, campaigns, flash }} />
            ) : view === 'forge' ? (
              <CampaignStudio
                {...{ universe, state, campaigns, party, npcs, dispatch, flash }}
                setView={goTo}
                call={(o) => callAI(ai, o)}
                services={{
                  renderCampaign: (camp, feed) => (
                    <CampaignCard key={camp.id} camp={camp} defaultOpen feed={feed} {...{ state, dispatch, universe, party, flash, setView: goTo }} />
                  ),
                  renderScene: (camp, scene, session, idx, feed) => (
                    <SceneRow key={scene.id} scene={scene} idx={idx} camp={camp} session={session} feed={feed} {...{ state, dispatch, universe, party, flash, setView: goTo }} />
                  ),
                  renderQuickForge: () => <Forge {...{ state, dispatch, universe, party, campaigns, flash, setView }} hideList />,
                  forge: (camp, { brief, writeAll, onStep, feed }) =>
                    forgeCampaign({ ai, universe, state, party, feed, brief, dispatch, writeAll, onStep, campaignId: camp.id, keep: { foundations: camp.foundations, createdAt: camp.createdAt } }),
                  createSheet: ({ camp, name, mode, count }, feed) =>
                    createCreatureSheet({ call: (o) => callAI(ai, o), creature: { name, count }, universe, state, feed, party, camp, dispatch, flash, mode }),
                }}
              />
            ) : view === 'chat' ? (
              <Chat
                {...{
                  state,
                  dispatch,
                  universe,
                  party,
                  campaigns,
                  npcs,
                  flash,
                  setSettingsOpen,
                  faunaSet,
                }}
              />
            ) : view === 'scene' ? (
              <SceneRunner
                {...{
                  state,
                  dispatch,
                  universe,
                  party,
                  campaigns,
                  npcs,
                  quests,
                  flash,
                  setView,
                }}
              />
            ) : view === 'party' ? (
              <Party {...{ state, dispatch, party, universe, flash }} />
            ) : view === 'assets' ? (
              <AssetManager
                {...{
                  state,
                  dispatch,
                  universe,
                  party,
                  campaigns,
                  npcs,
                  flash,
                }}
              />
            ) : view === 'bestiary' ? (
              <Bestiary
                {...{
                  dispatch,
                  state,
                  universe,
                  npcs,
                  party,
                  campaigns,
                  flash,
                }}
              />
            ) : view === 'encounter' ? (
              <Encounter {...{ dispatch, state, party, npcs, flash }} onOpenBattleMap={(mapId) => { setMapIntent({ mapId, battle: true }); goTo('maps'); }} />
            ) : view === 'archives' ? (
              <ArchivesPage universe={universe} dispatch={dispatch} flash={flash} />
            ) : view === 'maps' ? (
              <MapsPage universe={universe} maps={state.maps || {}} dispatch={dispatch} flash={flash} heroes={party} campaigns={campaigns} bestiary={npcs} onReturnToTable={() => setView('scene')}
                artOf={(name, id) => combatantArtOf(state, (state.combat?.combatants || []).find((c) => c.id === id), faunaFeed) || creatureArtOf(state, name, faunaFeed)}
                renderCombat={(slot) => slot.area === 'attack'
                  ? <AttackPanel key={slot.battle.aim?.at} state={state} dispatch={dispatch} battle={slot.battle} setBattle={slot.setBattle} />
                  : slot.area === 'card'
                  ? <TokenSheet state={state} dispatch={dispatch} id={slot.selectedId} battle={slot.battle} onClose={() => slot.onSelect(null)} />
                  : <MapEncounter {...{ state, dispatch, party, npcs, flash }} {...slot} />}
              />
            ) : view === 'present' ? (
              <StageControl {...{ universe, state, flash }} />
            ) : view === 'quests' ? (
              <Quests {...{ dispatch, quests, campaigns, flash }} />
            ) : (
              <Conjure {...{ dispatch, universe, party, state, flash }} />
            )}
          </div>
          </div>
          <DiceFloater open={diceOpen} onOpenChange={setDiceOpen} />
          <MobileBar
            view={view}
            setView={goTo}
            onOpenDice={() => setDiceOpen((o) => !o)}
            onMenu={() => setSideOpen(true)}
          />
          <CommandPalette
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            items={searchItems}
            onPick={(item) => {
              setSearchOpen(false);
              goTo(item.view);
            }}
          />
          {settingsOpen && (
            <SettingsModal
              onClose={() => setSettingsOpen(false)}
              flash={flash}
            />
          )}
          {toast && <div className="toast">{toast}</div>}
        </div>
      </>
    </AIContext.Provider>
  );
}


/* ----------------------------- recherche globale ------------------------ */
// Index plat de tout ce qui vit dans l'univers actif, pour la palette ⌘K.
function buildSearchItems({ state, U, campaigns, npcs, quests, party }) {
  const items = [];
  for (const g of NAV)
    for (const it of g.items)
      items.push({ key: 'v-' + it.view, kind: 'Page', label: it.label, hint: g.label, view: it.view });
  for (const c of campaigns) {
    items.push({ key: 'c-' + c.id, kind: 'Campagne', label: c.title, hint: c.theme || '', view: 'forge' });
    for (const sc of c.scenes || [])
      items.push({ key: 's-' + sc.id, kind: 'Scène', label: sc.title, hint: c.title, view: 'scene' });
  }
  for (const n of npcs)
    items.push({ key: 'n-' + n.id, kind: 'PNJ', label: n.name, hint: n.role || n.type || '', view: 'bestiary' });
  for (const p of party)
    items.push({ key: 'p-' + p.id, kind: 'Personnage', label: p.name, hint: [p.race, p.cls].filter(Boolean).join(' '), view: 'party' });
  for (const q of quests)
    items.push({ key: 'q-' + q.id, kind: 'Quête', label: q.title, hint: q.type === 'main' ? 'principale' : 'secondaire', view: 'quests' });
  for (const e of Object.values(state.libraryEntries || {}))
    if (e.universeId === U)
      items.push({ key: 'l-' + e.id, kind: 'Fiche', label: e.title, hint: LIBRARY_TYPES[e.archiveType]?.singular || '', view: 'library' });
  for (const m of Object.values(state.maps || {}))
    if (m.universeId === U)
      items.push({ key: 'm-' + m.id, kind: 'Carte', label: m.name || m.title || 'Carte', view: 'maps' });
  return items;
}
/* ----------------------------- Settings (AI) ---------------------------- */
function SettingsModal({ onClose, flash }) {
  const { ai, setAI } = useContext(AIContext);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');
  function pickPreset(p) {
    const preset = AI_PRESETS[p];
    setAI({
      provider: p,
      baseUrl: preset.baseUrl || ai.baseUrl,
      model: preset.model || ai.model,
    });
  }
  async function test() {
    setTesting(true);
    setResult('');
    try {
      const out = await callAI(ai, {
        json: false,
        prompt: 'Réponds uniquement par: OK',
      });
      setResult('✓ Connexion réussie — ' + out.slice(0, 40));
    } catch (e) {
      setResult('✗ ' + e.message);
    }
    setTesting(false);
  }
  return (
    <Modal title="Réglages — moteur IA" onClose={onClose}>
      <div className="warnbar">
        Le « ChatGPT gratuit » (site web) n'est pas une API. Pour une clé{' '}
        <b>gratuite</b>, le plus simple est Google Gemini (modèles Flash) ou
        OpenRouter (modèles « :free »). La clé reste sur ton appareil ; elle
        n'est pas incluse dans les backups.
      </div>
      <Field label="Fournisseur">
        <select
          className="in"
          value={ai.provider}
          onChange={(e) => pickPreset(e.target.value)}
        >
          {Object.entries(AI_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>
      <div
        className="faint"
        style={{ fontSize: 12.5, margin: '-6px 0 12px', lineHeight: 1.5 }}
      >
        {AI_PRESETS[ai.provider].help}
      </div>
      <div className="row">
        <Field label="Base URL">
          <input
            className="in"
            value={ai.baseUrl}
            onChange={(e) => setAI({ baseUrl: e.target.value })}
            placeholder="https://…/v1"
          />
        </Field>
        <Field label="Modèle">
          <input
            className="in"
            value={ai.model}
            onChange={(e) => setAI({ model: e.target.value })}
            placeholder={`Facultatif — par défaut : ${AI_PRESETS[ai.provider].model || 'à saisir'}`}
          />
        </Field>
      </div>
      <Field label="Clé API">
        <input
          className="in"
          type="password"
          value={ai.apiKey}
          onChange={(e) => setAI({ apiKey: e.target.value })}
          placeholder="colle ta clé ici"
        />
      </Field>
      <Field label="Clé ElevenLabs (voix des PNJ)">
        <input
          className="in"
          type="password"
          value={ai.elevenKey}
          onChange={(e) => setAI({ elevenKey: e.target.value })}
          placeholder="facultatif — pour écouter les répliques"
        />
      </Field>
      <div className="row" style={{ alignItems: 'center' }}>
        <button
          className="btn primary"
          style={{ flex: 'none' }}
          disabled={testing}
          onClick={test}
        >
          {testing ? (
            <>
              <Spin /> Test…
            </>
          ) : (
            'Tester la connexion'
          )}
        </button>
        <button
          className="btn ghost"
          style={{ flex: 'none' }}
          onClick={onClose}
        >
          Fermer
        </button>
        {result && (
          <span
            style={{
              fontSize: 12.5,
              color: result[0] === '✓' ? 'var(--verdant)' : 'var(--blood)',
            }}
          >
            {result}
          </span>
        )}
      </div>
      <div
        className="faint"
        style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.5 }}
      >
        Note de sécurité : une clé saisie dans une app front-end est visible
        côté navigateur. C'est acceptable pour un outil personnel (StackBlitz /
        local). Ne publie jamais le site en ligne avec ta clé en clair.
      </div>
    </Modal>
  );
}

/* ----------------------------- No universe ------------------------------ */
function NoUniverse({ dispatch }) {
  return (
    <div className="empty">
      <div className="big">No universe is bound</div>
      <p className="muted" style={{ maxWidth: 420, margin: '0 auto 18px' }}>
        Create a setting to begin. Everything you forge lives inside it.
      </p>
      <button
        className="btn primary"
        onClick={() =>
          dispatch({
            type: 'ADD_UNIVERSE',
            u: {
              id: uid(),
              name: 'New Universe',
              tone: '',
              lore: '',
              createdAt: now(),
            },
          })
        }
      >
        Create a universe
      </button>
    </div>
  );
}

/* ----------------------------- Dashboard -------------------------------- */
function Dashboard({
  state,
  dispatch,
  universe,
  party,
  campaigns,
  npcs,
  quests,
  setView,
  flash,
  setSettingsOpen,
  importRef,
}) {
  const { ai } = useContext(AIContext);
  const library = Object.values(state.libraryEntries || {})
    .filter((e) => e.universeId === universe.id)
    .map((e) => ({ ...e, typeLabel: LIBRARY_TYPES[e.archiveType]?.singular || '' }));
  const assetSrc = (asset) => asset?.dataUrl || asset?.url || '';
  const heroAsset = getPrimaryAsset(state, 'universe', universe.id);
  return (
    <>
      <UniverseHome
        universe={universe}
        heroImage={assetSrc(heroAsset)}
        campaigns={campaigns}
        party={party}
        npcs={npcs}
        quests={quests}
        library={library}
        log={(state.log || []).filter((l) => l.universeId === universe.id)}
        campaignImage={(c) => assetSrc(getPrimaryAsset(state, 'campaign', c.id))}
        portrait={(p) => assetSrc(getPrimaryAsset(state, 'player', p.id))}
        libraryImage={(e) =>
          assetSrc(getPrimaryAsset(state, 'library', e.id)) ||
          (LIBRARY_TYPES[e.archiveType] ? `/images/ui/repli-${e.archiveType}.webp` : '')
        }
        setView={setView}
      />
      {!ai.apiKey && (
        <div className="warnbar" role="status" style={{ marginTop: 22 }}>
          Moteur IA : <b>non configuré</b>.{' '}
          <button type="button" className="linkbtn" onClick={() => setSettingsOpen(true)}>
            Ouvre les Réglages
          </button>{' '}
          et colle une clé (Gemini gratuit conseillé) pour générer campagnes, scènes et PNJ.
        </div>
      )}
      <details className="lsx-advanced">
        <summary>
          Canon, mémoire & sauvegardes
          <small>ce que l'IA lit à chaque génération</small>
        </summary>
      <UniverseBrainPanel
        universe={universe}
        campaigns={campaigns}
        dispatch={dispatch}
        flash={flash}
      />
      <ArchivesLinkPanel universe={universe} dispatch={dispatch} flash={flash} setView={setView} />
      <div className="eyebrow">Canon de l’univers</div>
      <div className="panel">
        <Field label="Nom">
          <input
            className="in"
            value={universe.name}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_UNIVERSE',
                id: universe.id,
                patch: { name: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Ton (une ligne)">
          <input
            className="in"
            value={universe.tone}
            placeholder="sombre / épique / pulp de cape et d’épée…"
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_UNIVERSE',
                id: universe.id,
                patch: { tone: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Lore & canon — l’IA le relit à chaque génération">
          <textarea
            className="in"
            rows={4}
            value={universe.lore}
            placeholder="Factions, géographie, place de la magie, dieux, histoire récente…"
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_UNIVERSE',
                id: universe.id,
                patch: { lore: e.target.value },
              })
            }
          />
        </Field>
        <div className="row">
          <button
            className="btn"
            style={{ flex: 'none' }}
            onClick={() => {
              dispatch({
                type: 'ADD_UNIVERSE',
                u: {
                  id: uid(),
                  name: 'Nouvel univers',
                  tone: '',
                  lore: '',
                  createdAt: now(),
                },
              });
              flash('Nouvel univers créé');
            }}
          >
            ✦ Nouvel univers
          </button>
          {Object.keys(state.universes).length > 1 && (
            <button
              className="btn ghost danger"
              style={{ flex: 'none' }}
              onClick={() => {
                if (confirm('Supprimer cet univers et basculer vers un autre ?')) {
                  dispatch({ type: 'DELETE_UNIVERSE', id: universe.id });
                  flash('Univers supprimé');
                }
              }}
            >
              Supprimer l’univers
            </button>
          )}
        </div>
      </div>

      <div className="eyebrow">Backups & moteur</div>
      <div className="panel">
        <p
          className="muted"
          style={{ fontSize: 13.5, margin: '0 0 14px', lineHeight: 1.55 }}
        >
          Tes données vivent dans ce navigateur. Exporte un fichier <b>.json</b>{' '}
          régulièrement et garde-le ailleurs ; réimporte-le pour tout restaurer
          après un nettoyage de cache ou sur une autre machine.
        </p>
        <div className="row" style={{ flex: 'none' }}>
          <button
            className="btn primary"
            style={{ flex: 'none' }}
            onClick={() => {
              exportBackup(state);
              flash('Backup téléchargé');
            }}
          >
            ⤓ Exporter (.json)
          </button>
          <button
            className="btn"
            style={{ flex: 'none' }}
            onClick={() => importRef.current && importRef.current.click()}
          >
            ⤒ Importer / restaurer
          </button>
          <button
            className="btn"
            style={{ flex: 'none' }}
            onClick={() => setSettingsOpen(true)}
          >
            ⚙ Réglages IA
          </button>
        </div>
      </div>
      </details>
    </>
  );
}
function UniverseBrainPanel({ universe, campaigns, dispatch, flash }) {
  const { ai } = useContext(AIContext);

  const [notes, setNotes] = useState(universe.brainScratch || '');
  const [busy, setBusy] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState({});

  const suggestions = universe.loreSuggestions || {
    questions: [],
    loreBlocks: [],
    detectedEntities: [],
    missingAreas: [],
    structuredSections: [],
  };

  useEffect(() => {
    setNotes(universe.brainScratch || '');
  }, [universe.id]);

  function patchUniverse(patch) {
    dispatch({
      type: 'UPDATE_UNIVERSE',
      id: universe.id,
      patch,
    });
  }

  function saveScratch() {
    patchUniverse({
      brainScratch: notes,
    });

    flash('Mind dump sauvegardé.');
  }

  function deleteMemory(memoryId) {
    if (!confirm('Supprimer cette mémoire ?')) return;

    patchUniverse({
      memoryLog: (universe.memoryLog || []).filter((m) => m.id !== memoryId),
    });

    flash('Mémoire supprimée.');
  }

  async function analyzeUniverseMindDump(mode = 'full') {
    if (!notes.trim() && !universe.lore?.trim()) {
      flash('Ajoute du lore ou un mind dump à analyser.');
      return;
    }

    setBusy(true);

    try {
      const data = await callAI(ai, {
        system: `Tu es l'architecte de lore principal de Loresmith.

Réponds uniquement en JSON valide.

Tu aides un maître de jeu à bâtir un univers de fiction jouable.
Tu ne dois pas écrire une campagne.
Tu dois aider à structurer l'univers, poser les bonnes questions, proposer des blocs de lore et détecter les entités importantes.

Langue: français.
Style: clair, inspirant, utile pour un créateur d'univers.
Ne contredis pas le canon existant. Si quelque chose est flou, pose des questions.`,
        prompt: `Univers: ${universe.name}

Ton:
${universe.tone || ''}

Canon actuel:
${universe.lore || ''}

Mémoires récentes:
${
  (universe.memoryLog || [])
    .slice(0, 10)
    .map((m) => `- ${m.title}: ${m.summary}`)
    .join('\n') || 'Aucune mémoire enregistrée.'
}

Campagnes existantes:
${
  campaigns
    .map((c) => `- ${c.title}: ${c.premise || ''}`)
    .join('\n') || 'Aucune campagne.'
}

Mind dump à analyser:
${notes || ''}

Mode demandé:
${mode}

Retourne exactement:
{
  "questions": [
    {
      "id": "court-id",
      "question": "Question utile à répondre",
      "why": "Pourquoi cette question aide à bâtir l'univers"
    }
  ],
  "loreBlocks": [
    {
      "id": "court-id",
      "title": "Titre du bloc",
      "category": "Cosmologie|Géographie|Peuples|Histoire|Magie|Religion|Conflits|Mystères|Vie quotidienne|Autre",
      "text": "Bloc de lore prêt à intégrer, 1 à 3 paragraphes"
    }
  ],
  "detectedEntities": [
    {
      "name": "Nom détecté",
      "suggestedType": "person|place|artifact|event|faction|mystery|document|creature|concept",
      "context": "Pourquoi cette entité semble importante"
    }
  ],
  "missingAreas": [
    "Aspect de l'univers qui mériterait d'être clarifié"
  ],
  "structuredSections": [
    {
      "title": "Nom de section",
      "summary": "Résumé court de ce qui existe déjà ou devrait être développé"
    }
  ]
}`,
      });

      const normalized = {
        questions: Array.isArray(data.questions) ? data.questions : [],
        loreBlocks: Array.isArray(data.loreBlocks) ? data.loreBlocks : [],
        detectedEntities: Array.isArray(data.detectedEntities)
          ? data.detectedEntities
          : [],
        missingAreas: Array.isArray(data.missingAreas) ? data.missingAreas : [],
        structuredSections: Array.isArray(data.structuredSections)
          ? data.structuredSections
          : [],
        updatedAt: now(),
      };

      patchUniverse({
        brainScratch: notes,
        loreSuggestions: normalized,
      });

      flash('Questions et blocs générés.');
    } catch (e) {
      flash(e.message);
    }

    setBusy(false);
  }

  async function assimilate() {
    if (!notes.trim()) {
      flash('Ajoute des notes à assimiler.');
      return;
    }

    setBusy(true);

    try {
      const data = await callAI(ai, {
        system: `Tu es l'archiviste principal d'un univers de campagne TTRPG.

Réponds uniquement en JSON valide.

Tu dois transformer des notes décousues en mémoire exploitable pour un univers vivant.
Le résultat doit préserver les faits, les conséquences, les mystères, les rappels possibles, les seeds futurs et les éléments nostalgiques.

Langue: français.
Ton: littéraire, utile pour un maître de jeu, cohérent avec le lore existant.`,
        prompt: `Univers: ${universe.name}
Ton: ${universe.tone}

Canon actuel:
${universe.lore || ''}

Campagnes existantes:
${campaigns.map((c) => `- ${c.title}: ${c.premise || ''}`).join('\n')}

Notes décousues à assimiler:
${notes}

Retourne:
{
  "canonPatch": "Texte court à ajouter au canon de l'univers, en prose claire.",
  "memoryTitle": "Titre court de cette mémoire",
  "memorySummary": "Résumé utilisable plus tard par le MJ",
  "consequences": ["conséquence 1", "conséquence 2"],
  "futureSeeds": ["seed futur 1", "seed futur 2"],
  "nostalgicEchoes": ["rappel possible 1", "rappel possible 2"]
}`,
      });

      const memory = {
        id: uid(),
        createdAt: now(),
        title: data.memoryTitle || 'Mémoire assimilée',
        summary: data.memorySummary || notes,
        consequences: Array.isArray(data.consequences) ? data.consequences : [],
        futureSeeds: Array.isArray(data.futureSeeds) ? data.futureSeeds : [],
        nostalgicEchoes: Array.isArray(data.nostalgicEchoes)
          ? data.nostalgicEchoes
          : [],
      };

      patchUniverse({
        lore: [
          universe.lore || '',
          data.canonPatch ? `\n\n${data.canonPatch}` : '',
        ]
          .join('')
          .trim(),
        brainScratch: '',
        memoryLog: [memory, ...(universe.memoryLog || [])].slice(0, 80),
      });

      setNotes('');
      flash('Mémoire assimilée dans le canon.');
    } catch (e) {
      flash(e.message);
    }

    setBusy(false);
  }

  function integrateLoreBlock(block, index) {
    const text = String(block?.text || '').trim();

    if (!text) {
      flash('Ce bloc est vide.');
      return;
    }

    const heading = block.title ? `### ${block.title}` : '### Bloc de lore';

    const nextLore = [universe.lore || '', `${heading}\n${text}`]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    patchUniverse({
      lore: nextLore,
      loreSuggestions: {
        ...suggestions,
        loreBlocks: (suggestions.loreBlocks || []).filter(
          (_, i) => i !== index
        ),
      },
    });

    flash('Bloc intégré au canon.');
  }

  function dismissLoreBlock(index) {
    patchUniverse({
      loreSuggestions: {
        ...suggestions,
        loreBlocks: (suggestions.loreBlocks || []).filter(
          (_, i) => i !== index
        ),
      },
    });

    flash('Bloc ignoré.');
  }

  function addQuestionAnswer(question, index) {
    const answer = String(questionAnswers[index] || '').trim();

    if (!answer) {
      flash('Écris une réponse avant de l’ajouter.');
      return;
    }

    const addition = `Question de lore: ${question.question}\nRéponse: ${answer}`;

    const nextNotes = [notes, addition].filter(Boolean).join('\n\n');

    setNotes(nextNotes);

    patchUniverse({
      brainScratch: nextNotes,
    });

    setQuestionAnswers((prev) => ({
      ...prev,
      [index]: '',
    }));

    flash('Réponse ajoutée au mind dump.');
  }

  return (
    <>
      <div className="eyebrow">Créateur d’univers</div>

      <div className="universe-builder-layout">
        <div className="universe-builder-main">
          <div className="panel brain-panel">
            <p
              className="muted"
              style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 0 }}
            >
              Dépose ici tes idées décousues : cosmologie, peuples, lieux,
              magie, religion, conflits, mythes, personnages, secrets ou images
              mentales. L’IA peut ensuite poser des questions, proposer des
              blocs de lore, détecter des entités importantes et t’aider à
              construire un canon cohérent.
            </p>

            <Field label="Mind dump d’univers">
              <textarea
                className="in"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex. Les cités sont suspendues entre des stalactites. La magie vient d'anciens fils tissés dans la pierre. Les rois ne meurent jamais vraiment..."
                style={{ minHeight: 220 }}
              />
            </Field>

            <div className="row">
              <button
                className="btn primary"
                style={{ flex: 'none' }}
                disabled={busy}
                onClick={() => analyzeUniverseMindDump('full')}
              >
                {busy ? (
                  <>
                    <Spin /> Analyse…
                  </>
                ) : (
                  'Générer questions et blocs'
                )}
              </button>

              <button
                className="btn"
                style={{ flex: 'none' }}
                disabled={busy}
                onClick={() => analyzeUniverseMindDump('more-lore-blocks')}
              >
                Autres blocs de lore
              </button>

              <button
                className="btn"
                style={{ flex: 'none' }}
                disabled={busy}
                onClick={assimilate}
              >
                Assimiler directement au canon
              </button>

              <button
                className="btn ghost"
                style={{ flex: 'none' }}
                disabled={busy}
                onClick={saveScratch}
              >
                Sauvegarder
              </button>
            </div>
          </div>

          {(suggestions.structuredSections || []).length > 0 && (
            <>
              <div className="eyebrow">Structure suggérée</div>

              <div className="grid cols-2">
                {suggestions.structuredSections.map((section, i) => (
                  <div className="lore-section-preview" key={i}>
                    <b>{section.title || 'Section'}</b>
                    <p>{section.summary || 'Aucun résumé.'}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {(universe.memoryLog || []).length > 0 && (
            <>
              <div className="eyebrow">Mémoires récentes</div>

              <div className="memory-list">
                {(universe.memoryLog || []).slice(0, 5).map((m) => (
                  <div className="memory-item" key={m.id}>
                    <div className="card-h">
                      <b>{m.title}</b>

                      <button
                        className="btn ghost sm danger"
                        style={{ flex: 'none' }}
                        onClick={() => deleteMemory(m.id)}
                        title="Supprimer cette mémoire"
                      >
                        Supprimer
                      </button>
                    </div>

                    <p>{m.summary}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="universe-builder-side">
          <div className="panel">
            <div className="card-h">
              <div>
                <h3 style={{ margin: 0 }}>Questions AI</h3>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  Réponds seulement aux questions utiles. Tes réponses
                  retourneront dans le mind dump.
                </p>
              </div>
            </div>

            <div className="ai-suggestion-stack">
              {(suggestions.questions || []).length === 0 ? (
                <div className="ai-empty-box">
                  Aucune question générée pour le moment.
                </div>
              ) : (
                suggestions.questions.map((q, i) => (
                  <div className="ai-question-card" key={q.id || i}>
                    <p>{q.question}</p>

                    {q.why && (
                      <div
                        className="faint"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.35,
                          marginBottom: 8,
                        }}
                      >
                        {q.why}
                      </div>
                    )}

                    <textarea
                      className="in"
                      value={questionAnswers[i] || ''}
                      onChange={(e) =>
                        setQuestionAnswers((prev) => ({
                          ...prev,
                          [i]: e.target.value,
                        }))
                      }
                      placeholder="Ta réponse..."
                    />

                    <button
                      className="btn sm"
                      style={{ flex: 'none', marginTop: 8 }}
                      onClick={() => addQuestionAnswer(q, i)}
                    >
                      Ajouter au mind dump
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0 }}>Blocs de lore proposés</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Intègre seulement les blocs que tu veux rendre canoniques.
            </p>

            <div className="ai-suggestion-stack">
              {(suggestions.loreBlocks || []).length === 0 ? (
                <div className="ai-empty-box">
                  Aucun bloc de lore généré pour le moment.
                </div>
              ) : (
                suggestions.loreBlocks.map((block, i) => (
                  <div className="ai-suggestion-card" key={block.id || i}>
                    <div className="ai-suggestion-meta">
                      {block.category || 'Lore'}
                    </div>

                    <b>{block.title || 'Bloc de lore'}</b>

                    <p>{block.text || 'Aucun texte.'}</p>

                    <div className="row">
                      <button
                        className="btn sm primary"
                        style={{ flex: 'none' }}
                        onClick={() => integrateLoreBlock(block, i)}
                      >
                        Intégrer
                      </button>

                      <button
                        className="btn sm ghost"
                        style={{ flex: 'none' }}
                        onClick={() => dismissLoreBlock(i)}
                      >
                        Ignorer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0 }}>Entités détectées</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              À la prochaine étape, ces éléments pourront créer des fiches de
              bibliothèque en un clic.
            </p>

            {(suggestions.detectedEntities || []).length === 0 ? (
              <div className="ai-empty-box">
                Aucune entité détectée pour le moment.
              </div>
            ) : (
              <div className="ai-entity-grid">
                {suggestions.detectedEntities.map((entity, i) => (
                  <span className="ai-entity-chip" key={i}>
                    <b>{entity.suggestedType || 'entité'}</b>
                    {entity.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0 }}>Zones à clarifier</h3>

            <div className="ai-suggestion-stack" style={{ marginTop: 10 }}>
              {(suggestions.missingAreas || []).length === 0 ? (
                <div className="ai-empty-box">
                  Aucune zone floue détectée.
                </div>
              ) : (
                suggestions.missingAreas.map((item, i) => (
                  <div className="ai-suggestion-card" key={i}>
                    <p>{item}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
/* ----------------------------- Campaign Forge --------------------------- */
const FORGE_DRAFT_KEY = 'loresmith:forge-brief:v1';

/** Charge les Archives de l'univers (si lié) pour nourrir l'IA. */
function useUniverseFeed(universe) {
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    let alive = true;
    feedFor(universe).then((f) => alive && setFeed(f));
    return () => {
      alive = false;
    };
  }, [universe.id, universe.archives]);
  return feed;
}

/** Écrit une séance d'une campagne (scènes complètes) et renvoie le patch à enregistrer. */
async function writeCampaignSession({ ai, universe, state, party, camp, sessionNumber, feed }) {
  const session = (camp.sessions || []).find((s) => s.sessionNumber === sessionNumber);
  if (!session) throw new Error(`Séance ${sessionNumber} introuvable.`);
  const brief = { level: camp.level || 3, hours: camp.hours || 3, ...(camp.brief || {}) };
  const ctx = buildLoreContext({
    universe,
    state,
    feed,
    party,
    budget: 9000,
    focus: [camp.title, camp.premise, session.title, session.summary, session.mainLocation, ...(session.scenes || []).map((s) => `${s.title} ${s.location}`)].join(' '),
  });
  const d = await forgeSession((o) => callAI(ai, o), ctx, camp, session, brief, previousDigest(camp, sessionNumber));
  if (d._parseFailed || !Array.isArray(d.scenes) || !d.scenes.length)
    throw new Error(`La séance ${sessionNumber} n’a pas pu être écrite (réponse illisible). Réessaie ou change de modèle.`);
  const fresh = d.scenes.map((sc) => ({ ...toScene(sc, session), actId: session.actId || '' }));
  const sessions = camp.sessions.map((s) =>
    s.sessionNumber === sessionNumber
      ? {
          ...s,
          detailed: true,
          dmBrief: d.dmBrief || s.dmBrief || '',
          openingImage: d.openingImage || s.openingImage || '',
          recap: d.recap || '',
          possibleEndings: d.possibleEndings || [],
          cliffhanger: d.cliffhanger || '',
        }
      : s
  );
  const numbers = new Set(sessions.map((s) => s.sessionNumber));
  const scenes = [
    ...sessions.flatMap((s) => (s.sessionNumber === sessionNumber ? fresh : (camp.scenes || []).filter((sc) => sc.sessionNumber === s.sessionNumber))),
    ...(camp.scenes || []).filter((sc) => !numbers.has(sc.sessionNumber)),
  ];
  return { sessions, scenes };
}

/**
 * Forge une campagne complète : bible, puis chaque séance scène par scène (si `writeAll`).
 * `campaignId` : réécrit le canevas d'une campagne existante (Campaign Studio) en gardant ses fondations.
 * `onStep(label, status, note)` suit l'avancement. Renvoie l'identifiant et le nombre de séances en échec.
 */
async function forgeCampaign({ ai, universe, state, party, feed, brief, dispatch, writeAll = true, onStep = () => {}, campaignId, keep = {} }) {
  const call = (o) => callAI(ai, o);
  const ctx = buildLoreContext({ universe, state, feed, party, focus: [brief.mindDump, ...BRIEF_FIELDS.map((f) => brief[f.key])].join(' ') });
  onStep('Bible de campagne', 'run');
  const bible = await forgeBible(call, ctx, brief);
  if (bible._parseFailed || (!bible.title && !bible.sessions))
    throw new Error('L’IA n’a pas renvoyé une campagne lisible. Réessaie, ou choisis un modèle plus puissant dans Réglages.');
  const sessions = (bible.sessions || []).map((s, i) => ({ ...s, sessionNumber: Number(s.sessionNumber) || i + 1, detailed: false }));
  const id = campaignId || uid();

  // Ce que la bibliothèque connaît déjà est lié à la campagne ; le reste est proposé à la création.
  const lib = Object.values(state.libraryEntries || {}).filter((e) => e.universeId === universe.id);
  const libByName = new Map(lib.map((e) => [normName(e.title), e]));
  const suggestions = librarySuggestionsFrom(bible);
  const linked = [...new Set(suggestions.map((s) => libByName.get(normName(s.title))).filter(Boolean))];

  let camp = {
    id,
    title: cleanCampaignTitle(bible.title, brief.title || brief.theme),
    premise: bible.premise || '',
    hook: bible.hook || '',
    setting: bible.setting || '',
    campaignMode: brief.format,
    brief: { ...brief },
    mindDump: brief.mindDump || '',
    campaignCanon: bible.campaignCanon || '',
    dmOverview: bible.dmOverview || '',
    finalTruth: bible.finalTruth || '',
    failureState: bible.failureState || '',
    campaignThemes: bible.campaignThemes || [],
    campaignQuestions: bible.campaignQuestions || [],
    acts: bible.acts || [],
    sessions,
    recurringNpcs: bible.recurringNpcs || [],
    factions: bible.factions || [],
    majorLocations: bible.majorLocations || [],
    mysteries: bible.mysteries || [],
    monsters: bible.monsters || [],
    librarySuggestions: suggestions.filter((s) => !libByName.has(normName(s.title))),
    linkedLibraryEntryIds: linked.map((e) => e.id),
    hours: brief.hours,
    level: brief.level,
    theme: brief.theme,
    createdAt: now(),
    scenes: sessions.flatMap(outlineScenes),
  };
  camp = migrateCampaign({ ...camp, foundations: keep.foundations, createdAt: keep.createdAt || camp.createdAt });
  if (campaignId) dispatch({ type: 'UPDATE_CAMPAIGN', id, patch: camp });
  else dispatch({ type: 'ADD_CAMPAIGN', c: camp });
  linked.forEach((e) =>
    dispatch({ type: 'UPDATE_LIBRARY_ENTRY', id: e.id, patch: { linkedCampaignIds: [...new Set([...(e.linkedCampaignIds || []), id])] } })
  );
  onStep('Bible de campagne', 'ok', `${sessions.length} séance(s), ${camp.recurringNpcs.length} PNJ, ${camp.majorLocations.length} lieux`);

  let failed = 0;
  if (writeAll) {
    for (const s of sessions) {
      const label = `Séance ${s.sessionNumber} · ${s.title || ''}`;
      onStep(label, 'run');
      try {
        const patch = await writeCampaignSession({ ai, universe, state, party, camp, sessionNumber: s.sessionNumber, feed });
        camp = { ...camp, ...patch };
        dispatch({ type: 'UPDATE_CAMPAIGN', id, patch });
        onStep(label, 'ok', `${patch.scenes.filter((sc) => sc.sessionNumber === s.sessionNumber).length} scènes`);
      } catch (e) {
        failed++;
        onStep(label, 'err', e.message);
      }
    }
  }
  return { id, failed };
}

function Forge({ state, dispatch, universe, party, campaigns, flash, setView, hideList }) {
  const { ai } = useContext(AIContext);
  const feed = useUniverseFeed(universe);
  const startLevel = party[0]?.level || 3;
  const [brief, setBrief] = useState(() => {
    try {
      const raw = localStorage.getItem(FORGE_DRAFT_KEY);
      return { ...emptyBrief(), level: startLevel, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...emptyBrief(), level: startLevel };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(FORGE_DRAFT_KEY, JSON.stringify(brief));
    } catch {}
  }, [brief]);

  const [busy, setBusy] = useState('');
  const [steps, setSteps] = useState([]);
  const [err, setErr] = useState('');
  const [writeAll, setWriteAll] = useState(true);
  const set = (k, v) => setBrief((b) => ({ ...b, [k]: v }));
  const call = (o) => callAI(ai, o);

  const libCount = Object.values(state.libraryEntries || {}).filter((e) => e.universeId === universe.id).length;
  const npcCount = Object.values(state.npcs || {}).filter((n) => n.universeId === universe.id).length;
  const placeCount = useMemo(() => atlasPlaces(feed).length, [feed]);
  const groups = [...new Set(BRIEF_FIELDS.map((f) => f.group))];

  const context = () =>
    buildLoreContext({ universe, state, feed, party, focus: [brief.mindDump, ...BRIEF_FIELDS.map((f) => brief[f.key])].join(' ') });

  function setFormat(format) {
    setBrief((b) => ({ ...b, format, sessions: FORMATS[format]?.sessions || b.sessions }));
  }

  async function propose(keys) {
    setBusy(keys?.length === 1 ? keys[0] : 'propose');
    setErr('');
    try {
      const patch = await proposeBrief(call, context(), brief, keys);
      setBrief((b) => ({ ...b, ...patch }));
      const n = Object.keys(patch).length;
      flash(n ? `${n} champ(s) proposé(s) : modifie ce qui ne te plaît pas.` : 'Rien à proposer : tous les champs sont remplis.');
    } catch (e) {
      setErr(e.message);
    }
    setBusy('');
  }

  const step = (label, status, note = '') =>
    setSteps((list) => {
      const i = list.findIndex((s) => s.label === label);
      const next = { label, status, note };
      return i === -1 ? [...list, next] : list.map((s, j) => (j === i ? next : s));
    });

  async function forge() {
    setBusy('forge');
    setErr('');
    setSteps([]);
    try {
      const { failed } = await forgeCampaign({ ai, universe, state, party, feed, brief, dispatch, writeAll, onStep: step });
      flash(
        failed
          ? `Campagne forgée : ${failed} séance(s) à reprendre depuis sa fiche.`
          : writeAll
          ? 'Campagne forgée et écrite : passe-la au contrôle de préparation.'
          : 'Bible forgée : écris les séances depuis la fiche de la campagne.'
      );
    } catch (e) {
      setErr(e.message);
    }
    setBusy('');
  }

  return (
    <>
      <h1 className="view">Forge de campagnes</h1>
      <p className="sub">
        Choisis ce que tu veux : chaque champ laissé vide est décidé par l’IA. Tu peux aussi laisser l’IA proposer tout le
        brief, puis le corriger avant de forger. La forge puise dans le canon, la bibliothèque, les Archives et les lieux de
        l’Atlas, puis écrit chaque séance scène par scène.
      </p>

      <div className="panel forge-panel">
        <div className="forge-top">
          <Field label="Format">
            <select className="in" value={brief.format} onChange={(e) => setFormat(e.target.value)}>
              {Object.entries(FORMATS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Séances">
            <input className="in" type="number" min="1" max="24" value={brief.sessions} onChange={(e) => set('sessions', Math.max(1, Math.min(24, +e.target.value || 1)))} />
          </Field>
          <Field label="Heures / séance">
            <input className="in" type="number" min="1" max="8" value={brief.hours} onChange={(e) => set('hours', +e.target.value || 3)} />
          </Field>
          <Field label="Niveau de départ">
            <input className="in" type="number" min="1" max="20" value={brief.level} onChange={(e) => set('level', +e.target.value || 1)} />
          </Field>
          <Field label="Niveau final (facultatif)">
            <input className="in" type="number" min="1" max="20" value={brief.levelEnd} onChange={(e) => set('levelEnd', e.target.value)} />
          </Field>
        </div>

        <Field label="Notes libres (mind dump, facultatif)">
          <textarea
            className="in"
            rows={3}
            value={brief.mindDump}
            onChange={(e) => set('mindDump', e.target.value)}
            placeholder="Écris en vrac : idées, images, scènes que tu veux absolument, ce que les joueurs ont fait la dernière fois…"
          />
        </Field>

        <div className="forge-actions">
          <button className="btn" disabled={!!busy} onClick={() => propose()}>
            {busy === 'propose' ? <Spin /> : '✦'} L’IA propose les champs vides
          </button>
          <button
            className="btn ghost"
            disabled={!!busy}
            onClick={() => {
              if (confirm('Effacer le brief (les campagnes forgées ne sont pas touchées) ?')) setBrief({ ...emptyBrief(), level: startLevel });
            }}
          >
            Vider le brief
          </button>
        </div>

        {groups.map((g) => {
          const fields = BRIEF_FIELDS.filter((f) => f.group === g);
          const chosen = fields.filter((f) => String(brief[f.key] || '').trim()).length;
          return (
            <details key={g} className="forge-group" open={g === 'Cadre' || g === 'Intrigue'}>
              <summary>
                {g} <small>{chosen ? `${chosen}/${fields.length} choisis` : 'l’IA décide de tout'}</small>
              </summary>
              <div className="forge-fields">
                {fields.map((f) => {
                  const v = brief[f.key] || '';
                  return (
                    <div key={f.key} className={'forge-field' + (f.long ? ' wide' : '')}>
                      <label className="fl">
                        {f.label} {!v.trim() && <span className="forge-ai-chip">IA décide</span>}
                      </label>
                      <div className="forge-input">
                        {f.long ? (
                          <textarea className="in" rows={2} value={v} placeholder={f.ph || 'Laisse vide : l’IA décide'} onChange={(e) => set(f.key, e.target.value)} />
                        ) : (
                          <input className="in" value={v} placeholder={f.ph || 'Laisse vide : l’IA décide'} onChange={(e) => set(f.key, e.target.value)} />
                        )}
                        <button className="btn ghost sm" title="Proposer ce champ avec l’IA" disabled={!!busy} onClick={() => propose([f.key])}>
                          {busy === f.key ? <Spin /> : '🎲'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}

        <div className="forge-sources">
          <span>Puise dans :</span>
          <span className="tag">Canon {universe.lore ? '✓' : '—'}</span>
          <span className="tag">Mémoire · {(universe.memoryLog || []).length}</span>
          <span className="tag">Bibliothèque · {libCount}</span>
          {feed && <span className="tag">Archives · {feed.entries.length}</span>}
          {feed && <span className="tag">Lieux d’Atlas · {placeCount}</span>}
          <span className="tag">PNJ & créatures · {npcCount}</span>
          <span className="tag">Groupe · {party.length || 'générique'}</span>
        </div>

        <label className="forge-check">
          <input type="checkbox" checked={writeAll} onChange={(e) => setWriteAll(e.target.checked)} /> Écrire toutes les séances en détail maintenant
          (campagne prête à jouer ; plus long)
        </label>

        <button className="btn primary" disabled={!!busy} onClick={forge}>
          {busy === 'forge' ? (
            <>
              <Spin /> Forge en cours…
            </>
          ) : (
            '⚒ Forger la campagne'
          )}
        </button>

        {steps.length > 0 && (
          <ol className="forge-steps">
            {steps.map((s) => (
              <li key={s.label} data-status={s.status}>
                <span>{s.status === 'run' ? <Spin /> : s.status === 'ok' ? '✓' : '✕'}</span>
                <b>{s.label}</b>
                {s.note && <small>{s.note}</small>}
              </li>
            ))}
          </ol>
        )}

        {err && (
          <div role="alert" style={{ color: 'var(--blood)', marginTop: 12, fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>

      {!hideList && (
        <>
      <div className="eyebrow">Campagnes forgées</div>

      {campaigns.length === 0 ? (
        <div className="empty">
          <div className="big">Aucune campagne pour l’instant</div>
          <p className="muted">Laisse l’IA proposer un brief, ou remplis ce que tu veux, puis forge.</p>
        </div>
      ) : (
        <div className="grid">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} camp={c} {...{ state, dispatch, universe, party, flash, setView, feed }} />
          ))}
        </div>
      )}
        </>
      )}
    </>
  );
}
function normalizeArchiveType(type) {
  const t = String(type || '').toLowerCase();

  if (['artifact', 'artefact', 'item', 'object', 'objet'].includes(t))
    return 'artifact';
  if (['person', 'personnage', 'character', 'npc', 'pnj'].includes(t))
    return 'person';
  if (['place', 'lieu', 'location', 'atlas'].includes(t)) return 'place';
  if (['event', 'événement', 'evenement', 'history'].includes(t))
    return 'event';
  if (['faction', 'group', 'organisation', 'organization'].includes(t))
    return 'faction';
  if (['mystery', 'mystère', 'mystere'].includes(t)) return 'mystery';
  if (['document', 'archive', 'text', 'book'].includes(t)) return 'document';

  return 'document';
}

function makeLibraryEntryFromCampaignSuggestion(suggestion, campaignId) {
  const type = normalizeArchiveType(suggestion.archiveType || suggestion.type);

  return {
    id: uid(),
    archiveType: type,
    title: suggestion.title || suggestion.name || 'Archive sans titre',
    subtitle: suggestion.subtitle || '',
    shortSummary:
      suggestion.shortSummary || suggestion.summary || suggestion.role || '',
    body:
      suggestion.body ||
      suggestion.description ||
      suggestion.lore ||
      suggestion.shortSummary ||
      '',
    origin: suggestion.origin || '',
    historicalContext: suggestion.historicalContext || suggestion.context || '',
    currentLocation: suggestion.currentLocation || suggestion.location || '',
    owner: suggestion.owner || suggestion.possessor || '',
    campaignUse: suggestion.campaignUse || suggestion.use || '',
    secrets: suggestion.secrets || suggestion.secret || '',
    tags: suggestion.tags || [],
    imagePrompt: suggestion.imagePrompt || '',
    playerKnowledge: normalizeKnowledge(suggestion.playerKnowledge),
    roughNotes: suggestion.roughNotes || suggestion.notes || '',
    linkedCampaignIds: campaignId ? [campaignId] : [],
    createdAt: now(),
    updatedAt: now(),
  };
}
function CampaignArchiveSuggestions({
  suggestions = [],
  campaignId,
  dispatch,
  flash,
}) {
  if (!suggestions.length) return null;

  function createOne(suggestion) {
    const entry = makeLibraryEntryFromCampaignSuggestion(
      suggestion,
      campaignId
    );

    dispatch({
      type: 'ADD_LIBRARY_ENTRY',
      entry,
    });

    flash(`Archive créée : ${entry.title}`);
  }

  function createAll() {
    suggestions.forEach((suggestion) => {
      dispatch({
        type: 'ADD_LIBRARY_ENTRY',
        entry: makeLibraryEntryFromCampaignSuggestion(suggestion, campaignId),
      });
    });

    flash(`${suggestions.length} archives créées dans la bibliothèque.`);
  }

  return (
    <div className="campaign-suggestion-box">
      <div className="card-h">
        <div>
          <b>Suggestions à verser dans la bibliothèque</b>
          <p>
            Lieux, personnages, artefacts, factions, mystères ou événements
            extraits de cette campagne.
          </p>
        </div>

        <button
          className="btn sm primary"
          style={{ flex: 'none' }}
          onClick={createAll}
        >
          Tout créer
        </button>
      </div>

      <div className="campaign-suggestion-grid">
        {suggestions.map((s, i) => (
          <div className="campaign-suggestion-card" key={i}>
            <div className="campaign-suggestion-type">
              {normalizeArchiveType(s.archiveType || s.type)}
            </div>

            <b>{s.title || s.name || 'Suggestion sans titre'}</b>

            <p>
              {s.shortSummary || s.summary || s.description || 'Aucun résumé.'}
            </p>

            <button
              className="btn sm"
              style={{ flex: 'none' }}
              onClick={() => createOne(s)}
            >
              Créer dans la bibliothèque
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Texte de la campagne modifiable sur place : un clic pour éditer. */
function EditableText({ value, onSave, rows = 4, placeholder = 'Cliquer pour écrire…' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);
  if (editing)
    return (
      <div>
        <textarea className="in" rows={rows} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button className="btn sm primary" style={{ flex: 'none' }} onClick={() => { onSave(draft); setEditing(false); }}>
            Enregistrer
          </button>
          <button className="btn sm ghost" style={{ flex: 'none' }} onClick={() => setEditing(false)}>
            Annuler
          </button>
        </div>
      </div>
    );
  return (
    <button type="button" className={'camp-edit' + (value ? '' : ' empty')} title="Cliquer pour modifier" onClick={() => setEditing(true)}>
      {value || placeholder}
    </button>
  );
}

function CampaignCard({
  camp,
  state,
  dispatch,
  universe,
  party,
  flash,
  setView,
  feed,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { ai } = useContext(AIContext);
  const [brainNotes, setBrainNotes] = useState(camp.brainScratch || '');
  const [brainBusy, setBrainBusy] = useState(false);
  const [writing, setWriting] = useState(0);
  const [populating, setPopulating] = useState('');
  const sessions = camp.sessions || [];
  const written = sessions.filter((s) => s.detailed).length;
  const legacy = sessions.length === 0;
  const patchCamp = (patch) => dispatch({ type: 'UPDATE_CAMPAIGN', id: camp.id, patch });

  /** Écrit une ou plusieurs séances, l'une après l'autre (chacune voit les précédentes). */
  async function writeSessions(numbers) {
    let current = camp;
    for (const n of numbers) {
      setWriting(n);
      try {
        const patch = await writeCampaignSession({ ai, universe, state, party, camp: current, sessionNumber: n, feed });
        current = { ...current, ...patch };
        patchCamp(patch);
      } catch (e) {
        flash(e.message);
        break;
      }
    }
    setWriting(0);
  }

  function invokeOnMap() {
    dispatch({ type: 'UPDATE_UNIVERSE', id: universe.id, patch: { activeCampaignId: camp.id } });
    setView && setView('maps');
    flash(`« ${camp.title} » invoquée : ouvre une carte pour suivre la campagne.`);
  }

  /** Crée dans PNJ & Créatures les fiches des PNJ récurrents et des créatures de la campagne. */
  async function populateBestiary() {
    const known = new Set(Object.values(state.npcs || {}).filter((n) => n.universeId === universe.id).map((n) => normName(n.name)));
    const items = [
      ...(camp.recurringNpcs || []).map((n) => ({
        mode: 'npc',
        name: n.name,
        notes: [n.role, n.kind, n.motivation && `Motivation : ${n.motivation}`, n.secret && `Secret : ${n.secret}`, n.voice && `Voix : ${n.voice}`, n.arc && `Arc : ${n.arc}`, n.attitude && `Attitude : ${n.attitude}`].filter(Boolean).join('\n'),
      })),
      ...(camp.monsters || []).map((m) => ({
        mode: 'monster',
        name: m.name,
        cr: m.cr,
        notes: [m.kind, m.role && `Rôle : ${m.role}`, m.cr && `FP visé : ${m.cr}`, m.where && `Où : ${m.where}`, m.description].filter(Boolean).join('\n'),
      })),
    ].filter((it) => it.name && !known.has(normName(it.name)));
    if (!items.length) {
      flash('Toutes les fiches de cette campagne existent déjà dans PNJ & Créatures.');
      return;
    }
    const ctx = buildLoreContext({ universe, state, feed, party, budget: 6000, focus: `${camp.title} ${camp.premise}` });
    let made = 0;
    for (let i = 0; i < items.length; i += 2) {
      const batch = items.slice(i, i + 2);
      setPopulating(`${Math.min(i + 2, items.length)}/${items.length}`);
      try {
        const entities = await generateEntities((o) => callAI(ai, o), {
          ctx: `${ctx}\n\nCAMPAGNE : ${camp.title} — ${camp.premise}`,
          items: batch,
          level: camp.level || party[0]?.level || 3,
          size: party.length || 4,
        });
        for (const e of entities) {
          const n = { ...e, id: uid(), createdAt: now(), campaignIds: [camp.id] };
          dispatch({ type: 'ADD_NPC', n });
          autoPortrait(dispatch, n, archiveImageIndex(feed));
          made++;
        }
      } catch (e) {
        flash(e.message);
        break;
      }
    }
    setPopulating('');
    if (made) flash(`${made} fiche(s) créée(s) dans PNJ & Créatures.`);
  }

  async function enrichLongCampaign() {
    setBrainBusy(true);

    try {
      const data = await callAI(ai, {
        system: `Tu es l’architecte narratif de Loresmith.
  
  Réponds uniquement en JSON valide.
  Tu dois étoffer une campagne longue existante sans détruire sa structure.
  Ajoute du lore, du flux narratif, des détails de séances, des liens entre scènes,
  des conséquences, des secrets, des rappels, des seeds, des suggestions de bibliothèque.
  Langue: français.
  Style: riche, utile au MJ, immersif, mais organisé.`,
        prompt: `Univers: ${universe.name}
  Ton:
  ${universe.tone || ''}
  
  Canon:
  ${universe.lore || ''}
  
  Mémoire vivante:
  ${
    (universe.memoryLog || [])
      .slice(0, 12)
      .map((m) => `- ${m.title}: ${m.summary}`)
      .join('\n') || 'Aucune'
  }
  
  Campagne actuelle:
  Titre: ${camp.title}
  Prémisse: ${camp.premise}
  Hook: ${camp.hook}
  Canon de campagne:
  ${camp.campaignCanon || ''}
  
  Actes:
  ${(camp.acts || [])
    .map((a) => `- ${a.title}: ${a.summary || ''}`)
    .join('\n')}
  
  Séances:
  ${(camp.sessions || [])
    .map((s) => `- Séance ${s.sessionNumber}: ${s.title} — ${s.summary}`)
    .join('\n')}
  
  Scènes:
  ${(camp.scenes || [])
    .map(
      (sc, i) => `
  ${i + 1}. ${sc.title}
  Type: ${sc.type}
  Résumé: ${sc.summary}
  Lore actuel: ${sc.expanded?.lore || ''}
  Notes MJ: ${sc.expanded?.dmNotes || ''}
  `
    )
    .join('\n')}
  
  Retourne:
  {
    "campaignCanon": "Version enrichie du canon de campagne, 8 à 15 paragraphes.",
    "dmOverview": "Brief MJ complet, dense et structuré.",
    "acts": [
      {
        "title": str,
        "summary": str,
        "purpose": str,
        "lore": "Lore enrichi de l’acte.",
        "openingBeat": str,
        "turningPoint": str,
        "finale": str,
        "secrets": [str],
        "seeds": [str],
        "consequences": [str]
      }
    ],
    "sessions": [
      {
        "title": str,
        "sessionNumber": num,
        "act": str,
        "summary": str,
        "dmBrief": str,
        "openingImage": str,
        "mainGoal": str,
        "dramaticQuestion": str,
        "loreToReveal": [str],
        "importantChoices": [str],
        "expectedScenes": [str],
        "possibleEndings": [str]
      }
    ],
    "librarySuggestions": [
      {
        "title": str,
        "archiveType": "artifact|person|place|event|faction|mystery|document",
        "shortSummary": str,
        "body": "Fiche riche, 2 à 5 paragraphes.",
        "origin": str,
        "historicalContext": str,
        "currentLocation": str,
        "owner": str,
        "campaignUse": str,
        "secrets": str,
        "tags": [str],
        "imagePrompt": str
      }
    ],
    "scenes": [
      {
        "idHint": "titre exact de la scène à enrichir",
        "title": str,
        "summary": str,
        "readAloud": str,
        "purpose": str,
        "location": str,
        "lore": "Lore enrichi, 3 à 7 paragraphes.",
        "dmNotes": "Notes MJ riches.",
        "sensoryDetails": str,
        "hiddenTruth": str,
        "playerChoices": [str],
        "consequences": [str],
        "seeds": [str],
        "callbacks": [str],
        "questions": [str],
        "loot": [str],
        "libraryLinksToCreate": [
          {
            "title": str,
            "archiveType": "artifact|person|place|event|faction|mystery|document",
            "shortSummary": str,
            "body": str,
            "campaignUse": str,
            "secrets": str,
            "tags": [str],
            "imagePrompt": str
          }
        ]
      }
    ]
  }`,
      });

      const enrichedScenes = (camp.scenes || []).map((scene) => {
        const match = (data.scenes || []).find(
          (s) =>
            normalizeName(s.idHint || s.title) === normalizeName(scene.title)
        );

        if (!match) return scene;

        return {
          ...scene,
          title: match.title || scene.title,
          summary: match.summary || scene.summary,
          expanded: {
            ...(scene.expanded || {}),
            setting: match.location || scene.expanded?.setting || '',
            readAloud: match.readAloud || scene.expanded?.readAloud || '',
            purpose: match.purpose || scene.expanded?.purpose || '',
            lore: match.lore || scene.expanded?.lore || '',
            dmNotes: match.dmNotes || scene.expanded?.dmNotes || '',
            sensoryDetails:
              match.sensoryDetails || scene.expanded?.sensoryDetails || '',
            hiddenTruth:
              match.hiddenTruth || scene.expanded?.hiddenTruth || '',
            playerChoices:
              match.playerChoices || scene.expanded?.playerChoices || [],
            consequences:
              match.consequences || scene.expanded?.consequences || [],
            seeds: match.seeds || scene.expanded?.seeds || [],
            callbacks: match.callbacks || scene.expanded?.callbacks || [],
            questions: match.questions || scene.expanded?.questions || [],
            loot: match.loot || scene.expanded?.loot || [],
            libraryLinksToCreate: [
              ...(scene.expanded?.libraryLinksToCreate || []),
              ...(match.libraryLinksToCreate || []),
            ],
          },
        };
      });

      dispatch({
        type: 'UPDATE_CAMPAIGN',
        id: camp.id,
        patch: {
          campaignCanon: data.campaignCanon || camp.campaignCanon || '',
          dmOverview: data.dmOverview || camp.dmOverview || '',
          acts: data.acts || camp.acts || [],
          sessions: data.sessions || camp.sessions || [],
          librarySuggestions: [
            ...(camp.librarySuggestions || []),
            ...(data.librarySuggestions || []),
          ],
          scenes: enrichedScenes,
        },
      });

      flash('Campagne étoffée.');
    } catch (e) {
      flash(e.message);
    }

    setBrainBusy(false);
  }

  function deleteCampaignMemory(memoryId) {
    if (!confirm('Supprimer cette mémoire ?')) return;

    dispatch({
      type: 'UPDATE_CAMPAIGN',
      id: camp.id,
      patch: {
        memoryLog: (camp.memoryLog || []).filter((m) => m.id !== memoryId),
      },
    });

    flash('Mémoire supprimée.');
  }

  async function assimilateCampaignMemory() {
    if (!brainNotes.trim()) {
      flash('Ajoute des notes de campagne à assimiler.');
      return;
    }
    setBrainBusy(true);

    try {
      const data = await callAI(ai, {
        system: `Tu es un archiviste narratif pour une campagne TTRPG.
  
  Réponds uniquement en JSON valide.
  Transforme des notes de session décousues en mémoire de campagne.
  La mémoire doit produire des conséquences, des rappels futurs, des seeds, des PNJ/lieux/objets à rappeler plus tard.
  Langue: français.`,
        prompt: `Univers: ${universe.name}
  Canon global:
  ${universe.lore || ''}
  
  Campagne: ${camp.title}
  Prémisse: ${camp.premise || ''}
  Hook: ${camp.hook || ''}
  
  Notes décousues:
  ${brainNotes}
  
  Retourne:
  {
    "campaignMemoryTitle": "titre court",
    "campaignMemorySummary": "résumé narratif utile",
    "campaignCanonPatch": "texte court à ajouter à la mémoire de cette campagne",
    "universeCanonEcho": "texte très court à ajouter au canon global si pertinent",
    "consequences": ["..."],
    "futureSeeds": ["..."],
    "easterEggs": ["..."]
  }`,
      });

      const memory = {
        id: uid(),
        createdAt: now(),
        title: data.campaignMemoryTitle || 'Mémoire de campagne',
        summary: data.campaignMemorySummary || brainNotes,
        consequences: data.consequences || [],
        futureSeeds: data.futureSeeds || [],
        easterEggs: data.easterEggs || [],
      };

      dispatch({
        type: 'UPDATE_CAMPAIGN',
        id: camp.id,
        patch: {
          brainScratch: '',
          campaignCanon: [
            camp.campaignCanon || '',
            data.campaignCanonPatch ? `\n\n${data.campaignCanonPatch}` : '',
          ]
            .join('')
            .trim(),
          memoryLog: [memory, ...(camp.memoryLog || [])].slice(0, 60),
        },
      });

      if (data.universeCanonEcho) {
        dispatch({
          type: 'UPDATE_UNIVERSE',
          id: universe.id,
          patch: {
            lore: [universe.lore || '', `\n\n${data.universeCanonEcho}`]
              .join('')
              .trim(),
          },
        });
      }

      setBrainNotes('');
      flash('Mémoire de campagne assimilée.');
    } catch (e) {
      flash(e.message);
    }

    setBrainBusy(false);
  }

  return (
    <div className="panel">
      <div className="card-h">
        <div>
          <div
            style={{
              fontFamily: 'Cinzel,serif',
              fontSize: 19,
              color: '#f0e2bb',
            }}
          >
            {camp.title}
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            ~{camp.hours} h · niv. {camp.level} · {camp.scenes.length} scène
            {camp.scenes.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className="row" style={{ flex: 'none' }}>
          <button
            className="btn ghost sm"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Fermer' : 'Ouvrir'}
          </button>
          <button
            className="btn ghost sm danger"
            title="Supprimer la campagne"
            aria-label={`Supprimer la campagne ${camp.title}`}
            onClick={() => {
              if (
                confirm(
                  `Supprimer la campagne « ${camp.title} » ? Cette action est irréversible.`
                )
              ) {
                dispatch({ type: 'DELETE_CAMPAIGN', id: camp.id });
              }
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.55, margin: '10px 0 4px' }}>
        {camp.premise}
      </p>

      {open && (
        <>
          {!legacy && (
            <div className="camp-progress">
              <span>
                Séances écrites : <b>{written}</b>/{sessions.length}
              </span>
              <span className="bar">
                <i style={{ width: `${sessions.length ? (written / sessions.length) * 100 : 0}%` }} />
              </span>
              {written < sessions.length && (
                <button className="btn sm primary" disabled={!!writing} onClick={() => writeSessions(sessions.filter((s) => !s.detailed).map((s) => s.sessionNumber))}>
                  {writing ? (
                    <>
                      <Spin /> Séance {writing}…
                    </>
                  ) : (
                    '✎ Écrire les séances restantes'
                  )}
                </button>
              )}
            </div>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '6px 0 10px' }}>
            <button className="btn sm" style={{ flex: 'none' }} onClick={invokeOnMap}>
              🗺 Invoquer sur la carte
            </button>
            {(camp.recurringNpcs?.length > 0 || camp.monsters?.length > 0) && (
              <button className="btn sm" style={{ flex: 'none' }} disabled={!!populating} onClick={populateBestiary}>
                {populating ? (
                  <>
                    <Spin /> Fiches {populating}
                  </>
                ) : (
                  '✦ Créer les fiches PNJ & créatures'
                )}
              </button>
            )}
          </div>

          <div className="camp-bible">
            <details open>
              <summary>Accroche</summary>
              <EditableText value={camp.hook} onSave={(v) => patchCamp({ hook: v })} />
            </details>
            {(camp.dmOverview || !legacy) && (
              <details>
                <summary>Brief du MJ</summary>
                <EditableText value={camp.dmOverview} rows={8} onSave={(v) => patchCamp({ dmOverview: v })} />
              </details>
            )}
            {(camp.campaignCanon || !legacy) && (
              <details>
                <summary>Canon de la campagne</summary>
                <EditableText value={camp.campaignCanon} rows={12} onSave={(v) => patchCamp({ campaignCanon: v })} />
              </details>
            )}
            {(camp.finalTruth || camp.failureState) && (
              <details>
                <summary>Vérité cachée · si les PJ échouent</summary>
                <EditableText value={camp.finalTruth} onSave={(v) => patchCamp({ finalTruth: v })} />
                <EditableText value={camp.failureState} onSave={(v) => patchCamp({ failureState: v })} />
              </details>
            )}
            {camp.acts?.length > 0 && (
              <details>
                <summary>Actes ({camp.acts.length})</summary>
                <ul className="camp-list">
                  {camp.acts.map((a, i) => (
                    <li key={i}>
                      <b>{a.title}.</b> {toText(a.summary)} {a.turningPoint && <em>Bascule : {toText(a.turningPoint)}</em>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {camp.recurringNpcs?.length > 0 && (
              <details>
                <summary>PNJ récurrents ({camp.recurringNpcs.length})</summary>
                <ul className="camp-list">
                  {camp.recurringNpcs.map((n, i) => (
                    <li key={i}>
                      <b>{n.name}</b> — {toText(n.role)}. {toText(n.motivation)} {n.secret && <em>Secret : {toText(n.secret)}</em>}{' '}
                      {n.voice && <span className="muted">Voix : {toText(n.voice)}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {camp.factions?.length > 0 && (
              <details>
                <summary>Factions ({camp.factions.length})</summary>
                <ul className="camp-list">
                  {camp.factions.map((f, i) => (
                    <li key={i}>
                      <b>{f.name}</b> — {toText(f.goal)} {f.hiddenTruth && <em>En vérité : {toText(f.hiddenTruth)}</em>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {camp.majorLocations?.length > 0 && (
              <details>
                <summary>Lieux ({camp.majorLocations.length})</summary>
                <ul className="camp-list">
                  {camp.majorLocations.map((l, i) => (
                    <li key={i}>
                      <b>{l.name}</b> — {toText(l.description)} {l.secrets && <em>Secret : {toText(l.secrets)}</em>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {camp.mysteries?.length > 0 && (
              <details>
                <summary>Mystères ({camp.mysteries.length})</summary>
                <ul className="camp-list">
                  {camp.mysteries.map((m, i) => (
                    <li key={i}>
                      <b>{toText(m.question)}</b> → {toText(m.truth)}
                      {toList(m.clues).length > 0 && <div className="muted">Indices : {toList(m.clues).join(' · ')}</div>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {camp.monsters?.length > 0 && (
              <details>
                <summary>Créatures ({camp.monsters.length})</summary>
                <ul className="camp-list">
                  {camp.monsters.map((m, i) => (
                    <li key={i}>
                      <b>{m.name}</b> ({toText(m.kind)}, FP {toText(m.cr)}) — {toText(m.where)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {legacy ? (
            <>
              <div className="eyebrow" style={{ marginTop: 22 }}>
                Scènes
              </div>
              {camp.scenes.map((sc, i) => (
                <SceneRow key={sc.id} scene={sc} idx={i} camp={camp} {...{ state, dispatch, universe, party, flash, setView }} />
              ))}
            </>
          ) : (
            <>
              <div className="eyebrow" style={{ marginTop: 22 }}>
                Séances et scènes
              </div>
              {sessions.map((s) => {
                const scenes = camp.scenes.filter((sc) => sc.sessionNumber === s.sessionNumber);
                return (
                  <section key={s.sessionNumber} className="camp-session">
                    <div className="camp-session-head">
                      <h4>
                        Séance {s.sessionNumber} · {s.title}
                      </h4>
                      <button className="btn ghost sm" style={{ flex: 'none' }} disabled={!!writing} onClick={() => writeSessions([s.sessionNumber])}>
                        {writing === s.sessionNumber ? <Spin /> : s.detailed ? '↻ Réécrire' : '✎ Écrire cette séance'}
                      </button>
                    </div>
                    <div className="camp-session-meta">
                      {toText(s.summary)}
                      {s.mainGoal && (
                        <div>
                          <b>Objectif :</b> {toText(s.mainGoal)}
                        </div>
                      )}
                      {s.mainLocation && (
                        <div>
                          <b>Lieu principal :</b> {toText(s.mainLocation)}
                        </div>
                      )}
                    </div>
                    {s.recap && (
                      <Block title="À lire en début de séance">
                        <div className="block-text">{toText(s.recap)}</div>
                      </Block>
                    )}
                    {s.dmBrief && (
                      <Block title="Brief de séance">
                        <EditableText
                          value={toText(s.dmBrief)}
                          rows={6}
                          onSave={(v) => patchCamp({ sessions: sessions.map((x) => (x.sessionNumber === s.sessionNumber ? { ...x, dmBrief: v } : x)) })}
                        />
                      </Block>
                    )}
                    <details className="lore-details">
                      <summary>Lore de la séance : brief, PNJ, rencontres, fils, ajouter une scène</summary>
                      <SessionLore
                        camp={camp}
                        session={s}
                        universe={universe}
                        state={state}
                        party={party}
                        feed={feed}
                        call={(o) => callAI(ai, o)}
                        dispatch={dispatch}
                        flash={flash}
                        onAddScene={(sc) => {
                          const next = { ...toScene(sc, s), actId: s.actId || '' };
                          dispatch({ type: 'UPDATE_CAMPAIGN', id: camp.id, patch: { scenes: [...camp.scenes, next] } });
                          flash(`Scène ajoutée : ${next.title}`);
                        }}
                        onCreatureSheet={(c) => createCreatureSheet({ call: (o) => callAI(ai, o), creature: c, universe, state, feed, party, camp, dispatch, flash })}
                      />
                    </details>
                    {scenes.map((sc, i) => (
                      <SceneRow key={sc.id} scene={sc} idx={i} camp={camp} session={s} feed={feed} {...{ state, dispatch, universe, party, flash, setView }} />
                    ))}
                    {s.cliffhanger && (
                      <div className="muted" style={{ fontSize: 13.5, margin: '6px 0' }}>
                        <b>Fin de séance :</b> {toText(s.cliffhanger)}
                      </div>
                    )}
                  </section>
                );
              })}
            </>
          )}

          <div className="eyebrow">Mémoire de campagne</div>
          <CampaignArchiveSuggestions
            suggestions={camp.librarySuggestions || []}
            campaignId={camp.id}
            dispatch={dispatch}
            flash={flash}
          />
          <div className="panel brain-panel" style={{ marginTop: 14 }}>
            <p
              className="muted"
              style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}
            >
              Notes de session, conséquences, choix des joueurs, promesses,
              lieux visités, PNJ marqués, objets déplacés, morts importantes,
              mystères ouverts.
            </p>

            <Field label="Notes décousues de campagne">
              <textarea
                className="in"
                value={brainNotes}
                onChange={(e) => setBrainNotes(e.target.value)}
                placeholder="Ex. Les joueurs ont humilié le capitaine. Le sceau du temple est brisé. Le gobelin sauvé connaît maintenant leur nom..."
              />
            </Field>

            <div className="row">
              <button
                className="btn primary"
                style={{ flex: 'none' }}
                disabled={brainBusy}
                onClick={assimilateCampaignMemory}
              >
                {brainBusy ? (
                  <>
                    <Spin /> Assimilation…
                  </>
                ) : (
                  'Assimiler à la campagne'
                )}
              </button>
              <button
                className="btn primary"
                style={{ flex: 'none', marginTop: 12 }}
                disabled={brainBusy}
                onClick={enrichLongCampaign}
              >
                {brainBusy ? (
                  <>
                    <Spin /> Étoffage…
                  </>
                ) : (
                  'Étoffer cette campagne'
                )}
              </button>
              <button
                className="btn"
                style={{ flex: 'none' }}
                onClick={() => {
                  dispatch({
                    type: 'UPDATE_CAMPAIGN',
                    id: camp.id,
                    patch: { brainScratch: brainNotes },
                  });

                  flash('Notes sauvegardées.');
                }}
              >
                Sauvegarder sans assimiler
              </button>
            </div>

            {(camp.memoryLog || []).length > 0 && (
              <div className="memory-list">
                {(camp.memoryLog || []).slice(0, 4).map((m) => (
                  <div className="memory-item" key={m.id}>
                  <div className="card-h">
                    <b>{m.title}</b>
                
                    <button
                      className="btn ghost sm danger"
                      style={{ flex: 'none' }}
                      onClick={() => deleteCampaignMemory(m.id)}
                      title="Supprimer cette mémoire"
                    >
                      Supprimer
                    </button>
                  </div>
                
                  <p>{m.summary}</p>
                </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
function SceneEditModal({
  scene,
  camp,
  universe,
  state,
  dispatch,
  onClose,
  flash,
}) {
  const [draft, setDraft] = useState(() => ({
    title: scene.title || '',
    type: scene.type || 'exploration',
    summary: scene.summary || '',

    purpose: scene.expanded?.purpose || '',
    setting: scene.expanded?.setting || '',
    readAloud: scene.expanded?.readAloud || '',

    lore: scene.expanded?.lore || '',
    dmNotes: scene.expanded?.dmNotes || '',
    sensoryDetails: scene.expanded?.sensoryDetails || '',
    hiddenTruth: scene.expanded?.hiddenTruth || '',

    questions: arrayToText(scene.expanded?.questions),
    seeds: arrayToText(scene.expanded?.seeds),
    consequences: arrayToText(scene.expanded?.consequences),
    loot: arrayToText(scene.expanded?.loot),
    playerChoices: arrayToText(scene.expanded?.playerChoices),
    callbacks: arrayToText(scene.expanded?.callbacks),

    linkedNpcIds: scene.linkedNpcIds || [],
    linkedLibraryEntryIds: scene.linkedLibraryEntryIds || [],
  }));

  const npcs = Object.values(state.npcs || {}).filter(
    (n) => n.universeId === universe.id
  );
  const libraryEntries = Object.values(state.libraryEntries || {}).filter(
    (e) => e.universeId === universe.id
  );

  function set(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function toggleNpc(id) {
    set(
      'linkedNpcIds',
      draft.linkedNpcIds.includes(id)
        ? draft.linkedNpcIds.filter((x) => x !== id)
        : [...draft.linkedNpcIds, id]
    );
  }

  function toggleLibraryEntry(id) {
    set(
      'linkedLibraryEntryIds',
      draft.linkedLibraryEntryIds.includes(id)
        ? draft.linkedLibraryEntryIds.filter((x) => x !== id)
        : [...draft.linkedLibraryEntryIds, id]
    );
  }

  function save() {
    dispatch({
      type: 'UPDATE_SCENE',
      cid: camp.id,
      sid: scene.id,
      patch: {
        title: draft.title,
        type: draft.type,
        summary: draft.summary,
        linkedNpcIds: draft.linkedNpcIds,
        linkedLibraryEntryIds: draft.linkedLibraryEntryIds,
        expanded: {
          ...(scene.expanded || {}),

          purpose: draft.purpose,
          setting: draft.setting,
          readAloud: draft.readAloud,

          lore: draft.lore,
          dmNotes: draft.dmNotes,
          sensoryDetails: draft.sensoryDetails,
          hiddenTruth: draft.hiddenTruth,

          questions: textToArray(draft.questions),
          seeds: textToArray(draft.seeds),
          consequences: textToArray(draft.consequences),
          loot: textToArray(draft.loot),
          playerChoices: textToArray(draft.playerChoices),
          callbacks: textToArray(draft.callbacks),
        },
      },
    });

    flash('Scène mise à jour.');
    onClose();
  }

  return (
    <Modal title={`Éditer la scène — ${scene.title}`} onClose={onClose} wide>
      <div className="row">
        <Field label="Titre">
          <input
            className="in"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <Field label="Type">
          <select
            className="in"
            value={draft.type}
            onChange={(e) => set('type', e.target.value)}
          >
            <option value="social">Social</option>
            <option value="exploration">Exploration</option>
            <option value="combat">Combat</option>
            <option value="puzzle">Puzzle</option>
            <option value="climax">Climax</option>
          </select>
        </Field>
      </div>

      <Field label="Résumé">
        <textarea
          className="in"
          value={draft.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
      </Field>

      <Field label="But de la scène">
        <textarea
          className="in"
          value={draft.purpose}
          onChange={(e) => set('purpose', e.target.value)}
        />
      </Field>

      <Field label="Lieu / setting">
        <textarea
          className="in"
          value={draft.setting}
          onChange={(e) => set('setting', e.target.value)}
        />
      </Field>

      <Field label="Texte à lire aux joueurs">
        <textarea
          className="in"
          rows={5}
          value={draft.readAloud}
          onChange={(e) => set('readAloud', e.target.value)}
        />
      </Field>

      <Field label="Lore de la scène">
        <textarea
          className="in"
          rows={6}
          value={draft.lore}
          onChange={(e) => set('lore', e.target.value)}
          placeholder="Histoire du lieu, symboles, contexte profond, liens avec l’univers, éléments que les joueurs peuvent découvrir..."
        />
      </Field>

      <Field label="Notes MJ détaillées">
        <textarea
          className="in"
          rows={5}
          value={draft.dmNotes}
          onChange={(e) => set('dmNotes', e.target.value)}
          placeholder="Rythme, ambiance, secrets à garder, intention de la scène, façons de l’adapter selon les choix des joueurs..."
        />
      </Field>

      <div className="row">
        <Field label="Détails sensoriels">
          <textarea
            className="in"
            value={draft.sensoryDetails}
            onChange={(e) => set('sensoryDetails', e.target.value)}
            placeholder="Sons, odeurs, lumière, texture, température, mouvement, signes étranges..."
          />
        </Field>

        <Field label="Vérité cachée">
          <textarea
            className="in"
            value={draft.hiddenTruth}
            onChange={(e) => set('hiddenTruth', e.target.value)}
            placeholder="Ce qui se passe vraiment derrière cette scène."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Questions à résoudre">
          <textarea
            className="in"
            value={draft.questions}
            onChange={(e) => set('questions', e.target.value)}
            placeholder="Une ligne par question."
          />
        </Field>

        <Field label="Seeds / rappels futurs">
          <textarea
            className="in"
            value={draft.seeds}
            onChange={(e) => set('seeds', e.target.value)}
            placeholder="Une ligne par seed."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Conséquences possibles">
          <textarea
            className="in"
            value={draft.consequences}
            onChange={(e) => set('consequences', e.target.value)}
            placeholder="Une ligne par conséquence."
          />
        </Field>

        <Field label="Loot / trouvailles">
          <textarea
            className="in"
            value={draft.loot}
            onChange={(e) => set('loot', e.target.value)}
            placeholder="Une ligne par objet, indice ou récompense."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Choix des joueurs">
          <textarea
            className="in"
            value={draft.playerChoices}
            onChange={(e) => set('playerChoices', e.target.value)}
            placeholder="Une ligne par choix significatif possible."
          />
        </Field>

        <Field label="Callbacks / rappels">
          <textarea
            className="in"
            value={draft.callbacks}
            onChange={(e) => set('callbacks', e.target.value)}
            placeholder="Une ligne par rappel à une scène, campagne, PNJ ou archive précédente."
          />
        </Field>
      </div>

      <Field label="PNJ / monstres existants à associer">
        <div className="library-campaign-links">
          {npcs.length === 0 ? (
            <span className="muted">Aucun PNJ ou monstre disponible.</span>
          ) : (
            npcs.map((n) => (
              <button
                type="button"
                key={n.id}
                data-on={draft.linkedNpcIds.includes(n.id) ? 1 : 0}
                onClick={() => toggleNpc(n.id)}
              >
                {n.name} {n.entityType ? `· ${n.entityType}` : ''}
              </button>
            ))
          )}
        </div>
      </Field>

      <Field label="Archives de bibliothèque à associer">
        <div className="library-campaign-links">
          {libraryEntries.length === 0 ? (
            <span className="muted">
              Aucune archive disponible dans la bibliothèque.
            </span>
          ) : (
            libraryEntries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                data-on={draft.linkedLibraryEntryIds.includes(entry.id) ? 1 : 0}
                onClick={() => toggleLibraryEntry(entry.id)}
              >
                {entry.title}{' '}
                {entry.archiveType ? `· ${entry.archiveType}` : ''}
              </button>
            ))
          )}
        </div>
      </Field>

      <div className="row">
        <button className="btn primary" style={{ flex: 'none' }} onClick={save}>
          Sauvegarder la scène
        </button>

        <button
          className="btn ghost"
          style={{ flex: 'none' }}
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
    </Modal>
  );
}
function textToArray(text) {
  return String(text || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function arrayToText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.join('\n');
  return String(value);
}

function SceneRow({
  scene,
  idx,
  camp,
  state,
  dispatch,
  universe,
  party,
  flash,
  setView,
  feed,
  session,
}) {
  const { ai } = useContext(AIContext);
  const call = (o) => callAI(ai, o);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const tagCls =
    {
      combat: 'blood',
      social: 'arcane',
      puzzle: 'arcane',
      climax: 'ember',
      exploration: '',
    }[scene.type] || '';
  async function expand() {
    setBusy(true);
    try {
      const pb = party.length
        ? party
            .map((c) => `${c.name} (lv${c.level} ${c.race} ${c.cls})`)
            .join('; ')
        : 'the party';
      const d = await callAI(ai, {
        system: `You are a master D&D 5e DM.

          Respond with ONLY valid JSON, no prose, no markdown fences.
          
          LANGUAGE RULES:
          - All read-aloud narration must be in French.
          - All NPC dialogue must be in French.
          - Dialogue must reflect the speaker's species, personality, status, and emotional state.
          - ${FAUNA_RULE}
          - Frog-like characters may include occasional "croa".
          - Serpent-like characters may stretch s sounds, like "sssecret" or "sssi".
          - Goblins should sound nervous, twitchy, hesitant, opportunistic, and slightly chaotic.
          - Orcs should sound blunt, harsh, forceful, and direct.
          - Ancient beings should sound slow, ceremonial, and heavy with memory.
          - Do not make every word a gimmick. Use voice texture sparingly but noticeably.`,
        prompt: `Universe canon: ${universe.lore}. Tone: ${universe.tone}.
   Campaign: "${camp.title}" — ${camp.premise}
   Campaign memory:
${
  (camp.memoryLog || [])
    .slice(0, 10)
    .map((m) => `- ${m.title}: ${m.summary}`)
    .join('\n') || 'No campaign memory yet.'
}

Universe living memory:
${
  (universe.memoryLog || [])
    .slice(0, 8)
    .map((m) => `- ${m.title}: ${m.summary}`)
    .join('\n') || 'No universe memory yet.'
}
   Scene ${idx + 1}: "${scene.title}" (${scene.type}) — ${
          scene.summary
        }. Party: ${pb}.
   Flesh out this scene.
   If a scene includes monsters or enemies, list only the creatures actually planned for this scene in encounters. Encounter loot must be rare, modest, and often mundane or damaged: broken tools, wooden spoons, torn pouches, cheap trinkets, scraps, minor coins, or story clues. Avoid powerful or very useful loot unless the scene specifically deserves it.
   Generate 3 to 5 short dialogue lines the main NPC or creature might say during the first encounter. These must be actual spoken lines in French, not character descriptions.
   Use campaign and universe memory to add consequences, callbacks, recurring symbols, NPC reactions, seeded mysteries and subtle references to previous events.
JSON: {
  "setting": str,
  "readAloud": str,
  "dialogues": [
    {
      "speaker": str,
      "voice": str,
      "situation": "bienvenue"|"première rencontre"|"appel à l'aide"|"provocation"|"indice de quête"|"sidequest"|"mise en garde"|"mensonge"|"peur"|"menace"|"révélation"|"marchandage",
      "text": str
    }
  ],
  "npcs": [
    {
      "name": str,
      "note": str,
      "voice": str
    }
  ],
  "encounters": [
    {
      "name": str,
      "detail": str,
      "loot": [str]
    }
  ],
  "skillChecks": [
    {
      "check": str,
      "dc": num,
      "on_success": str,
      "on_failure": str
    }
  ],
  "branches": [
    {
      "if": str,
      "then": str
    }
  ],
  "loot": [str]
}`,
      });
      const sceneData = d._parseFailed ? fallbackSceneFromText(d._rawText) : d;

      dispatch({
        type: 'UPDATE_SCENE',
        cid: camp.id,
        sid: scene.id,
        patch: { expanded: sceneData },
      });
      setShow(true);
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }
  const x = scene.expanded;
  const sceneImages = state ? getAssetsFor(state, 'scene', scene.id) : [];
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
      <div className="card-h">
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: 'Cinzel,serif',
              color: 'var(--gold)',
              fontSize: 13,
            }}
          >
            {String(idx + 1).padStart(2, '0')}
          </span>
          <div>
            <b style={{ fontSize: 15 }}>{scene.title}</b>{' '}
            <span className={'tag ' + tagCls}>{scene.type}</span>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>
              {scene.summary}
            </div>
            {(scene.linkedNpcIds?.length > 0 ||
              scene.linkedLibraryEntryIds?.length > 0) && (
              <div className="linked-scene-chips">
                {(scene.linkedNpcIds || []).map((id) => {
                  const n = state.npcs?.[id];
                  return n ? <span key={id}>PNJ · {n.name}</span> : null;
                })}
                {scene.expanded?.libraryLinksToCreate?.length > 0 && (
                  <CampaignArchiveSuggestions
                    suggestions={scene.expanded.libraryLinksToCreate}
                    campaignId={camp.id}
                    dispatch={dispatch}
                    flash={flash}
                  />
                )}
                {(scene.linkedLibraryEntryIds || []).map((id) => {
                  const entry = state.libraryEntries?.[id];
                  return entry ? (
                    <span key={id}>Archive · {entry.title}</span>
                  ) : null;
                })}
              </div>
            )}
            {sceneImages.length > 0 && (
              <div
                className="readaloud-thumbs"
                style={{ marginTop: 8, maxWidth: 220 }}
              >
                {sceneImages.slice(0, 6).map((img) => (
                  <img
                    key={img.id}
                    src={img.dataUrl}
                    alt={img.name}
                    title="Ouvrir l'image"
                    onClick={() =>
                      window.open(img.dataUrl, '_blank', 'noopener,noreferrer')
                    }
                  />
                ))}
              </div>
            )}
            <button
              className="btn ghost sm"
              style={{ marginTop: 8 }}
              onClick={() => setView && setView('assets')}
            >
              Associer des images
            </button>
            {scene.readAloud && (
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                Texte narratif prêt.
              </div>
            )}
          </div>
        </div>
        <button
          className="btn sm"
          style={{ flex: 'none' }}
          disabled={busy}
          onClick={() => (x ? setShow((s) => !s) : expand())}
        >
          {busy ? <Spin /> : x ? show ? 'Masquer' : 'Afficher' : '✦ Développer'}
        </button>
      </div>
      {x && show && (
        <div style={{ marginTop: 12, paddingLeft: 26 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            <b style={{ color: 'var(--txt)' }}>Cadre. </b>
            {toText(x.setting || scene.location)}
          </div>
          {x.readAloud && <div className="scroll">{toText(x.readAloud)}</div>}
          {(toList(x.guidance).length > 0 || x.nextLocation) && (
            <div className="scene-guidance">
              <b>Guider le groupe vers la suite{x.nextLocation ? ` (→ ${toText(x.nextLocation)})` : ''}</b>
              <ul className="block-list">
                {toList(x.guidance).map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {toList(x.clues).length > 0 && (
            <Block title="Indices à trouver">
              <ul className="block-list">
                {toList(x.clues).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Block>
          )}
          {x.dialogues?.length > 0 && (
            <Block title="Dialogues">
              {x.dialogues.map((d, i) => (
                <div key={i} className="dialogue-block">
                  <b>{d.speaker}</b>
                  {d.voice && <span> — {d.voice}</span>}
                  <p>« {d.text} »</p>
                </div>
              ))}
            </Block>
          )}
          {x.npcs?.length > 0 && (
            <Block title="PNJ">
              {x.npcs.map((n, i) => (
                <div key={i} className="feat">
                  <b>{n.name}.</b> {n.note}
                </div>
              ))}
            </Block>
          )}
          {x.encounters?.length > 0 && (
            <Block title="Rencontres">
              {x.encounters.map((e, i) => (
                <div key={i} className="feat">
                  <b>{toText(e.name)}.</b> {toText(e.detail)}
                  {e.creatures?.length > 0 && (
                    <div className="scene-creatures">
                      {e.creatures.map((c, j) => (
                        <span key={j}>
                          {c.count || 1} × {toText(c.name)}
                          {c.cr ? ` · FP ${toText(c.cr)}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.tactics && <div className="muted">Tactique : {toText(e.tactics)}</div>}
                  {e.nonCombatResolution && <div className="muted">Sans combat : {toText(e.nonCombatResolution)}</div>}
                </div>
              ))}
            </Block>
          )}
          {x.skillChecks?.length > 0 && (
            <Block title="Tests de compétence">
              {x.skillChecks.map((c, i) => (
                <div key={i} className="feat">
                  <b>
                    {toText(c.check)} (DD {toText(c.dc)}).
                  </b>{' '}
                  {toText(c.on_success)}
                  {c.on_failure && <span className="muted"> Échec : {toText(c.on_failure)}</span>}
                </div>
              ))}
            </Block>
          )}
          {x.branches?.length > 0 && (
            <Block title="Si… alors">
              {x.branches.map((b, i) => (
                <div key={i} className="feat">
                  <b>Si</b> {b.if} <b>→</b> {b.then}
                </div>
              ))}
            </Block>
          )}
          {[
            ['purpose', 'Objectif de la scène'],
            ['lore', 'Lore'],
            ['dmNotes', 'Notes du MJ'],
            ['sensoryDetails', 'Ambiance'],
            ['hiddenTruth', 'Vérité cachée'],
          ].map(([k, label]) =>
            x[k] ? (
              <Block key={k} title={label}>
                <div className="block-text">{toText(x[k])}</div>
              </Block>
            ) : null
          )}
          {[
            ['playerChoices', 'Choix des joueurs'],
            ['consequences', 'Conséquences'],
            ['seeds', 'Graines pour la suite'],
            ['callbacks', 'Rappels'],
            ['questions', 'Questions à résoudre'],
          ].map(([k, label]) =>
            toList(x[k]).length ? (
              <Block key={k} title={label}>
                <ul className="block-list">
                  {toList(x[k]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </Block>
            ) : null
          )}
          {x.loot?.length > 0 && (
            <Block title="Butin">
              <div className="row" style={{ gap: 6 }}>
                {x.loot.map((l, i) => (
                  <span key={i} className="tag ember" style={{ flex: 'none' }}>
                    {toText(l)}
                  </span>
                ))}
              </div>
            </Block>
          )}
        </div>
      )}
      <details className="lore-details">
        <summary>Lore : PNJ, rencontres, DD, environnement, dialogues</summary>
        <SceneLore
          camp={camp}
          scene={scene}
          session={session}
          universe={universe}
          state={state}
          party={party}
          feed={feed}
          call={call}
          dispatch={dispatch}
          flash={flash}
          onCreatureSheet={(c) => createCreatureSheet({ call, creature: c, universe, state, feed, party, camp, dispatch, flash })}
        />
      </details>
    </div>
  );
}
// Les réponses de l'IA ne respectent pas toujours le format demandé :
// un champ texte peut arriver en objet ou en liste. Rendre un objet brut
// dans React fait planter toute la page, d'où cette conversion.
function toText(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
  if (typeof v === 'object')
    return Object.values(v).map(toText).filter(Boolean).join(' — ');
  return '';
}

function toList(v) {
  if (v == null || v === '') return [];
  return (Array.isArray(v) ? v : [v]).map(toText).filter(Boolean);
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontFamily: 'Cinzel,serif',
          fontSize: 11,
          letterSpacing: '.2em',
          color: 'var(--gold)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------- Generator (AI chat) ---------------------- */
function Chat({
  state,
  dispatch,
  universe,
  party,
  campaigns,
  npcs,
  flash,
  setSettingsOpen,
  faunaSet,
}) {
  const { ai, setAI } = useContext(AIContext);

  const [mode, setMode] = useState('gm'); // "gm" | "npc"
  const [activeThreadId, setActiveThreadId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const audioRef = useRef(null);

  const [activeCampaignId, setActiveCampaignId] = useState(
    campaigns[0]?.id || ''
  );
  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  const [activeSceneId, setActiveSceneId] = useState(
    activeCampaign?.scenes?.[0]?.id || ''
  );
  const activeScene =
    activeCampaign?.scenes?.find((sc) => sc.id === activeSceneId) ||
    activeCampaign?.scenes?.[0] ||
    null;

  const [selectedSpeakerKey, setSelectedSpeakerKey] = useState('');

  const logRef = useRef(null);

  const chatThreads = useMemo(() => {
    return Object.values(state.chatThreads || {})
      .filter((t) => t.universeId === universe.id)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [state.chatThreads, universe.id]);

  const activeThread =
    chatThreads.find((t) => t.id === activeThreadId) || chatThreads[0] || null;

  const msgs = activeThread?.messages || [];

  const partyBlurb = party.length
    ? party.map((c) => `${c.name} (lv${c.level} ${c.race} ${c.cls})`).join('; ')
    : 'an unspecified party';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => {
    if (!activeThread && chatThreads.length > 0) {
      setActiveThreadId(chatThreads[0].id);
    }
  }, [activeThread, chatThreads]);

  useEffect(() => {
    if (!activeCampaign && campaigns[0]) {
      setActiveCampaignId(campaigns[0].id);
      setActiveSceneId(campaigns[0].scenes?.[0]?.id || '');
      return;
    }

    if (
      activeCampaign &&
      !activeCampaign.scenes?.some((sc) => sc.id === activeSceneId)
    ) {
      setActiveSceneId(activeCampaign.scenes?.[0]?.id || '');
    }
  }, [activeCampaignId, activeSceneId, campaigns]);

  const sceneSpeakerNames = useMemo(() => {
    const expanded = activeScene?.expanded || {};
    const names = [
      ...(expanded.npcs || []).map((n) => n.name),
      ...(expanded.dialogues || []).map((d) => d.speaker),
      ...(activeScene?.npcs || []).map((n) =>
        typeof n === 'string' ? n : n.name
      ),
      ...(activeScene?.dialogues || []).map((d) => d.speaker),
    ];

    return Array.from(new Set(names.filter(Boolean).map((n) => n.trim())));
  }, [activeScene]);

  const npcOptions = useMemo(() => {
    const byName = (name) => {
      const clean = normalizeName(name);

      return (
        npcs.find((n) => normalizeName(n.name) === clean) ||
        npcs.find((n) => clean.includes(normalizeName(n.name))) ||
        npcs.find((n) => normalizeName(n.name).includes(clean)) ||
        null
      );
    };

    if (mode === 'npc' && activeScene && sceneSpeakerNames.length > 0) {
      return sceneSpeakerNames.map((name) => {
        const npc = byName(name);
        const dialogueVoice =
          activeScene?.expanded?.dialogues?.find(
            (d) => normalizeName(d.speaker) === normalizeName(name)
          )?.voice ||
          activeScene?.expanded?.npcs?.find(
            (n) => normalizeName(n.name) === normalizeName(name)
          )?.voice ||
          '';

        return {
          key: npc ? `npc:${npc.id}` : `scene:${name}`,
          name,
          npc,
          voice: npc?.voice || dialogueVoice || 'Voix non définie',
          description: npc?.description || npc?.kind || 'PNJ de cette scène',
        };
      });
    }

    return npcs.map((n) => ({
      key: `npc:${n.id}`,
      name: n.name,
      npc: n,
      voice: n.voice || 'Voix non définie',
      description: n.description || n.kind || 'PNJ',
    }));
  }, [mode, activeScene, sceneSpeakerNames, npcs]);

  useEffect(() => {
    if (mode !== 'npc') return;

    if (!npcOptions.length) {
      setSelectedSpeakerKey('');
      return;
    }

    if (!npcOptions.some((o) => o.key === selectedSpeakerKey)) {
      setSelectedSpeakerKey(npcOptions[0].key);
    }
  }, [mode, npcOptions, selectedSpeakerKey]);

  const selectedSpeaker =
    npcOptions.find((o) => o.key === selectedSpeakerKey) ||
    npcOptions[0] ||
    null;

  const selectedNpc = selectedSpeaker?.npc || null;

  const selectedPortrait = selectedNpc
    ? getPrimaryAsset(state, 'npc', selectedNpc.id) ||
      getPrimaryAsset(state, 'creature', selectedNpc.id)
    : null;

  const sceneContext = activeScene
    ? [
        `Campagne active: ${activeCampaign?.title || 'Aucune'}`,
        `Scène active: ${activeScene.title || 'Sans titre'}`,
        `Type de scène: ${activeScene.type || 'non défini'}`,
        `Résumé: ${activeScene.summary || 'aucun résumé'}`,
        `Contexte: ${
          activeScene.expanded?.setting ||
          activeScene.expanded?.readAloud ||
          activeCampaign?.premise ||
          ''
        }`,
      ].join('\n')
    : 'Aucune scène active.';

  function getThreadTitle({ mode, speakerName, sceneTitle }) {
    if (mode === 'npc') {
      return `${speakerName || 'PNJ'}${sceneTitle ? ' — ' + sceneTitle : ''}`;
    }

    return 'Maître du Jeu';
  }

  function makeThread({ initialMessages = [] } = {}) {
    const id = uid();

    const thread = {
      id,
      universeId: universe.id,
      mode,
      title: getThreadTitle({
        mode,
        speakerName: selectedSpeaker?.name,
        sceneTitle: activeScene?.title,
      }),
      speakerKey: mode === 'npc' ? selectedSpeaker?.key || '' : '',
      speakerName: mode === 'npc' ? selectedSpeaker?.name || '' : '',
      speakerVoice: mode === 'npc' ? selectedSpeaker?.voice || '' : '',
      npcId: mode === 'npc' ? selectedSpeaker?.npc?.id || '' : '',
      campaignId: activeCampaign?.id || '',
      campaignTitle: activeCampaign?.title || '',
      sceneId: activeScene?.id || '',
      sceneTitle: activeScene?.title || '',
      messages: initialMessages,
      createdAt: now(),
      updatedAt: now(),
    };

    dispatch({ type: 'ADD_CHAT_THREAD', thread });
    setActiveThreadId(id);

    return thread;
  }

  // Vrai si le locuteur courant peut parler ; sinon un message l'explique.
  function canSpeakNow() {
    if (mode !== 'npc' || !selectedSpeaker) return true;
    if (speaksByName(selectedSpeaker.name || '', faunaSet, selectedNpc)) return true;
    flash(`${selectedSpeaker.name} ne parle pas : c'est de la faune.`);
    return false;
  }

  async function playLine(text, idx) {
    if (!canSpeakNow()) return;
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(-1);
      return;
    }
    if (!ai.elevenKey) {
      flash('Ajoute une clé ElevenLabs dans Réglages pour écouter.');
      setSettingsOpen(true);
      return;
    }
    try {
      setPlayingIdx(idx);
      const profile = resolveVoiceProfile({
        ...(selectedNpc || {}),
        name: selectedSpeaker?.name || '',
        voice: selectedSpeaker?.voice || '',
        description: selectedSpeaker?.description || '',
      });
      const blob = await synthesizeSpeech(text, profile, ai.elevenKey);
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingIdx(-1);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      setPlayingIdx(-1);
      flash(e.message || 'Lecture impossible.');
    }
  }

  function startNewThread() {
    const thread = makeThread();
    setActiveThreadId(thread.id);
  }

  function selectThread(thread) {
    setActiveThreadId(thread.id);
    setMode(thread.mode || 'gm');

    if (thread.campaignId) {
      setActiveCampaignId(thread.campaignId);
    }

    if (thread.sceneId) {
      setActiveSceneId(thread.sceneId);
    }

    if (thread.speakerKey) {
      setSelectedSpeakerKey(thread.speakerKey);
    }
  }

  function deleteThread(threadId) {
    if (!confirm('Supprimer cette conversation ?')) return;

    dispatch({ type: 'DELETE_CHAT_THREAD', id: threadId });

    if (activeThreadId === threadId) {
      const next = chatThreads.find((t) => t.id !== threadId);
      setActiveThreadId(next?.id || '');
    }
  }

  function findThreadForNpc(option) {
    return chatThreads.find(
      (t) =>
        t.mode === 'npc' &&
        t.speakerKey === option.key &&
        t.sceneId === activeScene?.id
    );
  }

  function findLatestGmThread() {
    return chatThreads.find((t) => t.mode === 'gm') || null;
  }

  function systemPrompt() {
    const base = `Univers: ${universe.name}. Ton: ${universe.tone}. Canon: ${universe.lore}. Groupe: ${partyBlurb}.`;

    if (mode === 'npc') {
      return `${base}
  ${FAUNA_RULE}
  
  Tu INCARNES le PNJ suivant:
  Nom: ${selectedSpeaker?.name || 'PNJ de la scène courante'}
  Voix / style: ${selectedSpeaker?.voice || 'Voix non définie'}
  Description: ${selectedSpeaker?.description || 'Non définie'}
  Motivation: ${selectedNpc?.motivation || 'Non définie'}
  Secret: ${selectedNpc?.secret || 'Non défini'}
  Attitude: ${selectedNpc?.attitude || 'Non définie'}
  
  Contexte de jeu:
  ${sceneContext}
  
  Règles de réponse:
  - Réponds en français.
  - Réponds uniquement dans la voix du PNJ.
  - Donne une réplique jouable à la table.
  - Reste bref, vivant et naturel.
  - Si utile, ajoute une courte indication de jeu entre [crochets].
  - Respecte les tics de langage sans les exagérer.
  - Un gobelin peut être nerveux, hésitant et opportuniste.
  - Un serpent peut allonger certains “s”.
  - Une créature ancienne parle lentement, avec gravité.
  - Un noble parle de façon formelle et contrôlée.`;
    }

    return `${base}
  
  Tu es un assistant Maître du Jeu D&D 5e.
  Aide à créer et raffiner campagnes, scènes, énigmes, PNJ et monstres.
  Sois concret, structuré et prêt à jouer.`;
  }

  async function send() {
    if (!canSpeakNow()) return;
    const text = input.trim();
    if (!text || busy) return;

    if (!ai.apiKey) {
      flash("Configure l'IA dans Réglages d'abord.");
      setSettingsOpen(true);
      return;
    }

    let thread = activeThread;

    if (!thread) {
      thread = makeThread();
    }

    const userMessage = {
      id: uid(),
      role: 'user',
      content: text,
      createdAt: now(),
    };

    const history = [...(thread.messages || []), userMessage];

    dispatch({
      type: 'UPDATE_CHAT_THREAD',
      id: thread.id,
      patch: {
        messages: history,
        title:
          thread.title ||
          getThreadTitle({
            mode,
            speakerName: selectedSpeaker?.name,
            sceneTitle: activeScene?.title,
          }),
        mode,
        speakerKey: mode === 'npc' ? selectedSpeaker?.key || '' : '',
        speakerName: mode === 'npc' ? selectedSpeaker?.name || '' : '',
        speakerVoice: mode === 'npc' ? selectedSpeaker?.voice || '' : '',
        npcId: mode === 'npc' ? selectedSpeaker?.npc?.id || '' : '',
        campaignId: activeCampaign?.id || '',
        campaignTitle: activeCampaign?.title || '',
        sceneId: activeScene?.id || '',
        sceneTitle: activeScene?.title || '',
      },
    });

    setInput('');
    setBusy(true);

    try {
      const out = await callAIMessages(
        ai,
        [
          { role: 'system', content: systemPrompt() },
          ...history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        false
      );

      const assistantMessage = {
        id: uid(),
        role: 'assistant',
        content: out,
        createdAt: now(),
      };

      dispatch({
        type: 'UPDATE_CHAT_THREAD',
        id: thread.id,
        patch: {
          messages: [...history, assistantMessage],
        },
      });
    } catch (e) {
      dispatch({
        type: 'UPDATE_CHAT_THREAD',
        id: thread.id,
        patch: {
          messages: [
            ...history,
            {
              id: uid(),
              role: 'assistant',
              content: '⚠ ' + e.message,
              createdAt: now(),
            },
          ],
        },
      });
    }

    setBusy(false);
  }

  const quick =
    mode === 'gm'
      ? [
          'Propose 3 accroches de campagne pour cet univers.',
          'Crée un PNJ marquant avec un secret.',
          'Donne-moi une énigme adaptée au groupe.',
        ]
      : [
          'Le joueur dit : « Qui es-tu, vraiment ? »',
          "Le joueur tente de t'intimider.",
          "Le joueur t'offre de l'or pour des informations.",
        ];

  return (
    <>
      <h1 className="view">Générateur</h1>
      <p className="sub">
        Discute avec l'IA pour bâtir et raffiner. En mode <b>Voix de PNJ</b>,
        sélectionne une campagne, une scène, puis clique sur le portrait du PNJ
        à incarner.
      </p>

      <div className="panel">
        <div className="generator-mode-row">
          <button
            className={'btn sm' + (mode === 'gm' ? ' primary' : ' ghost')}
            onClick={() => {
              setMode('gm');
              const existing = findLatestGmThread();
              setActiveThreadId(existing?.id || '');
            }}
          >
            Maître du jeu
          </button>

          <button
            className={'btn sm' + (mode === 'npc' ? ' primary' : ' ghost')}
            onClick={() => {
              setMode('npc');
              setActiveThreadId('');
            }}
          >
            Voix de PNJ
          </button>

          {mode === 'npc' && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                className={'btn sm' + (ai.voiceOutput !== 'generate' ? ' primary' : ' ghost')}
                onClick={() => setAI({ voiceOutput: 'self' })}
              >
                Je lis moi-même
              </button>
              <button
                className={'btn sm' + (ai.voiceOutput === 'generate' ? ' primary' : ' ghost')}
                onClick={() => setAI({ voiceOutput: 'generate' })}
              >
                Générer le son
              </button>
            </div>
          )}
        </div>

        {mode === 'npc' && (
          <div className="npc-generator-panel">
            <div className="npc-generator-controls">
              <Field label="Campagne active">
                <select
                  className="in"
                  value={activeCampaign?.id || ''}
                  onChange={(e) => {
                    const next = campaigns.find((c) => c.id === e.target.value);
                    setActiveCampaignId(e.target.value);
                    setActiveSceneId(next?.scenes?.[0]?.id || '');
                  }}
                >
                  {campaigns.length === 0 ? (
                    <option value="">Aucune campagne</option>
                  ) : (
                    campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))
                  )}
                </select>
              </Field>

              <Field label="Scène active">
                <select
                  className="in"
                  value={activeScene?.id || ''}
                  onChange={(e) => {
                    setActiveSceneId(e.target.value);

                    const existing = chatThreads.find(
                      (t) =>
                        t.mode === mode &&
                        t.sceneId === e.target.value &&
                        (!selectedSpeaker?.key ||
                          t.speakerKey === selectedSpeaker.key)
                    );

                    setActiveThreadId(existing?.id || '');
                  }}
                >
                  {!activeCampaign?.scenes?.length ? (
                    <option value="">Aucune scène</option>
                  ) : (
                    activeCampaign.scenes.map((sc, i) => (
                      <option key={sc.id} value={sc.id}>
                        {i + 1}. {sc.title}
                      </option>
                    ))
                  )}
                </select>
              </Field>
            </div>

            <div className="npc-generator-scene-note">
              {activeScene ? (
                <>
                  <b>{activeScene.title}</b>
                  <span>
                    {activeScene.summary ||
                      activeScene.expanded?.setting ||
                      'Aucun résumé de scène.'}
                  </span>
                </>
              ) : (
                <span>Choisis une scène pour limiter les PNJ disponibles.</span>
              )}
            </div>

            <div className="npc-pill-grid">
              {npcOptions.length === 0 ? (
                <div className="npc-pill-empty">
                  Aucun PNJ trouvé pour cette scène. Développe la scène dans
                  Campaigns ou crée des PNJ dans NPCs & Monsters.
                </div>
              ) : (
                npcOptions.map((option) => (
                  <NpcVoicePill
                    key={option.key}
                    option={option}
                    state={state}
                    selected={selectedSpeaker?.key === option.key}
                    onClick={() => {
                      setSelectedSpeakerKey(option.key);

                      const existing = findThreadForNpc(option);
                      setActiveThreadId(existing?.id || '');
                    }}
                  />
                ))
              )}
            </div>

            {selectedSpeaker && (
              <div className="npc-selected-card">
                <div>
                  {selectedPortrait ? (
                    <img
                      src={selectedPortrait.dataUrl}
                      alt={selectedPortrait.name || selectedSpeaker.name}
                      onClick={() =>
                        window.open(
                          selectedPortrait.dataUrl,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      title="Cliquer pour ouvrir l'image"
                    />
                  ) : (
                    <PortraitToken
                      seed={selectedSpeaker.name + selectedSpeaker.voice}
                      size={54}
                    />
                  )}
                </div>

                <div>
                  <b>{selectedSpeaker.name}</b>
                  <span>{selectedSpeaker.voice}</span>
                  <p>{selectedSpeaker.description}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!ai.apiKey && (
          <div className="warnbar">
            Aucune clé IA.{' '}
            <span
              style={{
                color: 'var(--gold-lt)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => setSettingsOpen(true)}
            >
              Ouvre les Réglages
            </span>{' '}
            pour activer la discussion.
          </div>
        )}

        <div className="generator-chat-layout">
          <ChatThreadSidebar
            threads={chatThreads}
            activeThreadId={activeThread?.id || ''}
            onSelect={selectThread}
            onDelete={deleteThread}
            onNew={startNewThread}
          />

          <div className="generator-chat-main">
            <div className="chatwrap">
              <div className="chatlog" ref={logRef}>
                {msgs.length === 0 && (
                  <div className="empty" style={{ padding: '20px 0' }}>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      {activeThread
                        ? 'Cette conversation est vide.'
                        : mode === 'npc' && selectedSpeaker
                        ? `Nouvelle conversation avec : ${selectedSpeaker.name}`
                        : 'Nouvelle conversation avec le Maître du Jeu'}
                    </div>

                    <div
                      className="row"
                      style={{ justifyContent: 'center', flexWrap: 'wrap' }}
                    >
                      {quick.map((q, i) => (
                        <button
                          key={i}
                          className="btn ghost sm"
                          style={{ flex: 'none' }}
                          onClick={() => setInput(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={'msg ' + (m.role === 'user' ? 'user' : 'ai')}
                  >
                    {m.content}
                    {mode === 'npc' && m.role !== 'user' && ai.voiceOutput === 'generate' && (
                      <div>
                        <button
                          className="btn ghost sm"
                          style={{ flex: 'none', marginTop: 6 }}
                          onClick={() => playLine(m.content, i)}
                          title="Écouter avec la voix du PNJ"
                        >
                          {playingIdx === i ? '■ Stop' : '▶ Écouter'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {busy && (
                  <div className="msg ai">
                    <Spin /> …
                  </div>
                )}
              </div>

              <div className="chatbar">
                <textarea
                  className="in"
                  value={input}
                  placeholder={
                    mode === 'npc'
                      ? `Ce que dit / fait le joueur à ${
                          selectedSpeaker?.name || 'ce PNJ'
                        }…`
                      : 'Ta demande au Maître du jeu…'
                  }
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />

                <button
                  className="btn primary"
                  style={{ flex: 'none' }}
                  disabled={busy}
                  onClick={send}
                >
                  {busy ? <Spin /> : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
function ChatThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onDelete,
  onNew,
}) {
  const gmThreads = threads.filter((t) => t.mode === 'gm');
  const npcThreads = threads.filter((t) => t.mode === 'npc');

  return (
    <aside className="chat-thread-sidebar">
      <div className="chat-thread-head">
        <div>
          <b>Conversations</b>
          <span>
            {threads.length} fil{threads.length > 1 ? 's' : ''}
          </span>
        </div>

        <button
          type="button"
          className="chat-thread-new"
          onClick={onNew}
          title="Nouvelle conversation"
        >
          +
        </button>
      </div>

      {threads.length === 0 ? (
        <div className="chat-thread-empty">
          Aucune conversation encore. Écris au MJ ou à un PNJ pour commencer.
        </div>
      ) : (
        <>
          {gmThreads.length > 0 && (
            <ChatThreadGroup
              title="Maître du Jeu"
              threads={gmThreads}
              activeThreadId={activeThreadId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          )}

          {npcThreads.length > 0 && (
            <ChatThreadGroup
              title="PNJ"
              threads={npcThreads}
              activeThreadId={activeThreadId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          )}
        </>
      )}
    </aside>
  );
}

function ChatThreadGroup({
  title,
  threads,
  activeThreadId,
  onSelect,
  onDelete,
}) {
  return (
    <div className="chat-thread-group">
      <div className="chat-thread-group-title">{title}</div>

      {threads.map((thread) => (
        <ChatThreadButton
          key={thread.id}
          thread={thread}
          active={thread.id === activeThreadId}
          onSelect={() => onSelect(thread)}
          onDelete={() => onDelete(thread.id)}
        />
      ))}
    </div>
  );
}

function ChatThreadButton({ thread, active, onSelect, onDelete }) {
  const lastMessage =
    thread.messages?.[thread.messages.length - 1]?.content ||
    'Nouvelle conversation';
  const count = thread.messages?.length || 0;

  return (
    <div className="chat-thread-row" data-on={active ? 1 : 0}>
      <button type="button" className="chat-thread-button" onClick={onSelect}>
        <span className="chat-thread-title">
          {thread.title || thread.speakerName || 'Conversation'}
        </span>

        <span className="chat-thread-meta">
          {thread.sceneTitle ||
            thread.campaignTitle ||
            (thread.mode === 'gm' ? 'MJ' : 'PNJ')}
        </span>

        <span className="chat-thread-preview">
          {lastMessage.slice(0, 78)}
          {lastMessage.length > 78 ? '…' : ''}
        </span>

        <span className="chat-thread-count">
          {count} message{count > 1 ? 's' : ''}
        </span>
      </button>

      <button
        type="button"
        className="chat-thread-delete"
        onClick={onDelete}
        title="Supprimer cette conversation"
      >
        ×
      </button>
    </div>
  );
}

function NpcVoicePill({ option, state, selected, onClick }) {
  const portrait = option.npc
    ? getPrimaryAsset(state, 'npc', option.npc.id) ||
      getPrimaryAsset(state, 'creature', option.npc.id)
    : null;

  return (
    <button
      type="button"
      className="npc-voice-pill"
      data-on={selected ? 1 : 0}
      onClick={onClick}
      title={option.voice || option.name}
    >
      <span className="npc-voice-portrait">
        {portrait ? (
          <img src={portrait.dataUrl} alt={portrait.name || option.name} />
        ) : (
          <PortraitToken seed={option.name + option.voice} size={64} />
        )}
      </span>

      <span className="npc-voice-name">{option.name}</span>
      <span className="npc-voice-role">
        {option.npc?.kind || option.npc?.role || 'Scène'}
      </span>
    </button>
  );
}

function normalizeName(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
function SceneRunner({
  state,
  dispatch,
  universe,
  party,
  campaigns,
  npcs,
  quests,
  flash,
  setView,
}) {
  const { ai } = useContext(AIContext);

  // Campagne et scène actives conservées pendant la session : on les retrouve en revenant de la carte de combat.
  const remembered = (key) => {
    try {
      return sessionStorage.getItem(key) || '';
    } catch {
      return '';
    }
  };
  const [activeCampaignId, setActiveCampaignId] = useState(
    () => remembered('loresmith:scene-campaign') || campaigns[0]?.id || ''
  );
  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  const [activeSceneId, setActiveSceneId] = useState(
    () => remembered('loresmith:scene-id') || activeCampaign?.scenes?.[0]?.id || ''
  );
  useEffect(() => {
    try {
      sessionStorage.setItem('loresmith:scene-campaign', activeCampaignId || '');
      sessionStorage.setItem('loresmith:scene-id', activeSceneId || '');
    } catch {
      /* stockage indisponible */
    }
  }, [activeCampaignId, activeSceneId]);

  useEffect(() => {
    if (!activeCampaign && campaigns[0]) {
      setActiveCampaignId(campaigns[0].id);
      setActiveSceneId(campaigns[0].scenes?.[0]?.id || '');
      return;
    }

    if (
      activeCampaign &&
      !activeCampaign.scenes?.some((sc) => sc.id === activeSceneId)
    ) {
      setActiveSceneId(activeCampaign.scenes?.[0]?.id || '');
    }
  }, [activeCampaignId, activeSceneId, campaigns]);

  const activeScene =
    activeCampaign?.scenes?.find((sc) => sc.id === activeSceneId) ||
    activeCampaign?.scenes?.[0] ||
    null;

  const expanded = activeScene?.expanded || null;

  const sceneDialogues = expanded?.dialogues || activeScene?.dialogues || [];

  const sceneNotes =
    activeScene?.dmNotes ||
    expanded?.dmNotes ||
    expanded?.setting ||
    activeScene?.summary ||
    '';

  const readAloud =
    expanded?.readAloud ||
    activeScene?.readAloud ||
    activeCampaign?.hook ||
    'Choisis une campagne, puis une scène. Développe la scène pour générer un texte à lire à voix haute.';

  const setting =
    expanded?.setting ||
    activeScene?.summary ||
    activeCampaign?.premise ||
    universe.lore;

  const activeCampaignImages = activeCampaign
    ? getAssetsFor(state, 'campaign', activeCampaign.id)
    : [];

  const activeSceneImages = activeScene
    ? getAssetsFor(state, 'scene', activeScene.id)
    : [];

  const sceneImages =
    activeSceneImages.length > 0 ? activeSceneImages : activeCampaignImages;

  const mainSceneImage = sceneImages[0] || null;

  const sceneNpcRows = getSceneNpcRows({
    expanded,
    activeScene,
    npcs,
  });

  const sceneMonsterRows = getSceneMonsterRows({
    expanded,
    activeScene,
    npcs,
  });

  const featuredNpc = sceneNpcRows[0]?.npc || sceneNpcRows[0] || null;

  const featuredNpcVoice =
    featuredNpc?.voice ||
    sceneDialogues.find((d) => d.speaker === featuredNpc?.name)?.voice ||
    'Voix non définie';

  const [entityModal, setEntityModal] = useState(null);

  const combatants = state.combat?.combatants || [];

  const [dialoguePrompt, setDialoguePrompt] = useState('');
  const [dialogueBusy, setDialogueBusy] = useState(false);
  const [liveDialogue, setLiveDialogue] = useState('');

  async function generateSceneDialogue() {
    if (!dialoguePrompt.trim()) return;

    setDialogueBusy(true);
    setLiveDialogue('');

    try {
      const out = await callAI(ai, {
        json: false,
        system: `Tu es un assistant de jeu de rôle. Réponds en français. Écris uniquement le dialogue ou la courte réponse de mise en scène. Le ton doit respecter l'espèce, le statut, l'émotion et la personnalité du personnage. Un gobelin hésite, bégaie et panique un peu. Un serpent allonge parfois les s. Une créature-grenouille peut dire "croa" légèrement, sans exagérer.`,
        prompt: `Univers: ${universe.name}
Canon: ${universe.lore}

Campagne: ${activeCampaign?.title || 'Aucune'}
Scène: ${activeScene?.title || 'Aucune'}
Contexte de scène: ${setting}

Personnage qui parle: ${featuredNpc?.name || 'PNJ inconnu'}
Voix / style: ${featuredNpcVoice}
Motivation: ${featuredNpc?.motivation || 'inconnue'}
Secret: ${featuredNpc?.secret || 'inconnu'}
Attitude: ${featuredNpc?.attitude || 'inconnue'}

Demande du MJ:
${dialoguePrompt}

Réponds uniquement avec une ou deux répliques en français que ce personnage pourrait dire maintenant. Ne décris pas le personnage. N'explique pas.`,
      });

      setLiveDialogue(out);
    } catch (e) {
      flash(e.message);
    }

    setDialogueBusy(false);
  }

  return (
    <div className="scene-shell">
      <aside className="scene-left">
        <div className="scene-card compass-card">
          <div className="scene-label">Univers</div>
          <div className="scene-select">{universe.name}</div>
        </div>

        <div className="scene-card campaign-panel">
          <div className="scene-label">Campagne</div>

          {campaigns.length > 0 ? (
            <select
              className="in"
              value={activeCampaign?.id || ''}
              onChange={(e) => {
                const next = campaigns.find((c) => c.id === e.target.value);
                setActiveCampaignId(e.target.value);
                setActiveSceneId(next?.scenes?.[0]?.id || '');
              }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : (
            <p className="scene-muted">Aucune campagne pour l’instant.</p>
          )}

          <p>
            {activeCampaign
              ? activeCampaign.premise
              : 'Génère une aventure pour commencer.'}
          </p>
        </div>

        <div className="scene-card">
          <div className="scene-label">Scènes</div>

          {!activeCampaign?.scenes?.length ? (
            <p className="scene-muted">Aucune scène.</p>
          ) : (
            <div className="scene-list">
              {activeCampaign.scenes.map((sc, index) => (
                <button
                  key={sc.id}
                  data-on={activeScene?.id === sc.id ? 1 : 0}
                  onClick={() => setActiveSceneId(sc.id)}
                >
                  <b>Étape {index + 1}</b> — {sc.title}
                  <br />
                  <span>{sc.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="scene-card">
          <div className="scene-label">Groupe ({party.length})</div>

          {party.length === 0 ? (
            <p className="scene-muted">Aucun personnage.</p>
          ) : (
            party.slice(0, 5).map((p) => (
              <div className="scene-party-row" key={p.id}>
                {getPrimaryAsset(state, 'player', p.id) ? (
                  <img
                    className="scene-mini-portrait"
                    src={getPrimaryAsset(state, 'player', p.id).dataUrl}
                    alt={p.name}
                  />
                ) : (
                  <PortraitToken seed={p.name + p.cls} size={38} />
                )}

                <div>
                  <b>{p.name}</b>
                  <span>
                    {p.race} · {p.cls}
                  </span>
                </div>

                <em>Lv. {p.level}</em>
              </div>
            ))
          )}

          <button className="scene-mini-btn" onClick={() => setView('party')}>
            Voir les fiches
          </button>
        </div>
      </aside>

      <main className="scene-main">
        <div className="scene-titlebar">
          <h1>{activeScene ? activeScene.title : 'Table de jeu'}</h1>
          <div className="scene-pill">
            {activeScene ? activeScene.type : 'Aucune scène'}
          </div>
        </div>

        <section className="readaloud-panel">
          <div className="scene-label dark">À lire aux joueurs</div>

          {mainSceneImage && (
            <div className="readaloud-banner-wrap">
              <img
                className="readaloud-banner"
                src={mainSceneImage.dataUrl}
                alt={mainSceneImage.name}
                title="Cliquer pour ouvrir l'image dans un nouvel onglet"
                onClick={() =>
                  window.open(
                    mainSceneImage.dataUrl,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              />

              {sceneImages.length > 1 && (
                <div className="readaloud-thumbs">
                  {sceneImages.slice(0, 8).map((img) => (
                    <img
                      key={img.id}
                      src={img.dataUrl}
                      alt={img.name}
                      title="Cliquer pour ouvrir cette image"
                      onClick={() =>
                        window.open(
                          img.dataUrl,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="readaloud-text">
            <p>{readAloud}</p>
          </div>
        </section>

        <DmCopilot
          key={activeScene?.id || 'none'}
          readAloud={readAloud}
          checks={expanded?.skillChecks || []}
          branches={expanded?.branches || []}
          hasMonsters={getSceneMonsterRows({ expanded, activeScene, npcs }).length > 0}
          onOpenCombat={() => {
            // Le combat se mène sur la carte de combat de la carte de jeu ; à défaut, sur l’ancienne page.
            const mapId = tableMapId(state.maps || {}, universe?.id);
            if (mapId) { setMapIntent({ mapId, battle: true }); setView('maps'); } else setView('encounter');
          }}
        />

        <TableMap
          maps={state.maps || {}}
          universeId={universe?.id}
          heroes={party}
          dispatch={dispatch}
          onOpenMaps={() => setView('maps')}
          campaign={activeCampaign}
          scene={activeScene?.title}
        />

        <div className="scene-grid-dialogue">
          <section className="scene-card scene-dialogue-card">
            <div className="scene-label">Dialogues de scène</div>

            <div className="scene-dialogue-list">
              {sceneDialogues.length > 0 ? (
                sceneDialogues.map((d, i) => (
                  <SceneDialogueItem
                    key={i}
                    dialogue={d}
                    index={i}
                    state={state}
                    npcs={npcs}
                  />
                ))
              ) : (
                <div className="scene-dialogue-empty">
                  <div className="scene-dialogue-empty-title">
                    Aucun dialogue préparé
                  </div>
                  <p>
                    Développe la scène dans l’onglet Campaigns pour générer des
                    pistes de répliques.
                  </p>
                </div>
              )}
            </div>
            <div className="scene-dialogue-prompt">
              <Field label="Inspirer une réponse improvisée">
                <textarea
                  className="in"
                  value={dialoguePrompt}
                  onChange={(e) => setDialoguePrompt(e.target.value)}
                  placeholder="Ex. Les aventuriers demandent pourquoi le gobelin bloque la route. Réponds avec sa nervosité, ses mensonges et sa peur."
                />
              </Field>

              <button
                className="scene-mini-btn"
                disabled={dialogueBusy}
                onClick={generateSceneDialogue}
              >
                {dialogueBusy ? 'Génération...' : 'Générer une réponse'}
              </button>

              {liveDialogue && (
                <div className="scene-dialogue-line" style={{ marginTop: 10 }}>
                  <small>Réponse improvisée</small>
                  {liveDialogue}
                </div>
              )}
            </div>
          </section>

          <section className="scene-card large">
            <div className="scene-label">Notes MJ éditables</div>

            <div className="scene-notes-stack">
              <textarea
                className="scene-notes-textarea"
                value={sceneNotes}
                onChange={(e) => {
                  if (!activeCampaign || !activeScene) return;

                  dispatch({
                    type: 'UPDATE_SCENE',
                    cid: activeCampaign.id,
                    sid: activeScene.id,
                    patch: { dmNotes: e.target.value },
                  });
                }}
                placeholder="Notes utiles pour jouer cette scène : intentions des PNJ, détails secrets, informations à révéler, dangers, ambiance..."
              />

              <SceneSkillChecks checks={expanded?.skillChecks || []} />

              <SceneOutcomes
                branches={expanded?.branches || []}
                flash={flash}
              />
            </div>
          </section>
        </div>

        <section className="scene-card combat-table-card">
          <div className="combat-head">
            <div className="scene-label">Combat Tracker</div>
            <button
              className="scene-mini-btn"
              onClick={() => setView('encounter')}
            >
              Ouvrir Combat
            </button>
          </div>

          {combatants.length === 0 ? (
            <p className="scene-muted">
              Aucun combattant. Ajoute-les dans Combat.
            </p>
          ) : (
            <table className="scene-combat-table">
              <thead>
                <tr>
                  <th>Init</th>
                  <th>Nom</th>
                  <th>HP</th>
                  <th>AC</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {combatants.map((c) => (
                  <tr key={c.id}>
                    <td>{c.init}</td>
                    <td>{c.name}</td>
                    <td>
                      {c.hp}/{c.maxHp}
                    </td>
                    <td>{c.ac}</td>
                    <td>{c.isPC ? 'PJ' : 'Menace'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <aside className="scene-right">
        <div className="scene-card">
          <div className="scene-label">Quest Log</div>

          {quests.length === 0 ? (
            <p className="scene-muted">Aucune quête.</p>
          ) : (
            quests.slice(0, 4).map((q) => (
              <div className="quest-mini" key={q.id}>
                <b>{q.title}</b>
                {(q.checkpoints || []).slice(0, 3).map((cp) => (
                  <span key={cp.id}>
                    {cp.done ? '☑' : '☐'} {cp.text}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="scene-card">
          <div className="scene-label">Choix / Branches</div>

          {expanded?.branches?.length > 0 ? (
            <div className="scene-list">
              {expanded.branches.map((b, i) => (
                <button
                  key={i}
                  onClick={() => flash('Branche sélectionnée : ' + b.then)}
                >
                  <b>Choix {i + 1}</b>
                  <br />
                  {b.if}
                </button>
              ))}
            </div>
          ) : (
            <p className="scene-muted">
              Développe la scène pour voir les choix possibles.
            </p>
          )}
        </div>

        <SceneEntityList
          title="NPCs de la scène"
          type="npc"
          items={sceneNpcRows}
          state={state}
          emptyText="Aucun PNJ n’est encore associé à cette scène. Développe la scène dans Campaigns ou ajoute des dialogues avec des noms de PNJ."
          onOpen={setEntityModal}
        />

        <SceneEntityList
          title="Monstres prévus"
          type="monster"
          items={sceneMonsterRows}
          state={state}
          emptyText="Aucun monstre prévu pour cette scène. Les monstres affichés ici viennent des encounters de la scène."
          onOpen={setEntityModal}
        />

        <button className="end-turn">Fin du tour</button>
      </aside>

      {entityModal && (
        <SceneEntityModal
          entity={entityModal}
          state={state}
          onClose={() => setEntityModal(null)}
        />
      )}
    </div>
  );
}
function SceneDialogueItem({ dialogue, index, state, npcs }) {
  const [open, setOpen] = useState(index === 0);

  const speakerName = dialogue?.speaker || 'PNJ inconnu';
  const situation = dialogue?.situation || dialogue?.nature || 'dialogue';
  const voice = dialogue?.voice || '';

  const npc =
    npcs.find((n) => n.name?.toLowerCase() === speakerName.toLowerCase()) ||
    npcs.find((n) =>
      speakerName.toLowerCase().includes(n.name?.toLowerCase())
    ) ||
    npcs.find((n) =>
      n.name?.toLowerCase().includes(speakerName.toLowerCase())
    ) ||
    null;

  const portrait = npc
    ? getPrimaryAsset(state, 'npc', npc.id) ||
      getPrimaryAsset(state, 'creature', npc.id)
    : null;

  const label = normalizeDialogueNature(situation);

  return (
    <div className="scene-dialogue-collapsible" data-open={open ? 1 : 0}>
      <button
        type="button"
        className="scene-dialogue-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scene-dialogue-toggle-icon">
          {portrait ? (
            <img
              src={portrait.dataUrl}
              alt={portrait.name || speakerName}
              title="Cliquer pour ouvrir l'image"
              onClick={(e) => {
                e.stopPropagation();
                window.open(portrait.dataUrl, '_blank', 'noopener,noreferrer');
              }}
            />
          ) : (
            <PortraitToken seed={speakerName + voice} size={52} />
          )}
        </span>

        <span className="scene-dialogue-toggle-main">
          <span className="scene-dialogue-toggle-name">{speakerName}</span>
          <span className="scene-dialogue-toggle-meta">
            {label}
            {voice ? ` · ${voice}` : ''}
          </span>
        </span>

        <span className="scene-dialogue-chevron">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="scene-dialogue-body">
          <p>« {dialogue?.text || 'Réplique à compléter.'} »</p>
        </div>
      )}
    </div>
  );
}

function normalizeDialogueNature(value) {
  const raw = (value || '').toString().trim().toLowerCase();

  const labels = {
    'première rencontre': 'Première rencontre',
    'mise en garde': 'Mise en garde',
    mensonge: 'Mensonge',
    peur: 'Peur',
    menace: 'Menace',
    "demande d'aide": 'Appel à l’aide',
    "appel à l'aide": 'Appel à l’aide',
    bienvenue: 'Bienvenue',
    provocation: 'Provocation',
    indice: 'Indice',
    'indice de quête': 'Indice de quête',
    sidequest: 'Side quest',
    'quête secondaire': 'Quête secondaire',
    révélation: 'Révélation',
    marchandage: 'Marchandage',
    avertissement: 'Avertissement',
  };

  return labels[raw] || value || 'Dialogue';
}
function SceneSkillChecks({ checks }) {
  if (!checks || checks.length === 0) {
    return (
      <div className="scene-play-block">
        <div className="scene-play-block-head">
          <span className="scene-play-icon">✦</span>
          <div>
            <b>Skill Checks suggérés</b>
            <small>À préparer dans l’onglet Campaigns.</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-play-block">
      <div className="scene-play-block-head">
        <span className="scene-play-icon">✦</span>
        <div>
          <b>Skill Checks suggérés</b>
          <small>
            {checks.length} test{checks.length > 1 ? 's' : ''} disponible
            {checks.length > 1 ? 's' : ''}
          </small>
        </div>
      </div>

      <div className="scene-check-list">
        {checks.map((check, i) => (
          <SceneSkillCheckItem key={i} check={check} index={i} />
        ))}
      </div>
    </div>
  );
}

function SceneSkillCheckItem({ check, index }) {
  const [open, setOpen] = useState(false);

  const skillName = check?.check || 'Test';
  const dc = check?.dc || '?';
  const success = check?.on_success || check?.success || 'Succès à définir.';
  const failure = check?.on_failure || check?.failure || 'Échec à définir.';

  return (
    <div className="scene-check-card" data-open={open ? 1 : 0}>
      <button
        type="button"
        className="scene-check-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scene-check-number">{index + 1}</span>

        <span className="scene-check-main">
          <span className="scene-check-name">{skillName}</span>
          <span className="scene-check-hint">
            Cliquer pour voir succès / échec
          </span>
        </span>

        <span className="scene-dc-badge">DD {dc}</span>
        <span className="scene-check-open">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="scene-check-details">
          <div className="scene-result success">
            <span>✓</span>
            <div>
              <b>Succès</b>
              <p>{success}</p>
            </div>
          </div>

          <div className="scene-result failure">
            <span>!</span>
            <div>
              <b>Échec</b>
              <p>{failure}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SceneOutcomes({ branches, flash }) {
  if (!branches || branches.length === 0) {
    return (
      <div className="scene-play-block">
        <div className="scene-play-block-head">
          <span className="scene-play-icon">◆</span>
          <div>
            <b>Outcomes potentiels</b>
            <small>À construire dans l’onglet Campaigns.</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-play-block">
      <div className="scene-play-block-head">
        <span className="scene-play-icon">◆</span>
        <div>
          <b>Outcomes potentiels</b>
          <small>
            {branches.length} branche{branches.length > 1 ? 's' : ''} narrative
            {branches.length > 1 ? 's' : ''}
          </small>
        </div>
      </div>

      <div className="scene-outcome-cards">
        {branches.map((branch, i) => (
          <SceneOutcomeItem key={i} branch={branch} index={i} flash={flash} />
        ))}
      </div>
    </div>
  );
}

function SceneOutcomeItem({ branch, index, flash }) {
  const [open, setOpen] = useState(false);

  const condition = branch?.if || 'Si les héros font un choix important…';
  const outcome = branch?.then || 'Conséquence à définir.';

  return (
    <div className="scene-outcome-card" data-open={open ? 1 : 0}>
      <button
        type="button"
        className="scene-outcome-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scene-outcome-icon">◇</span>

        <span className="scene-outcome-main">
          <span className="scene-outcome-title">Branche {index + 1}</span>
          <span className="scene-outcome-condition">{condition}</span>
        </span>

        <span className="scene-check-open">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="scene-outcome-details">
          <div className="scene-arrow">→</div>
          <p>{outcome}</p>

          <button
            type="button"
            className="scene-outcome-action"
            onClick={() => flash && flash('Outcome sélectionné : ' + outcome)}
          >
            Marquer comme direction choisie
          </button>
        </div>
      )}
    </div>
  );
}
function SceneEntityList({ title, type, items, state, emptyText, onOpen }) {
  return (
    <div className="scene-card scene-entity-card">
      <div className="scene-label">{title}</div>

      {!items || items.length === 0 ? (
        <p className="scene-muted">{emptyText}</p>
      ) : (
        <div className="scene-entity-list">
          {items.map((item, index) => (
            <SceneEntityItem
              key={item.key || item.id || item.name || index}
              item={item}
              type={type}
              state={state}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SceneEntityItem({ item, type, state, onOpen }) {
  const [open, setOpen] = useState(false);

  const isMonster = type === 'monster';
  const npc = item.npc || null;

  const portrait = npc
    ? getPrimaryAsset(state, isMonster ? 'creature' : 'npc', npc.id) ||
      getPrimaryAsset(state, isMonster ? 'npc' : 'creature', npc.id)
    : null;

  const name = item.name || npc?.name || 'Inconnu';
  const role =
    item.role || npc?.role || npc?.kind || (isMonster ? 'Menace' : 'PNJ');
  const shortDescription =
    item.note ||
    item.detail ||
    npc?.description ||
    'Aucune description courte disponible.';

  return (
    <div
      className="scene-entity-item"
      data-open={open ? 1 : 0}
      data-type={type}
    >
      <button
        type="button"
        className="scene-entity-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scene-entity-portrait">
          {portrait ? (
            <img
              src={portrait.dataUrl}
              alt={portrait.name || name}
              title="Cliquer pour ouvrir l'image"
              onClick={(e) => {
                e.stopPropagation();
                window.open(portrait.dataUrl, '_blank', 'noopener,noreferrer');
              }}
            />
          ) : (
            <PortraitToken seed={name + role} size={46} />
          )}
        </span>

        <span className="scene-entity-main">
          <span className="scene-entity-name">{name}</span>
          <span className="scene-entity-role">{role}</span>
        </span>

        <span className="scene-entity-chevron">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="scene-entity-details">
          <p>{shortDescription}</p>

          {!isMonster && (
            <div className="scene-entity-meta">
              {item.voice && <span>Voix : {item.voice}</span>}
              {npc?.attitude && <span>Attitude : {npc.attitude}</span>}
              {npc?.motivation && <span>Motivation : {npc.motivation}</span>}
            </div>
          )}

          {isMonster && (
            <>
              <div className="scene-monster-stats">
                <span>CR {npc?.cr || '?'}</span>
                <span>AC {npc?.ac || '?'}</span>
                <span>HP {npc?.hp || '?'}</span>
              </div>

              <div className="scene-entity-meta">
                {npc?.speed && <span>Vitesse : {npc.speed}</span>}
                {npc?.tactics && <span>Tactiques : {npc.tactics}</span>}
              </div>

              <SceneLootPreview loot={item.loot} />
            </>
          )}

          <button
            type="button"
            className="scene-entity-sheet-btn"
            onClick={() => onOpen && onOpen({ ...item, type })}
          >
            Voir la fiche complète
          </button>
        </div>
      )}
    </div>
  );
}

function SceneLootPreview({ loot }) {
  const cleanLoot = Array.isArray(loot) ? loot.filter(Boolean) : [];

  return (
    <div className="scene-loot-preview">
      <b>Loot probable</b>

      {cleanLoot.length === 0 ? (
        <p>
          Rien d’évident. Peut-être quelques objets banals, brisés ou sans
          grande valeur.
        </p>
      ) : (
        <div className="scene-loot-chips">
          {cleanLoot.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SceneEntityModal({ entity, state, onClose }) {
  const npc = entity.npc || entity;
  const isMonster = entity.type === 'monster';

  const portrait = npc?.id
    ? getPrimaryAsset(state, isMonster ? 'creature' : 'npc', npc.id) ||
      getPrimaryAsset(state, isMonster ? 'npc' : 'creature', npc.id)
    : null;

  return (
    <Modal
      title={`${isMonster ? 'Monstre' : 'PNJ'} — ${
        entity.name || npc?.name || 'Inconnu'
      }`}
      onClose={onClose}
      wide
    >
      <div className="scene-sheet-modal">
        <div className="scene-sheet-portrait-wrap">
          {portrait ? (
            <img
              className="scene-sheet-portrait"
              src={portrait.dataUrl}
              alt={portrait.name || npc?.name}
              onClick={() =>
                window.open(portrait.dataUrl, '_blank', 'noopener,noreferrer')
              }
              title="Cliquer pour ouvrir l'image"
            />
          ) : (
            <PortraitToken
              seed={(npc?.name || entity.name || 'entity') + (npc?.kind || '')}
              size={120}
            />
          )}
        </div>

        <div className="scene-sheet-content">
          <h3>{entity.name || npc?.name || 'Inconnu'}</h3>
          <p className="muted">
            {npc?.kind || npc?.role || entity.role || 'Rôle non défini'}
          </p>

          {npc?.description && (
            <div className="scene-sheet-section">
              <b>Description</b>
              <p>{npc.description}</p>
            </div>
          )}

          {!isMonster && (
            <>
              <div className="scene-sheet-section">
                <b>Jeu de rôle</b>
                <p>
                  <strong>Voix :</strong>{' '}
                  {npc?.voice || entity.voice || 'Non définie'}
                </p>
                <p>
                  <strong>Attitude :</strong> {npc?.attitude || 'Non définie'}
                </p>
                <p>
                  <strong>Motivation :</strong>{' '}
                  {npc?.motivation || 'Non définie'}
                </p>
                <p>
                  <strong>Secret :</strong> {npc?.secret || 'Non défini'}
                </p>
              </div>

              {entity.dialogues?.length > 0 && (
                <div className="scene-sheet-section">
                  <b>Répliques dans cette scène</b>
                  {entity.dialogues.map((d, i) => (
                    <p key={i}>« {d.text} »</p>
                  ))}
                </div>
              )}
            </>
          )}

          {isMonster && (
            <>
              <div className="scene-sheet-section">
                <b>Combat</b>
                <div className="scene-sheet-stats">
                  <span>CR {npc?.cr || '?'}</span>
                  <span>AC {npc?.ac || '?'}</span>
                  <span>HP {npc?.hp || '?'}</span>
                  <span>Vitesse {npc?.speed || '?'}</span>
                </div>
              </div>

              {npc?.tactics && (
                <div className="scene-sheet-section">
                  <b>Tactiques</b>
                  <p>{npc.tactics}</p>
                </div>
              )}

              {npc?.traits?.length > 0 && (
                <div className="scene-sheet-section">
                  <b>Traits</b>
                  {npc.traits.map((t, i) => (
                    <p key={i}>
                      <strong>{t.name}.</strong> {t.desc}
                    </p>
                  ))}
                </div>
              )}

              {npc?.actions?.length > 0 && (
                <div className="scene-sheet-section">
                  <b>Actions</b>
                  {npc.actions.map((a, i) => (
                    <p key={i}>
                      <strong>{a.name}.</strong> {a.desc}
                    </p>
                  ))}
                </div>
              )}

              <div className="scene-sheet-section">
                <SceneLootPreview loot={entity.loot} />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
function getSceneNpcRows({ expanded, activeScene, npcs }) {
  const dialogueRows = expanded?.dialogues || activeScene?.dialogues || [];
  const sceneNpcRows = expanded?.npcs || activeScene?.npcs || [];

  const manuallyLinkedNpcs = npcs.filter(
    (n) =>
      !n.isMonster &&
      n.entityType !== 'monster' &&
      (n.linkedSceneIds || []).includes(activeScene?.id)
  );

  const encounterNames = new Set(
    (expanded?.encounters || activeScene?.encounters || [])
      .map((e) => normalizeEntityName(typeof e === 'string' ? e : e.name))
      .filter(Boolean)
  );

  const names = uniqueClean([
    ...sceneNpcRows.map((n) => (typeof n === 'string' ? n : n.name)),
    ...dialogueRows.map((d) => d.speaker),
    ...manuallyLinkedNpcs.map((n) => n.name),
  ]);

  return names
    .filter((name) => !encounterNames.has(normalizeEntityName(name)))
    .map((name) => {
      const npc = findNpcBySceneName(npcs, name);
      const sceneInfo = sceneNpcRows.find(
        (n) =>
          normalizeEntityName(typeof n === 'string' ? n : n.name) ===
          normalizeEntityName(name)
      );

      const dialogues = dialogueRows.filter(
        (d) => normalizeEntityName(d.speaker) === normalizeEntityName(name)
      );

      return {
        key: `npc-${name}`,
        name,
        npc,
        role: npc?.role || npc?.kind || 'PNJ',
        note: typeof sceneInfo === 'string' ? '' : sceneInfo?.note,
        voice:
          npc?.voice ||
          (typeof sceneInfo === 'string' ? '' : sceneInfo?.voice) ||
          dialogues[0]?.voice ||
          '',
        dialogues,
      };
    });
}
function getSceneMonsterRows({ expanded, activeScene, npcs }) {
  const encounters = expanded?.encounters || activeScene?.encounters || [];
  const sceneLoot = expanded?.loot || activeScene?.loot || [];

  const fromEncounters = encounters
    .map((encounter, index) => {
      const name = typeof encounter === 'string' ? encounter : encounter.name;
      if (!name) return null;

      const npc = findNpcBySceneName(npcs, name);

      return {
        key: `monster-${name}-${index}`,
        name,
        npc,
        role: npc?.role || npc?.kind || 'Monstre',
        detail: typeof encounter === 'string' ? '' : encounter.detail,
        loot: normalizeEncounterLoot(encounter, sceneLoot),
      };
    })
    .filter(Boolean);

  const manuallyLinked = npcs
    .filter(
      (n) =>
        (n.isMonster || n.entityType === 'monster') &&
        (n.linkedSceneIds || []).includes(activeScene?.id)
    )
    .map((n) => ({
      key: `linked-monster-${n.id}`,
      name: n.name,
      npc: n,
      role: n.role || n.kind || 'Monstre',
      detail: n.shortDescription || n.description || '',
      loot: (n.lootTable || []).map((l) => `${l.roll}: ${l.item}`),
    }));

  const existingNames = new Set(
    fromEncounters.map((x) => normalizeEntityName(x.name))
  );

  return [
    ...fromEncounters,
    ...manuallyLinked.filter(
      (x) => !existingNames.has(normalizeEntityName(x.name))
    ),
  ];
}
function normalizeEncounterLoot(encounter, sceneLoot) {
  const encounterLoot =
    typeof encounter === 'string'
      ? []
      : Array.isArray(encounter.loot)
      ? encounter.loot
      : [];

  const combined = [...encounterLoot];

  if (
    combined.length === 0 &&
    Array.isArray(sceneLoot) &&
    sceneLoot.length > 0
  ) {
    combined.push(...sceneLoot.slice(0, 3));
  }

  return combined.filter(Boolean);
}

function findNpcBySceneName(npcs, name) {
  const clean = normalizeEntityName(name);

  return (
    npcs.find((n) => normalizeEntityName(n.name) === clean) ||
    npcs.find((n) => clean.includes(normalizeEntityName(n.name))) ||
    npcs.find((n) => normalizeEntityName(n.name).includes(clean)) ||
    null
  );
}

function normalizeEntityName(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uniqueClean(values) {
  const seen = new Set();

  return values
    .filter(Boolean)
    .map((v) => v.toString().trim())
    .filter(Boolean)
    .filter((v) => {
      const key = normalizeEntityName(v);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function InfoBlock({ title, text }) {
  return (
    <div className="info-block">
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}
const LIBRARY_TYPES = {
  artifact: {
    label: 'Artefacts',
    singular: 'Artefact',
    tone: "fiche de musée, description d'objet, provenance, rumeurs, possesseurs",
  },
  vivant: {
    label: 'Vivant',
    singular: 'Espèce',
    tone: 'fiche de bestiaire ou de flore : habitat, cycle de vie, usages, dangers, rencontres',
  },
  person: {
    label: 'Personnages',
    singular: 'Personnage',
    tone: 'profil de recueil, biographie, relations, réputation, secrets',
  },
  place: {
    label: 'Lieux',
    singular: 'Lieu',
    tone: 'atlas, géographie, ambiance, accès, dangers, histoire',
  },
  event: {
    label: 'Événements',
    singular: 'Événement',
    tone: "livre d'histoire, chronologie, causes, conséquences, témoins",
  },
  faction: {
    label: 'Factions',
    singular: 'Faction',
    tone: 'dossier politique, hiérarchie, buts, symboles, conflits',
  },
  mystery: {
    label: 'Mystères',
    singular: 'Mystère',
    tone: 'dossier interdit, hypothèses, indices, contradictions',
  },
  document: {
    label: 'Documents',
    singular: 'Document',
    tone: 'archive, extrait de texte, notes marginales, contexte de découverte',
  },
};

const KNOWLEDGE_SCHEMA = `"playerKnowledge": [
    { "dc": 0, "skill": "—", "text": "ce que tout le monde sait (rumeur, réputation)", "reveal": "comment le glisser en jeu : réplique d'un PNJ, détail du décor, document trouvé" },
    { "dc": 10, "skill": "Histoire|Arcanes|Nature|Religion|Investigation|Perspicacité|Médecine|Survie", "text": str, "reveal": str },
    { "dc": 15, "skill": str, "text": str, "reveal": str },
    { "dc": 20, "skill": str, "text": "ce que seuls les plus savants devinent (peut effleurer un secret)", "reveal": str }
  ]`;

/** Remet en forme les connaissances graduées renvoyées par l'IA. */
function normalizeKnowledge(list) {
  return (Array.isArray(list) ? list : [])
    .filter((k) => k && (k.text || k.info))
    .map((k) => ({ dc: Number(k.dc) || 0, skill: toText(k.skill === '—' ? '' : k.skill), text: toText(k.text || k.info), reveal: toText(k.reveal || k.howToReveal) }))
    .sort((a, b) => a.dc - b.dc);
}

function Library({ state, dispatch, universe, campaigns, flash }) {
  const { ai } = useContext(AIContext);

  const [type, setType] = useState('artifact');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(null);
  const feed = useUniverseFeed(universe);
  const imageIndex = useMemo(() => archiveImageIndex(feed), [feed]);

  // Les fiches sans image reçoivent celle des Archives qui porte leur nom (une fois, sans écraser un choix du MJ).
  useEffect(() => {
    if (!imageIndex.length) return;
    const withImage = new Set(Object.values(state.assets || {}).filter((a) => a.targetType === 'library').map((a) => a.targetId));
    const assets = [];
    for (const e of Object.values(state.libraryEntries || {})) {
      if (e.universeId !== universe.id || withImage.has(e.id) || e.noAutoImage) continue;
      const img = matchArchiveImages([e.title, e.subtitle, ...(e.altNames || [])].filter(Boolean), imageIndex)[0];
      if (img)
        assets.push({ id: `arc-auto-${e.id}`, name: img.caption, category: 'library', targetType: 'library', targetId: e.id, dataUrl: img.src, source: 'archives', prompt: '', createdAt: 0, universeId: universe.id });
    }
    if (assets.length) dispatch({ type: 'IMPORT_ARCHIVE_ENTRIES', entries: [], assets });
  }, [imageIndex, Object.keys(state.libraryEntries || {}).length]);

  const [draft, setDraft] = useState({
    title: '',
    roughNotes: '',
    currentLocation: '',
    owner: '',
    linkedCampaignIds: [],
  });

  const entries = Object.values(state.libraryEntries || {})
    .filter((e) => e.universeId === universe.id)
    .sort(
      (a, b) =>
        Number(b.updatedAt || b.createdAt || 0) -
        Number(a.updatedAt || a.createdAt || 0)
    );

  const filtered = entries.filter((e) => e.archiveType === type);
  const selected =
    entries.find((e) => e.id === selectedId) || filtered[0] || null;

  // Ouvrir une fiche depuis la grille : on amène directement la lecture en haut de page.
  useEffect(() => {
    if (selectedId) document.querySelector('.dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [type, filtered.length]);

  function updateDraft(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function toggleDraftCampaign(id) {
    updateDraft(
      'linkedCampaignIds',
      draft.linkedCampaignIds.includes(id)
        ? draft.linkedCampaignIds.filter((x) => x !== id)
        : [...draft.linkedCampaignIds, id]
    );
  }

  function toggleEntryCampaign(entry, id) {
    const current = entry.linkedCampaignIds || [];

    dispatch({
      type: 'UPDATE_LIBRARY_ENTRY',
      id: entry.id,
      patch: {
        linkedCampaignIds: current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id],
      },
    });
  }

  async function createWithAI() {
    if (!draft.roughNotes.trim()) {
      flash('Ajoute des notes libres pour créer une fiche.');
      return;
    }

    setBusy(true);

    try {
      const kind = LIBRARY_TYPES[type];

      const data = await callAI(ai, {
        system: `Tu es l'archiviste d'une grande bibliothèque de lore TTRPG.
  
  Réponds uniquement en JSON valide.
  Tu dois transformer des notes décousues en fiche d'archive immersive.
  Langue: français.
  Style: littéraire, clair, consultable, comme un vrai document de bibliothèque.
  Le texte doit respecter le ton de l'univers.`,
        prompt: `Univers: ${universe.name}
  Ton: ${universe.tone}
  Canon:
  ${universe.lore || ''}
  
  Type de fiche: ${kind.singular}
  Format attendu: ${kind.tone}
  
  Campagnes liées:
  ${
    campaigns
      .filter((c) => draft.linkedCampaignIds.includes(c.id))
      .map((c) => `- ${c.title}: ${c.premise || ''}`)
      .join('\n') || 'Aucune'
  }
  
  Titre fourni:
  ${draft.title || 'Non spécifié'}
  
  Lieu actuel:
  ${draft.currentLocation || 'Inconnu'}
  
  Possesseur actuel:
  ${draft.owner || 'Inconnu'}
  
  Notes libres:
  ${draft.roughNotes}
  
  Retourne:
  {
    "title": "titre final",
    "subtitle": "sous-titre archivistique court",
    "shortSummary": "résumé bref",
    "body": "fiche complète en prose, 3 à 7 paragraphes",
    "origin": "origine ou provenance",
    "historicalContext": "contexte historique ou narratif",
    "currentLocation": "où cela se trouve actuellement",
    "owner": "qui le possède, le protège, le cherche ou l'a perdu",
    "campaignUse": "comment cela a été vu ou peut revenir en campagne",
    "secrets": "secrets, rumeurs ou incertitudes",
    "tags": ["tag1", "tag2", "tag3"],
    "imagePrompt": "prompt d'image dark fantasy sans texte ni watermark",
    ${KNOWLEDGE_SCHEMA}
  }`,
        maxTokens: 6000,
      });

      const id = uid();

      const entry = {
        id,
        archiveType: type,
        title: data.title || draft.title || `Nouvelle fiche — ${kind.singular}`,
        subtitle: data.subtitle || '',
        shortSummary: data.shortSummary || '',
        body: data.body || draft.roughNotes,
        origin: data.origin || '',
        historicalContext: data.historicalContext || '',
        currentLocation: data.currentLocation || draft.currentLocation || '',
        owner: data.owner || draft.owner || '',
        campaignUse: data.campaignUse || '',
        secrets: data.secrets || '',
        tags: data.tags || [],
        imagePrompt: data.imagePrompt || '',
        playerKnowledge: normalizeKnowledge(data.playerKnowledge),
        roughNotes: draft.roughNotes,
        linkedCampaignIds: draft.linkedCampaignIds,
        createdAt: now(),
        updatedAt: now(),
      };

      dispatch({ type: 'ADD_LIBRARY_ENTRY', entry });
      setSelectedId(id);

      setDraft({
        title: '',
        roughNotes: '',
        currentLocation: '',
        owner: '',
        linkedCampaignIds: [],
      });

      flash('Fiche d’archive créée.');
    } catch (e) {
      flash(e.message);
    }

    setBusy(false);
  }

  function createBlank() {
    const kind = LIBRARY_TYPES[type];
    const id = uid();

    const entry = {
      id,
      archiveType: type,
      title: draft.title || `Nouvelle fiche — ${kind.singular}`,
      subtitle: '',
      shortSummary: '',
      body: draft.roughNotes || '',
    
      origin: '',
      historicalContext: '',
      currentLocation: draft.currentLocation || '',
      owner: draft.owner || '',
      campaignUse: '',
      secrets: '',
      tags: [],
      imagePrompt: '',
      roughNotes: draft.roughNotes || '',
      linkedCampaignIds: draft.linkedCampaignIds || [],
    
      // Champs communs
      era: '',
      date: '',
      materials: '',
      condition: '',
      civilization: '',
      classification: '',
      language: '',
      authenticity: '',
    
      // Personnage
      race: '',
      age: '',
      occupation: '',
      status: '',
      allegiance: '',
      appearance: '',
      personality: '',
      goals: [],
      dialogues: [],
    
      // Lieu
      region: '',
      population: '',
      districts: [],
      pointsOfInterest: [],
      rumors: [],
    
      // Événement
      actors: [],
      timeline: [],
      causes: [],
      consequences: [],
    
      // Faction
      motto: '',
      size: '',
      influence: '',
      secrecy: '',
      hierarchy: [],
      territories: [],
      allies: [],
      enemies: [],
      resources: [],
    
      // Mystère
      fragments: [],
      clues: [],
      witnesses: [],
      redHerrings: [],
      questions: [],
    
      createdAt: now(),
      updatedAt: now(),
    };

    dispatch({ type: 'ADD_LIBRARY_ENTRY', entry });
    setSelectedId(id);

    setDraft({
      title: '',
      roughNotes: '',
      currentLocation: '',
      owner: '',
      linkedCampaignIds: [],
    });

    flash('Fiche vide créée.');
  }

  async function writeReadAloud(entry) {
    setBusy(true);
    try {
      const data = await callAI(ai, {
        system: `Tu es le conteur d'une table de jeu de rôle. Tu écris des passages courts, à lire à voix haute aux aventuriers.\nRéponds uniquement en JSON valide : {"readAloud": "..."}.\nLangue : français. Deux à quatre phrases, à la deuxième personne du pluriel, sensorielles. N'invente aucun fait absent de la fiche.`,
        prompt: `Univers : ${universe.name}\nTon : ${universe.tone}\nFiche : ${entry.title}\nRésumé : ${entry.shortSummary || ''}\nTexte source :\n${(entry.body || '').slice(0, 6000)}`,
      });
      dispatch({ type: 'UPDATE_LIBRARY_ENTRY', id: entry.id, patch: { readAloud: String(data.readAloud || '').trim() } });
      flash('Passage à lire rédigé : relis-le avant la séance.');
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }

  async function writeKnowledge(entry) {
    setBusy(true);
    try {
      const data = await callAI(ai, {
        system: `Tu es le MJ complice d'une table de jeu de rôle (D&D 5e). Tu gradues ce que les personnages peuvent savoir d'un sujet.
Réponds uniquement en JSON valide. Langue : français.
Chaque palier : un DD, la compétence qui convient, l'information exacte (ce que le joueur apprend), et une façon CONCRÈTE de la lui faire découvrir en jeu
(une réplique entre guillemets d'un PNJ, une inscription, une odeur, un document, une rumeur de taverne). Du plus courant (DD 0) au plus rare (DD 20 ou plus).
Ne révèle pas les secrets du MJ aux paliers faciles. Reste fidèle à la fiche : n'invente pas de faits contraires.`,
        prompt: `Univers : ${universe.name}\nTon : ${universe.tone}\nType : ${LIBRARY_TYPES[entry.archiveType]?.singular || 'Archive'}\nFiche : ${entry.title}\nRésumé : ${entry.shortSummary || ''}\nTexte :\n${(entry.body || '').slice(0, 5000)}\nSecrets du MJ (à garder pour les paliers élevés, ou à taire) :\n${entry.secrets || '—'}\n\nRetourne : { ${KNOWLEDGE_SCHEMA} } (4 à 6 paliers)`,
        maxTokens: 2500,
      });
      const playerKnowledge = normalizeKnowledge(data.playerKnowledge);
      if (!playerKnowledge.length) throw new Error('L’IA n’a pas renvoyé de connaissances lisibles. Réessaie.');
      dispatch({ type: 'UPDATE_LIBRARY_ENTRY', id: entry.id, patch: { playerKnowledge } });
      flash('Connaissances des joueurs rédigées : relis-les avant la séance.');
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }

  function pickArchiveImage(entry, img) {
    dispatch({
      type: 'ADD_ASSET',
      asset: { id: uid(), name: img.caption, category: 'library', targetType: 'library', targetId: entry.id, dataUrl: img.src, source: 'archives', prompt: '', createdAt: now() },
    });
    setPicker(null);
    flash('Image des Archives assignée.');
  }

  function openEntry(id) {
    const target = state.libraryEntries?.[id];
    if (!target) return;
    setType(target.archiveType);
    setSelectedId(id);
  }

  async function polishEntry(entry) {
    setBusy(true);

    try {
      const kind = LIBRARY_TYPES[entry.archiveType] || LIBRARY_TYPES.document;

      const data = await callAI(ai, {
        system: `Tu es l'archiviste d'une bibliothèque de lore TTRPG.
  
  Réponds uniquement en JSON valide.
  Tu dois améliorer une fiche existante sans trahir les faits.
  Langue: français.
  Style: document d'archive immersif, clair, élégant, cohérent avec l'univers.`,
        prompt: `Univers: ${universe.name}
  Ton: ${universe.tone}
  Canon:
  ${universe.lore || ''}
  
  Type: ${kind.singular}
  Format: ${kind.tone}
  
  Fiche actuelle:
  Titre: ${entry.title}
  Sous-titre: ${entry.subtitle || ''}
  Résumé: ${entry.shortSummary || ''}
  Corps:
  ${entry.body || ''}
  Origine: ${entry.origin || ''}
  Contexte: ${entry.historicalContext || ''}
  Lieu actuel: ${entry.currentLocation || ''}
  Possesseur: ${entry.owner || ''}
  Usage campagne: ${entry.campaignUse || ''}
  Secrets: ${entry.secrets || ''}
  
  Notes libres:
  ${entry.roughNotes || ''}
  
  Retourne:
{
  "title": "titre final",
  "subtitle": "sous-titre archivistique court",
  "shortSummary": "résumé bref",
  "body": "fiche complète en prose, 3 à 7 paragraphes",
  "origin": "origine",
  "historicalContext": "contexte historique",
  "currentLocation": "lieu actuel",
  "owner": "possesseur, gardien ou faction liée",
  "campaignUse": "comment utiliser cette fiche en campagne",
  "secrets": "secrets, vérité cachée ou information MJ",
  "tags": ["tag1", "tag2"],
  "imagePrompt": "prompt d'image clair et visuel",

  "era": "époque",
  "materials": "matériaux ou support",
  "condition": "état de conservation",
  "civilization": "civilisation ou origine culturelle",

  "race": "race ou nature",
  "age": "âge",
  "occupation": "occupation",
  "status": "statut",
  "allegiance": "allégeance",
  "appearance": "apparence",
  "personality": "personnalité",
  "goals": ["objectif 1", "objectif 2"],
  "dialogues": ["réplique 1", "réplique 2", "réplique 3"],

  "region": "région",
  "population": "population",
  "districts": ["quartier 1", "quartier 2"],
  "pointsOfInterest": ["point d'intérêt 1", "point d'intérêt 2"],
  "rumors": ["rumeur 1", "rumeur 2"],

  "date": "date",
  "actors": ["acteur 1", "acteur 2"],
  "timeline": ["fait 1", "fait 2"],
  "causes": ["cause 1", "cause 2"],
  "consequences": ["conséquence 1", "conséquence 2"],

  "motto": "devise",
  "size": "taille",
  "influence": "influence",
  "secrecy": "niveau de secret",
  "hierarchy": ["rang 1", "rang 2"],
  "territories": ["territoire 1", "territoire 2"],
  "allies": ["allié 1", "allié 2"],
  "enemies": ["ennemi 1", "ennemi 2"],
  "resources": ["ressource 1", "ressource 2"],

  "fragments": ["fragment connu 1", "fragment connu 2"],
  "clues": ["indice 1", "indice 2"],
  "witnesses": ["témoin 1", "témoin 2"],
  "redHerrings": ["fausse piste 1", "fausse piste 2"],
  "questions": ["question ouverte 1", "question ouverte 2"],

  "classification": "classification",
  "language": "langue",
  "authenticity": "évaluation d'authenticité",
  ${KNOWLEDGE_SCHEMA}
}`,
        maxTokens: 7000,
      });

      dispatch({
        type: 'UPDATE_LIBRARY_ENTRY',
        id: entry.id,
        patch: {
          title: data.title || entry.title,
          subtitle: data.subtitle || entry.subtitle,
          shortSummary: data.shortSummary || entry.shortSummary,
          body: data.body || entry.body,
          origin: data.origin || entry.origin,
          historicalContext: data.historicalContext || entry.historicalContext,
          currentLocation: data.currentLocation || entry.currentLocation,
          owner: data.owner || entry.owner,
          campaignUse: data.campaignUse || entry.campaignUse,
          secrets: data.secrets || entry.secrets,
          tags: data.tags || entry.tags || [],
          imagePrompt: data.imagePrompt || entry.imagePrompt,
          era: data.era || entry.era || '',
          materials: data.materials || entry.materials || '',
          condition: data.condition || entry.condition || '',
          civilization: data.civilization || entry.civilization || '',

          race: data.race || entry.race || '',
          age: data.age || entry.age || '',
          occupation: data.occupation || entry.occupation || '',
          status: data.status || entry.status || '',
          allegiance: data.allegiance || entry.allegiance || '',
          appearance: data.appearance || entry.appearance || '',
          personality: data.personality || entry.personality || '',
          goals: data.goals || entry.goals || [],
          dialogues: data.dialogues || entry.dialogues || [],

          region: data.region || entry.region || '',
          population: data.population || entry.population || '',
          districts: data.districts || entry.districts || [],
          pointsOfInterest:
            data.pointsOfInterest || entry.pointsOfInterest || [],
          rumors: data.rumors || entry.rumors || [],

          date: data.date || entry.date || '',
          actors: data.actors || entry.actors || [],
          timeline: data.timeline || entry.timeline || [],
          causes: data.causes || entry.causes || [],
          consequences: data.consequences || entry.consequences || [],

          motto: data.motto || entry.motto || '',
          size: data.size || entry.size || '',
          influence: data.influence || entry.influence || '',
          secrecy: data.secrecy || entry.secrecy || '',
          hierarchy: data.hierarchy || entry.hierarchy || [],
          territories: data.territories || entry.territories || [],
          allies: data.allies || entry.allies || [],
          enemies: data.enemies || entry.enemies || [],
          resources: data.resources || entry.resources || [],

          fragments: data.fragments || entry.fragments || [],
          clues: data.clues || entry.clues || [],
          witnesses: data.witnesses || entry.witnesses || [],
          redHerrings: data.redHerrings || entry.redHerrings || [],
          questions: data.questions || entry.questions || [],

          classification: data.classification || entry.classification || '',
          language: data.language || entry.language || '',
          authenticity: data.authenticity || entry.authenticity || '',
          playerKnowledge: normalizeKnowledge(data.playerKnowledge).length ? normalizeKnowledge(data.playerKnowledge) : entry.playerKnowledge || [],
        },
      });

      flash('Fiche reformulée par l’IA.');
    } catch (e) {
      flash(e.message);
    }

    setBusy(false);
  }

  async function uploadEntryImage(entry, file) {
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);

      dispatch({
        type: 'ADD_ASSET',
        asset: {
          id: uid(),
          name: file.name,
          category: 'library',
          targetType: 'library',
          targetId: entry.id,
          dataUrl,
          source: 'upload',
          prompt: entry.imagePrompt || '',
          createdAt: now(),
        },
      });

      flash('Image ajoutée à la fiche.');
    } catch (e) {
      flash(e.message);
    }
  }

  return (
    <>
      <h1 className="view">Bibliothèque</h1>
      <p className="sub">
        Archives vivantes de l’univers : artefacts, personnages, lieux,
        événements, factions, mystères et documents. Chaque fiche peut être
        nourrie par des notes libres, reformulée par l’IA, liée aux campagnes et
        enrichie d’une image.
      </p>

      <div className="library-shell">
        <aside className="panel library-sidebar">
          <div className="scene-label">Rayons</div>

          <div className="library-type-list">
            {Object.entries(LIBRARY_TYPES).map(([k, v]) => (
              <button
                key={k}
                data-on={type === k ? 1 : 0}
                onClick={() => {
                  setType(k);
                  setSelectedId('');
                }}
              >
                {v.label}
                <span className="library-type-count">{entries.filter((e) => e.archiveType === k).length}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="library-main">
          <div className="panel library-create-panel">
            <div className="scene-label">Nouvelle archive</div>

            <div className="row">
              <Field label="Titre provisoire">
                <input
                  className="in"
                  value={draft.title}
                  onChange={(e) => updateDraft('title', e.target.value)}
                  placeholder="Ex. La couronne fendue de Merath"
                />
              </Field>

              <Field label="Lieu actuel">
                <input
                  className="in"
                  value={draft.currentLocation}
                  onChange={(e) =>
                    updateDraft('currentLocation', e.target.value)
                  }
                  placeholder="Ex. Crypte de Vornal, coffre du duc, disparu..."
                />
              </Field>

              <Field label="Possesseur / gardien">
                <input
                  className="in"
                  value={draft.owner}
                  onChange={(e) => updateDraft('owner', e.target.value)}
                  placeholder="Ex. En possession de Selka, volé par les PJ..."
                />
              </Field>
            </div>

            <Field label="Notes libres">
              <textarea
                className="in"
                value={draft.roughNotes}
                onChange={(e) => updateDraft('roughNotes', e.target.value)}
                placeholder="Écris comme dans un LLM : fragments, idées, faits joués, rumeurs, liens avec des PNJ, conséquences, objets vus, contradictions..."
              />
            </Field>

            <Field label="Campagnes liées">
              <div className="library-campaign-links">
                {campaigns.length === 0 ? (
                  <span className="muted">Aucune campagne disponible.</span>
                ) : (
                  campaigns.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      data-on={draft.linkedCampaignIds.includes(c.id) ? 1 : 0}
                      onClick={() => toggleDraftCampaign(c.id)}
                    >
                      {c.title}
                    </button>
                  ))
                )}
              </div>
            </Field>

            <div className="row">
              <button
                className="btn primary"
                style={{ flex: 'none' }}
                disabled={busy}
                onClick={createWithAI}
              >
                {busy ? (
                  <>
                    <Spin /> Rédaction…
                  </>
                ) : (
                  'Créer avec l’IA'
                )}
              </button>

              <button
                className="btn"
                style={{ flex: 'none' }}
                onClick={createBlank}
              >
                Créer une fiche vide
              </button>
            </div>
          </div>

          <div className="eyebrow">{LIBRARY_TYPES[type].label}</div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="big">Aucune archive dans ce rayon</div>
              <p className="muted">
                Crée une première fiche avec des notes libres ou une fiche vide.
              </p>
            </div>
          ) : (
            <div className="library-entry-grid">
              {filtered.map((entry) => {
                const img = getPrimaryAsset(state, 'library', entry.id) ?? (entry.imageSrc ? { dataUrl: entry.imageSrc } : null);

                return (
                  <LibraryCard
                    key={entry.id}
                    entry={entry}
                    img={img}
                    typeLabel={LIBRARY_TYPES[entry.archiveType]?.singular || 'Archive'}
                    selected={selected?.id === entry.id}
                    onClick={() => setSelectedId(entry.id)}
                  />
                );
              })}
            </div>
          )}

          {selected && (
            <LibraryEntryEditor
              entry={selected}
              state={state}
              campaigns={campaigns}
              busy={busy}
              dispatch={dispatch}
              flash={flash}
              onPolish={polishEntry}
              onUploadImage={uploadEntryImage}
              onToggleCampaign={toggleEntryCampaign}
              onOpenEntry={openEntry}
              onWriteReadAloud={writeReadAloud}
              onWriteKnowledge={writeKnowledge}
              onPickArchive={imageIndex.length ? (entry) => setPicker(entry) : null}
            />
          )}
        </main>
      </div>
      {picker && (
        <ArchiveImagePicker
          index={imageIndex}
          suggested={matchArchiveImages([picker.title, picker.subtitle, ...(picker.altNames || [])].filter(Boolean), imageIndex)}
          onClose={() => setPicker(null)}
          onPick={(img) => pickArchiveImage(picker, img)}
        />
      )}
    </>
  );
}

function splitLines(value) {
  return String(value || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}







function LibraryEntryEditor({
  entry,
  state,
  campaigns,
  busy,
  dispatch,
  flash,
  onPolish,
  onUploadImage,
  onToggleCampaign,
  onOpenEntry,
  onWriteReadAloud,
  onWriteKnowledge,
  onPickArchive,
}) {
  const img = getPrimaryAsset(state, 'library', entry.id) ?? (entry.imageSrc ? { dataUrl: entry.imageSrc } : null);
  // Détail complet de la fiche des Archives, lu depuis le fichier publié (rien n'est copié dans le navigateur).
  const { feed: archiveFeed } = useUnderdarkFeed();
  const archive = entry.sourceId ? archiveFeed?.entries.find((x) => x.id === entry.sourceId) ?? null : null;

  function update(patch) {
    dispatch({
      type: 'UPDATE_LIBRARY_ENTRY',
      id: entry.id,
      patch,
    });
  }

  function updateField(k, v) {
    update({ [k]: v });
  }

  return (
    <>
      <LibraryArchiveView
        entry={entry}
        img={img}
        archive={archive}
        gallery={[...getAssetsFor(state, 'library', entry.id).filter((x) => x.dataUrl), ...(entry.imageSrcs || []).map((src, i) => ({ id: `${entry.id}-${i}`, name: entry.title, dataUrl: src }))]}
        campaigns={campaigns}
        related={entry.related || []}
        hasEntry={(id) => !!state.libraryEntries?.[id]}
        onOpenEntry={onOpenEntry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        onWriteReadAloud={onWriteReadAloud}
        onWriteKnowledge={onWriteKnowledge}
        onPickArchive={onPickArchive}
        busy={busy}
      />

      <div className="library-edit-panel panel">
        <div className="scene-label">Édition rapide</div>

        <div className="row">
          <Field label="Titre">
            <input
              className="in"
              value={entry.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
            />
          </Field>

          <Field label="Sous-titre">
            <input
              className="in"
              value={entry.subtitle || ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Résumé court">
          <textarea
            className="in"
            value={entry.shortSummary || ''}
            onChange={(e) => updateField('shortSummary', e.target.value)}
          />
        </Field>

        <Field label="Ce que les joueurs savent (du plus courant au plus rare)">
          <KnowledgeEditor value={entry.playerKnowledge || []} onChange={(playerKnowledge) => updateField('playerKnowledge', playerKnowledge)} />
        </Field>

        <Field label="Passage à lire aux aventuriers (à voix haute)">
          <textarea
            className="in"
            rows={3}
            value={entry.readAloud || ''}
            onChange={(e) => updateField('readAloud', e.target.value)}
          />
        </Field>

        <Field label="Corps principal">
          <textarea
            className="in"
            value={entry.body || ''}
            onChange={(e) => updateField('body', e.target.value)}
            style={{ minHeight: 160 }}
          />
        </Field>

        <div className="row">
          <Field label="Origine">
            <textarea
              className="in"
              value={entry.origin || ''}
              onChange={(e) => updateField('origin', e.target.value)}
            />
          </Field>

          <Field label="Contexte historique">
            <textarea
              className="in"
              value={entry.historicalContext || ''}
              onChange={(e) => updateField('historicalContext', e.target.value)}
            />
          </Field>
        </div>

        <div className="row">
          <Field label="Lieu actuel">
            <input
              className="in"
              value={entry.currentLocation || ''}
              onChange={(e) => updateField('currentLocation', e.target.value)}
            />
          </Field>

          <Field label="Possesseur / gardien">
            <input
              className="in"
              value={entry.owner || ''}
              onChange={(e) => updateField('owner', e.target.value)}
            />
          </Field>
        </div>

        <div className="row">
          <Field label="Usage en campagne">
            <textarea
              className="in"
              value={entry.campaignUse || ''}
              onChange={(e) => updateField('campaignUse', e.target.value)}
            />
          </Field>

          <Field label="Secrets">
            <textarea
              className="in"
              value={entry.secrets || ''}
              onChange={(e) => updateField('secrets', e.target.value)}
            />
          </Field>
        </div>

        <div className="row">
          <button
            className="btn primary"
            style={{ flex: 'none' }}
            disabled={busy}
            onClick={() => onPolish(entry)}
          >
            {busy ? (
              <>
                <Spin /> Reformulation…
              </>
            ) : (
              'Reformuler avec l’IA'
            )}
          </button>

          <button
            className="btn ghost danger"
            style={{ flex: 'none' }}
            onClick={() => {
              if (confirm('Supprimer cette fiche ?')) {
                dispatch({ type: 'DELETE_LIBRARY_ENTRY', id: entry.id });
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </div>
    </>
  );
}
function LibraryArchiveView({
  entry,
  img,
  archive,
  gallery,
  campaigns,
  related,
  hasEntry,
  onOpenEntry,
  onUploadImage,
  onPolish,
  onWriteReadAloud,
  onWriteKnowledge,
  onPickArchive,
  busy,
}) {
  return (
    <Dossier
      entry={entry}
      typeLabel={LIBRARY_TYPES[entry.archiveType]?.singular || 'Archive'}
      img={img}
      archive={archive}
      gallery={gallery}
      campaigns={campaigns}
      related={related}
      hasEntry={hasEntry}
      onOpenEntry={onOpenEntry}
      onUploadImage={onUploadImage}
      onPolish={onPolish}
      onWriteReadAloud={onWriteReadAloud}
      onWriteKnowledge={onWriteKnowledge}
      onPickArchive={onPickArchive}
      busy={busy}
    />
  );
}

/** Édition des connaissances graduées : DD, compétence, information, façon de la révéler en jeu. */
function KnowledgeEditor({ value, onChange }) {
  const rows = value || [];
  const up = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="knowledge-editor">
      {rows.map((k, i) => (
        <div key={i} className="knowledge-row">
          <input className="in" type="number" min="0" max="30" title="DD (0 = connu de tous)" value={k.dc ?? 0} onChange={(e) => up(i, { dc: Number(e.target.value) || 0 })} />
          <input className="in" placeholder="Compétence" value={k.skill || ''} onChange={(e) => up(i, { skill: e.target.value })} />
          <textarea className="in" rows={2} placeholder="Ce que le joueur apprend" value={k.text || ''} onChange={(e) => up(i, { text: e.target.value })} />
          <textarea className="in" rows={2} placeholder="Comment le lui faire découvrir en jeu" value={k.reveal || ''} onChange={(e) => up(i, { reveal: e.target.value })} />
          <button type="button" className="btn ghost sm danger" onClick={() => onChange(rows.filter((_, j) => j !== i))} title="Retirer">
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { dc: rows.length ? Math.min(30, (Number(rows[rows.length - 1].dc) || 0) + 5) : 0, skill: '', text: '', reveal: '' }])}>
        + Ajouter un palier
      </button>
    </div>
  );
}


async function generateOpenAIImage(ai, prompt) {
  if (!ai || !ai.apiKey) {
    throw new Error('Clé API manquante.');
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ai.apiKey,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 240);
    } catch {}

    throw new Error('Erreur génération image ' + res.status + '. ' + detail);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("Aucune image retournée par l'API.");
  }

  return 'data:image/png;base64,' + b64;
}
/* ----------------------------- Party (+ PDF import) --------------------- */
function AssetManager({
  state,
  dispatch,
  universe,
  party,
  campaigns,
  npcs,
  flash,
}) {
  const { ai } = useContext(AIContext);

  const [category, setCategory] = useState('scene');
  const [targetId, setTargetId] = useState('');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const sceneTargets = campaigns.flatMap((c) =>
    (c.scenes || []).map((sc) => ({
      id: sc.id,
      label: `${c.title} → ${sc.title}`,
      type: 'scene',
    }))
  );

  const campaignTargets = campaigns.map((c) => ({
    id: c.id,
    label: c.title,
    type: 'campaign',
  }));

  const npcTargets = npcs.map((n) => ({
    id: n.id,
    label: n.name,
    type: 'npc',
  }));

  const creatureTargets = npcs.map((n) => ({
    id: n.id,
    label: n.name,
    type: 'creature',
  }));

  const playerTargets = party.map((p) => ({
    id: p.id,
    label: p.name,
    type: 'player',
  }));

  const targetOptions =
    category === 'scene'
      ? sceneTargets
      : category === 'campaign'
      ? campaignTargets
      : category === 'npc'
      ? npcTargets
      : category === 'creature'
      ? creatureTargets
      : category === 'player'
      ? playerTargets
      : category === 'map'
      ? campaignTargets
      : [{ id: universe.id, label: universe.name, type: 'universe' }];

  const targetType =
    category === 'scene'
      ? 'scene'
      : category === 'campaign' || category === 'map'
      ? 'campaign'
      : category === 'npc'
      ? 'npc'
      : category === 'creature'
      ? 'creature'
      : category === 'player'
      ? 'player'
      : 'universe';

  const assets = Object.values(state.assets || {})
    .filter((asset) => asset.universeId === universe.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  async function uploadImage(file) {
    if (!file) return;

    if (!targetId) {
      flash("Choisis où l'image doit apparaître.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      dispatch({
        type: 'ADD_ASSET',
        asset: {
          id: uid(),
          name: name || file.name,
          category,
          targetType,
          targetId,
          dataUrl,
          source: 'upload',
          prompt: '',
          createdAt: now(),
        },
      });

      setName('');
      flash('Image importée et assignée.');
    } catch (e) {
      flash(e.message);
    }
  }

  async function generateImage() {
    if (!prompt.trim()) {
      flash("Écris un prompt d'image.");
      return;
    }

    if (!targetId) {
      flash("Choisis où l'image doit apparaître.");
      return;
    }

    if (!ai.apiKey) {
      flash('Configure une clé IA avant de générer une image.');
      return;
    }

    if (ai.provider !== 'openai') {
      flash(
        "La génération d'image intégrée est prévue pour OpenAI. Utilise l'import manuel pour l'instant."
      );
      return;
    }

    setBusy(true);

    try {
      const dataUrl = await generateOpenAIImage(ai, prompt);

      dispatch({
        type: 'ADD_ASSET',
        asset: {
          id: uid(),
          name: name || 'Image générée',
          category,
          targetType,
          targetId,
          dataUrl,
          source: 'generated',
          prompt,
          createdAt: now(),
        },
      });

      setPrompt('');
      setName('');
      flash('Image générée et assignée.');
    } catch (e) {
      flash(e.message);
    }

    setBusy(false);
  }

  return (
    <>
      <h1 className="view">Images</h1>
      <p className="sub">
        Choisis exactement où chaque image doit apparaître : une scène précise,
        une campagne, un PNJ, une créature ou un personnage joueur.
      </p>

      <div className="panel">
        <div className="row">
          <Field label="Type d'image">
            <select
              className="in"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setTargetId('');
              }}
            >
              <option value="scene">Image de scène</option>
              <option value="campaign">Image de campagne</option>
              <option value="npc">Portrait de PNJ</option>
              <option value="creature">Image de créature / monstre</option>
              <option value="player">Portrait de joueur</option>
              <option value="map">Carte / lieu</option>
              <option value="universe">Image d'univers</option>
            </select>
          </Field>

          <Field label="Où l'image doit apparaître">
            <select
              className="in"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Choisir une cible…</option>
              {targetOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Nom de l'image">
          <input
            className="in"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Embuscade dans la clairière"
          />
        </Field>

        <Field label="Importer une image">
          <input
            className="in"
            type="file"
            accept="image/*"
            onChange={(e) => uploadImage(e.target.files && e.target.files[0])}
          />
        </Field>

        <div className="eyebrow">Génération d'image</div>

        <Field label="Prompt d'image">
          <textarea
            className="in"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Décris l'image à générer..."
          />
        </Field>

        <button
          className="btn ghost"
          style={{ marginBottom: 12 }}
          onClick={() => {
            const selected = targetOptions.find((t) => t.id === targetId);
            setPrompt(
              buildImagePrompt({
                type: category,
                name: selected?.label || name,
                description: '',
                universe,
              })
            );
          }}
        >
          Préparer un prompt automatiquement
        </button>

        <button className="btn primary" disabled={busy} onClick={generateImage}>
          {busy ? (
            <>
              <Spin /> Génération…
            </>
          ) : (
            "Générer l'image"
          )}
        </button>
      </div>

      <div className="eyebrow">Galerie</div>

      {assets.length === 0 ? (
        <div className="empty muted">Aucune image importée.</div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <div className="asset-card" key={asset.id}>
              <img src={asset.dataUrl} alt={asset.name} />
              <div>
                <b>{asset.name}</b>
                <span>
                  {asset.category} · {asset.targetType}
                </span>
              </div>
              <button
                className="btn ghost sm danger"
                onClick={() => {
                  if (confirm('Supprimer cette image ?')) {
                    dispatch({ type: 'DELETE_ASSET', id: asset.id });
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
/* ----------------------------- Party (+ PDF import) --------------------- */
function Party({ state, dispatch, party, universe, flash }) {
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <h1 className="view">Le groupe</h1>
      <p className="sub">
        Import each player's sheet so adventures fit their level, skills and
        backstory. Upload a PDF (read on-device) or paste the sheet text — the
        AI reformats it into a clean character. Add anyone by hand too.
      </p>
      <div className="row" style={{ marginBottom: 18, flex: 'none' }}>
        <button
          className="btn primary"
          style={{ flex: 'none' }}
          onClick={() => setImporting(true)}
        >
          ⇪ Import sheet (PDF / text)
        </button>
        <button
          className="btn"
          style={{ flex: 'none' }}
          onClick={() => setAdding(true)}
        >
          + Add by hand
        </button>
      </div>
      {party.length === 0 ? (
        <div className="empty">
          <div className="big">No heroes yet</div>
          <p className="muted">
            Import a character sheet to seed your campaigns.
          </p>
        </div>
      ) : (
        <div className="grid cols-2">
          {party.map((c) => (
            <CharCard
              key={c.id}
              c={c}
              state={state}
              dispatch={dispatch}
              flash={flash}
            />
          ))}
        </div>
      )}
      {importing && (
        <ImportModal
          universe={universe}
          dispatch={dispatch}
          flash={flash}
          onClose={() => setImporting(false)}
        />
      )}
      {adding && (
        <CharFormModal
          dispatch={dispatch}
          flash={flash}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

function CharCard({ c, state, dispatch, flash }) {
  const [open, setOpen] = useState(false);
  const portrait = getPrimaryAsset(state, 'player', c.id);

  async function uploadPortrait(file) {
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);

      dispatch({
        type: 'ADD_ASSET',
        asset: {
          id: uid(),
          name: file.name,
          category: 'player',
          targetType: 'player',
          targetId: c.id,
          dataUrl,
          source: 'upload',
          prompt: '',
          createdAt: now(),
        },
      });

      flash('Portrait assigné au personnage.');
    } catch (e) {
      flash(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="card-h">
        <div style={{ display: 'flex', gap: 12 }}>
          {portrait?.dataUrl ? (
            <img
              src={portrait.dataUrl}
              alt={c.name}
              className="scene-mini-portrait"
              style={{ width: 52, height: 52 }}
              onClick={() =>
                window.open(portrait.dataUrl, '_blank', 'noopener,noreferrer')
              }
            />
          ) : (
            <PortraitToken seed={c.name + c.cls} size={52} />
          )}
          <div>
            <div
              style={{
                fontFamily: 'Cinzel,serif',
                fontSize: 17,
                color: '#f0e2bb',
              }}
            >
              {c.name}
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              lv {c.level} {c.race} {c.cls}
              {c.background ? ' · ' + c.background : ''}
            </div>
            <label
              className="btn ghost sm"
              style={{ marginTop: 8, flex: 'none' }}
            >
              Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  uploadPortrait(e.target.files && e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn ghost sm"
            style={{ flex: 'none' }}
            onClick={() => setOpen(true)}
          >
            Fiche
          </button>

          <button
            className="btn ghost sm danger"
            style={{ flex: 'none' }}
            onClick={() => {
              if (confirm('Remove ' + c.name + '?'))
                dispatch({ type: 'DELETE_CHARACTER', id: c.id });
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {c.backstory && (
        <p
          style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 10 }}
          className="muted"
        >
          {c.backstory}
        </p>
      )}

      {open && <CharacterSheetModal c={c} onClose={() => setOpen(false)} />}
    </div>
  );
}
function CharacterSheetModal({ c, onClose }) {
  return (
    <Modal title={`Fiche — ${c.name}`} onClose={onClose} wide>
      <div className="grid cols-2">
        <div className="panel">
          <div className="eyebrow" style={{ marginTop: 0 }}>
            Identité
          </div>
          <p>
            <b>Nom :</b> {c.name || '—'}
          </p>
          <p>
            <b>Race :</b> {c.race || '—'}
          </p>
          <p>
            <b>Classe :</b> {c.cls || '—'}
          </p>
          <p>
            <b>Niveau :</b> {c.level || '—'}
          </p>
          <p>
            <b>Background :</b> {c.background || '—'}
          </p>
        </div>

        <div className="panel">
          <div className="eyebrow" style={{ marginTop: 0 }}>
            Attributs
          </div>
          <p>
            <b>FOR :</b> {c.str || '—'}
          </p>
          <p>
            <b>DEX :</b> {c.dex || '—'}
          </p>
          <p>
            <b>CON :</b> {c.con || '—'}
          </p>
          <p>
            <b>INT :</b> {c.int || '—'}
          </p>
          <p>
            <b>SAG :</b> {c.wis || '—'}
          </p>
          <p>
            <b>CHA :</b> {c.cha || '—'}
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginTop: 0 }}>
          Capacités et notes
        </div>
        <p>
          <b>Compétences :</b> {c.skills || '—'}
        </p>
        <p>
          <b>Sorts :</b> {c.spells || '—'}
        </p>
        <p>
          <b>Équipement :</b> {c.equipment || '—'}
        </p>
        <p>
          <b>Capacités :</b> {c.features || '—'}
        </p>
        <p>
          <b>Notes MJ :</b> {c.notes || '—'}
        </p>
      </div>

      {c.backstory && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginTop: 0 }}>
            Histoire
          </div>
          <p>{c.backstory}</p>
        </div>
      )}
    </Modal>
  );
}

function ImportModal({ universe, dispatch, flash, onClose }) {
  const { ai } = useContext(AIContext);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  async function readPdf(file) {
    setErr('');
    setStage('Lecture du PDF…');
    setBusy(true);
    try {
      const pdfjs = await import('pdfjs-dist'); // requires: npm i pdfjs-dist
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let out = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        out += content.items.map((it) => it.str).join(' ') + '\n';
      }
      const extracted = out.replace(/\s+\n/g, '\n').trim();
      setText(extracted);
      if (ai.apiKey) {
        await structure(extracted);
      } else {
        setStage('');
        setBusy(false);
        flash(
          'PDF lu — ajoute une clé IA pour le reformater, ou édite le texte.'
        );
      }
    } catch (e) {
      setBusy(false);
      setStage('');
      setErr(
        'Lecture PDF impossible : ' +
          e.message +
          '. As-tu fait « npm i pdfjs-dist » ?'
      );
    }
  }

  async function structure(src) {
    setStage("Reformatage par l'IA…");
    setBusy(true);
    setErr('');
    try {
      const d = await callAI(ai, {
        system:
          'You parse D&D 5e character sheets. Respond with ONLY valid JSON, no prose.',
        prompt: `Extract a character from this sheet text. JSON: {"name":str,"race":str,"cls":str,"level":num,"background":str,"backstory":str(1-2 sentences if present),"notes":str(notable skills/specs the DM should design around)}.
   Sheet:\n${(src || text).slice(0, 6000)}`,
      });
      dispatch({ type: 'ADD_CHARACTER', c: { id: uid(), ...d } });
      flash(`${d.name} joined the party`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
    setStage('');
  }

  return (
    <Modal title="Import character" onClose={onClose}>
      <div className="row" style={{ flex: 'none', marginBottom: 12 }}>
        <button
          className="btn primary"
          style={{ flex: 'none' }}
          disabled={busy}
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          ⇪ Choisir un PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) readPdf(f);
            e.target.value = '';
          }}
        />
        {stage && (
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--gold-lt)',
              alignSelf: 'center',
            }}
          >
            <Spin /> {stage}
          </span>
        )}
      </div>
      <div className="faint" style={{ fontSize: 12, marginBottom: 12 }}>
        Le PDF est lu dans ton navigateur (rien n'est téléversé). Première fois
        sur StackBlitz : exécute <b>npm i pdfjs-dist</b>.
      </div>
      <Field label="…ou colle le texte de la fiche">
        <textarea
          className="in"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Name: Kael Ardent • Half-Elf Ranger, Level 4 • Background: Outlander • STR 12 DEX 17… • Backstory…"
        />
      </Field>
      {err && (
        <div style={{ color: 'var(--blood)', fontSize: 13, marginBottom: 10 }}>
          {err}
        </div>
      )}
      <button
        className="btn primary"
        disabled={busy || !text.trim()}
        onClick={() => structure()}
      >
        {busy ? (
          <>
            <Spin /> {stage || '…'}
          </>
        ) : (
          'Reformater & importer'
        )}
      </button>
    </Modal>
  );
}

function CharFormModal({ dispatch, flash, onClose }) {
  const [f, setF] = useState({
    name: '',
    race: '',
    cls: '',
    level: 1,
    background: '',
    backstory: '',
    notes: '',
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modal title="Add character" onClose={onClose}>
      <div className="row">
        <Field label="Name">
          <input
            className="in"
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Level">
          <input
            className="in"
            type="number"
            min="1"
            max="20"
            value={f.level}
            onChange={(e) => set('level', +e.target.value)}
          />
        </Field>
      </div>
      <div className="row">
        <Field label="Race">
          <input
            className="in"
            value={f.race}
            onChange={(e) => set('race', e.target.value)}
          />
        </Field>
        <Field label="Class">
          <input
            className="in"
            value={f.cls}
            onChange={(e) => set('cls', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Background">
        <input
          className="in"
          value={f.background}
          onChange={(e) => set('background', e.target.value)}
        />
      </Field>
      <Field label="Backstory">
        <textarea
          className="in"
          rows={2}
          value={f.backstory}
          onChange={(e) => set('backstory', e.target.value)}
        />
      </Field>
      <Field label="DM notes (skills/specs to design around)">
        <input
          className="in"
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>
      <button
        className="btn primary"
        disabled={!f.name.trim()}
        onClick={() => {
          dispatch({ type: 'ADD_CHARACTER', c: { id: uid(), ...f } });
          flash(f.name + ' added');
          onClose();
        }}
      >
        Add to party
      </button>
    </Modal>
  );
}

/* ----------------------------- Bestiary --------------------------------- */
const BESTIARY_SEL_KEY = 'loresmith:bestiary-sel';
const QUICK_PRESETS = {
  monster: ['prédateur des galeries', 'nuée fongique', 'boss de fin d’acte', 'gardien d’un sanctuaire', 'charognard opportuniste', 'horreur venue des Archives'],
  npc: ['marchand louche', 'garde fatigué', 'érudit des Archives', 'enfant témoin', 'prêtresse ambiguë', 'informateur qui ment'],
};

/** Portrait d'une fiche : image assignée, sinon portrait SRD, sinon rien. */
function portraitOf(state, n) {
  const a = getPrimaryAsset(state, 'creature', n.id) || getPrimaryAsset(state, 'npc', n.id);
  if (a?.dataUrl || a?.url) return a.dataUrl || a.url;
  if (n.srdId) return tokenImage({ kind: 'monster', statId: n.srdId });
  return '';
}

/** Assigne un portrait à une fiche et en tire le jeton rond réutilisé sur les cartes. */
async function assignPortrait(dispatch, n, src, source = 'upload') {
  const isMonster = n.entityType === 'monster' || n.isMonster;
  const type = isMonster ? 'creature' : 'npc';
  dispatch({
    type: 'ADD_ASSET',
    asset: { id: uid(), name: n.name, category: type, targetType: type, targetId: n.id, dataUrl: src, source, prompt: n.imagePrompt || '', createdAt: now() },
  });
  try {
    const token = await makeToken(src, { hostile: isMonster });
    dispatch({ type: 'UPDATE_NPC', id: n.id, patch: { token } });
  } catch {
    /* Image d'un autre site sans autorisation : le portrait reste, sans jeton. */
  }
}

/** Image automatique : les Archives d'abord (par nom ou espèce), sinon le portrait SRD. */
function autoPortrait(dispatch, n, imageIndex) {
  const isMonster = n.entityType === 'monster' || n.isMonster;
  // Une créature prend l'image de son espèce (nom exact de la fiche des Archives) ; un PNJ, celle de son nom.
  const match = isMonster
    ? matchArchiveImages([n.kind, n.type, n.name].filter(Boolean), imageIndex.filter((i) => ['creature', 'flore', 'fungus'].includes(i.entryType)))[0]
    : matchPortrait([n.name], imageIndex)[0];
  if (match) return assignPortrait(dispatch, n, match.src, 'archives');
  if (n.srdId) return assignPortrait(dispatch, n, tokenImage({ kind: 'monster', statId: n.srdId }), 'srd');
  return null;
}

function Bestiary({ dispatch, state, universe, npcs, party, campaigns, flash }) {
  const { ai } = useContext(AIContext);
  const feed = useUniverseFeed(universe);
  const imageIndex = useMemo(() => archiveImageIndex(feed), [feed]);

  const [mode, setMode] = useState('monster');
  const [quick, setQuick] = useState('');
  const [count, setCount] = useState(1);
  const [difficulty, setDifficulty] = useState('moderate');
  const [advanced, setAdvanced] = useState(false);
  const [f, setF] = useState({ name: '', function: '', ancestry: '', role: '', cr: '', clan: '', backstory: '', sceneIds: [] });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem(BESTIARY_SEL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [srdPick, setSrdPick] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const lvl = party[0]?.level || 3;
  const size = party.length || 4;
  const isMon = (n) => n.entityType === 'monster' || n.isMonster;

  const list = useMemo(() => {
    const k = normName(q);
    return npcs.filter(
      (n) =>
        (filter === 'all' || (filter === 'monster') === isMon(n)) &&
        (!k || normName(`${n.name} ${n.kind} ${n.type} ${n.role} ${n.shortDescription} ${n.faction}`).includes(k))
    );
  }, [npcs, filter, q]);
  const selected = npcs.find((n) => n.id === selectedId) || list[0] || null;
  const pos = selected ? list.findIndex((n) => n.id === selected.id) : -1;

  function select(id) {
    setSelectedId(id);
    setEditing(false);
    try {
      localStorage.setItem(BESTIARY_SEL_KEY, id);
    } catch {}
  }
  const step = (d) => {
    if (!list.length) return;
    const i = pos === -1 ? 0 : (pos + d + list.length) % list.length;
    select(list[i].id);
  };

  // Navigation au clavier : ↑/↓ (ou j/k) d'une fiche à l'autre, hors des champs de saisie.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sceneOptions = campaigns.flatMap((c) => (c.scenes || []).map((sc) => ({ id: sc.id, label: `${c.title} → ${sc.title}` })));

  const setImage = (n, src, source) => assignPortrait(dispatch, n, src, source);
  const autoImage = (n) => autoPortrait(dispatch, n, imageIndex);

  function add(entity, extra = {}) {
    const n = { ...entity, ...extra, id: uid(), createdAt: now() };
    dispatch({ type: 'ADD_NPC', n });
    return n;
  }

  /** Génération. `random` : tout au hasard (on ignore le texte et les champs), seul le FP ou le clan peut contraindre. */
  async function generate(random = false) {
    setBusy('gen');
    setErr('');
    try {
      const idea = random ? '' : quick;
      const notes = random ? '' : [quick, f.backstory && `Histoire : ${f.backstory}`].filter(Boolean).join('\n');
      const items = Array.from({ length: Math.max(1, Math.min(6, count)) }, () => ({
        mode,
        difficulty,
        notes,
        name: random || count !== 1 ? '' : f.name,
        function: random ? '' : f.function,
        ancestry: random ? '' : f.ancestry,
        role: random ? '' : f.role,
        cr: f.cr,
        clan: mode === 'npc' || mode === 'monster' ? f.clan : '',
      }));
      // Sans nom ni idée imposés, l'IA ne doit pas reprendre les personnages célèbres des Archives.
      const free = random || (!idea && !f.name && !f.function);
      const ctx = buildLoreContext({ universe, state, feed, party, budget: 7000, noNamedPersons: free, focus: `${idea} ${f.function} ${f.ancestry} ${f.name}` });
      const made = [];
      for (let i = 0; i < items.length; i += 3) {
        const batch = items.slice(i, i + 3);
        const entities = await generateEntities((o) => callAI(ai, o), {
          ctx: batch.length > 1 ? `${ctx}\n\nCrée des fiches VARIÉES (noms, rôles, tactiques différents).` : ctx,
          items: batch,
          level: lvl,
          size,
        });
        for (const e of entities) made.push(add(e, { linkedSceneIds: f.sceneIds, sourceNotes: notes, clan: f.clan || undefined }));
      }
      if (made[0]) select(made[0].id);
      made.forEach((n) => autoImage(n));
      flash(made.length > 1 ? `${made.length} fiches créées.` : `${made[0]?.name} ajouté à PNJ & Créatures.`);
      setF((s) => ({ ...s, name: '', backstory: '', sceneIds: [] }));
    } catch (e) {
      setErr(e.message);
    }
    setBusy('');
  }

  function importSrd() {
    const stat = STATS[srdPick];
    if (!stat) return;
    const n = add(entityFromSrd(stat));
    select(n.id);
    setImage(n, tokenImage({ kind: 'monster', statId: stat.id }), 'srd');
    setSrdPick('');
    flash(`${stat.name} importé du SRD : modifie-le à ta guise.`);
  }

  async function aiPortrait(n) {
    setBusy('img');
    try {
      const prompt = n.imagePrompt || `${n.name}, ${n.kind || n.type || ''}. ${n.description || n.shortDescription || ''}`;
      await setImage(n, await generatePortrait(ai, prompt, clanPaintBrief(feed, n.clan)), 'generated');
      flash('Portrait et jeton créés.');
    } catch (e) {
      flash(e.message);
    }
    setBusy('');
  }

  async function uploadImage(n, file) {
    if (!file) return;
    try {
      await setImage(n, await fileToCompressed(file), 'upload');
      flash('Portrait et jeton assignés.');
    } catch (e) {
      flash(e.message);
    }
  }

  async function uploadToken(n, file) {
    if (!file) return;
    try {
      const src = await fileToCompressed(file, { max: 512 });
      dispatch({ type: 'UPDATE_NPC', id: n.id, patch: { token: await makeToken(src, { hostile: isMon(n) }) } });
      flash('Jeton remplacé.');
    } catch (e) {
      flash(e.message);
    }
  }

  function patchArray(n, key, i, patch) {
    const arr = [...(n[key] || [])];
    arr[i] = { ...arr[i], ...patch };
    dispatch({ type: 'UPDATE_NPC', id: n.id, patch: { [key]: arr } });
  }

  const portrait = selected ? portraitOf(state, selected) : '';
  const sceneLabels = selected ? getLinkedSceneLabels(selected.linkedSceneIds || [], campaigns) : [];
  const campaignLabels = selected ? campaigns.filter((c) => (selected.campaignIds || []).includes(c.id)).map((c) => c.title) : [];

  return (
    <>
      <h1 className="view">PNJ & Créatures</h1>
      <p className="sub">
        Décris en une phrase (ou rien du tout) : l’IA forge une fiche 5e complète en puisant dans le lore. Chaque fiche est gardée
        dans ton grimoire, reçoit une image des Archives quand il en existe une, et un jeton réutilisé sur les cartes de combat.
      </p>

      <div className="panel bx-forge">
        <div className="bestiary-toggle">
          <button type="button" data-on={mode === 'monster' ? 1 : 0} onClick={() => setMode('monster')}>
            Créature
          </button>
          <button type="button" data-on={mode === 'npc' ? 1 : 0} onClick={() => setMode('npc')}>
            PNJ
          </button>
        </div>
        <div className="bx-quick">
          <input
            className="in"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && generate()}
            placeholder={mode === 'npc' ? 'ex. passeuse drow qui doit de l’argent aux duergars (vide : l’IA choisit)' : 'ex. colonie de moulasses qui garde une herse (vide : l’IA choisit)'}
          />
          <select className="in" style={{ flex: '0 0 130px' }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} title="Difficulté pour le groupe">
            {[
              ['trivial', 'Triviale'],
              ['easy', 'Facile'],
              ['moderate', 'Moyenne'],
              ['hard', 'Difficile'],
              ['deadly', 'Mortelle'],
              ['boss', 'Boss'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="in" style={{ flex: '0 0 76px' }} value={count} onChange={(e) => setCount(+e.target.value)} title="Nombre de fiches">
            {[1, 2, 3, 4, 6].map((c) => (
              <option key={c} value={c}>
                ×{c}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={!!busy} onClick={() => generate(false)}>
            {busy === 'gen' ? (
              <>
                <Spin /> Forge…
              </>
            ) : (
              `✦ Générer`
            )}
          </button>
          <button className="btn" disabled={!!busy} onClick={() => generate(true)} title="Ignore le texte et les champs : l'IA tire tout au hasard (le FP ou le clan, si tu les as choisis, restent imposés)">
            🎲 Tout au hasard
          </button>
        </div>
        <div className="bx-quick">
          <Field label="FP (vide : au hasard)">
            <select className="in" value={f.cr} onChange={(e) => set('cr', e.target.value)}>
              <option value="">Aléatoire</option>
              {['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Peuple / clan moriquendi (marques de guerre)">
            <select className="in" value={f.clan} onChange={(e) => set('clan', e.target.value)}>
              <option value="">Aucun / au hasard</option>
              {Object.entries(CLANS).map(([k, v]) => (
                <option key={k} value={k}>
                  Moriquendi · clan {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="bx-presets">
          {QUICK_PRESETS[mode].map((p) => (
            <button key={p} type="button" onClick={() => setQuick(p)}>
              {p}
            </button>
          ))}
          <button type="button" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '− Moins de détails' : '+ Tout choisir moi-même'}
          </button>
        </div>
        {advanced && (
          <>
            <div className="row">
              <Field label="Nom">
                <input className="in" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="vide : l’IA choisit" />
              </Field>
              <Field label={mode === 'npc' ? 'Fonction / rôle social' : 'Espèce / type'}>
                <input className="in" value={f.function} onChange={(e) => set('function', e.target.value)} />
              </Field>
              <Field label="Origine / nature">
                <input className="in" value={f.ancestry} onChange={(e) => set('ancestry', e.target.value)} />
              </Field>
            </div>
            <div className="row">
              <Field label={mode === 'npc' ? 'Utilité dans l’histoire' : 'Rôle au combat'}>
                <input className="in" value={f.role} onChange={(e) => set('role', e.target.value)} placeholder={mode === 'npc' ? 'indice, suspect, allié fragile…' : 'brute, tireur, contrôleur…'} />
              </Field>
              <Field label="FP visé">
                <input className="in" value={f.cr} onChange={(e) => set('cr', e.target.value)} placeholder="ex. 2" />
              </Field>
            </div>
            <Field label="Histoire inventée en jeu">
              <textarea className="in" rows={2} value={f.backstory} onChange={(e) => set('backstory', e.target.value)} />
            </Field>
            {sceneOptions.length > 0 && (
              <Field label="Associer à des scènes">
                <div className="scene-link-box">
                  {sceneOptions.slice(0, 24).map((sc) => (
                    <button
                      type="button"
                      key={sc.id}
                      data-on={f.sceneIds.includes(sc.id) ? 1 : 0}
                      onClick={() => set('sceneIds', f.sceneIds.includes(sc.id) ? f.sceneIds.filter((x) => x !== sc.id) : [...f.sceneIds, sc.id])}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        <div className="bx-quick">
          <select className="in" value={srdPick} onChange={(e) => setSrdPick(e.target.value)}>
            <option value="">Importer une fiche du SRD (instantané, sans IA)…</option>
            {Object.values(STATS)
              .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · FP {s.cr.split(' ')[0]}
                </option>
              ))}
          </select>
          <button className="btn" disabled={!srdPick} onClick={importSrd}>
            Importer
          </button>
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          Équilibré pour {size} héros de niveau {lvl}.
        </div>
        {err && <div style={{ color: 'var(--blood)', fontSize: 13 }}>{err}</div>}
      </div>

      {npcs.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <div className="big">Le bestiaire est vide</div>
          <p className="muted">Clique sur « Générer » sans rien écrire : l’IA s’inspire de ton univers.</p>
        </div>
      ) : (
        <div className="bx-layout">
          <aside className="panel bx-list">
            <input className="in" placeholder="Chercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="bx-filters">
              {[
                ['all', `Tous · ${npcs.length}`],
                ['monster', `Créatures · ${npcs.filter(isMon).length}`],
                ['npc', `PNJ · ${npcs.filter((n) => !isMon(n)).length}`],
              ].map(([k, l]) => (
                <button key={k} type="button" data-on={filter === k ? 1 : 0} onClick={() => setFilter(k)}>
                  {l}
                </button>
              ))}
            </div>
            <ul className="bx-items">
              {list.map((n) => {
                const img = n.token || portraitOf(state, n);
                return (
                  <li key={n.id}>
                    <button type="button" className="bx-item" data-on={selected?.id === n.id ? 1 : 0} onClick={() => select(n.id)}>
                      {img ? <img src={img} alt="" loading="lazy" /> : <span className="bx-ph">{isMon(n) ? '👹' : '✦'}</span>}
                      <span>
                        <b>{n.name}</b>
                        <small>{[isMon(n) ? 'Créature' : 'PNJ', n.kind || n.type || n.role].filter(Boolean).join(' · ')}</small>
                      </span>
                      <span className="bx-cr">FP {n.cr || '—'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="bx-hint">↑ ↓ (ou j / k) pour passer d’une fiche à l’autre</div>
          </aside>

          <main>
            {selected && (
              <>
                <div className="bx-nav">
                  <div className="bx-nav-group">
                    <button className="btn ghost sm" onClick={() => step(-1)} title="Fiche précédente">
                      ◀
                    </button>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {pos + 1} / {list.length}
                    </span>
                    <button className="btn ghost sm" onClick={() => step(1)} title="Fiche suivante">
                      ▶
                    </button>
                  </div>
                  <div className="bx-nav-group bx-media">
                    <button className="btn ghost sm" onClick={() => setEditing((v) => !v)}>
                      {editing ? 'Fermer l’édition' : '✎ Modifier'}
                    </button>
                    <button className="btn ghost sm" onClick={() => setPicker(true)}>
                      Image des Archives
                    </button>
                    <label className="btn ghost sm">
                      Importer une image
                      <input hidden type="file" accept="image/*" onChange={(e) => { uploadImage(selected, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button className="btn ghost sm" disabled={busy === 'img'} onClick={() => aiPortrait(selected)} title={ai.provider === 'openai' ? 'gpt-image-1' : 'Pollinations (gratuit) : seule la description visuelle est envoyée'}>
                      {busy === 'img' ? <Spin /> : '✦ Portrait IA'}
                    </button>
                    <label className="btn ghost sm" title="Remplacer seulement le jeton de carte">
                      Jeton
                      <input hidden type="file" accept="image/*" onChange={(e) => { uploadToken(selected, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        const copy = add({ ...selected, name: `${selected.name} (copie)` });
                        if (portrait) setImage(copy, portrait, 'copy');
                        select(copy.id);
                      }}
                    >
                      Dupliquer
                    </button>
                    <button
                      className="btn ghost sm danger"
                      onClick={() => {
                        if (confirm(`Supprimer ${selected.name} ?`)) {
                          step(1);
                          dispatch({ type: 'DELETE_NPC', id: selected.id });
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {editing && <BestiaryEditor n={selected} dispatch={dispatch} />}
                <StatSheet
                  n={selected}
                  portrait={portrait}
                  token={selected.token}
                  scenes={sceneLabels}
                  campaigns={campaignLabels}
                  onPortraitClick={() => setPicker(true)}
                  onSpendAction={(i, d) => {
                    const a = selected.actions[i];
                    const max = Number(a.usesMax || 0);
                    patchArray(selected, 'actions', i, { usesLeft: Math.max(0, Math.min(max, Number(a.usesLeft ?? max) + d)) });
                  }}
                  onEffect={(i, patch) => patchArray(selected, 'effects', i, patch)}
                />
              </>
            )}
          </main>
        </div>
      )}

      {picker && selected && (
        <ArchiveImagePicker
          index={imageIndex}
          suggested={matchArchiveImages([selected.name, selected.kind, selected.type].filter(Boolean), imageIndex)}
          withCreatures
          onClose={() => setPicker(false)}
          onPick={(img) => {
            setImage(selected, img.src, 'archives');
            setPicker(false);
            flash('Image et jeton assignés.');
          }}
        />
      )}
    </>
  );
}

/** Édition d'une fiche : les champs texte directement, les listes une entrée par ligne (« Nom. Description »). */
function BestiaryEditor({ n, dispatch }) {
  const up = (patch) => dispatch({ type: 'UPDATE_NPC', id: n.id, patch });
  const field = (k, label, type = 'text') => (
    <Field label={label}>
      <input className="in" type={type} value={n[k] ?? ''} onChange={(e) => up({ [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />
    </Field>
  );
  const area = (k, label) => (
    <Field label={label}>
      <textarea className="in" value={n[k] ?? ''} onChange={(e) => up({ [k]: e.target.value })} />
    </Field>
  );
  const named = (k, label) => (
    <Field label={`${label} (une par ligne : « Nom. Description »)`}>
      <textarea
        className="in"
        defaultValue={(n[k] || []).map((t) => `${t.name}. ${t.desc || ''}`.trim()).join('\n')}
        onBlur={(e) =>
          up({
            [k]: splitLines(e.target.value).map((line, i) => {
              const [name, ...rest] = line.split('. ');
              return { ...(n[k]?.[i] || {}), name: name.trim(), desc: rest.join('. ').trim() };
            }),
          })
        }
      />
    </Field>
  );
  return (
    <div className="panel bx-edit" style={{ marginBottom: 12 }} key={n.id}>
      <div className="row">
        {field('name', 'Nom')}
        {field('kind', 'Nature / espèce')}
        {field('role', 'Rôle')}
        <Field label="Type">
          <select className="in" value={n.entityType === 'monster' || n.isMonster ? 'monster' : 'npc'} onChange={(e) => up({ entityType: e.target.value, isMonster: e.target.value === 'monster' })}>
            <option value="monster">Créature</option>
            <option value="npc">PNJ</option>
          </select>
        </Field>
      </div>
      <div className="row">
        {field('cr', 'FP')}
        {field('ac', 'CA', 'number')}
        {field('hp', 'PV', 'number')}
        {field('hitDice', 'Dés de vie')}
        {field('speed', 'Vitesse')}
      </div>
      <div className="row">
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => (
          <Field key={k} label={{ str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA' }[k]}>
            <input className="in" type="number" value={n[k] ?? 10} onChange={(e) => up({ [k]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
      <div className="row">
        {field('senses', 'Sens')}
        {field('languages', 'Langues')}
        {field('resistances', 'Résistances')}
        {field('immunities', 'Immunités')}
      </div>
      {area('shortDescription', 'Résumé')}
      <div className="row">
        {area('voice', 'Voix')}
        {area('motivation', 'Motivation')}
        {area('secret', 'Secret')}
      </div>
      <VoiceProfileEditor n={n} up={up} />
      {area('tactics', 'Tactique')}
      {named('traits', 'Traits')}
      {named('actions', 'Actions')}
      {area('description', 'Description')}
    </div>
  );
}
/** Profil de voix d'un PNJ : automatique (déduit de la fiche) ou manuel, avec préréglages. */
function VoiceProfileEditor({ n, up }) {
  const vp = n.voiceProfile || { mode: 'auto' };
  const set = (patch) => up({ voiceProfile: { ...vp, ...patch } });
  const applyPreset = (key) => {
    const p = VOICE_PRESETS[key];
    up({ voiceProfile: { mode: 'manual', voiceName: p.voiceName, model: p.model, stability: p.stability, style: p.style } });
  };
  const switchMode = (mode) =>
    set(
      mode === 'manual'
        ? { mode, voiceName: vp.voiceName || 'George', model: vp.model || VOICE_MODELS[0].id, stability: vp.stability ?? 0.5, style: vp.style ?? 0.35 }
        : { mode }
    );
  const isV3 = vp.model === 'eleven_v3';

  return (
    <div className="voice-profile" style={{ margin: '8px 0' }}>
      <div className="eyebrow">Profil de voix</div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Mode">
          <select className="in" value={vp.mode || 'auto'} onChange={(e) => switchMode(e.target.value)}>
            <option value="auto">Automatique (déduit de la fiche)</option>
            <option value="manual">Manuel</option>
          </select>
        </Field>
        {Object.entries(VOICE_PRESETS).map(([key, p]) => (
          <button key={key} className="btn ghost sm" style={{ flex: 'none' }} onClick={() => applyPreset(key)}>
            {p.label}
          </button>
        ))}
      </div>
      {vp.mode === 'manual' && (
        <div className="row">
          <Field label="Voix">
            <select className="in" value={vp.voiceName} onChange={(e) => set({ voiceName: e.target.value })}>
              {VOICE_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Modèle">
            <select className="in" value={vp.model} onChange={(e) => set({ model: e.target.value })}>
              {VOICE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Stabilité">
            {isV3 ? (
              <select className="in" value={vp.stability ?? 0} onChange={(e) => set({ stability: Number(e.target.value) })}>
                <option value={0}>Créatif</option>
                <option value={0.5}>Naturel</option>
                <option value={1}>Robuste</option>
              </select>
            ) : (
              <input type="range" min="0" max="1" step="0.05" value={vp.stability ?? 0.5} onChange={(e) => set({ stability: Number(e.target.value) })} />
            )}
          </Field>
          <Field label={`Expressivité (${Number(vp.style ?? 0.35).toFixed(2)})`}>
            <input type="range" min="0" max="1" step="0.05" value={vp.style ?? 0.35} onChange={(e) => set({ style: Number(e.target.value) })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function getLinkedSceneLabels(sceneIds, campaigns) {
  if (!sceneIds || sceneIds.length === 0) return [];

  const scenes = campaigns.flatMap((c) =>
    (c.scenes || []).map((sc) => ({
      id: sc.id,
      label: `${c.title} → ${sc.title}`,
    }))
  );

  return sceneIds
    .map((id) => scenes.find((sc) => sc.id === id)?.label)
    .filter(Boolean);
}

/* ----------------------------- Encounter / Combat ----------------------- */
/**
 * Module Combat. Utilisé tel quel dans l’onglet Combat, et sous la carte de combat (`embedded`) :
 * la sélection est alors partagée avec le plateau, et la mini-carte cède la place au vrai plateau.
 */
/** Pile d’annulation du combat, pour la session en cours : l’état du combat avant chaque geste de jeu. */
const combatUndo = [];
const COMBAT_UNDO_MAX = 40;
const COMBAT_JOURNAL_MAX = 150;

/** États de D&D 5e (DRS), avec leur effet en une ligne. La Concentration est un repère du MJ. */
const COMBAT_CONDITIONS = [
  { name: 'À terre', icon: '⤓', rule: 'Se déplace en rampant. Désavantage à ses attaques ; les attaques contre lui ont l’avantage à 1,5 m, le désavantage au-delà.' },
  { name: 'Agrippé', icon: '✊', rule: 'Vitesse 0. Prend fin si l’agrippeur est neutralisé ou si la créature est éloignée de lui.' },
  { name: 'Assourdi', icon: '🔇', rule: 'N’entend rien ; échoue aux tests qui demandent l’ouïe.' },
  { name: 'Aveuglé', icon: '◌', rule: 'Ne voit rien. Désavantage à ses attaques ; les attaques contre lui ont l’avantage.' },
  { name: 'Charmé', icon: '♥', rule: 'Ne peut pas attaquer le charmeur ; le charmeur a l’avantage à ses tests sociaux contre lui.' },
  { name: 'Effrayé', icon: '!', rule: 'Désavantage aux tests et attaques tant que la source est en vue ; ne peut pas s’en approcher.' },
  { name: 'Empoisonné', icon: '☠', rule: 'Désavantage aux jets d’attaque et aux tests de caractéristique.' },
  { name: 'Entravé', icon: '⛓', rule: 'Vitesse 0. Désavantage à ses attaques et aux JS de Dextérité ; les attaques contre lui ont l’avantage.' },
  { name: 'Étourdi', icon: '✷', rule: 'Neutralisé, immobile, parle à peine. Rate ses JS de Force et de Dextérité ; les attaques contre lui ont l’avantage.' },
  { name: 'Inconscient', icon: '☾', rule: 'Neutralisé, à terre, lâche ce qu’il tient. Rate ses JS de Force et de Dextérité ; attaques avec avantage, critique à 1,5 m.' },
  { name: 'Invisible', icon: '◇', rule: 'Les attaques contre lui ont le désavantage ; ses attaques ont l’avantage.' },
  { name: 'Neutralisé', icon: '⊘', rule: 'Ni action ni réaction.' },
  { name: 'Paralysé', icon: '❄', rule: 'Neutralisé, immobile, muet. Rate ses JS de Force et de Dextérité ; attaques avec avantage, critique à 1,5 m.' },
  { name: 'Pétrifié', icon: '▣', rule: 'Changé en pierre : neutralisé, résistance à tous les dégâts. Les attaques contre lui ont l’avantage.' },
  { name: 'Épuisement', icon: '⧗', rule: 'Effets cumulés par niveau (1 : désavantage aux tests de caractéristique… 6 : mort).' },
  { name: 'Concentration', icon: '◎', rule: 'Maintient un sort. Après des dégâts : JS de Constitution, DD 10 ou la moitié des dégâts si c’est plus.' },
];
const conditionOf = (name) => COMBAT_CONDITIONS.find((x) => x.name === name) || { name, icon: '•', rule: '' };

/** États d’un combattant, compacts : pastilles à retirer d’un clic et liste pour en ajouter (fiche du jeton, carte). */
function ConditionPicker({ conditions = [], onChange }) {
  return (
    <div className="cond-picker">
      {conditions.map((name) => {
        const cd = conditionOf(name);
        return (
          <button key={name} type="button" className="cond-picker-chip" title={`${cd.rule}\nClic : retirer`} onClick={() => onChange(conditions.filter((n) => n !== name))}>
            <span aria-hidden="true">{cd.icon}</span> {name} <span aria-hidden="true">×</span>
          </button>
        );
      })}
      <select
        className="cond-picker-add"
        value=""
        aria-label="Ajouter un état"
        onChange={(e) => e.target.value && onChange([...conditions, e.target.value])}
      >
        <option value="">+ État…</option>
        {COMBAT_CONDITIONS.filter((cd) => !conditions.includes(cd.name)).map((cd) => (
          <option key={cd.name} value={cd.name} title={cd.rule}>{cd.name}</option>
        ))}
      </select>
    </div>
  );
}

/** Jet de dés : « 2d8 +4 », « d20 +7 1d4 adv. » ; les dés sont doublés en cas de critique. */
function rollDiceText(text, { crit = false } = {}) {
  const src = String(text || '');
  const rolls = [];
  let total = 0;
  for (const m of src.matchAll(/(^|\s)([+-]?)(\d+)d(\d+)/g)) {
    const n = Number(m[3]) * (crit ? 2 : 1);
    const faces = Number(m[4]);
    const sign = m[2] === '-' ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const r = 1 + Math.floor(Math.random() * faces);
      rolls.push(sign * r);
      total += sign * r;
    }
  }
  const flat = /(^|\s)([+-]\s?\d+)(?![\dd])/.exec(src.replace(/(^|\s)[+-]?\d*d\d+/g, ' '));
  const bonus = flat ? Number(flat[2].replace(/\s/g, '')) : 0;
  return { total: total + bonus, rolls, bonus };
}

function rollCombatAttack(combatant, attack) {
  const calc = calculateAttackLine(combatant, attack, getCombatantDerivedStats(combatant));
  const adv = / adv\./.test(calc.toHit);
  const dis = /disadv\./.test(calc.toHit);
  const d20s = [1 + Math.floor(Math.random() * 20)];
  if (adv || dis) d20s.push(1 + Math.floor(Math.random() * 20));
  const nat = adv ? Math.max(...d20s) : dis ? Math.min(...d20s) : d20s[0];
  const rest = rollDiceText(calc.toHit.replace(/^d20/, '').replace(/(dis)?adv\./, ''));
  const crit = nat === 20;
  const dmg = calc.damage && calc.damage !== '—' ? rollDiceText(calc.damage, { crit }) : null;
  const dmgType = calc.damage ? calc.damage.replace(/(^|\s)[+-]?\d*d\d+/g, ' ').replace(/(^|\s)[+-]\s?\d+/g, ' ').trim() : '';
  return {
    key: uid(),
    who: combatant.name,
    name: attack.name,
    d20s,
    nat,
    adv,
    dis,
    total: nat + rest.total,
    crit,
    fumble: nat === 1,
    dmg: dmg ? Math.max(0, dmg.total) : null,
    dmgType,
    formula: `${calc.toHit} · ${calc.damage}`,
  };
}

/**
 * Un nouveau combattant prend une case libre près de sa position par défaut (grille 12 × 12) et, s’il porte le nom
 * d’un autre, un numéro : trois gobelins deviennent Gobelin, Gobelin 2, Gobelin 3.
 */
function withFreshInstance(list, combatant, blockedCells = []) {
  const base = combatant.name;
  const same = list.filter((x) => x.name === base || x.name.startsWith(`${base} `) && /^\d+$/.test(x.name.slice(base.length + 1))).length;
  const name = same ? `${base} ${same + 1}` : base;
  const taken = new Set([...blockedCells, ...list.map((t) => `${Number(t.token?.x || 0)},${Number(t.token?.y || 0)}`)]);
  const x0 = Number(combatant.token?.x || 0);
  const y0 = Number(combatant.token?.y || 0);
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || x < 0 || y < 0 || x > 11 || y > 11 || taken.has(`${x},${y}`)) continue;
        return { ...combatant, name, token: { ...(combatant.token || {}), x, y } };
      }
    }
  }
  return { ...combatant, name };
}

function Encounter({ dispatch, state, party, npcs, flash, embedded, onOpenBattleMap }) {
  const c = state.combat || { combatants: [], round: 1 };
  const [dmg, setDmg] = useState({});
  const [infoModal, setInfoModal] = useState(null);
  const [sideMap, setSideMap] = useState(() => { try { return localStorage.getItem('loresmith:combat-side-map') || 'mini'; } catch { return 'mini'; } });
  const chooseSideMap = (v) => { setSideMap(v); try { localStorage.setItem('loresmith:combat-side-map', v); } catch { /* préférence non gardée */ } };
  // Page Combat avec la carte de combat : la situation tactique (abri, menaces) vient du plateau lié au combat.
  const boundMapId = String(state.combat?.battleKey || '').split(':')[0];
  const boundMapRec = state.maps?.[boundMapId];
  const boundMap = !embedded && sideMap === 'board' ? boundMapRec : null;
  const boardTactics = useMemo(
    () => (boundMap?.battle && battleKeyOf(boundMap) === state.combat?.battleKey ? battleTactics(boundMap.battle, state.combat?.combatants || []) : null),
    [boundMap, state.combat],
  );
  const tacticsById = embedded?.tactics || boardTactics;
  const [localSelection, setLocalSelection] = useState('');
  const selectedTokenId = embedded ? embedded.selectedId || '' : localSelection;
  const setSelectedTokenId = embedded ? (id) => embedded.onSelect?.(id || null) : setLocalSelection;
  const [mapMode, setMapMode] = useState('move');
  const [showGrid, setShowGrid] = useState(true);
  const [tab, setTab] = useState('tour');
  const [lastRoll, setLastRoll] = useState(null);
  const [hpPulse, setHpPulse] = useState(null);
  const [showKeys, setShowKeys] = useState(false);

  /**
   * Toute modification du combat passe ici. Avec un libellé, le geste peut être annulé et il est consigné au journal
   * (sauf `log: false`) ; `undo: false` le consigne sans l’empiler.
   */
  const setC = (patch, label, opts = {}) => {
    if (label && opts.undo !== false) {
      combatUndo.push({ label, combat: c });
      if (combatUndo.length > COMBAT_UNDO_MAX) combatUndo.shift();
    }
    const entry = label && opts.log !== false
      ? { id: uid(), at: Date.now(), round: Number(patch.round ?? c.round ?? 1), text: label, tone: opts.tone || '' }
      : null;
    dispatch({
      type: 'COMBAT_SET',
      patch: entry ? { ...patch, journal: [entry, ...(c.journal || [])].slice(0, COMBAT_JOURNAL_MAX) } : patch,
    });
  };

  function undo() {
    const last = combatUndo.pop();
    if (!last) return;
    // Le lien avec le plateau reste celui d’aujourd’hui : la synchronisation replace ou retire les jetons d’elle-même.
    const entry = { id: uid(), at: Date.now(), round: Number(last.combat.round || 1), text: `Annulé : ${last.label}`, tone: 'undo' };
    // Les états restaurés doivent repartir vers les jetons : on garde le dernier accord fiche ↔ jeton d’aujourd’hui.
    const agreed = new Map((c.combatants || []).map((x) => [x.id, x.condsAt]));
    dispatch({
      type: 'COMBAT_SET',
      patch: {
        ...last.combat,
        combatants: (last.combat.combatants || []).map((x) => (agreed.has(x.id) ? { ...x, condsAt: agreed.get(x.id) } : x)),
        battleKey: c.battleKey,
        syncedIds: c.syncedIds,
        journal: [entry, ...(last.combat.journal || [])].slice(0, COMBAT_JOURNAL_MAX),
      },
    });
    flash(`Annulé : ${last.label}`);
  }

  const combatants = c.combatants || [];
  const blockedCells = c.blockedCells || [];

  const sorted = [...combatants].sort(
    (a, b) => (Number(b.init) || 0) - (Number(a.init) || 0)
  );
  const turnIndex = Number(c.turnIndex || 0);
  const activeCombatant = sorted.length
    ? sorted[Math.min(turnIndex, sorted.length - 1) % sorted.length]
    : null;
  const selectedCombatant = combatants.find((x) => x.id === selectedTokenId) || activeCombatant;

  function update(id, patch, label, opts) {
    setC({
      combatants: combatants.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }, label, opts);
  }

  function remove(id) {
    const t = combatants.find((x) => x.id === id);
    setC({
      combatants: combatants.filter((x) => x.id !== id),
    }, t ? `${t.name} retiré du combat` : '', { tone: 'out' });
    if (selectedTokenId === id) setSelectedTokenId('');
  }

  function addCombatant(source, isPC) {
    const combatant = withFreshInstance(combatants, isPC
      ? buildPcCombatant(source)
      : buildNpcCombatant(source), blockedCells);

    setC({
      combatants: [...combatants, combatant],
    }, `${combatant.name} rejoint le combat`, { tone: 'join' });

    flash(`${combatant.name} ajouté au combat`);
  }

  function addWholeParty() {
    const present = new Set(combatants.filter((x) => x.isPC).map((x) => x.sourceId));
    const fresh = [];
    for (const p of party.filter((h) => !present.has(h.id))) fresh.push(withFreshInstance([...combatants, ...fresh], buildPcCombatant(p), blockedCells));
    if (!fresh.length) {
      flash('Tout le groupe est déjà au combat.');
      return;
    }
    setC({ combatants: [...combatants, ...fresh] }, `${fresh.map((x) => x.name).join(', ')} rejoignent le combat`, { tone: 'join' });
  }

  /** d20 + modificateur de Dextérité, pour les créatures seulement ou pour tout le monde. */
  function rollInitiative(who) {
    const rolled = [];
    const next = combatants.map((x) => {
      if (who === 'foes' && x.isPC) return x;
      const d20 = 1 + Math.floor(Math.random() * 20);
      const init = d20 + abilityMod(Number(x.dex) || 10);
      rolled.push(`${x.name} ${init}`);
      return { ...x, init };
    });
    if (!rolled.length) return;
    setC({ combatants: next, turnIndex: 0 }, `Initiative ${who === 'foes' ? 'des créatures' : 'de tous'} : ${rolled.join(', ')}`, { tone: 'roll' });
  }

  function addBlank() {
    setC({
      combatants: [
        ...combatants,
        withFreshInstance(combatants, {
          id: uid(),
          sourceId: '',
          name: 'Combatant',
          isPC: false,
          maxHp: 10,
          hp: 10,
          ac: 12,
          baseAc: 12,
          init: 10,
          speed: '30 ft.',
          attacks: [
            {
              name: 'Attaque improvisée',
              type: 'action',
              attackBonus: 3,
              damageDice: '1d6',
              damageBonus: 1,
              damageType: 'bludgeoning',
              range: '5 ft.',
              desc: 'Attaque de base improvisée.',
            },
          ],
          effects: getDefaultCombatEffects(false),
          token: makeDefaultToken(false),
        }, blockedCells),
      ],
    }, 'Combattant improvisé ajouté', { tone: 'join' });
  }

  /** Dégâts (delta < 0) ou soins : les PV temporaires absorbent les dégâts en premier. */
  function adjustHp(id, delta) {
    const t = combatants.find((x) => x.id === id);
    if (!t || !delta) return;
    const max = Number(t.maxHp) || 0;
    let hp = Number(t.hp) || 0;
    let temp = Number(t.tempHp) || 0;
    if (delta < 0) {
      const absorbed = Math.min(temp, -delta);
      temp -= absorbed;
      hp = Math.max(0, hp - (-delta - absorbed));
    } else {
      hp = Math.min(max, hp + delta);
    }
    let label = delta < 0
      ? `${t.name} subit ${-delta} dégâts (${hp}/${max} PV)`
      : `${t.name} récupère ${delta} PV (${hp}/${max} PV)`;
    if (delta < 0 && (t.conditions || []).includes('Concentration')) {
      label += ` · JS de Concentration DD ${Math.max(10, Math.floor(-delta / 2))}`;
    }
    if (hp === 0 && Number(t.hp) > 0) label += t.isPC ? ' · à 0 PV : jets contre la mort' : ' · hors de combat';
    const patch = { hp, tempHp: temp };
    if (hp > 0 && t.deathSaves) patch.deathSaves = { s: 0, f: 0 };
    update(id, patch, label, { tone: delta < 0 ? 'hit' : 'heal' });
    setHpPulse({ id, delta, key: uid() });
  }

  function applyHp(id, sign) {
    const v = parseInt(dmg[id], 10);
    if (!v) return;

    const t = combatants.find((x) => x.id === id);
    if (!t) return;

    adjustHp(id, -sign * Math.abs(v));

    setDmg((d) => ({ ...d, [id]: '' }));
  }

  function setHpExact(id, value) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;
    const hp = Math.max(0, Math.min(Number(t.maxHp) || 0, Number(value) || 0));
    if (hp === Number(t.hp)) return;
    update(id, { hp }, `${t.name} : PV fixés à ${hp}/${t.maxHp}`, { tone: hp < t.hp ? 'hit' : 'heal' });
  }

  function setTempHp(id, value) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;
    const temp = Math.max(0, Number(value) || 0);
    update(id, { tempHp: temp }, `${t.name} : ${temp} PV temporaires`, { tone: 'heal' });
  }

  function toggleCondition(id, name) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;
    const has = (t.conditions || []).includes(name);
    update(
      id,
      { conditions: has ? t.conditions.filter((n) => n !== name) : [...(t.conditions || []), name] },
      has ? `${t.name} n’est plus ${name.toLowerCase()}` : `${t.name} : ${name}`,
      { tone: 'state' },
    );
  }

  function changeDeathSaves(id, key, delta) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;
    const ds = { s: 0, f: 0, ...(t.deathSaves || {}) };
    ds[key] = Math.max(0, Math.min(3, ds[key] + delta));
    const label = ds.s === 3
      ? `${t.name} est stabilisé`
      : ds.f === 3
        ? `${t.name} succombe`
        : `${t.name} : jets contre la mort ${ds.s} réussite(s), ${ds.f} échec(s)`;
    update(id, { deathSaves: ds }, label, { tone: ds.f === 3 ? 'out' : 'state' });
  }

  function rollAttack(t, index) {
    const attack = (t?.attacks || [])[index];
    if (!attack) return;
    if (t.isPC && activeCombatant && activeCombatant.id !== t.id) {
      flash(`Ce n’est pas le tour de ${t.name} : un héros n’attaque que pendant son tour.`);
      return;
    }
    // Sur la carte de combat, l’attaque passe par le panneau d’attaque : cible la plus proche, arme choisie.
    if (embedded?.battle) {
      const b = embedded.battle;
      const me = b.tokens.find((q) => q.id === t.id);
      if (me) {
        const gap = (q) => Math.max(Math.abs(q.x - me.x), Math.abs(q.y - me.y));
        const foes = b.tokens.filter((q) => q.id !== t.id && (q.kind === 'pc') !== (me.kind === 'pc') && Number(q.hp ?? 1) > 0);
        const target = [...foes].sort((x, y) => gap(x) - gap(y))[0] || b.tokens.find((q) => q.id !== t.id);
        if (target) {
          embedded.setBattle({ ...b, aim: { from: t.id, to: target.id, at: Date.now(), pick: index } });
          return;
        }
      }
    }
    const r = rollCombatAttack(t, attack);
    setLastRoll(r);
    const verdict = r.crit ? ' — CRITIQUE' : r.fumble ? ' — échec automatique' : '';
    setC({}, `${t.name} · ${attack.name} : ${r.total} pour toucher${verdict}${r.dmg !== null && !r.fumble ? ` · ${r.dmg} dégâts${r.dmgType ? ` ${r.dmgType}` : ''}` : ''}`, { undo: false, tone: 'roll' });
  }

  function toggleEffect(id, effectIndex) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;

    const effects = [...(t.effects || [])];
    const effect = effects[effectIndex];
    if (!effect) return;

    effects[effectIndex] = {
      ...effect,
      active: !effect.active,
    };

    update(id, { effects }, `${t.name} : ${effect.name} ${effect.active ? 'retiré' : 'actif'}`, { tone: 'state' });
  }

  function changeEffectUses(id, effectIndex, delta) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;

    const effects = [...(t.effects || [])];
    const effect = effects[effectIndex];
    if (!effect) return;

    const max = Number(effect.usesMax || 0);
    const current = Number(effect.usesLeft ?? max);

    effects[effectIndex] = {
      ...effect,
      usesLeft: Math.max(0, Math.min(max, current + delta)),
    };

    update(id, { effects }, `${t.name} : ${effect.name} ${delta < 0 ? 'utilisé' : 'rechargé'}`, { log: false });
  }

  function changeActionUses(id, actionIndex, delta) {
    const t = combatants.find((x) => x.id === id);
    if (!t) return;

    const attacks = [...(t.attacks || [])];
    const action = attacks[actionIndex];
    if (!action) return;

    const max = Number(action.usesMax || 0);
    const current = Number(action.usesLeft ?? max);

    attacks[actionIndex] = {
      ...action,
      usesLeft: Math.max(0, Math.min(max, current + delta)),
    };

    update(id, { attacks }, `${t.name} : ${action.name} ${delta < 0 ? 'utilisé' : 'rechargé'}`, { log: false });
  }

  function moveToken(id, x, y) {
    const key = `${x},${y}`;

    if (blockedCells.includes(key)) {
      flash('Cette case est inaccessible.');
      return;
    }

    const occupied = combatants.find(
      (t) =>
        t.id !== id &&
        Number(t.token?.x || 0) === x &&
        Number(t.token?.y || 0) === y
    );

    if (occupied) {
      flash('Cette case est déjà occupée.');
      return;
    }

    const t = combatants.find((q) => q.id === id);
    update(id, {
      token: {
        ...(t?.token || {}),
        x,
        y,
      },
    }, `${t?.name || 'Jeton'} déplacé`, { log: false });
  }

  function toggleBlockedCell(x, y) {
    const key = `${x},${y}`;

    const occupied = combatants.find(
      (t) => Number(t.token?.x || 0) === x && Number(t.token?.y || 0) === y
    );

    if (occupied) {
      flash('Impossible de bloquer une case occupée.');
      return;
    }

    setC({
      blockedCells: blockedCells.includes(key)
        ? blockedCells.filter((k) => k !== key)
        : [...blockedCells, key],
    });
  }

  function refreshRoundResources(list) {
    return list.map((t) => ({
      ...t,
      attacks: (t.attacks || []).map((a) =>
        a.reset === 'round' ? { ...a, usesLeft: Number(a.usesMax || 0) } : a
      ),
      effects: (t.effects || []).map((e) =>
        e.reset === 'round' ? { ...e, usesLeft: Number(e.usesMax || 0) } : e
      ),
    }));
  }

  function resetRoundResources() {
    const round = Number(c.round || 1) + 1;
    setC({
      round,
      turnIndex: 0,
      combatants: refreshRoundResources(combatants),
    }, `Manche ${round} : ressources de manche rechargées`, { tone: 'round' });
    if (sorted[0]) setSelectedTokenId(embedded ? sorted[0].id : '');
  }

  function advanceTurn() {
    if (!sorted.length) return;

    // Une créature hors de combat (0 PV) n’a plus de tour ; un héros à 0 PV garde le sien pour ses jets contre la mort.
    let nextIndex = turnIndex;
    let wraps = false;
    for (let i = 0; i < sorted.length; i++) {
      nextIndex = (nextIndex + 1) % sorted.length;
      if (nextIndex === 0) wraps = true;
      const n = sorted[nextIndex];
      if (n.isPC || Number(n.hp) > 0) break;
    }
    const round = wraps ? Number(c.round || 1) + 1 : Number(c.round || 1);
    const next = sorted[nextIndex];

    setC({
      turnIndex: nextIndex,
      round,
      combatants: wraps
        ? refreshRoundResources(combatants)
        : combatants,
    }, `${wraps ? `Manche ${round} · ` : ''}Tour de ${next?.name || '—'}`, { tone: wraps ? 'round' : 'turn' });
    // Sur la carte, la fiche du jeton suit le tour ; sur la page Combat, la fiche revient d’elle-même au tour actif.
    setSelectedTokenId(embedded ? next?.id : '');
    setLastRoll(null);
  }

  function previousTurn() {
    if (!sorted.length) return;
    const round = Number(c.round || 1);
    if (turnIndex === 0 && round <= 1) return;
    const prevIndex = turnIndex > 0 ? turnIndex - 1 : sorted.length - 1;
    const prevRound = turnIndex > 0 ? round : round - 1;
    setC({ turnIndex: prevIndex, round: prevRound }, `Retour au tour de ${sorted[prevIndex]?.name || '—'}`, { tone: 'turn' });
    setSelectedTokenId(embedded ? sorted[prevIndex]?.id : '');
  }

  function resetCombat() {
    if (!combatants.length) return;
    setC({ round: 1, turnIndex: 0, combatants: [] }, 'Combat vidé', { tone: 'out' });
    flash('Combat vidé — Ctrl+Z pour annuler.');
  }

  const dmStrategy = buildCombatStrategy(sorted, {
    round: c.round,
    activeCombatant,
    blockedCells,
  });

  // Raccourcis clavier de la Table de guerre (jamais pendant la saisie).
  const keysRef = useRef(null);
  keysRef.current = { advanceTurn, previousTurn, undo, sorted, selectedCombatant, rollAttack, setTab, setShowKeys, setSelectedTokenId };
  useEffect(() => {
    const onKey = (e) => {
      const k = keysRef.current;
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        k.undo();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.scrim, .lsx-palette')) return;
      const list = k.sorted;
      const at = list.findIndex((x) => x.id === k.selectedCombatant?.id);
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); if (e.shiftKey) k.previousTurn(); else k.advanceTurn(); }
      else if (e.key === 'ArrowRight' && list.length) { e.preventDefault(); k.setSelectedTokenId(list[(at + 1) % list.length].id); }
      else if (e.key === 'ArrowLeft' && list.length) { e.preventDefault(); k.setSelectedTokenId(list[(at - 1 + list.length) % list.length].id); }
      else if ((e.key === 'a' || e.key === 'A') && k.selectedCombatant?.attacks?.length) { e.preventDefault(); k.setTab('tour'); k.rollAttack(k.selectedCombatant, 0); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); k.setTab('tour'); setTimeout(() => document.querySelector('.wt-amount input')?.focus(), 0); }
      else if (/^[1-5]$/.test(e.key)) { e.preventDefault(); k.setTab(WAR_TABS[Number(e.key) - 1].id); }
      else if (e.key === '?') { e.preventDefault(); k.setShowKeys((v) => !v); }
      else if (e.key === 'Escape') { k.setShowKeys(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

    const ops = {
      update, remove, adjustHp, applyHp, setHpExact, setTempHp, toggleCondition, changeDeathSaves, rollAttack,
      toggleEffect, changeEffectUses, changeActionUses, addCombatant, addWholeParty, addBlank, rollInitiative,
      refreshFromSheet: (t) => {
        const source = npcs.find((n) => n.id === t.sourceId);
        if (!source) {
          flash('Aucune fiche source trouvée pour ce combattant.');
          return;
        }
        update(t.id, refreshCombatantFromNpc(t, source), `${t.name} réimporté depuis sa fiche`);
        flash(`${t.name} réimporté depuis sa fiche.`);
      },
    };
    // Sur la page Cartes, le plateau est celui de la carte ouverte ; sur la page Combat, celui lié au combat.
    const boardBattle = embedded ? embedded.battle : boundMapRec?.battle && battleKeyOf(boundMapRec) === c.battleKey ? boundMapRec.battle : null;
    const boardTokens = new Map((boardBattle?.tokens || []).map((t) => [t.id, t]));
    const setBoardBattle = embedded ? embedded.setBattle : (b) => dispatch({ type: 'UPDATE_MAP', id: boundMapRec.id, patch: { battle: b, updatedAt: Date.now() } });
    const hiddenCount = (boardBattle?.tokens || []).filter((t) => t.visible === false).length;
    const pstate = partyStateOf(combatants, party);
    const foes = combatants.filter((x) => !x.isPC && Number(x.hp) > 0);
    const rating = foes.length && pstate.levels.length
      ? rateEncounter(foes.map((x) => xpOfCombatant(x, boardTokens.get(x.id))), pstate)
      : null;
    const place = embedded?.place || boardBattle?.local?.place || boundMapRec?.title || '';
    const pcs = combatants.filter((x) => x.isPC);
    const avgLevel = pcs.length ? Math.round(pcs.reduce((s, x) => s + (Number(x.level) || 1), 0) / pcs.length) : null;
    const tabFor = combatants.length ? tab : tab === 'tour' ? 'groupe' : tab;

    return (
      <div className="wt" data-empty={combatants.length ? 0 : 1} data-inmap={embedded ? 1 : 0}>
        <header className="wt-head">
          <div className="wt-head-title">
            <span className="wt-eyebrow">Session · Combat{place ? ` · ${place}` : ''}</span>
            <h1>La Table de guerre</h1>
          </div>
          <dl className="wt-head-stats">
            <div>
              <dt>Groupe</dt>
              <dd>{pcs.length || party.length} PJ{avgLevel ? <small> · niv. {avgLevel}</small> : null}</dd>
            </div>
            <div>
              <dt>Manche</dt>
              <dd>{String(c.round || 1).padStart(2, '0')}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{sorted.length ? `${String(Math.min(turnIndex, sorted.length - 1) + 1).padStart(2, '0')}/${String(sorted.length).padStart(2, '0')}` : '—'}</dd>
            </div>
            {rating && (
              <div className="wt-diff" data-level={Math.min(4, Math.floor(rating.score))} title={`${rating.adjusted} PX ajustés (seuils du groupe : ${rating.thresholds.join(' / ')})`}>
                <dt>Équilibre estimé</dt>
                <dd>{rating.label}<i style={{ '--p': `${Math.min(100, (rating.score / 5) * 100)}%` }} /></dd>
              </div>
            )}
          </dl>
          <div className="wt-head-actions">
            <button type="button" className="wt-btn" onClick={undo} disabled={!combatUndo.length} title={combatUndo.length ? `Annuler : ${combatUndo[combatUndo.length - 1].label} (Ctrl+Z)` : 'Rien à annuler'}>
              <Undo2 size={15} aria-hidden="true" /> Annuler
            </button>
            <button type="button" className="wt-btn" onClick={() => setShowKeys(true)} title="Raccourcis clavier (?)">
              <Keyboard size={15} aria-hidden="true" /> Raccourcis
            </button>
            {onOpenBattleMap && boundMapRec && (
              <button type="button" className="wt-btn" onClick={() => onOpenBattleMap(boundMapRec.id)} title="Ouvrir la carte de combat et sa projection aux joueurs">
                <MonitorPlay size={15} aria-hidden="true" /> Vue joueurs
              </button>
            )}
            <button type="button" className="wt-btn danger" onClick={resetCombat} disabled={!combatants.length} title="Vider le combat (annulable)">
              <Trash2 size={15} aria-hidden="true" /> Vider
            </button>
          </div>
        </header>

        <div className="wt-body">
          {!embedded && (
          <section className="wt-map" aria-label="Carte tactique">
            <header className="wt-map-head">
              <div className="wt-map-title">
                <h2>{sideMap === 'board' ? place || 'Carte de combat' : 'Champ de bataille'}</h2>
                <span>{sideMap === 'board' ? 'Plateau de la carte, synchronisé · glisser les jetons' : 'Grille tactique · 1 case = 5 pi'}</span>
              </div>
              <div className="wt-map-tools">
                <div className="wt-seg" role="tablist" aria-label="Carte affichée">
                  <button type="button" role="tab" aria-selected={sideMap === 'mini'} data-on={sideMap === 'mini' ? 1 : 0} onClick={() => chooseSideMap('mini')}>Grille</button>
                  <button type="button" role="tab" aria-selected={sideMap === 'board'} data-on={sideMap === 'board' ? 1 : 0} onClick={() => chooseSideMap('board')}>Carte de combat</button>
                </div>
                {sideMap === 'mini' && (
                  <div className="wt-seg" aria-label="Outil de carte">
                    <button type="button" data-on={mapMode === 'move' ? 1 : 0} aria-pressed={mapMode === 'move'} onClick={() => setMapMode('move')} title="Sélectionner un jeton, puis cliquer une case"><Move size={14} aria-hidden="true" /> Déplacer</button>
                    <button type="button" data-on={mapMode === 'block' ? 1 : 0} aria-pressed={mapMode === 'block'} onClick={() => setMapMode('block')} title="Cliquer les cases infranchissables : murs, piliers, gouffres"><Square size={14} aria-hidden="true" /> Obstacles</button>
                    <button type="button" data-on={mapMode === 'measure' ? 1 : 0} aria-pressed={mapMode === 'measure'} onClick={() => setMapMode('measure')} title="Cliquer deux cases pour mesurer la distance"><Ruler size={14} aria-hidden="true" /> Mesurer</button>
                    <button type="button" data-on={showGrid ? 1 : 0} aria-pressed={showGrid} onClick={() => setShowGrid((v) => !v)} title="Afficher la grille"><Grid3x3 size={14} aria-hidden="true" /> Quadrillage</button>
                  </div>
                )}
              </div>
            </header>
            <div className="wt-map-stage">
              {sideMap === 'board' ? (
                <div className="wt-board">
                  <CombatBoardPanel state={state} dispatch={dispatch} party={party} npcs={npcs} selectedId={selectedTokenId} onSelect={setSelectedTokenId} />
                </div>
              ) : (
                <CombatMiniMap
                  combatants={combatants}
                  selectedTokenId={selectedCombatant?.id || ''}
                  activeId={activeCombatant?.id || ''}
                  blockedCells={blockedCells}
                  mode={mapMode}
                  showGrid={showGrid}
                  onSelect={setSelectedTokenId}
                  onMove={moveToken}
                  onToggleBlocked={toggleBlockedCell}
                />
              )}
              {hiddenCount > 0 && sideMap === 'board' && (
                <span className="wt-map-flag"><EyeOff size={13} aria-hidden="true" /> Mode MJ · {hiddenCount} caché{hiddenCount > 1 ? 's' : ''} aux joueurs</span>
              )}
            </div>
            <footer className="wt-map-legend">
              <span><i className="pc" /> Héros</span>
              <span><i className="enemy" /> Menace</span>
              {sideMap === 'mini' && <span><i className="block" /> Obstacle</span>}
              {sideMap === 'mini' && <span><i className="threat" /> Allonge du jeton choisi</span>}
              <span className="wt-map-hint">
                {sideMap === 'board'
                  ? 'Clic : fiche du combattant · glisser : déplacer'
                  : mapMode === 'block'
                    ? 'Clic : poser ou retirer un obstacle'
                    : mapMode === 'measure'
                      ? 'Deux clics : distance en cases et en pieds'
                      : 'Clic sur un jeton : sa fiche · puis clic sur une case : le déplacer'}
              </span>
            </footer>
          </section>
          )}

          <aside className="wt-desk" aria-label="Pupitre du MJ">
            <div className="wt-desk-head">
              <h2>Le pupitre du MJ</h2>
              <span>Une chose à la fois</span>
            </div>
            <nav className="wt-tabs" role="tablist" aria-label="Sections du pupitre">
              {WAR_TABS.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={tabFor === x.id}
                  data-on={tabFor === x.id ? 1 : 0}
                  onClick={() => setTab(x.id)}
                  title={`${x.label} (${i + 1})`}
                >
                  {x.label}
                  {x.id === 'journal' && (c.journal || []).length > 0 && <small>{Math.min(99, c.journal.length)}</small>}
                </button>
              ))}
            </nav>
            <div className="wt-desk-body" role="tabpanel">
              {tabFor === 'tour' && selectedCombatant && (
                <WarInspector
                  key={selectedCombatant.id}
                  t={selectedCombatant}
                  isActive={selectedCombatant.id === activeCombatant?.id}
                  activeName={activeCombatant?.name}
                  art={combatantArtOf(state, selectedCombatant)}
                  sourceNpc={npcs.find((n) => n.id === selectedCombatant.sourceId)}
                  tactics={tacticsById?.[selectedCombatant.id]}
                  boardToken={boardTokens.get(selectedCombatant.id)}
                  onBoardVisible={boardBattle ? (visible) => setBoardBattle({ ...boardBattle, tokens: boardBattle.tokens.map((q) => (q.id === selectedCombatant.id ? { ...q, visible } : q)) }) : null}
                  amount={dmg[selectedCombatant.id] || ''}
                  onAmount={(v) => setDmg((d) => ({ ...d, [selectedCombatant.id]: v }))}
                  lastRoll={lastRoll}
                  hpPulse={hpPulse?.id === selectedCombatant.id ? hpPulse : null}
                  ops={ops}
                  onInfo={setInfoModal}
                  onBackToTurn={() => setSelectedTokenId('')}
                />
              )}
              {tabFor === 'groupe' && (
                <WarRoster
                  sorted={sorted}
                  party={party}
                  npcs={npcs}
                  activeId={activeCombatant?.id}
                  selectedId={selectedCombatant?.id}
                  ops={ops}
                  onPick={(id) => { setSelectedTokenId(id); setTab('tour'); }}
                />
              )}
              {tabFor === 'terrain' && (
                <div className="wt-stack">
                  {!embedded && (
                  <section className="wt-card">
                    <h3>Carte au centre</h3>
                    <div className="wt-seg wide">
                      <button type="button" data-on={sideMap === 'mini' ? 1 : 0} onClick={() => chooseSideMap('mini')}>Grille tactique</button>
                      <button type="button" data-on={sideMap === 'board' ? 1 : 0} onClick={() => chooseSideMap('board')}>Carte de combat</button>
                    </div>
                    <p className="wt-note">
                      {sideMap === 'board'
                        ? 'Le plateau de la carte (terrain, abris, jetons) est synchronisé avec ce combat : PV, initiative et tour passent d’un côté à l’autre.'
                        : 'Grille légère de 12 × 12 cases : Obstacles pour tracer murs et gouffres, Mesurer pour les distances.'}
                    </p>
                    {sideMap === 'mini' && (
                      <div className="wt-row">
                        <button type="button" className="wt-btn" onClick={() => setC({ blockedCells: [] }, 'Obstacles effacés', { log: false })} disabled={!blockedCells.length}>
                          <Eraser size={14} aria-hidden="true" /> Effacer les obstacles ({blockedCells.length})
                        </button>
                      </div>
                    )}
                    {selectedCombatant && sideMap === 'mini' && (
                      <label className="wt-field">
                        <span>Allonge de menace de {selectedCombatant.name} (cases)</span>
                        <input
                          className="in"
                          type="number"
                          min="0"
                          max="6"
                          value={Number(selectedCombatant.token?.threat ?? 1)}
                          onChange={(e) => update(selectedCombatant.id, { token: { ...(selectedCombatant.token || {}), threat: Math.max(0, Number(e.target.value) || 0) } })}
                        />
                      </label>
                    )}
                  </section>
                  )}
                  {boardBattle && (
                    <section className="wt-card">
                      <h3>Vu par les joueurs</h3>
                      <div className="wt-chips">
                        {boardBattle.tokens.map((tk) => (
                          <button
                            key={tk.id}
                            type="button"
                            className="wt-chip"
                            data-on={tk.visible ? 1 : 0}
                            onClick={() => setBoardBattle({ ...boardBattle, tokens: boardBattle.tokens.map((q) => (q.id === tk.id ? { ...q, visible: !tk.visible } : q)) })}
                            title={tk.visible ? 'Visible des joueurs (clic : cacher)' : 'Caché aux joueurs (clic : montrer)'}
                          >
                            {tk.visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />} {tk.name}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  {boardBattle ? (
                    <SkirmishPanel battle={boardBattle} setBattle={setBoardBattle} combatants={combatants} party={party} dispatch={dispatch} place={place} flash={flash} />
                  ) : (
                    <p className="wt-note">
                      Le champ de bataille improvisé (renforts, rencontre au niveau voulu, placement tactique) s’ouvre avec une carte de combat : choisis « Carte de combat » ci-dessus.
                    </p>
                  )}
                </div>
              )}
              {tabFor === 'mj' && (
                <div className="wt-stack">
                  <CombatAiPanel
                    combatants={sorted}
                    active={activeCombatant}
                    round={c.round}
                    place={place}
                    positions={boardBattle ? Object.fromEntries(boardBattle.tokens.map((t) => [t.id, { x: t.x, y: t.y, visible: t.visible }])) : undefined}
                    tactics={tacticsById}
                  />
                  <section className="wt-card">
                    <h3>Stratégie MJ</h3>
                    <DmStrategyPanel strategy={dmStrategy} />
                  </section>
                </div>
              )}
              {tabFor === 'journal' && (
                <WarJournal journal={c.journal || []} canUndo={combatUndo.length > 0} undoLabel={combatUndo[combatUndo.length - 1]?.label} onUndo={undo} onClear={() => setC({ journal: [] })} />
              )}
            </div>
            {tabFor === 'tour' && selectedCombatant && (
              <footer className="wt-desk-foot">
                <button
                  type="button"
                  className="wt-btn"
                  disabled={!selectedCombatant.attacks?.length || (selectedCombatant.isPC && selectedCombatant.id !== activeCombatant?.id)}
                  onClick={() => rollAttack(selectedCombatant, 0)}
                  title="Lancer la première attaque (A)"
                >
                  <Swords size={15} aria-hidden="true" /> Attaquer
                </button>
                <button type="button" className="wt-btn primary" onClick={advanceTurn} title="Fin du tour (N)">
                  <SkipForward size={15} aria-hidden="true" /> Fin du tour <kbd>N</kbd>
                </button>
              </footer>
            )}
          </aside>
        </div>

        <WarInitiative
          sorted={sorted}
          activeId={activeCombatant?.id}
          selectedId={selectedCombatant?.id}
          round={c.round || 1}
          art={(t) => combatantPictureOf(state, t)}
          boardTokens={boardTokens}
          onPick={(id) => { setSelectedTokenId(id); setTab('tour'); }}
          onNext={advanceTurn}
          onPrev={previousTurn}
          onNewRound={resetRoundResources}
        />

        {showKeys && <WarShortcuts onClose={() => setShowKeys(false)} />}
        {infoModal && (
          <CombatInfoModal info={infoModal} onClose={() => setInfoModal(null)} />
        )}
      </div>
    );
}

const WAR_TABS = [
  { id: 'tour', label: 'Tour' },
  { id: 'groupe', label: 'Groupe' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'mj', label: 'MJ' },
  { id: 'journal', label: 'Journal' },
];

const hpTone = (t) => {
  const pct = (Number(t.hp || 0) / Math.max(1, Number(t.maxHp || 1))) * 100;
  return pct <= 0 ? 'down' : pct > 50 ? 'ok' : pct > 20 ? 'hurt' : 'crit';
};

/** Fiche du combattant choisi (par défaut celui dont c’est le tour) : PV, défenses, états, attaques, fiche complète. */
function WarInspector({
  t, isActive, activeName, art, sourceNpc, tactics, boardToken, onBoardVisible, amount, onAmount, lastRoll, hpPulse, ops, onInfo, onBackToTurn,
}) {
  const calc = getCombatantDerivedStats(t);
  const [editing, setEditing] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [hpDraft, setHpDraft] = useState(null);
  const pct = Math.round((Number(t.hp || 0) / Math.max(1, Number(t.maxHp || 1))) * 100);
  const tone = hpTone(t);
  const conditions = t.conditions || [];
  const roll = lastRoll && lastRoll.who === t.name ? lastRoll : null;
  const amountValue = Math.abs(parseInt(amount, 10) || 0);

  function updateAttack(index, patch) {
    const attacks = [...(t.attacks || [])];
    attacks[index] = { ...attacks[index], ...patch };
    ops.update(t.id, { attacks });
  }

  function addAttack() {
    ops.update(t.id, {
      attacks: [
        ...(t.attacks || []),
        {
          name: 'Nouvelle attaque',
          type: 'action',
          attackBonus: 0,
          damageDice: '1d6',
          damageBonus: 0,
          damageType: 'bludgeoning',
          range: '5 ft.',
          desc: '',
          usesMax: 0,
          usesLeft: 0,
          reset: 'none',
          proficiency: false,
        },
      ],
    });
  }

  function deleteAttack(index) {
    ops.update(t.id, { attacks: (t.attacks || []).filter((_, i) => i !== index) });
  }

  return (
    <div className="wt-inspector" data-side={t.isPC ? 'pc' : 'enemy'}>
      <div className="wt-who">
        <div className="wt-portrait" data-tone={tone}>
          {art ? <img src={art} alt="" /> : <PortraitToken seed={t.name + (t.kind || '')} size={58} />}
        </div>
        <div className="wt-who-text">
          <h3>{t.name}</h3>
          <span>{[t.kind, t.isPC ? (t.level ? `niveau ${t.level}` : 'héros') : t.cr ? `FP ${t.cr}` : 'menace'].filter(Boolean).join(' · ')}</span>
          <div className="wt-badges">
            {isActive ? <b className="wt-badge gold">Tour actuel</b> : <b className="wt-badge">Sélectionné</b>}
            <b className={`wt-badge ${t.isPC ? 'pc' : 'enemy'}`}>{t.isPC ? 'PJ' : 'Menace'}</b>
            {boardToken && boardToken.visible === false && <b className="wt-badge violet">Caché</b>}
          </div>
        </div>
      </div>
      {!isActive && activeName && (
        <button type="button" className="wt-backturn" onClick={onBackToTurn}>
          ↩ Revenir au tour de <b>{activeName}</b>
        </button>
      )}

      <section className="wt-hp" data-tone={tone}>
        <div className="wt-hp-line">
          <span className="wt-hp-num">
            {hpPulse && <i key={hpPulse.key} className="wt-hp-pulse" data-sign={hpPulse.delta < 0 ? '-' : '+'}>{hpPulse.delta > 0 ? `+${hpPulse.delta}` : hpPulse.delta}</i>}
            <b>{t.hp}</b> / {t.maxHp} <small>points de vie</small>
          </span>
          {Number(t.tempHp) > 0 && <span className="wt-temp" title="PV temporaires : absorbent les dégâts en premier">+{t.tempHp} temp.</span>}
          <span className="wt-hp-state">{tone === 'down' ? (t.isPC ? 'À terre' : 'Hors de combat') : tone === 'crit' ? 'En péril' : tone === 'hurt' ? 'Blessé' : 'En forme'}</span>
        </div>
        <div className="wt-hpbar" role="meter" aria-valuemin={0} aria-valuemax={Number(t.maxHp) || 0} aria-valuenow={Number(t.hp) || 0} aria-label="Points de vie">
          <i style={{ width: pct + '%' }} />
          {Number(t.tempHp) > 0 && <em style={{ width: Math.min(100, (Number(t.tempHp) / Math.max(1, Number(t.maxHp))) * 100) + '%' }} />}
        </div>
        <div className="wt-hp-quick">
          <button type="button" className="hit" onClick={() => ops.adjustHp(t.id, -5)} aria-label="5 dégâts">−5</button>
          <button type="button" className="hit" onClick={() => ops.adjustHp(t.id, -1)} aria-label="1 dégât">−1</button>
          <input
            className="wt-hp-exact"
            inputMode="numeric"
            aria-label="PV actuels"
            value={hpDraft ?? t.hp}
            onChange={(e) => setHpDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => { if (hpDraft !== null) ops.setHpExact(t.id, hpDraft); setHpDraft(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setHpDraft(null); e.currentTarget.blur(); } }}
          />
          <button type="button" className="heal" onClick={() => ops.adjustHp(t.id, 1)} aria-label="1 PV de soin">+1</button>
          <button type="button" className="heal" onClick={() => ops.adjustHp(t.id, 5)} aria-label="5 PV de soin">+5</button>
        </div>
        <div className="wt-amount">
          <input
            inputMode="numeric"
            placeholder="Valeur"
            aria-label="Valeur de dégâts ou de soins (D)"
            value={amount}
            onChange={(e) => onAmount(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { ops.applyHp(t.id, e.shiftKey ? -1 : +1); e.currentTarget.blur(); }
              if (e.key === 'Escape') e.currentTarget.blur();
            }}
          />
          <button type="button" className="hit" disabled={!amountValue} onClick={() => ops.applyHp(t.id, +1)} title="Entrée">Dégâts</button>
          <button type="button" className="heal" disabled={!amountValue} onClick={() => ops.applyHp(t.id, -1)} title="Maj + Entrée">Soins</button>
          <button type="button" className="temp" disabled={!amountValue} onClick={() => { ops.setTempHp(t.id, amountValue); onAmount(''); }} title="Donner cette valeur en PV temporaires">PV temp.</button>
        </div>
      </section>

      {t.isPC && Number(t.hp) === 0 && (
        <section className="wt-death">
          <h4>Jets contre la mort</h4>
          {[['s', 'Réussites'], ['f', 'Échecs']].map(([k, label]) => {
            const n = Number(t.deathSaves?.[k] || 0);
            return (
              <div key={k} className="wt-death-row" data-kind={k}>
                <span>{label}</span>
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    type="button"
                    data-on={i < n ? 1 : 0}
                    aria-label={`${label} : ${i + 1}`}
                    onClick={() => ops.changeDeathSaves(t.id, k, i < n ? -1 : +1)}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}

      <div className="wt-tiles">
        <div title={calc.ac !== Number(t.baseAc || t.ac) ? `Base ${t.baseAc || t.ac}, effets compris` : 'Classe d’armure'}>
          <b>{calc.ac}</b>
          <span>Classe d’armure</span>
        </div>
        <div>
          <b>{String(t.speed || '30 ft.').replace(/\s*ft\.?/i, '')}</b>
          <span>Vitesse · pi</span>
        </div>
        <label>
          <input
            value={t.init}
            inputMode="numeric"
            aria-label="Initiative"
            onChange={(e) => ops.update(t.id, { init: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })}
          />
          <span>Initiative</span>
        </label>
      </div>

      {tactics?.length > 0 && (
        <section className="wt-sec">
          <h4>Situation sur la carte</h4>
          <TacticalChips notes={tactics} />
        </section>
      )}

      <section className="wt-sec">
        <div className="wt-sec-head">
          <h4>États & conditions</h4>
          <button type="button" className="wt-link" aria-expanded={condOpen} onClick={() => setCondOpen((v) => !v)}>
            {condOpen ? 'Fermer' : '+ Ajouter'}
          </button>
        </div>
        {conditions.length === 0 && !condOpen && <p className="wt-note">Aucun état.</p>}
        {conditions.length > 0 && (
          <div className="wt-chips">
            {conditions.map((name) => {
              const cd = conditionOf(name);
              return (
                <button key={name} type="button" className="wt-cond on" title={`${cd.rule}\nClic : retirer`} onClick={() => ops.toggleCondition(t.id, name)}>
                  <span aria-hidden="true">{cd.icon}</span> {name} <span aria-hidden="true">×</span>
                </button>
              );
            })}
          </div>
        )}
        {condOpen && (
          <div className="wt-cond-pick">
            {COMBAT_CONDITIONS.map((cd) => (
              <button
                key={cd.name}
                type="button"
                className="wt-cond"
                data-on={conditions.includes(cd.name) ? 1 : 0}
                aria-pressed={conditions.includes(cd.name)}
                title={cd.rule}
                onClick={() => ops.toggleCondition(t.id, cd.name)}
              >
                <span aria-hidden="true">{cd.icon}</span> {cd.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="wt-sec">
        <div className="wt-sec-head">
          <h4>Attaques rapides</h4>
          <span className="wt-note">{t.isPC && !isActive ? 'À son tour seulement' : 'Cliquer pour lancer'}</span>
        </div>
        {roll && (
          <div key={roll.key} className="wt-roll" data-crit={roll.crit ? 1 : 0} data-fumble={roll.fumble ? 1 : 0} aria-live="polite">
            <div className="wt-roll-main">
              <span>{roll.name}</span>
              <b>{roll.total}</b>
              <small>pour toucher</small>
            </div>
            <div className="wt-roll-detail">
              d20 : {roll.d20s.join(' / ')}{roll.adv ? ' (avantage)' : roll.dis ? ' (désavantage)' : ''}
              {roll.crit ? ' · CRITIQUE' : roll.fumble ? ' · 1 naturel' : ''}
            </div>
            {roll.dmg !== null && !roll.fumble && (
              <div className="wt-roll-dmg">
                <b>{roll.dmg}</b> dégâts {roll.dmgType}
                <small>{roll.crit ? 'dés doublés' : ''}</small>
              </div>
            )}
          </div>
        )}
        {(t.attacks || []).length === 0 ? (
          <p className="wt-note">Aucune attaque définie — « Modifier la fiche » pour en ajouter.</p>
        ) : (
          <div className="wt-attacks">
            {(t.attacks || []).map((attack, i) => {
              const ac = calculateAttackLine(t, attack, calc);
              const max = Number(attack.usesMax || 0);
              const left = Number(attack.usesLeft ?? max);
              return (
                <div key={i} className="wt-attack" data-spent={max > 0 && left <= 0 ? 1 : 0}>
                  <button type="button" className="wt-attack-roll" disabled={t.isPC && !isActive} onClick={() => ops.rollAttack(t, i)} title={t.isPC && !isActive ? `${t.name} attaquera à son tour` : `Lancer : ${ac.toHit} · ${ac.damage}`}>
                    <span className="wt-attack-ico" aria-hidden="true"><Dices size={16} /></span>
                    <span className="wt-attack-text">
                      <b>{attack.name}</b>
                      <small>{[attack.type || 'action', attack.range, ac.damage !== '—' ? ac.damage : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="wt-attack-bonus">{ac.toHit.replace(/^d20\s*/, '')}</span>
                  </button>
                  <button
                    type="button"
                    className="wt-attack-info"
                    aria-label={`Règles de ${attack.name}`}
                    onClick={() => onInfo({ title: attack.name, subtitle: attack.type || 'Action', body: attack.desc || 'Aucune description.', rules: buildAttackRulesText(attack, ac) })}
                  >
                    ?
                  </button>
                  {max > 0 && (
                    <UseTracker left={left} max={max} reset={attack.reset} onSpend={() => ops.changeActionUses(t.id, i, -1)} onRestore={() => ops.changeActionUses(t.id, i, +1)} compact />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <details className="wt-fold">
        <summary>Buffs, malus & ressources <small>{(t.effects || []).filter((e) => e.active).length} actif(s)</small></summary>
        <CombatEffectsPanel
          combatant={t}
          onToggleEffect={(i) => ops.toggleEffect(t.id, i)}
          onEffectUses={(i, d) => ops.changeEffectUses(t.id, i, d)}
          onInfo={onInfo}
        />
      </details>

      <details className="wt-fold">
        <summary>Fiche complète</summary>
        {t.str !== undefined && (
          <div className="wt-abilities">
            {[['FOR', t.str], ['DEX', t.dex], ['CON', t.con], ['INT', t.int], ['SAG', t.wis], ['CHA', t.cha]].map(([k, v]) => (
              <div key={k}><span>{k}</span><b>{v}</b><small>{signed(abilityMod(v))}</small></div>
            ))}
          </div>
        )}
        <dl className="wt-sheet">
          {t.saves && <><dt>Sauvegardes</dt><dd>{t.saves}</dd></>}
          {t.skills && <><dt>Compétences</dt><dd>{t.skills}</dd></>}
          {t.senses && <><dt>Sens</dt><dd>{t.senses}</dd></>}
          {t.languages && <><dt>Langues</dt><dd>{t.languages}</dd></>}
          {t.cr && <><dt>FP</dt><dd>{t.cr}</dd></>}
          {t.tactics && <><dt>Tactique</dt><dd>{t.tactics}</dd></>}
        </dl>
        <div className="wt-row">
          <button type="button" className="wt-btn" onClick={() => setEditing((v) => !v)}>
            <Pencil size={14} aria-hidden="true" /> {editing ? 'Fermer l’édition' : 'Modifier la fiche'}
          </button>
          {sourceNpc && (
            <button type="button" className="wt-btn" onClick={() => ops.refreshFromSheet(t)} title="Réimporter les actions, effets, CA et caractéristiques depuis la fiche">
              <RefreshCw size={14} aria-hidden="true" /> Réimporter
            </button>
          )}
          {onBoardVisible && boardToken && (
            <button type="button" className="wt-btn" onClick={() => onBoardVisible(boardToken.visible === false)}>
              {boardToken.visible === false ? <><Eye size={14} aria-hidden="true" /> Révéler</> : <><EyeOff size={14} aria-hidden="true" /> Cacher aux joueurs</>}
            </button>
          )}
          <button type="button" className="wt-btn danger" onClick={() => ops.remove(t.id)}>
            <Trash2 size={14} aria-hidden="true" /> Retirer
          </button>
        </div>
        {editing && (
          <CombatantEditPanel
            t={t}
            onUpdate={(patch) => ops.update(t.id, patch)}
            onUpdateAttack={updateAttack}
            onAddAttack={addAttack}
            onDeleteAttack={deleteAttack}
          />
        )}
      </details>
    </div>
  );
}

/** Onglet Groupe : ajouter des combattants (héros, bestiaire, improvisé) et les voir tous, en compact. */
function WarRoster({ sorted, party, npcs, activeId, selectedId, ops, onPick }) {
  return (
    <div className="wt-stack">
      <section className="wt-card">
        <h3>Ajouter au combat</h3>
        <div className="wt-add">
          <select
            className="in"
            value=""
            aria-label="Ajouter un membre du groupe"
            onChange={(e) => {
              const p = party.find((x) => x.id === e.target.value);
              if (p) ops.addCombatant(p, true);
            }}
          >
            <option value="">+ Membre du groupe…</option>
            {party.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="in"
            value=""
            aria-label="Ajouter depuis le bestiaire"
            onChange={(e) => {
              const m = npcs.find((x) => x.id === e.target.value);
              if (m) ops.addCombatant(m, false);
            }}
          >
            <option value="">+ Bestiaire…</option>
            {npcs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.isMonster || m.entityType === 'monster' ? '(monstre)' : '(PNJ)'}
              </option>
            ))}
          </select>
          <div className="wt-row">
            <button type="button" className="wt-btn" onClick={ops.addWholeParty} disabled={!party.length}>
              <Users size={14} aria-hidden="true" /> Tout le groupe
            </button>
            <button type="button" className="wt-btn" onClick={ops.addBlank}>
              <Plus size={14} aria-hidden="true" /> Combattant improvisé
            </button>
          </div>
          {sorted.length > 0 && (
            <div className="wt-row">
              <button type="button" className="wt-btn" onClick={() => ops.rollInitiative('foes')}>
                <Dices size={14} aria-hidden="true" /> Initiative des créatures
              </button>
              <button type="button" className="wt-btn" onClick={() => ops.rollInitiative('all')}>
                <Dices size={14} aria-hidden="true" /> Initiative de tous
              </button>
            </div>
          )}
        </div>
        <p className="wt-note">Chaque ajout est une instance distincte : trois gobelins du bestiaire gardent chacun leurs PV, états et position.</p>
      </section>
      {sorted.length === 0 ? (
        <div className="wt-empty">
          <Swords size={28} aria-hidden="true" />
          <b>La table est vide</b>
          <span>Ajoute les héros puis leurs adversaires pour lancer l’initiative.</span>
        </div>
      ) : (
        <section className="wt-card">
          <h3>Combattants <small>{sorted.length}</small></h3>
          <ul className="wt-roster">
            {sorted.map((t) => (
              <li key={t.id} data-side={t.isPC ? 'pc' : 'enemy'} data-tone={hpTone(t)} data-active={t.id === activeId ? 1 : 0} data-sel={t.id === selectedId ? 1 : 0}>
                <input
                  className="wt-roster-init"
                  value={t.init}
                  inputMode="numeric"
                  aria-label={`Initiative de ${t.name}`}
                  onChange={(e) => ops.update(t.id, { init: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })}
                />
                <button type="button" className="wt-roster-name" onClick={() => onPick(t.id)}>
                  <b>{t.name}</b>
                  <small>CA {getCombatantDerivedStats(t).ac} · {t.hp}/{t.maxHp} PV{(t.conditions || []).length ? ` · ${t.conditions.join(', ')}` : ''}</small>
                </button>
                <button type="button" className="wt-mini hit" onClick={() => ops.adjustHp(t.id, -1)} aria-label={`1 dégât à ${t.name}`}>−</button>
                <button type="button" className="wt-mini heal" onClick={() => ops.adjustHp(t.id, 1)} aria-label={`1 PV de soin à ${t.name}`}>+</button>
                <button type="button" className="wt-mini" onClick={() => ops.remove(t.id)} aria-label={`Retirer ${t.name}`}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WarJournal({ journal, canUndo, undoLabel, onUndo, onClear }) {
  const time = (at) => new Date(at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="wt-stack">
      <div className="wt-row">
        <button type="button" className="wt-btn" onClick={onUndo} disabled={!canUndo} title={undoLabel ? `Annuler : ${undoLabel}` : ''}>
          <Undo2 size={14} aria-hidden="true" /> Annuler le dernier geste
        </button>
        <button type="button" className="wt-btn" onClick={onClear} disabled={!journal.length}>Effacer le journal</button>
      </div>
      {undoLabel && <p className="wt-note">Dernier geste annulable : {undoLabel}</p>}
      {journal.length === 0 ? (
        <p className="wt-note">Le journal consigne dégâts, soins, états, attaques lancées et tours.</p>
      ) : (
        <ol className="wt-journal">
          {journal.map((e) => (
            <li key={e.id} data-tone={e.tone || ''}>
              <span className="wt-journal-meta">M{e.round} · {time(e.at)}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Bande d’initiative, toujours visible : ordre, tour actif, PV et états ; « Tour suivant » à portée de main. */
function WarInitiative({ sorted, activeId, selectedId, round, art, boardTokens, onPick, onNext, onPrev, onNewRound }) {
  const stripRef = useRef(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="1"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);
  return (
    <section className="wt-init" aria-label="Fil d’initiative">
      <div className="wt-init-head">
        <h2>Fil d’initiative</h2>
        <span>Le tour actif brille · clic pour ouvrir une fiche · ←/→ pour parcourir</span>
        <span className="wt-init-count">Acteurs <b>{String(sorted.length).padStart(2, '0')}</b> · Manche <b>{String(round).padStart(2, '0')}</b></span>
      </div>
      <div className="wt-init-row">
        <button type="button" className="wt-init-prev" onClick={onPrev} aria-label="Tour précédent (Maj+N)" title="Tour précédent (Maj+N)">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <ol className="wt-init-strip" ref={stripRef}>
          {sorted.length === 0 && <li className="wt-init-empty">Ajoute des combattants dans l’onglet Groupe.</li>}
          {sorted.map((t) => {
            const pct = Math.round((Number(t.hp || 0) / Math.max(1, Number(t.maxHp || 1))) * 100);
            const img = art(t);
            const hidden = boardTokens.get(t.id)?.visible === false;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="wt-init-card"
                  data-side={t.isPC ? 'pc' : 'enemy'}
                  data-tone={hpTone(t)}
                  data-active={t.id === activeId ? 1 : 0}
                  data-sel={t.id === selectedId ? 1 : 0}
                  data-hidden={hidden ? 1 : 0}
                  onClick={() => onPick(t.id)}
                  aria-current={t.id === activeId ? 'step' : undefined}
                  title={`${t.name} — initiative ${t.init}, ${t.hp}/${t.maxHp} PV${(t.conditions || []).length ? ` · ${t.conditions.join(', ')}` : ''}`}
                >
                  <span className="wt-init-score">{t.init}</span>
                  <span className="wt-init-face">{img ? <img src={img} alt="" /> : getInitials(t.name)}</span>
                  <span className="wt-init-text">
                    <b>{t.name}</b>
                    <small>{t.hp}/{t.maxHp} PV{Number(t.tempHp) > 0 ? ` +${t.tempHp}` : ''}</small>
                    <i className="wt-init-bar"><i style={{ width: pct + '%' }} /></i>
                  </span>
                  {(t.conditions || []).length > 0 && (
                    <span className="wt-init-conds" aria-hidden="true">{t.conditions.slice(0, 3).map((n) => conditionOf(n).icon).join('')}</span>
                  )}
                  {t.id === activeId && <span className="wt-init-tag">Actif</span>}
                  {hidden && <span className="wt-init-tag violet">Caché</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="wt-init-actions">
          <button type="button" className="wt-btn" onClick={onNewRound} title="Nouvelle manche : recharge les ressources de manche et revient au premier">
            <RotateCcw size={14} aria-hidden="true" /> Nouvelle manche
          </button>
          <button type="button" className="wt-btn primary big" onClick={onNext} disabled={!sorted.length} title="Tour suivant (N)">
            <SkipForward size={17} aria-hidden="true" /> Tour suivant
          </button>
        </div>
      </div>
    </section>
  );
}

function WarShortcuts({ onClose }) {
  const keys = [
    ['N', 'Fin du tour / tour suivant'],
    ['Maj + N', 'Tour précédent'],
    ['← →', 'Combattant précédent / suivant'],
    ['A', 'Lancer la première attaque du combattant'],
    ['D', 'Saisir une valeur de dégâts (Entrée : dégâts, Maj+Entrée : soins)'],
    ['1 – 5', 'Onglets Tour, Groupe, Terrain, MJ, Journal'],
    ['Ctrl / ⌘ + Z', 'Annuler le dernier geste'],
    ['?', 'Afficher ces raccourcis'],
  ];
  return (
    <Modal title="Raccourcis de la Table de guerre" onClose={onClose}>
      <dl className="wt-keys">
        {keys.map(([k, v]) => (
          <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
        ))}
      </dl>
    </Modal>
  );
}

/** Aide de l’IA pour le combat : plan du round, cibles, capacités, rebondissements (IA configurée dans Réglages). */
function CombatAiPanel({ combatants, active, round, place, positions, tactics }) {
  const { ai } = useContext(AIContext);
  const [state, setState] = useState({ busy: false });
  async function ask() {
    setState({ busy: true });
    const lines = combatants.map((t) => {
      const pos = positions?.[t.id];
      const atk = (t.attacks || [])
        .map((a) => `${a.name}${a.attackBonus != null ? ` +${a.attackBonus}` : ''}${a.damageDice ? ` ${a.damageDice}${a.damageBonus ? `+${a.damageBonus}` : ''}` : ''}${a.range ? ` (${a.range})` : ''}`)
        .join('; ');
      const fx = (t.effects || []).filter((e) => e.active || e.source === 'Trait').map((e) => e.name).join(', ');
      return `- ${t.id === active?.id ? '▶ ' : ''}${t.name} [${t.isPC ? 'joueur' : 'créature'}] init ${t.init}, PV ${t.hp}/${t.maxHp}, CA ${t.ac}${pos ? `, case (${pos.x},${pos.y})${pos.visible === false ? ', cachée aux joueurs' : ''}` : ''}${atk ? `. Actions : ${atk}` : ''}${fx ? `. Traits et effets : ${fx}` : ''}${t.skills ? `. Compétences : ${t.skills}` : ''}${tactics?.[t.id]?.length ? `. Situation : ${tactics[t.id].map((n) => n.label).join(' ; ')}` : ''}`;
    });
    try {
      const text = await callAIMessages(ai, [
        { role: 'system', content: 'Tu es un maître du jeu expert de D&D 5e. Tu aides le MJ à mener un combat tactique, lisible et cinématique. Réponds en français, en 6 points maximum, une phrase chacun, sans titre : l’ordre des actions des créatures ce round, la cible de chacune et pourquoi, la capacité, le trait ou le don à utiliser, le terrain à exploiter, et un rebondissement pour garder la tension. N’invente aucune statistique.' },
        { role: 'user', content: `Lieu : ${place || 'inconnu'}. Round ${round}. Une case = 5 pieds.\n${lines.join('\n')}\n\nTour actuel : ${active?.name || 'personne'}.` },
      ], false);
      setState({ busy: false, text });
    } catch (e) {
      setState({ busy: false, error: e.message });
    }
  }
  return (
    <div className="panel combat-ai-panel">
      <div className="combat-panel-head">
        <div>
          <b>Aide de l’IA</b>
          <span>Plan du round, cibles, capacités et rebondissements</span>
        </div>
      </div>
      <button className="btn primary sm" disabled={state.busy || !ai?.apiKey || !combatants.length} onClick={ask}>
        {state.busy ? 'L’IA réfléchit…' : '✨ Que faire ce round ?'}
      </button>
      {!ai?.apiKey && <p className="muted" style={{ fontSize: 12 }}>Configure une clé d’IA dans Réglages pour l’activer.</p>}
      {state.error && <p className="combat-ai-error">{state.error}</p>}
      {state.text && (
        <ul className="combat-ai-answer">
          {state.text.split('\n').map((l) => l.replace(/^[\s*•\-–\d.)]+/, '').trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Niveaux et PV restants du groupe : les héros du combat, sinon tous les personnages de l’univers (PV pleins). */
function partyStateOf(combatants, party) {
  const pcs = combatants.filter((c) => c.isPC);
  if (pcs.length) {
    const hp = pcs.reduce((s, c) => s + Math.max(0, Number(c.hp) || 0), 0);
    const max = pcs.reduce((s, c) => s + Math.max(1, Number(c.maxHp) || 1), 0);
    return { levels: pcs.map((c) => Number(c.level) || 1), hpRatio: hp / max, size: pcs.length };
  }
  return { levels: party.map((h) => Number(h.level) || 1), hpRatio: 1, size: party.length };
}

/** XP d’un combattant ennemi : sa fiche SRD, son FP, sinon une estimation d’après ses PV max. */
function xpOfCombatant(c, token) {
  const st = token?.statId ? STATS[token.statId] : null;
  const xp = xpOf(st || { cr: c.cr || '' });
  if (xp) return xp;
  const hp = Number(c.maxHp) || 0;
  return hp <= 10 ? 25 : hp <= 20 ? 50 : hp <= 35 ? 100 : hp <= 60 ? 200 : hp <= 90 ? 450 : 1100;
}

/** Famille de créatures la plus représentée parmi les ennemis (pour des renforts cohérents). */
function themeOfEnemies(tokens) {
  let best = 'all', n = 0;
  for (const th of SKIRMISH_THEMES) {
    if (!th.ids.length) continue;
    const k = tokens.filter((t) => th.ids.includes(t.statId)).length;
    if (k > n) { best = th.id; n = k; }
  }
  return best;
}

const LEVELS = ['Facile', 'Moyen', 'Difficile', 'Mortel'];
const skNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Champ de bataille improvisé, sous la carte de combat : ajouter des créatures génériques (bestiaire SRD, fiche rapide
 * ou écrite par l’IA), proposer une rencontre à la difficulté voulue et la placer de façon tactique, et suivre la
 * difficulté en cours de combat pour la doser.
 */
function SkirmishPanel({ battle, setBattle, combatants, party, dispatch, place, flash }) {
  const { ai } = useContext(AIContext);
  const [tab, setTab] = useState(null);
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState(1);
  const [quick, setQuick] = useState({ name: '', cr: '1/2', style: 'brute' });
  const [aiAsk, setAiAsk] = useState({ text: '', busy: false });
  const [target, setTarget] = useState(2);
  const [theme, setTheme] = useState('all');
  const [seed, setSeed] = useState(1);
  const [withParty, setWithParty] = useState(true);
  const [replace, setReplace] = useState(false);
  const [aiPlan, setAiPlan] = useState({ busy: false });
  const [intent, setIntent] = useState(0);
  const [advice, setAdvice] = useState({ busy: false });

  const pstate = partyStateOf(combatants, party);
  const heroesOnBoard = battle.tokens.filter((t) => t.kind === 'pc');
  const byId = new Map(battle.tokens.map((t) => [t.id, t]));
  const foes = combatants.filter((c) => !c.isPC && Number(c.hp) > 0 && byId.has(c.id));
  const current = rateEncounter(foes.map((c) => xpOfCombatant(c, byId.get(c.id))), pstate);
  const proposal = useMemo(() => proposeEncounter(pstate, target, theme, seed, customStats()), [JSON.stringify(pstate), target, theme, seed]);

  const heroTokens = () => party.map((h) => ({
    id: `pc-${h.id}-${uid()}`, name: h.name, kind: 'pc', size: 1, visible: true, heroId: h.id, sight: sightFor(h.race),
    hp: Number(h.hp || h.maxHp || 20), maxHp: Number(h.hp || h.maxHp || 20), ac: Number(h.ac || 14),
  }));
  const addGroups = (groups, opts = {}) => {
    const base = opts.replace ? { ...battle, tokens: battle.tokens.filter((t) => t.kind !== 'monster') } : battle;
    const needParty = opts.party && !base.tokens.some((t) => t.kind === 'pc') && party.length > 0;
    const added = placeTactically(base, groups, Date.now() % 100000, { party: needParty ? heroTokens() : undefined, extra: customStats() });
    if (!added.length) { flash('Plus de place libre sur le plateau.'); return; }
    setBattle({ ...base, tokens: [...base.tokens, ...added] });
    const n = added.filter((t) => t.kind === 'monster').length;
    flash(`${n} créature${n > 1 ? 's' : ''} placée${n > 1 ? 's' : ''} (cachée${n > 1 ? 's' : ''} aux joueurs).`);
  };

  const q = skNorm(query);
  const matches = Object.values(STATS)
    .filter((s) => !q || skNorm(`${s.name} ${s.meta} ${s.id}`).includes(q))
    .sort((a, b) => crOf(a) - crOf(b) || a.name.localeCompare(b.name))
    .slice(0, q ? 12 : 8);

  async function createWithAI() {
    if (!aiAsk.text.trim()) return;
    setAiAsk((s) => ({ ...s, busy: true, error: '' }));
    try {
      const r = await callAIMessages(ai, [
        { role: 'system', content: 'Tu écris des fiches de créatures D&D 5e en français, au format du SRD 5.1. Réponds UNIQUEMENT en JSON : {"name","meta","ac","hp","speed","abil":[FOR,DEX,CON,INT,SAG,CHA],"saves","skills","senses","languages","cr","traits":[[nom,texte]],"actions":[[nom,texte]],"reactions":[[nom,texte]]}. "meta" : « Type de taille X, alignement ». "ac" : « 13 (armure de cuir) ». "hp" : « 22 (5d8) ». "speed" en mètres (« 9 m »). "cr" : « 1/2 (100 PX) ». Chaque attaque s’écrit exactement : « Attaque d’arme au corps à corps : +4 au toucher, allonge 1,5 m. Touché : 5 (1d6 + 2) tranchants. » ou « Attaque d’arme à distance : +4 au toucher, portée 24/96 m. Touché : … ». Valeurs équilibrées selon le FP (Guide du maître).' },
        { role: 'user', content: `Créature : ${aiAsk.text}\nGroupe : ${pstate.size || 4} héros de niveau ${pstate.levels.join(', ') || 1}. Lieu : ${place || 'souterrain'}.` },
      ], true);
      if (r._parseFailed || !Array.isArray(r.abil) || r.abil.length !== 6 || !Array.isArray(r.actions) || !r.name) throw new Error('Fiche incomplète reçue de l’IA, réessaie.');
      const st = registerStat({
        id: `ai-${Date.now().toString(36)}`, name: String(r.name), meta: String(r.meta || 'Créature'), ac: String(r.ac || '12'), hp: String(r.hp || '10'),
        speed: String(r.speed || '9 m'), abil: r.abil.map((x) => Number(x) || 10), saves: r.saves || undefined, skills: r.skills || undefined,
        senses: String(r.senses || 'Perception passive 10'), languages: String(r.languages || '—'), cr: String(r.cr || '1 (200 PX)'),
        traits: (r.traits || []).filter((x) => Array.isArray(x) && x.length === 2), actions: r.actions.filter((x) => Array.isArray(x) && x.length === 2),
        reactions: (r.reactions || []).filter((x) => Array.isArray(x) && x.length === 2),
      });
      addGroups([{ stat: st.id, n: Math.max(1, Number(qty) || 1) }]);
      setAiAsk({ text: '', busy: false });
    } catch (e) {
      setAiAsk((s) => ({ ...s, busy: false, error: e.message }));
    }
  }

  async function proposeWithAI() {
    setAiPlan({ busy: true });
    const catalogue = [...Object.values(STATS)].filter((s) => xpOf(s) > 0).map((s) => `${s.id} = ${s.name} (FP ${s.cr.split(' ')[0]}, ${xpOf(s)} PX)`).join('\n');
    const th = encounterThresholds(pstate);
    try {
      const r = await callAIMessages(ai, [
        { role: 'system', content: 'Tu es un MJ expert de D&D 5e. Tu composes une rencontre cohérente avec le lieu, à la difficulté demandée (règles du Guide du maître : XP × multiplicateur selon le nombre de créatures). Réponds UNIQUEMENT en JSON : {"groups":[{"stat":"id du catalogue","n":nombre}],"why":"2 phrases : qui sont-ils, pourquoi ici, et leur plan de combat"}. N’utilise que des id du catalogue.' },
        { role: 'user', content: `Lieu : ${place || 'souterrain'}. Groupe : ${pstate.size || 4} héros, niveaux ${pstate.levels.join(', ') || '1'}, PV restants ${Math.round(pstate.hpRatio * 100)} %. Difficulté visée : ${LEVELS[target - 1]} (seuils XP ajustés facile/moyen/difficile/mortel : ${th.join(' / ')}).${theme !== 'all' ? ` Thème : ${SKIRMISH_THEMES.find((t) => t.id === theme)?.label}.` : ''}\nCatalogue :\n${catalogue}` },
      ], true);
      const groups = (r.groups || []).filter((g) => STATS[g.stat] && Number(g.n) > 0).map((g) => ({ stat: g.stat, n: Math.min(10, Number(g.n)) }));
      if (!groups.length) throw new Error('Proposition vide, réessaie.');
      const rating = rateEncounter(groups.flatMap((g) => Array.from({ length: g.n }, () => xpOf(STATS[g.stat]))), pstate);
      setAiPlan({ busy: false, groups, rating, why: r.why });
    } catch (e) {
      setAiPlan({ busy: false, error: e.message });
    }
  }

  // Doser la difficulté en cours de combat.
  const patchFoes = (fn) => dispatch({ type: 'COMBAT_SET', patch: { combatants: combatants.map((c) => (!c.isPC && Number(c.hp) > 0 && byId.has(c.id) ? { ...c, ...fn(c) } : c)) } });
  const reinforcements = () => {
    const goal = Math.min(4.6, current.score + Math.max(1, intent));
    const th = themeOfEnemies(battle.tokens.filter((t) => t.kind === 'monster'));
    const ids = SKIRMISH_THEMES.find((t) => t.id === th)?.ids ?? [];
    const avg = pstate.levels.length ? pstate.levels.reduce((s, l) => s + l, 0) / pstate.levels.length : 1;
    const pool = (ids.length ? ids.map((id) => STATS[id]).filter(Boolean) : Object.values(STATS)).filter((s) => xpOf(s) > 0 && crOf(s) <= Math.max(1, avg + 1) && !/bon,|bon$/.test(s.meta));
    const base = foes.map((c) => xpOfCombatant(c, byId.get(c.id)));
    let best = null;
    for (const s of pool) for (let n = 1; n <= 4; n++) {
      const r = rateEncounter([...base, ...Array(n).fill(xpOf(s))], pstate);
      const miss = Math.abs(r.score - goal);
      if (!best || miss < best.miss) best = { stat: s.id, n, miss, r };
    }
    return best;
  };
  const reinf = intent > 0 ? reinforcements() : null;
  const hurt = [...foes].sort((a, b) => Number(a.hp) / Number(a.maxHp) - Number(b.hp) / Number(b.maxHp))[0];
  const leaderStat = foes.map((c) => byId.get(c.id)?.statId).filter(Boolean).map((id) => STATS[id]).sort((a, b) => crOf(b) - crOf(a))[0];
  const leaderMoves = leaderStat ? [...(leaderStat.traits || []), ...leaderStat.actions].filter(([n, d]) => /recharge|incantation|1\/jour|commandement|invisib|agrandissement|régénération/i.test(`${n} ${d}`)).slice(0, 2) : [];

  async function askAdvice() {
    setAdvice({ busy: true });
    const lines = combatants.filter((c) => byId.has(c.id)).map((c) => `- ${c.name} [${c.isPC ? 'joueur' : 'créature'}] PV ${c.hp}/${c.maxHp}, CA ${c.ac}${(c.attacks || []).length ? `, actions : ${c.attacks.map((a) => a.name).join(', ')}` : ''}`);
    try {
      const text = await callAIMessages(ai, [
        { role: 'system', content: 'Tu es un MJ expert de D&D 5e. Le MJ veut doser la difficulté d’un combat en cours sans que les joueurs le remarquent. Réponds en français, 5 points au plus, une phrase chacun, sans titre, chacun commençant par un verbe à l’impératif (« Utilise… », « Invoque… », « Fais fuir… ») : capacités ou sorts des créatures à utiliser ou à oublier, renforts plausibles (créatures du SRD), terrain, moral, alliés inattendus. Reste cohérent avec le lieu. N’invente pas de statistiques.' },
        { role: 'user', content: `Lieu : ${place || 'inconnu'}. Difficulté actuelle : ${current.label} (${current.adjusted} XP ajustés). Le MJ veut ${intent > 0 ? `corser le combat (${intent > 1 ? 'nettement' : 'un peu'})` : intent < 0 ? `faciliter le combat (${intent < -1 ? 'nettement' : 'un peu'})` : 'garder la tension sans changer la difficulté'}. Groupe à ${Math.round(pstate.hpRatio * 100)} % de ses PV.\n${lines.join('\n')}` },
      ], false);
      setAdvice({ busy: false, text });
    } catch (e) {
      setAdvice({ busy: false, error: e.message });
    }
  }

  const Gauge = ({ rating, small }) => (
    <div className={`skirmish-gauge ${small ? 'small' : ''}`} title={`Seuils ajustés facile / moyen / difficile / mortel : ${rating.thresholds.join(' / ')} XP`}>
      <div className="skirmish-gauge-bar">
        {['Trivial', 'Facile', 'Moyen', 'Difficile', 'Mortel'].map((l) => <span key={l}>{l}</span>)}
        <i style={{ left: `${Math.min(99, (rating.score / 5) * 100)}%` }} />
      </div>
      <small><b>{rating.label}</b> · {rating.adjusted} XP ajustés ({rating.xp} XP){pstate.hpRatio < 0.99 ? ` · groupe à ${Math.round(pstate.hpRatio * 100)} % de PV` : ''}</small>
    </div>
  );
  const groupText = (groups) => groups.map((g) => `${g.n} × ${STATS[g.stat]?.name ?? g.stat}`).join(', ');

  return (
    <div className="panel skirmish-panel">
      <div className="skirmish-head">
        <b>⚔ Champ de bataille improvisé</b>
        <div className="skirmish-tabs" role="tablist">
          {[['add', '➕ Ajouter des créatures'], ['gen', '🎲 Générer une rencontre'], ['dose', '📊 Difficulté']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`btn sm ${tab === id ? 'primary' : ''}`} onClick={() => setTab(tab === id ? null : id)}>{label}</button>
          ))}
        </div>
        <div className="skirmish-now" onClick={() => setTab('dose')}><Gauge rating={current} small /></div>
      </div>

      {tab === 'add' && (
        <div className="skirmish-body skirmish-add">
          <div className="skirmish-col">
            <div className="skirmish-row">
              <input className="input" placeholder="Chercher : gobelin, orc, squelette, loup…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="skirmish-qty">× <input className="input" type="number" min="1" max="12" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
            </div>
            <ul className="skirmish-list">
              {matches.map((s) => (
                <li key={s.id}>
                  <img src={tokenImage({ kind: 'monster', statId: s.id })} alt="" />
                  <span><b>{s.name}</b><small>FP {s.cr.split(' ')[0]} · PV {parseInt(s.hp, 10)} · CA {parseInt(s.ac, 10)}</small></span>
                  <button className="btn sm" onClick={() => addGroups([{ stat: s.id, n: Math.max(1, Number(qty) || 1) }])}>Ajouter</button>
                </li>
              ))}
              {!matches.length && <li className="muted">Rien de tel au bestiaire : crée-la à droite.</li>}
            </ul>
          </div>
          <div className="skirmish-col">
            <div className="skirmish-sub">Créature générique rapide</div>
            <div className="skirmish-row">
              <input className="input" placeholder="Nom (ex. Sentinelle de basalte)" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
            </div>
            <div className="skirmish-row">
              <select className="input" value={quick.cr} onChange={(e) => setQuick({ ...quick, cr: e.target.value })}>{QUICK_CRS.map((c) => <option key={c} value={c}>FP {c}</option>)}</select>
              <select className="input" value={quick.style} onChange={(e) => setQuick({ ...quick, style: e.target.value })}>
                <option value="brute">Brute (contact)</option><option value="tireur">Tireur</option><option value="mage">Lanceur de sorts</option>
              </select>
              <button className="btn sm" onClick={() => { const st = registerStat(quickStat(quick.name || 'Créature', quick.cr, quick.style)); addGroups([{ stat: st.id, n: Math.max(1, Number(qty) || 1) }]); setQuick({ ...quick, name: '' }); }}>Créer et placer</button>
            </div>
            <div className="skirmish-sub">Ou décrite à l’IA</div>
            <div className="skirmish-row">
              <input className="input" placeholder="ex. chaman gobelin qui invoque des rats" value={aiAsk.text} onChange={(e) => setAiAsk({ ...aiAsk, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') createWithAI(); }} />
              <button className="btn sm primary" disabled={aiAsk.busy || !ai?.apiKey || !aiAsk.text.trim()} onClick={createWithAI}>{aiAsk.busy ? 'Écriture…' : '✨ Créer'}</button>
            </div>
            {!ai?.apiKey && <p className="muted skirmish-note">Configure une clé d’IA dans Réglages pour cette option.</p>}
            {aiAsk.error && <p className="combat-ai-error">{aiAsk.error}</p>}
            <p className="muted skirmish-note">Les fiches créées ici restent dans ton bestiaire de ce navigateur et se retrouvent dans la recherche.</p>
          </div>
        </div>
      )}

      {tab === 'gen' && (
        <div className="skirmish-body">
          <div className="skirmish-row wrap">
            <span className="muted">Groupe : {pstate.size || 0} héros, niv. {pstate.levels.join(', ') || '—'} · PV {Math.round(pstate.hpRatio * 100)} %</span>
          </div>
          <div className="skirmish-row wrap">
            {LEVELS.map((l, i) => <button key={l} className={`btn sm ${target === i + 1 ? 'primary' : ''}`} onClick={() => setTarget(i + 1)}>{l}</button>)}
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>{SKIRMISH_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          </div>
          {proposal ? (
            <div className="skirmish-proposal">
              <div><b>{groupText(proposal.groups)}</b></div>
              <Gauge rating={proposal.rating} />
              <div className="skirmish-row wrap">
                <button className="btn sm" onClick={() => setSeed(seed + 1)}>🔄 Autre proposition</button>
                <button className="btn sm primary" onClick={() => addGroups(proposal.groups, { party: withParty, replace })}>📍 Placer sur la carte</button>
                {ai?.apiKey && <button className="btn sm" disabled={aiPlan.busy} onClick={proposeWithAI}>{aiPlan.busy ? 'L’IA compose…' : '✨ Proposition de l’IA'}</button>}
              </div>
            </div>
          ) : <p className="muted">Aucune créature de ce thème ne convient à ce groupe.</p>}
          {aiPlan.error && <p className="combat-ai-error">{aiPlan.error}</p>}
          {aiPlan.groups && (
            <div className="skirmish-proposal ai">
              <div><b>✨ {groupText(aiPlan.groups)}</b></div>
              {aiPlan.why && <p className="skirmish-note">{aiPlan.why}</p>}
              <Gauge rating={aiPlan.rating} />
              <button className="btn sm primary" onClick={() => addGroups(aiPlan.groups, { party: withParty, replace })}>📍 Placer sur la carte</button>
            </div>
          )}
          <div className="skirmish-row wrap">
            {!heroesOnBoard.length && party.length > 0 && <label><input type="checkbox" checked={withParty} onChange={(e) => setWithParty(e.target.checked)} /> Placer aussi le groupe ({party.length} héros) à gauche</label>}
            {battle.tokens.some((t) => t.kind === 'monster') && <label><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Remplacer les créatures déjà sur la carte</label>}
          </div>
          <p className="muted skirmish-note">Placement tactique : combattants au contact, tireurs et chef en retrait à l’abri, rôdeurs sur les flancs. Tout arrive caché aux joueurs.</p>
        </div>
      )}

      {tab === 'dose' && (
        <div className="skirmish-body">
          {foes.length ? <Gauge rating={current} /> : <p className="muted">Aucune créature debout pour l’instant.</p>}
          <div className="skirmish-intent">
            <span>Faciliter</span>
            <input type="range" min="-2" max="2" step="1" value={intent} onChange={(e) => setIntent(Number(e.target.value))} />
            <span>Corser</span>
            <b>{['Nettement plus facile', 'Un peu plus facile', 'Garder la tension', 'Un peu plus dur', 'Nettement plus dur'][intent + 2]}</b>
          </div>
          <ul className="skirmish-moves">
            {intent > 0 && reinf && (
              <li><span>📯 <b>Renforts :</b> {reinf.n} × {STATS[reinf.stat]?.name} {reinf.n > 1 ? 'surgissent' : 'surgit'} ({reinf.r.label}, {reinf.r.adjusted} XP ajustés).</span>
                <button className="btn sm" onClick={() => addGroups([{ stat: reinf.stat, n: reinf.n }])}>Faire entrer</button></li>
            )}
            {intent > 0 && (
              <li><span>🛡 <b>Formation serrée :</b> +2 CA pour les créatures (bouclier levé, couvert pris).</span>
                <button className="btn sm" onClick={() => patchFoes((c) => ({ effects: [...(c.effects || []), { name: 'Formation serrée', icon: '🛡', source: 'MJ', desc: '+2 CA, ajouté pour corser le combat.', short: '+2 CA', active: true, modifier: { ac: 2 }, usesMax: 0, usesLeft: 0, reset: 'none' }] }))}>Appliquer</button></li>
            )}
            {intent > 1 && (
              <li><span>🧪 <b>Potions :</b> les créatures sous la moitié de leurs PV en récupèrent 7 (2d4 + 2).</span>
                <button className="btn sm" onClick={() => patchFoes((c) => (Number(c.hp) < Number(c.maxHp) / 2 ? { hp: Math.min(Number(c.maxHp), Number(c.hp) + 7) } : {}))}>Appliquer</button></li>
            )}
            {intent > 0 && leaderMoves.map(([n, d]) => (
              <li key={n}><span>✨ <b>{leaderStat.name} : utilise « {n} »</b> — {d.slice(0, 140)}{d.length > 140 ? '…' : ''}</span></li>
            ))}
            {intent < 0 && hurt && (
              <li><span>🏃 <b>Moral brisé :</b> {hurt.name} ({hurt.hp}/{hurt.maxHp} PV) prend la fuite.</span>
                <button className="btn sm" onClick={() => setBattle({ ...battle, tokens: battle.tokens.filter((t) => t.id !== hurt.id) })}>Faire fuir</button></li>
            )}
            {intent < 0 && (
              <li><span>🩸 <b>Blessures cachées :</b> les créatures perdent 25 % de leurs PV restants.</span>
                <button className="btn sm" onClick={() => patchFoes((c) => ({ hp: Math.max(1, Math.round(Number(c.hp) * 0.75)) }))}>Appliquer</button></li>
            )}
            {intent < -1 && <li><span>🕯 <b>Allié inattendu :</b> un PNJ du coin intervient, ou une créature se retourne contre les siens.</span></li>}
            {intent < 0 && leaderMoves.length > 0 && <li><span>🙈 <b>Oublie</b> « {leaderMoves[0][0]} » de {leaderStat.name} ce round.</span></li>}
            {intent === 0 && <li><span>⚖ Le dosage actuel convient : joue les créatures intelligemment, et fais bouger le terrain pour garder la tension.</span></li>}
          </ul>
          <button className="btn sm primary" disabled={advice.busy || !ai?.apiKey} onClick={askAdvice}>{advice.busy ? 'L’IA réfléchit…' : '✨ Conseils de l’IA'}</button>
          {advice.error && <p className="combat-ai-error">{advice.error}</p>}
          {advice.text && (
            <ul className="combat-ai-answer">
              {advice.text.split('\n').map((l) => l.replace(/^[\s*•\-–\d.)]+/, '').trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Module Combat sous la carte de combat : les combattants et les jetons sont les mêmes (même identifiant).
 * Ajouter un combattant pose son jeton ; un jeton ajouté sur la carte devient un combattant ; retirer l’un retire
 * l’autre ; PV, CA, nom, initiative et tour en cours se reportent sur le plateau. Un autre lieu = un autre combat.
 */
/** Clé du combat d’un plateau (même calcul que la carte de combat) : une autre zone = un autre combat. */
const battleKeyOf = (m) => `${m.id}:${m.battle?.local?.source ?? m.battle?.terrain?.source ?? 'plateau'}`;

/**
 * Carte de combat dans la page Combat (à la place de la mini-map) : le plateau de la carte liée au combat, synchronisé
 * avec les combattants comme sous la carte.
 */
function CombatBoardPanel({ state, dispatch, party, npcs, selectedId, onSelect }) {
  const maps = Object.values(state.maps || {}).filter((m) => m.battle && (!state.activeUniverseId || m.universeId === state.activeUniverseId));
  const boundId = String(state.combat?.battleKey || '').split(':')[0];
  const [pick, setPick] = useState(null);
  const rec = maps.find((m) => m.id === (pick || boundId)) || maps.find((m) => m.battle.tokens?.length) || maps[0];
  if (!rec) return <p className="combat-map-help">Aucune carte de combat pour l’instant : ouvre une carte, puis « ⚔ Ouvrir la carte de combat ».</p>;
  return (
    <>
      {maps.length > 1 && (
        <select className="input combat-board-pick" value={rec.id} onChange={(e) => setPick(e.target.value)}>
          {maps.map((m) => <option key={m.id} value={m.id}>{m.battle.local?.place || m.title}</option>)}
        </select>
      )}
      <CombatBoardSync key={battleKeyOf(rec)} {...{ state, dispatch, party, npcs, selectedId, onSelect, rec }} />
    </>
  );
}

function CombatBoardSync({ state, dispatch, party, npcs, selectedId, onSelect, rec }) {
  const setBattle = (b) => dispatch({ type: 'UPDATE_MAP', id: rec.id, patch: { battle: b, updatedAt: Date.now() } });
  const bound = useBattleSync({ state, dispatch, party, npcs, battle: rec.battle, setBattle, combatKey: battleKeyOf(rec) });
  if (!bound) return <p className="muted">Préparation du combat…</p>;
  return <MiniBattle battle={rec.battle} onBattle={setBattle} selectedId={selectedId || null} onSelect={(id) => onSelect(id || '')} />;
}

/**
 * Synchronise le module Combat et un plateau de carte de combat (mêmes identifiants) : entrée dans le combat, ajouts,
 * retraits, PV, CA, nom, initiative et tour en cours. Renvoie `true` une fois le combat lié à ce plateau.
 */
function useBattleSync({ state, dispatch, party, npcs, battle, setBattle, combatKey }) {
  const c = state.combat || { combatants: [], round: 1 };
  const combatants = c.combatants || [];
  const bound = c.battleKey === combatKey;

  // Entrée dans ce combat : on reprend les combattants préparés dans l’onglet Combat (s’ils ne sont liés à aucune
  // carte), sinon ceux du plateau.
  useEffect(() => {
    if (bound) return;
    if (!c.battleKey && combatants.length) {
      dispatch({ type: 'COMBAT_SET', patch: { battleKey: combatKey, syncedIds: [] } });
      return;
    }
    const fresh = battle.tokens.map((t) => combatantFromToken(t, party, npcs));
    dispatch({ type: 'COMBAT_SET', patch: { battleKey: combatKey, combatants: fresh, syncedIds: fresh.map((x) => x.id), round: battle.round || 1, turnIndex: 0 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatKey, bound]);

  // Synchronisation dans les deux sens, à chaque changement d’un côté ou de l’autre.
  useEffect(() => {
    if (!bound) return;
    const tokens = battle.tokens;
    const tById = new Map(tokens.map((t) => [t.id, t]));
    const cById = new Map(combatants.map((x) => [x.id, x]));
    const known = new Set(c.syncedIds || tokens.filter((t) => cById.has(t.id)).map((t) => t.id));
    const goneOnMap = [...known].filter((id) => !tById.has(id) && cById.has(id));
    const goneInCombat = [...known].filter((id) => !cById.has(id) && tById.has(id));
    const newTokens = tokens.filter((t) => !cById.has(t.id) && !known.has(t.id));
    const newCombatants = combatants.filter((x) => !tById.has(x.id) && !known.has(x.id));

    let nextComb = combatants.filter((x) => !goneOnMap.includes(x.id));
    if (newTokens.length) nextComb = [...nextComb, ...newTokens.map((t) => combatantFromToken(t, party, npcs))];
    let nextTokens = tokens.filter((t) => !goneInCombat.includes(t.id));
    if (newCombatants.length) nextTokens = [...nextTokens, ...placeOnBoard({ ...battle, tokens: nextTokens }, newCombatants.map(tokenFromCombatant))];

    // États (À terre, Empoisonné…) synchronisés dans les deux sens. `condsAt` garde, sur le combattant, les états du
    // dernier accord avec son jeton : le côté qui s’en écarte est celui qui vient de changer, l’autre le suit.
    const condKey = (list) => [...new Set(list || [])].sort().join('|');
    const conds = new Map();
    for (const t of nextTokens) {
      const x = nextComb.find((q) => q.id === t.id);
      if (!x) continue;
      const tk = condKey(t.conditions);
      const ck = condKey(x.conditions);
      const last = x.condsAt;
      const fromToken = tk !== ck && (last === undefined ? !x.conditions?.length : last === ck);
      conds.set(t.id, fromToken ? [...(t.conditions || [])] : [...(x.conditions || [])]);
    }
    nextComb = nextComb.map((x) => {
      if (!conds.has(x.id)) return x;
      const list = conds.get(x.id);
      const key = condKey(list);
      return condKey(x.conditions) === key && x.condsAt === key ? x : { ...x, conditions: list, condsAt: key };
    });

    // Ce que le module Combat décide (PV, CA, nom, initiative, états ; déplacement et arme en main des héros) se voit
    // sur le plateau. Chaque perte ou gain de PV est noté pour être écrit en grand au-dessus du jeton.
    const byId = new Map(nextComb.map((x) => [x.id, x]));
    const now = Date.now();
    const hits = [];
    nextTokens = nextTokens.map((t) => {
      const x = byId.get(t.id);
      if (!x) return t;
      const ac = getCombatantDerivedStats(x).ac;
      const init = x.init === '' || x.init === undefined ? undefined : Number(x.init);
      const sameConds = condKey(t.conditions) === condKey(x.conditions);
      const hero = x.isPC ? heroReachOf(x) : null;
      const sameHero = !hero || (t.move === hero.move && JSON.stringify(t.reach) === JSON.stringify(hero.reach));
      const same = t.hp === Number(x.hp) && t.maxHp === Number(x.maxHp) && t.ac === Number(ac) && t.name === x.name && t.init === init && sameConds && sameHero;
      if (t.hp !== undefined && Number(x.hp) !== t.hp) hits.push({ id: uid(), to: t.id, amount: Number(x.hp) - t.hp, at: now });
      return same ? t : {
        ...t, hp: Number(x.hp), maxHp: Number(x.maxHp), ac: Number(ac), name: x.name, init,
        ...(sameConds ? {} : { conditions: [...(x.conditions || [])] }),
        ...(hero ? { move: hero.move, reach: hero.reach } : {}),
      };
    });

    const sorted = [...nextComb].sort((a, b) => (Number(b.init) || 0) - (Number(a.init) || 0));
    const active = sorted.length ? sorted[Math.min(Number(c.turnIndex || 0), sorted.length - 1)] : null;
    const turn = active?.id;
    const round = Number(c.round || 1);
    const synced = nextComb.filter((x) => nextTokens.some((t) => t.id === x.id)).map((x) => x.id);

    const combChanged = nextComb.length !== combatants.length || nextComb.some((x, i) => x !== combatants[i]);
    const syncedChanged = synced.length !== (c.syncedIds || []).length || synced.some((id, i) => id !== c.syncedIds[i]);
    if (combChanged || syncedChanged) dispatch({ type: 'COMBAT_SET', patch: { ...(combChanged ? { combatants: nextComb } : {}), syncedIds: synced } });
    const tokensChanged = nextTokens.length !== tokens.length || nextTokens.some((t, i) => t !== tokens[i]);
    const recentHits = hits.length ? [...(battle.hits || []).filter((h) => now - h.at < 8000), ...hits].slice(-12) : battle.hits;
    if (tokensChanged || battle.turn !== turn || battle.round !== round) setBattle({ ...battle, tokens: nextTokens, turn, round, hits: recentHits });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bound, combatants, battle.tokens, c.turnIndex, c.round, c.syncedIds]);
  return bound;
}

function MapEncounter({ state, dispatch, party, npcs, flash, battle, setBattle, place, combatKey, selectedId, onSelect }) {
  const c = state.combat || { combatants: [], round: 1 };
  const combatants = c.combatants || [];
  const bound = useBattleSync({ state, dispatch, party, npcs, battle, setBattle, combatKey });

  const positions = Object.fromEntries(battle.tokens.map((t) => [t.id, { x: t.x, y: t.y, visible: t.visible }]));
  const tactics = useMemo(() => battleTactics(battle, combatants), [battle, combatants]);
  if (!bound) return <p className="muted">Préparation du combat…</p>;
  return <Encounter {...{ dispatch, state, party, npcs, flash }} embedded={{ selectedId, onSelect, place, positions, tactics, battle, setBattle }} />;
}

/** « name Discrétion, bonus +6, desc … » (objets aplatis en texte), tableaux ou objets → « Discrétion +6, … ». */
function formatBonuses(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : `${x.name || x.label || ''} ${x.bonus ?? x.value ?? ''}`.trim())).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([k, b]) => `${k} ${b}`).join(', ');
  const str = String(v);
  const pairs = [...str.matchAll(/name\s+([^,]+?),\s*bonus\s+([+-]?\d+)/gi)];
  return pairs.length ? pairs.map((m) => `${m[1].trim()} ${m[2]}`).join(', ') : str;
}

function normalizeCreatureName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[’']/g, "'")
    .replace(/^(?:les\s+|le\s+|la\s+|l')/, '').replace(/\s*#?\d+$/, '').trim();
}

/** Illustration de la créature dans la bibliothèque (fiches importées des Archives comprises), par son nom. */
function libraryImageOf(state, name) {
  const key = normalizeCreatureName(name);
  if (!key) return '';
  const entry = Object.values(state.libraryEntries || {}).find((e) => normalizeCreatureName(e.title) === key);
  const a = entry ? getPrimaryAsset(state, 'library', entry.id) : null;
  return a ? a.dataUrl || a.url || '' : '';
}

/** Portrait importé sur une fiche PNJ ou créature. La vignette ronde du SRD, posée à défaut
 *  d'illustration, n'en est pas un : c'est un jeton. */
function sheetPortraitOf(state, npc) {
  const pick = (type) => Object.values(state.assets || {})
    .filter((a) => a.targetType === type && a.targetId === npc.id && a.source !== 'srd' && (a.dataUrl || a.url))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const a = pick('creature') || pick('npc');
  return a ? a.dataUrl || a.url : '';
}

/** Illustration d'un combattant : le joueur par son portrait, la créature par sa fiche
 *  (sourceId), puis par son nom. Même règle pour la fiche MJ et l'écran joueur. */
function combatantArtOf(state, t, feed) {
  if (!t) return '';
  const src = String(t.sourceId || '');
  if (t.isPC) {
    const a = src ? getPrimaryAsset(state, 'player', src) : null;
    return a ? a.dataUrl || a.url || '' : '';
  }
  const npc = src && !src.startsWith('srd:') ? state.npcs?.[src] : null;
  return (npc && sheetPortraitOf(state, npc)) || creatureArtOf(state, t.name, feed) || (npc ? creatureArtOf(state, npc.name, feed) : '');
}

/** Image d’un combattant pour l’initiative : son illustration, sinon le portrait de sa fiche, sinon son jeton. */
function combatantPictureOf(state, t) {
  if (!t) return '';
  const src = String(t.sourceId || '');
  const npc = !t.isPC && src && !src.startsWith('srd:') ? state.npcs?.[src] : null;
  return combatantArtOf(state, t)
    || (npc && portraitOf(state, npc))
    || (src.startsWith('srd:') && tokenImage({ kind: 'monster', statId: src.slice(4) }))
    || t.image || '';
}

/** Pleine illustration d'une créature, par son nom : portrait importé sur sa fiche PNJ, puis
 *  bibliothèque, puis Archives. Jamais le jeton rond. */
function creatureArtOf(state, name, feed) {
  const key = normalizeCreatureName(name);
  if (!key) return '';
  const npc = Object.values(state.npcs || {}).find((n) => normalizeCreatureName(n.name) === key);
  const fromSheet = npc ? sheetPortraitOf(state, npc) : '';
  if (fromSheet) return fromSheet;
  const fromLibrary = libraryImageOf(state, name);
  if (fromLibrary) return fromLibrary;
  const entry = feed?.entries?.find((e) => normalizeCreatureName(e.name) === key);
  const src = entry?.images?.find((i) => i.kind !== 'anatomie')?.src || entry?.images?.[0]?.src || '';
  return !src || /^(data:|https?:|\/)/.test(src) ? src : `/${src}`;
}

/** Types de dégâts saisis en anglais dans les fiches de héros, en français pour l’affichage. */
const TYPE_FR = { slashing: 'tranchants', piercing: 'perforants', bludgeoning: 'contondants', fire: 'de feu', cold: 'de froid', force: 'de force', 'force/fire': 'de force', poison: 'de poison', necrotic: 'nécrotiques', radiant: 'radiants', lightning: 'de foudre', thunder: 'de tonnerre', acid: 'd’acide', psychic: 'psychiques', weapon: '' };
const frDamage = (text) => String(text || '').replace(/\b(slashing|piercing|bludgeoning|force\/fire|fire|cold|force|poison|necrotic|radiant|lightning|thunder|acid|psychic|weapon)\b/gi, (m) => TYPE_FR[m.toLowerCase()] ?? m).trim();

/** Portée d’une attaque, en cases : allonge au contact, ou portée courte / longue à distance. */
/** Déplacement (en cases) et portée de l’arme en main d’un héros, pour l’écran joueur. */
function heroReachOf(x) {
  const sp = String(x.speed || '30 ft.');
  const n = parseFloat(sp.replace(',', '.')) || 30;
  const move = Math.max(1, Math.round((/\bm\b|mètre/i.test(sp) ? n * 3.28084 : n) / 5));
  const weapons = (x.attacks || []).filter(isWieldedWeapon);
  const name = x.wield && weapons.some((w) => w.name === x.wield) ? x.wield : weapons[0]?.name;
  const a = (x.attacks || []).find((q) => q.name === name) || (x.attacks || [])[0];
  if (!a) return { move, reach: { melee: 1, short: 0, long: 0 } };
  return { move, reach: { ...attackReach(a), weapon: a.name } };
}

function attackReach(a) {
  const text = `${a.range || ''} ${a.desc || ''}`;
  const cells = (m) => Math.round((parseFloat(String(m).replace(',', '.')) * 3.28084) / 5);
  const al = /allonge\s*([\d,]+)\s*m/i.exec(text);
  const po = /portée\s*([\d,]+)\s*\/\s*([\d,]+)\s*m/i.exec(text);
  const ft = /(\d+)\s*(?:[–/-]\s*(\d+)\s*)?ft/i.exec(a.range || '');
  const melee = al ? cells(al[1]) : 0;
  let short = po ? cells(po[1]) : 0, long = po ? cells(po[2]) : 0;
  if (!al && !po && ft) {
    const n = Number(ft[1]) / 5;
    if (n <= 2) return { melee: n, short: 0, long: 0 };
    short = n; long = ft[2] ? Number(ft[2]) / 5 : n;
  }
  if (!melee && !short && /corps à corps|mêlée|melee/i.test(text)) return { melee: 1, short: 0, long: 0 };
  return { melee: melee || (!short ? 1 : 0), short, long };
}

/** Une arme qu’on tient en main (une épée, un arc) : pas une morsure, un sort ni un trait. */
const isWieldedWeapon = (a) => !/morsure|griffe|coup|poing|frappe|tentacule|dard|queue|corne|souffle|sort|cantrip|trait mystique|rayon|onde|incantation|attaques multiples/i.test(`${a.name} ${a.type || ''}`);
const isTwoHanded = (a) => /deux mains|two-handed|arc|arbalète lourde|arbalete lourde|pique|coutille|glaive|maillet|lance d.arçon/i.test(`${a.name} ${a.desc || ''}`);
const rollDie = (f) => 1 + Math.floor(Math.random() * f);
const rollDice = (expr) => (String(expr).match(/(\d*)d(\d+)/g) || []).reduce((s, d) => { const [n, f] = d.split('d').map((x) => Number(x || 1)); let t = 0; for (let i = 0; i < n; i++) t += rollDie(f); return s + t; }, 0);
const doubleDice = (expr) => String(expr).replace(/(\d*)d(\d+)/g, (_, n, f) => `${Number(n || 1) * 2}d${f}`);

/**
 * Attaque sur la carte : l’attaquant vise une cible (trait tracé, aussi chez les joueurs). Le panneau dit quoi lancer
 * (bonus, avantage ou désavantage selon la position, abri de la cible), bloque une attaque hors de portée ou avec une
 * arme qu’on ne tient pas, puis applique les dégâts à partir du résultat des dés.
 */
function AttackPanel({ state, dispatch, battle, setBattle }) {
  const aim = battle.aim;
  const c = state.combat || {};
  const combatants = c.combatants || [];
  const A = combatants.find((x) => x.id === aim.from);
  const T = combatants.find((x) => x.id === aim.to);
  const tA = battle.tokens.find((t) => t.id === aim.from);
  const tT = battle.tokens.find((t) => t.id === aim.to);
  const [pick, setPick] = useState(aim.pick ?? null);
  const [d20, setD20] = useState(['', '']);
  const [dmg, setDmg] = useState('');
  const [save, setSave] = useState('');
  const [done, setDone] = useState(null);
  const [reaction, setReaction] = useState(false);
  const announceTimer = useRef(null);
  // L’annonce part après une courte pause de saisie : elle s’applique au plateau tel qu’il est à ce moment-là.
  const battleRef = useRef(battle);
  battleRef.current = battle;
  useEffect(() => () => clearTimeout(announceTimer.current), []);
  const close = () => setBattle({ ...battle, aim: undefined });
  if (!A || !T || !tA || !tT) return <div className="attack-panel"><p className="muted">Attaquant ou cible absent du combat.</p><button className="btn sm" onClick={close}>Fermer</button></div>;

  const grid = effectiveOf(battle);
  const dist = Math.max(Math.max(0, tA.x - (tT.x + tT.size - 1), tT.x - (tA.x + tA.size - 1)), Math.max(0, tA.y - (tT.y + tT.size - 1), tT.y - (tA.y + tA.size - 1)));
  const cover = coverAgainst(battle, grid, tA, tT);
  const notes = battleTactics(battle, combatants)[A.id] || [];
  const derived = getCombatantDerivedStats(A);
  const targetAc = getCombatantDerivedStats(T).ac;
  const turnKey = `${c.round || 1}:${c.turnIndex || 0}`;
  const weapons = (A.attacks || []).filter(isWieldedWeapon);
  const inHand = A.isPC ? (A.wield && weapons.some((w) => w.name === A.wield) ? A.wield : weapons[0]?.name) : null;

  const options = (A.attacks || []).map((a, i) => {
    const calc = calculateAttackLine(A, a, derived);
    const reach = attackReach(a);
    const saveM = /sauvegarde de (\w+)\s*DD\s*(\d+)/i.exec(a.desc || '');
    const isSave = !!saveM && !/au toucher/i.test(a.desc || '');
    const melee = reach.melee > 0 && dist <= reach.melee;
    const ranged = !melee && reach.long > 0 && dist <= reach.long;
    const why = [];
    let blocked = '';
    if (/attaques multiples/i.test(a.name)) blocked = 'Résume les attaques : choisis chacune des attaques ci-dessous.';
    else if (!melee && !ranged) blocked = `Hors de portée : ${T.name} est à ${dist * 5} pieds (${reach.melee ? `allonge ${reach.melee * 5} pi` : `portée ${reach.short * 5}/${reach.long * 5} pi`}).`;
    else if (A.isPC && isWieldedWeapon(a) && inHand && inHand !== a.name) {
      const cur = weapons.find((w) => w.name === inHand);
      blocked = `${A.name} tient ${cur ? `« ${cur.name} »${isTwoHanded(cur) ? ' à deux mains' : ''}` : 'autre chose'}. Pour utiliser « ${a.name} », il faut changer d’arme.`;
    }
    let adv = derived.advantage, dis = derived.disadvantage;
    if (ranged && dist > reach.short) { dis = true; why.push(`portée longue (au-delà de ${reach.short * 5} pi) : désavantage`); }
    if (ranged && notes.some((n) => n.label.startsWith('Désavantage à distance'))) { dis = true; why.push('ennemi au contact : désavantage à distance'); }
    if (melee && notes.some((n) => n.label === `Avantage contre ${T.name} (Tactique de groupe)`)) { adv = true; why.push('Tactique de groupe : avantage'); }
    if (melee && notes.some((n) => n.label === `Prise en tenaille de ${T.name}`)) why.push('prise en tenaille possible (règle optionnelle : avantage)');
    const mode = adv && dis ? 'normal' : adv ? 'adv' : dis ? 'dis' : 'normal';
    return { a, i, calc, reach, melee, ranged, blocked, why, mode, isSave, saveAbility: saveM?.[1], saveDc: saveM ? Number(saveM[2]) : 0 };
  });
  const usable = options.filter((o) => !o.blocked);
  if (!options.length) return <div className="attack-panel"><p className="muted">{A.name} n’a aucune attaque sur sa fiche.</p><button className="btn sm" onClick={close}>Fermer</button></div>;
  const sel = options.find((o) => o.i === pick) || usable[0] || options[0];
  const coverAc = cover.level === 3 ? null : cover.ac;
  const dc = targetAc + (coverAc || 0);

  // Un héros n’attaque que pendant son tour (sauf réaction : attaque d’opportunité).
  const offTurn = A.isPC && battle.turn && battle.turn !== A.id && !reaction;
  const foes = combatants.filter((x) => x.id !== A.id && battle.tokens.some((t) => t.id === x.id));
  const retarget = (to) => {
    clearTimeout(announceTimer.current);
    setD20(['', '']); setDmg(''); setSave(''); setDone(null);
    setBattle({ ...battle, aim: { from: aim.from, to, at: aim.at, by: aim.by } });
  };
  const family = attackFamily(sel.a, String(sel.calc.damageType || ''), sel.ranged);

  /** Verdict d’un jet pour toucher (les d20 saisis), annoncé aux joueurs avec une phrase de récit. */
  const verdictOf = (dice) => {
    const v = dice.map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 20);
    if (!v.length || (sel.mode !== 'normal' && v.length < 2)) return null;
    const n = sel.mode === 'normal' ? v[0] : sel.mode === 'adv' ? Math.max(...v) : Math.min(...v);
    const tot = n + Number(sel.calc.attackBonus || 0);
    const verdict = n === 20 ? 'crit' : n === 1 ? 'fumble' : tot >= dc ? 'hit' : 'miss';
    return { verdict, roll: tot };
  };
  const announce = (dice, delay = 700) => {
    clearTimeout(announceTimer.current);
    const v = verdictOf(dice);
    if (!v) return;
    announceTimer.current = setTimeout(() => {
      const cur = battleRef.current;
      if (cur.aim?.at !== aim.at || cur.aim?.to !== aim.to) return;
      const keep = cur.aim?.verdict === v.verdict && cur.aim?.line;
      const line = keep || attackLine(family, v.verdict, { A: A.name, T: T.name, W: sel.a.name });
      const label = { crit: 'Coup critique !', hit: 'Touché !', miss: 'Raté', fumble: 'Échec critique !' }[v.verdict];
      setBattle({
        ...cur,
        aim: { ...cur.aim, verdict: v.verdict, roll: v.roll, line, weapon: sel.a.name, damage: undefined, text: `${A.name} → ${T.name} : ${label}`, tone: v.verdict === 'crit' ? 'crit' : v.verdict === 'hit' ? 'hit' : 'miss' },
      });
    }, delay);
  };
  const setDice = (next, delay) => { setD20(next); announce(next, delay); };

  const switchTo = (name) => {
    const used = A.interactAt === turnKey;
    const patch = { wield: name, interactAt: turnKey, dropped: inHand && inHand !== name ? [...new Set([...(A.dropped || []), inHand])] : A.dropped };
    dispatch({ type: 'COMBAT_SET', patch: { combatants: combatants.map((x) => (x.id === A.id ? { ...x, ...patch } : x)) } });
    setPick(options.find((o) => o.a.name === name)?.i ?? null);
    return used;
  };

  // Jet d’attaque : le dé naturel (deux avec avantage ou désavantage), le bonus s’ajoute.
  const nat = (() => {
    const v = d20.map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 20);
    if (!v.length) return null;
    if (sel.mode === 'normal' || v.length < 2) return v[0];
    return sel.mode === 'adv' ? Math.max(...v) : Math.min(...v);
  })();
  const total = nat === null ? null : nat + Number(sel.calc.attackBonus || 0);
  const crit = nat === 20, fumble = nat === 1;
  const hit = nat === null ? null : fumble ? false : crit ? true : total >= dc;

  // Dégâts : la somme des dés (doublés sur un critique) plus le bonus, ajustée aux résistances de la cible.
  const stat = tT.statId ? STATS[tT.statId] : null;
  const rawType = String(sel.calc.damageType || '').toLowerCase();
  const type = rawType in TYPE_FR ? TYPE_FR[rawType] : rawType;
  const has = (field) => !!(type && field && skNorm(field).includes(skNorm(type).replace(/s$/, '')));
  const factor = has(stat?.immune) ? 0 : has(stat?.resist) ? 0.5 : has(stat?.vuln) ? 2 : 1;
  const dice = sel.calc.damageDice ? (crit ? doubleDice(sel.calc.damageDice) : sel.calc.damageDice) : '';
  const raw = dmg === '' ? null : Math.max(0, parseInt(dmg, 10) + Number(sel.calc.damageBonus || 0));
  const saveOk = save === '' ? null : parseInt(save, 10) >= sel.saveDc;
  const final = raw === null ? null : Math.floor((sel.isSave && saveOk ? raw / 2 : raw) * factor);

  const apply = () => {
    const hp = Math.max(0, Number(T.hp) - (final || 0));
    dispatch({ type: 'COMBAT_SET', patch: { combatants: combatants.map((x) => (x.id === T.id ? { ...x, hp } : x)) } });
    const text = sel.isSave
      ? `${A.name} → ${T.name} : ${saveOk ? 'sauvegarde réussie' : 'sauvegarde ratée'}, ${final} dégâts`
      : `${A.name} → ${T.name} : ${crit ? 'Coup critique !' : 'Touché !'} ${final} dégâts${type ? ` ${type}` : ''}`;
    clearTimeout(announceTimer.current);
    const verdict = sel.isSave ? 'hit' : crit ? 'crit' : 'hit';
    const line = sel.isSave ? '' : battle.aim?.line || attackLine(family, verdict, { A: A.name, T: T.name, W: sel.a.name });
    setBattle({ ...battle, aim: { ...aim, text, tone: crit ? 'crit' : 'hit', verdict, roll: total ?? undefined, line, weapon: sel.a.name, damage: final } });
    setDone({ text, hp });
  };
  const miss = () => {
    clearTimeout(announceTimer.current);
    const verdict = fumble ? 'fumble' : 'miss';
    const text = `${A.name} → ${T.name} : ${fumble ? 'Échec critique !' : 'Raté'}`;
    const line = battle.aim?.verdict === verdict && battle.aim?.line ? battle.aim.line : attackLine(family, verdict, { A: A.name, T: T.name, W: sel.a.name });
    setBattle({ ...battle, aim: { ...aim, text, tone: 'miss', verdict, roll: total ?? undefined, line, weapon: sel.a.name } });
    setDone({ text });
  };
  const again = () => {
    clearTimeout(announceTimer.current);
    setD20(['', '']); setDmg(''); setSave(''); setDone(null);
    setBattle({ ...battle, aim: { from: aim.from, to: aim.to, at: aim.at, by: aim.by } });
  };

  return (
    <div className="attack-panel">
      <div className="attack-head">
        <b>🎯 {A.name} → {T.name}</b>
        <button type="button" className="token-sheet-close" onClick={close} aria-label="Terminer l’attaque">✕</button>
      </div>
      <label className="attack-target">
        <span>Cible</span>
        <select className="input" value={T.id} onChange={(e) => retarget(e.target.value)}>
          {foes.map((x) => <option key={x.id} value={x.id}>{x.name}{x.isPC ? ' (héros)' : ''} · {x.hp}/{x.maxHp} PV</option>)}
        </select>
      </label>
      <div className="attack-facts">
        <span>{dist * 5} pi</span>
        <span>CA {targetAc}{coverAc ? ` +${coverAc} (abri)` : ''}</span>
        {cover.level > 0 && <span className="tac-chip tone-buff" tabIndex={0}>🛡 {cover.label}<span className="tac-why" role="tooltip">{cover.why}</span></span>}
        {aim.by === 'joueurs' && <span className="attack-by">déclarée depuis l’écran joueur</span>}
      </div>
      {cover.level === 3 && <p className="attack-block">Pas de ligne de vue : {T.name} ne peut pas être pris pour cible directement.</p>}

      <div className="attack-options">
        {options.map((o) => (
          <button key={o.i} type="button" className={`attack-option ${o === sel ? 'on' : ''} ${o.blocked ? 'blocked' : ''}`} onClick={() => setPick(o.i)}>
            <b>{o.a.name}</b>
            <small>{o.isSave ? `Sauv. ${o.saveAbility} DD ${o.saveDc}` : o.calc.toHit} · {frDamage(o.calc.damage)}</small>
          </button>
        ))}
      </div>

      {offTurn ? (
        <div className="attack-block">
          <p>⛔ Ce n’est pas le tour de {A.name} : un héros n’attaque que pendant son tour.</p>
          <div className="skirmish-row wrap">
            <button className="btn sm" onClick={() => setReaction(true)} title="Réaction : attaque d’opportunité quand un ennemi quitte son allonge">C’est une réaction (attaque d’opportunité)</button>
            <button className="btn sm" onClick={close}>Fermer</button>
          </div>
        </div>
      ) : sel.blocked ? (
        <div className="attack-block">
          <p>⛔ {sel.blocked}</p>
          {A.isPC && isWieldedWeapon(sel.a) && inHand && inHand !== sel.a.name && sel.ranged + sel.melee > 0 && (
            <>
              <p className="muted">Lâcher une arme est gratuit ; dégainer l’autre utilise l’interaction d’objet du tour{A.interactAt === turnKey ? ' — déjà utilisée : il faudra une action' : ' (gratuite)'}.</p>
              <button className="btn sm" onClick={() => switchTo(sel.a.name)}>Lâcher « {inHand} » et prendre « {sel.a.name} »{A.interactAt === turnKey ? ' (action)' : ''}</button>
            </>
          )}
        </div>
      ) : done ? (
        <div className="attack-done">
          <p><b>{done.text}</b>{done.hp !== undefined ? ` · ${T.name} : ${done.hp}/${T.maxHp} PV` : ''}</p>
          <div className="skirmish-row wrap">
            <button className="btn sm" onClick={again}>Attaque suivante</button>
            <button className="btn sm primary" onClick={close}>Terminer</button>
          </div>
        </div>
      ) : sel.isSave ? (
        <div className="attack-steps">
          <p>{T.name} fait une <b>sauvegarde de {sel.saveAbility} DD {sel.saveDc}</b>. Résultat de son jet (total) :</p>
          <div className="skirmish-row"><input className="input" type="number" value={save} onChange={(e) => setSave(e.target.value)} placeholder="Total" /></div>
          {saveOk !== null && (
            <>
              <p>{saveOk ? 'Réussite : moitié des dégâts.' : 'Échec : dégâts complets.'} Lance <b>{dice || '—'}</b>{sel.calc.damageBonus ? ` ${signed(sel.calc.damageBonus)}` : ''}.</p>
              <div className="skirmish-row">
                <input className="input" type="number" value={dmg} onChange={(e) => setDmg(e.target.value)} placeholder="Somme des dés" />
                <button className="btn sm" onClick={() => setDmg(String(rollDice(dice)))}>🎲 Lancer</button>
              </div>
              {final !== null && <button className="btn sm primary" onClick={apply}>Appliquer {final} dégâts à {T.name}{factor !== 1 ? ` (${factor === 0 ? 'immunité' : factor < 1 ? 'résistance' : 'vulnérabilité'})` : ''}</button>}
            </>
          )}
        </div>
      ) : (
        <div className="attack-steps">
          <p>Lance <b>{sel.mode === 'normal' ? '1d20' : `2d20 (${sel.mode === 'adv' ? 'garde le meilleur' : 'garde le pire'})`} {signed(sel.calc.attackBonus)}</b>{sel.calc.attackDice?.length ? ` ${sel.calc.attackDice.join(' ')}` : ''} contre <b>{dc}</b>.</p>
          {sel.why.length > 0 && <p className="muted attack-why">{sel.why.join(' · ')}</p>}
          <div className="skirmish-row">
            <input className="input" type="number" min="1" max="20" value={d20[0]} onChange={(e) => setDice([e.target.value, d20[1]])} onKeyDown={(e) => { if (e.key === 'Enter') announce(d20, 0); }} placeholder="d20" aria-label="Résultat du d20" />
            {sel.mode !== 'normal' && <input className="input" type="number" min="1" max="20" value={d20[1]} onChange={(e) => setDice([d20[0], e.target.value])} onKeyDown={(e) => { if (e.key === 'Enter') announce(d20, 0); }} placeholder="2e d20" aria-label="Second d20" />}
            <button className="btn sm" onClick={() => setDice([String(rollDie(20)), String(rollDie(20))], 0)}>🎲 Lancer</button>
          </div>
          {hit !== null && (
            <p className={`attack-verdict ${hit ? 'hit' : 'miss'}`}>
              {nat}{sel.mode !== 'normal' && d20[1] ? ` (sur ${d20[0]} et ${d20[1]})` : ''} {signed(sel.calc.attackBonus)} = <b>{total}</b> → {crit ? 'Coup critique !' : fumble ? 'Échec critique' : hit ? 'Touché' : 'Raté'}
            </p>
          )}
          {hit !== null && battle.aim?.line && <p className="attack-line">« {battle.aim.line} »</p>}
          {hit === false && <button className="btn sm" onClick={miss}>Terminer : raté</button>}
          {hit && (
            <>
              <p>Dégâts : lance <b>{dice || '—'}</b>{sel.calc.damageBonus ? ` ${signed(sel.calc.damageBonus)}` : ''}{type ? ` ${type}` : ''}{crit ? ' (dés doublés)' : ''}.</p>
              <div className="skirmish-row">
                <input className="input" type="number" value={dmg} onChange={(e) => setDmg(e.target.value)} placeholder="Somme des dés" />
                <button className="btn sm" onClick={() => setDmg(String(rollDice(dice)))}>🎲 Lancer</button>
              </div>
              {final !== null && <button className="btn sm primary" onClick={apply}>Appliquer {final} dégâts à {T.name}{factor !== 1 ? ` (${factor === 0 ? 'immunité' : factor < 1 ? 'résistance' : 'vulnérabilité'})` : ''}</button>}
            </>
          )}
        </div>
      )}
      {A.isPC && inHand && <p className="muted attack-hand">En main : {inHand}{A.dropped?.length ? ` · au sol : ${A.dropped.join(', ')}` : ''}</p>}
    </div>
  );
}

/** Aperçu de la fiche du jeton sélectionné sur la carte de combat : l’essentiel pour jouer son tour. */
function TokenSheet({ state, dispatch, id, battle, onClose }) {
  const { feed: archiveFeed } = useUnderdarkFeed();
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(null);
  const combatants = state.combat?.combatants || [];
  const t = combatants.find((x) => x.id === id);
  if (!t) return <p className="muted token-sheet-empty">Ce jeton n’est pas (encore) dans le combat.</p>;

  const derived = getCombatantDerivedStats(t);
  const tactics = battle ? battleTactics(battle, combatants)[t.id] || [] : [];
  const src = String(t.sourceId || '');
  const npc = !t.isPC && src && !src.startsWith('srd:') ? state.npcs?.[src] : null;
  const pcAsset = t.isPC && src ? getPrimaryAsset(state, 'player', src) : null;
  // Une vraie illustration (portrait importé ou image des Archives) s'affiche en grand ;
  // à défaut, on garde le petit jeton rond.
  const illustration = combatantArtOf(state, t, archiveFeed);
  const picture = illustration
    || (npc && portraitOf(state, npc))
    || (src.startsWith('srd:') && tokenImage({ kind: 'monster', statId: src.slice(4) }))
    || t.image || '';
  const hp = Number(t.hp || 0);
  const maxHp = Math.max(1, Number(t.maxHp || 1));
  const pct = Math.round((hp / maxHp) * 100);
  const col = pct > 50 ? 'var(--verdant)' : pct > 20 ? 'var(--ember)' : 'var(--blood)';
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const saves = formatBonuses(t.saves);
  const skills = formatBonuses(t.skills);
  const perception = skills.match(/perception\s*\+?(-?\d+)/i);
  const passive = 10 + (perception ? Number(perception[1]) : abilityMod(t.wis || 10));
  const active = (t.effects || []).filter((e) => e.active);
  const traits = (t.effects || []).filter((e) => !e.active && e.source === 'Trait');
  const patch = (p) => dispatch({ type: 'COMBAT_SET', patch: { combatants: combatants.map((x) => (x.id === t.id ? { ...x, ...p } : x)) } });
  const applyHp = (dir) => {
    const v = parseInt(amount, 10);
    if (!v) return;
    patch({ hp: Math.max(0, Math.min(maxHp, hp - dir * v)) });
    setAmount('');
  };
  const lines = [
    ['Vitesse', t.speed], ['Sauvegardes', saves], ['Compétences', skills], ['Sens', toText(t.senses)], ['Langues', toText(t.languages)],
  ].filter(([, v]) => v);

  return (
    <div className="token-sheet" data-kind={t.isPC ? 'pc' : 'creature'}>
      {illustration ? (
        <div className="token-sheet-hero">
          <img src={illustration} alt="" />
          <div className="token-sheet-name">
            <b>{t.name}</b>
            <span>{[t.kind, t.cr ? `FP ${t.cr}` : '', t.isPC && t.level ? `niv. ${t.level}` : ''].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" className="token-sheet-close" onClick={onClose} aria-label="Fermer la fiche">✕</button>
        </div>
      ) : (
        <div className="token-sheet-head">
          <div className={`token-sheet-picture ${t.isPC ? 'pc' : 'foe'}`}>
            {picture ? <img src={picture} alt="" /> : <span title="Aucune image : ajoute un portrait à la fiche">{(t.name || '?').charAt(0)}</span>}
          </div>
          <div className="token-sheet-name">
            <b>{t.name}</b>
            <span>{[t.kind, t.cr ? `FP ${t.cr}` : '', t.isPC && t.level ? `niv. ${t.level}` : ''].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" className="token-sheet-close" onClick={onClose} aria-label="Fermer la fiche">✕</button>
        </div>
      )}

      <div className="token-sheet-hp">
        <div className="token-sheet-bar"><i style={{ width: `${pct}%`, background: col }} /></div>
        <span><b>{hp}</b> / {maxHp} PV{hp === 0 ? ' · à terre' : ''}</span>
        <div className="token-sheet-hp-row">
          <input
            type="number" min="0" placeholder="PV" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyHp(+1); }}
          />
          <button type="button" className="btn sm danger" onClick={() => applyHp(+1)}>Dégâts</button>
          <button type="button" className="btn sm" onClick={() => applyHp(-1)}>Soin</button>
        </div>
      </div>

      <div className="token-sheet-stats">
        <div><span>CA</span><b>{derived.ac}</b></div>
        <div><span>Init.</span><b>{t.init === '' || t.init === undefined ? '—' : t.init}</b></div>
        <div><span title="Perception passive">Perc. pass.</span><b>{passive}</b></div>
      </div>

      <div className="token-sheet-block">
        <div className="token-sheet-title">États</div>
        <ConditionPicker conditions={t.conditions || []} onChange={(conditions) => patch({ conditions })} />
      </div>

      <div className="token-sheet-abil">
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k, i) => (
          <div key={k}><span>{['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'][i]}</span><b>{sign(abilityMod(t[k] || 10))}</b><small>{t[k] || 10}</small></div>
        ))}
      </div>

      {tactics.length > 0 && (
        <div className="token-sheet-block">
          <div className="token-sheet-title">Position (auto)</div>
          <TacticalChips notes={tactics} />
        </div>
      )}

      {active.length > 0 && (
        <div className="token-sheet-chips">
          {active.map((e, i) => <span key={i} title={e.desc || e.short || ''}>{e.name}</span>)}
        </div>
      )}

      {(t.attacks || []).length > 0 && (
        <div className="token-sheet-block">
          <div className="token-sheet-title">Attaques / actions</div>
          {t.attacks.map((a, i) => {
            const calc = calculateAttackLine(t, a, derived);
            const key = `a${i}`;
            return (
              <div key={key} className="token-sheet-attack">
                <button type="button" onClick={() => setOpen(open === key ? null : key)}>
                  <b>{a.name}</b>
                  <span>{calc.toHit} · {calc.damage}</span>
                </button>
                {open === key && a.desc && <p>{a.desc}</p>}
              </div>
            );
          })}
        </div>
      )}

      {traits.length > 0 && (
        <div className="token-sheet-block">
          <div className="token-sheet-title">Traits</div>
          {traits.map((e, i) => {
            const key = `t${i}`;
            return (
              <div key={key} className="token-sheet-attack">
                <button type="button" onClick={() => setOpen(open === key ? null : key)}><b>{e.name}</b></button>
                {open === key && <p>{e.desc || e.short}</p>}
              </div>
            );
          })}
        </div>
      )}

      {lines.length > 0 && (
        <dl className="token-sheet-lines">
          {lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
      {t.tactics && <p className="token-sheet-tactics"><b>Tactique :</b> {t.tactics}</p>}
    </div>
  );
}

function CombatantEditPanel({
  t,
  onUpdate,
  onUpdateAttack,
  onAddAttack,
  onDeleteAttack,
}) {
  return (
    <div className="combat-edit-panel" onClick={(e) => e.stopPropagation()}>
      <div className="combat-edit-grid">
        <Field label="Nom">
          <input
            className="in"
            value={t.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </Field>

        <Field label="AC">
          <input
            className="in"
            type="number"
            value={t.baseAc || t.ac || 10}
            onChange={(e) =>
              onUpdate({
                baseAc: Number(e.target.value) || 10,
                ac: Number(e.target.value) || 10,
              })
            }
          />
        </Field>

        <Field label="HP actuels">
          <input
            className="in"
            type="number"
            value={t.hp || 0}
            onChange={(e) => onUpdate({ hp: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="HP max">
          <input
            className="in"
            type="number"
            value={t.maxHp || 0}
            onChange={(e) => onUpdate({ maxHp: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="Speed">
          <input
            className="in"
            value={t.speed || ''}
            onChange={(e) => onUpdate({ speed: e.target.value })}
            placeholder="30 ft. / 30 pieds"
          />
        </Field>

        <Field label="Type">
          <select
            className="in"
            value={t.isPC ? 'pc' : 'enemy'}
            onChange={(e) => onUpdate({ isPC: e.target.value === 'pc' })}
          >
            <option value="pc">PJ / Allié</option>
            <option value="enemy">Menace / Ennemi</option>
          </select>
        </Field>
      </div>

      <div className="combat-edit-title">Attaques éditables</div>

      <div className="combat-edit-attacks">
        {(t.attacks || []).map((a, i) => (
          <div className="combat-edit-attack" key={i}>
            <div className="combat-edit-grid attack-grid">
              <Field label="Nom attaque">
                <input
                  className="in"
                  value={a.name || ''}
                  onChange={(e) => onUpdateAttack(i, { name: e.target.value })}
                />
              </Field>

              <Field label="Type">
                <select
                  className="in"
                  value={a.type || 'action'}
                  onChange={(e) => onUpdateAttack(i, { type: e.target.value })}
                >
                  <option value="action">Action</option>
                  <option value="bonus action">Bonus action</option>
                  <option value="reaction">Reaction</option>
                  <option value="legendary action">Legendary action</option>
                  <option value="lair action">Lair action</option>
                </select>
              </Field>

              <Field label="Bonus toucher">
                <input
                  className="in"
                  type="number"
                  value={a.attackBonus || 0}
                  onChange={(e) =>
                    onUpdateAttack(i, {
                      attackBonus: Number(e.target.value) || 0,
                      proficiency: false,
                    })
                  }
                />
              </Field>

              <Field label="Dés dégâts">
                <input
                  className="in"
                  value={a.damageDice || ''}
                  onChange={(e) =>
                    onUpdateAttack(i, { damageDice: e.target.value })
                  }
                  placeholder="1d8"
                />
              </Field>

              <Field label="Bonus dégâts">
                <input
                  className="in"
                  type="number"
                  value={a.damageBonus || 0}
                  onChange={(e) =>
                    onUpdateAttack(i, {
                      damageBonus: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>

              <Field label="Type dégâts">
                <input
                  className="in"
                  value={a.damageType || ''}
                  onChange={(e) =>
                    onUpdateAttack(i, { damageType: e.target.value })
                  }
                  placeholder="tranchants, feu, poison..."
                />
              </Field>

              <Field label="Portée">
                <input
                  className="in"
                  value={a.range || ''}
                  onChange={(e) => onUpdateAttack(i, { range: e.target.value })}
                  placeholder="5 ft. / reach 5 ft. / 30 ft."
                />
              </Field>

              <Field label="Usages max">
                <input
                  className="in"
                  type="number"
                  value={a.usesMax || 0}
                  onChange={(e) => {
                    const max = Number(e.target.value) || 0;
                    onUpdateAttack(i, {
                      usesMax: max,
                      usesLeft: max,
                    });
                  }}
                />
              </Field>

              <Field label="Reset">
                <select
                  className="in"
                  value={a.reset || 'none'}
                  onChange={(e) => onUpdateAttack(i, { reset: e.target.value })}
                >
                  <option value="none">Aucun</option>
                  <option value="turn">Tour</option>
                  <option value="round">Round</option>
                  <option value="encounter">Combat</option>
                  <option value="short rest">Repos court</option>
                  <option value="long rest">Repos long</option>
                  <option value="day">Jour</option>
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className="in"
                rows={2}
                value={a.desc || ''}
                onChange={(e) => onUpdateAttack(i, { desc: e.target.value })}
              />
            </Field>

            <button
              className="btn ghost sm danger"
              type="button"
              onClick={() => onDeleteAttack(i)}
            >
              Supprimer cette attaque
            </button>
          </div>
        ))}
      </div>

      <button className="btn sm" type="button" onClick={onAddAttack}>
        + Ajouter une attaque
      </button>
    </div>
  );
}

/** Allonge, portée et Tactique de groupe d’un combattant, lues dans ses attaques (sinon dans la fiche SRD du jeton). */
function profileOfCombatant(c, token) {
  if (!c) return profileFromStat(token);
  const cells = (m) => Math.round((parseFloat(String(m).replace(',', '.')) * 3.28084) / 5);
  let reach = 0, ranged = 0;
  for (const a of c.attacks || []) {
    const text = `${a.range || ''} ${a.desc || ''}`;
    const al = /allonge\s*([\d,]+)\s*m/i.exec(text);
    const po = /portée\s*([\d,]+)\s*\/?/i.exec(text);
    const ft = /(\d+)\s*(?:[–-]\s*\d+\s*)?ft/i.exec(a.range || '');
    if (al) reach = Math.max(reach, cells(al[1]));
    if (po) ranged = Math.max(ranged, cells(po[1]));
    if (!al && !po && ft) { const n = Number(ft[1]) / 5; if (n <= 2) reach = Math.max(reach, n); else ranged = Math.max(ranged, n); }
    if (!al && !po && !ft && /corps à corps|mêlée|melee/i.test(text)) reach = Math.max(reach, 1);
  }
  const fromStat = profileFromStat(token);
  return {
    reach: reach || fromStat.reach || 1,
    ranged: ranged || fromStat.ranged,
    pack: fromStat.pack || (c.effects || []).some((e) => /tactique de groupe/i.test(e.name || '')),
  };
}

/** Situation tactique de chaque jeton du plateau (abri, avantages, menaces), avec le profil de son combattant. */
function battleTactics(battle, combatants) {
  const grid = effectiveOf(battle);
  const byId = new Map((combatants || []).map((c) => [c.id, c]));
  const profileOf = (t) => profileOfCombatant(byId.get(t.id), t);
  return Object.fromEntries(battle.tokens.map((t) => [t.id, tacticalNotes(battle, grid, t.id, profileOf)]));
}

/** Pastilles de situation tactique ; la justification s’affiche en bulle au survol. */
function TacticalChips({ notes }) {
  if (!notes?.length) return null;
  const icon = { buff: '🛡', chance: '🎯', malus: '⚠', alert: '⚔' };
  return (
    <div className="tac-notes">
      {notes.map((n, i) => (
        <span key={i} className={`tac-chip tone-${n.tone}`} tabIndex={0}>
          {icon[n.tone]} {n.label}
          <span className="tac-why" role="tooltip">{n.why}</span>
        </span>
      ))}
    </div>
  );
}

function CombatEffectsPanel({
  combatant,
  onToggleEffect,
  onEffectUses,
  onInfo,
  tactics,
}) {
  const effects = combatant.effects || [];

  return (
    <div className="combat-subpanel">
      <div className="combat-subtitle">Buffs / malus / ressources</div>
      {tactics?.length > 0 && (
        <div className="combat-tactics">
          <span className="combat-small-muted">Position sur la carte (auto) :</span>
          <TacticalChips notes={tactics} />
        </div>
      )}

      {effects.length === 0 ? (
        <p className="combat-small-muted">Aucun buff ou malus actif.</p>
      ) : (
        <div className="combat-effect-grid">
          {effects.map((effect, i) => {
            const max = Number(effect.usesMax || 0);
            const left = Number(effect.usesLeft ?? max);

            return (
              <div
                className="combat-effect-chip"
                data-active={effect.active ? 1 : 0}
                key={i}
              >
                <button
                  type="button"
                  className="combat-effect-toggle"
                  onClick={() => onToggleEffect(i)}
                >
                  <span>{effect.icon || '✦'}</span>
                  <b>{effect.name}</b>
                </button>

                <button
                  type="button"
                  className="combat-effect-info"
                  onClick={() =>
                    onInfo({
                      title: effect.name,
                      subtitle: effect.source || effect.reset || 'Effet',
                      body:
                        effect.desc || effect.short || 'Aucune description.',
                      rules: getKnownEffectRules(effect),
                    })
                  }
                >
                  ?
                </button>

                {max > 0 && (
                  <UseTracker
                    left={left}
                    max={max}
                    reset={effect.reset}
                    onSpend={() => onEffectUses(i, -1)}
                    onRestore={() => onEffectUses(i, +1)}
                    compact
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UseTracker({ left, max, reset, onSpend, onRestore, compact }) {
  return (
    <div className={'combat-use-tracker ' + (compact ? 'compact' : '')}>
      <button type="button" onClick={onSpend}>
        −
      </button>
      <span>
        {left}/{max}
        {reset && reset !== 'none' ? ` · ${reset}` : ''}
      </span>
      <button type="button" onClick={onRestore}>
        +
      </button>
    </div>
  );
}
function DmStrategyPanel({ strategy }) {
  const s = strategy || {};

  return (
    <div className="dm-strategy-text">
      <div className="dm-turn-banner">
        <b>
          Round {s.round || 1} ·{' '}
          {s.activeName ? `Tour de ${s.activeName}` : 'Aucun tour actif'}
        </b>
        <span>
          Cette lecture se met à jour selon les PV, effets actifs, ressources
          restantes, positionnement et combattant actif.
        </span>
      </div>

      <div className="dm-strategy-section">
        <div className="dm-strategy-section-title">
          Buffs, malus et effets par combattant
        </div>

        {s.effectGroups?.length ? (
          s.effectGroups.map((group) => (
            <div
              className="dm-effect-character"
              data-side={group.isPC ? 'pc' : 'enemy'}
              key={group.id}
            >
              <div className="dm-effect-character-head">
                <div>
                  <b>{group.name}</b>
                  <span>{group.isPC ? 'PJ / allié' : 'ennemi / menace'}</span>
                </div>

                <span>
                  HP {group.hp}/{group.maxHp} · AC {group.ac}
                </span>
              </div>

              {group.effects.length ? (
                <div className="dm-effect-chip-row">
                  {group.effects.map((effect, i) => (
                    <span
                      key={i}
                      className={
                        'dm-effect-chip ' +
                        (effect.active
                          ? 'active'
                          : effect.recommended
                          ? 'available'
                          : 'off')
                      }
                    >
                      {effect.active ? '● ' : effect.recommended ? '◇ ' : '○ '}
                      {effect.name}

                      <span className="dm-effect-tooltip">
                        <b>{effect.name}</b>
                        <p>{effect.status}</p>
                        <p>{effect.impact}</p>
                        {effect.why && <p>{effect.why}</p>}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="combat-small-muted">
                  Aucun effet notable enregistré pour ce combattant.
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="combat-small-muted">
            Aucun effet à afficher. Ajoute des combattants ou des effets dans
            leurs fiches.
          </p>
        )}
      </div>

      <div className="dm-strategy-section">
        <div className="dm-strategy-section-title">
          Lecture tactique dynamique
        </div>

        {s.tactics?.length ? (
          s.tactics.map((tactic, i) => (
            <div
              className="dm-tactic-card"
              data-severity={tactic.severity || 'normal'}
              key={i}
            >
              <b>{tactic.title}</b>
              <p>{tactic.text}</p>
            </div>
          ))
        ) : (
          <p className="combat-small-muted">
            Rien de critique pour l’instant. Le combat semble stable.
          </p>
        )}
      </div>

      <div className="dm-strategy-section">
        <div className="dm-strategy-section-title">
          Rappels de règles personnalisés
        </div>

        {s.rules?.length ? (
          s.rules.map((rule, i) => (
            <div className="dm-rule-card" key={i}>
              <b>{rule.title}</b>
              <p>{rule.text}</p>
            </div>
          ))
        ) : (
          <p className="combat-small-muted">
            Aucun rappel spécifique détecté pour ce round.
          </p>
        )}
      </div>
    </div>
  );
}

function CombatMiniMap({
  combatants,
  selectedTokenId,
  activeId = '',
  blockedCells = [],
  mode = 'move',
  showGrid = true,
  onSelect,
  onMove,
  onToggleBlocked,
}) {
  const cols = 12;
  const rows = 12;
  const [measure, setMeasure] = useState([]);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (mode !== 'measure') setMeasure([]);
  }, [mode]);

  const cells = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({ x, y });
    }
  }

  const selected = combatants.find((t) => t.id === selectedTokenId);

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function isBlocked(x, y) {
    return blockedCells.includes(cellKey(x, y));
  }

  function tokenAt(x, y) {
    return combatants.find(
      (t) => Number(t.token?.x || 0) === x && Number(t.token?.y || 0) === y
    );
  }

  function isInThreatRadius(x, y, token) {
    if (!token) return false;

    const tx = Number(token.token?.x || 0);
    const ty = Number(token.token?.y || 0);
    const radius = Number(token.token?.threat ?? 1);

    const dist = Math.max(Math.abs(tx - x), Math.abs(ty - y));
    return dist > 0 && dist <= radius;
  }

  // Distance de jeu (1 case = 5 pi, diagonales comprises), comme l’allonge de menace.
  const cellsBetween = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const [ma, mb] = measure;
  const from = mode === 'measure' ? ma : selected ? { x: Number(selected.token?.x || 0), y: Number(selected.token?.y || 0) } : null;
  const to = mode === 'measure' ? mb || hover : hover;
  const dist = from && to && (from.x !== to.x || from.y !== to.y) ? cellsBetween(from, to) : null;

  return (
    <div className="combat-map-wrap" data-grid={showGrid ? 1 : 0}>
      <div className="combat-map-grid" onMouseLeave={() => setHover(null)}>
        {cells.map((cell) => {
          const token = tokenAt(cell.x, cell.y);
          const blocked = isBlocked(cell.x, cell.y);
          const threatened =
            selected && !blocked && isInThreatRadius(cell.x, cell.y, selected);
          const pct = token ? Math.round((Number(token.hp || 0) / Math.max(1, Number(token.maxHp || 1))) * 100) : 0;

          return (
            <button
              key={`${cell.x}-${cell.y}`}
              type="button"
              className="combat-map-cell"
              data-threat={threatened ? 1 : 0}
              data-blocked={blocked ? 1 : 0}
              data-editing={mode === 'block' ? 1 : 0}
              aria-label={token ? `${token.name}, case ${cell.x + 1}-${cell.y + 1}` : `Case ${cell.x + 1}-${cell.y + 1}${blocked ? ', obstacle' : ''}`}
              onMouseEnter={() => setHover(cell)}
              onClick={() => {
                if (mode === 'measure') {
                  setMeasure((m) => (m.length === 1 ? [m[0], cell] : [cell]));
                  return;
                }

                if (mode === 'block') {
                  if (!token) {
                    onToggleBlocked(cell.x, cell.y);
                  } else {
                    onSelect(token.id);
                  }

                  return;
                }

                if (token) {
                  onSelect(token.id);
                } else if (selectedTokenId && !blocked) {
                  onMove(selectedTokenId, cell.x, cell.y);
                }
              }}
            >
              {token && (
                <span
                  className={'combat-map-token ' + (token.isPC ? 'pc' : 'enemy')}
                  data-on={selectedTokenId === token.id ? 1 : 0}
                  data-active={activeId === token.id ? 1 : 0}
                  data-down={Number(token.hp) <= 0 ? 1 : 0}
                  title={`${token.name} — ${token.hp}/${token.maxHp} PV`}
                  style={{ '--hp': `${pct}%` }}
                >
                  {getInitials(token.name)}
                  {(token.conditions || []).length > 0 && <i className="combat-map-cond" aria-hidden="true">{token.conditions.length}</i>}
                </span>
              )}
            </button>
          );
        })}
        {from && to && dist !== null && (
          <svg className="combat-map-measure" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
            <line x1={from.x + 0.5} y1={from.y + 0.5} x2={to.x + 0.5} y2={to.y + 0.5} />
          </svg>
        )}
        {dist !== null && to && (
          <span className="combat-map-dist" style={{ left: `${((to.x + 0.5) / cols) * 100}%`, top: `${((to.y + 0.5) / rows) * 100}%` }}>
            {dist} case{dist > 1 ? 's' : ''} · {dist * 5} pi
          </span>
        )}
      </div>
    </div>
  );
}

function CombatInfoModal({ info, onClose }) {
  return (
    <Modal title={info.title || 'Information'} onClose={onClose} wide>
      <div className="combat-info-modal">
        {info.subtitle && (
          <div className="combat-info-subtitle">{info.subtitle}</div>
        )}

        <p>{info.body}</p>

        {info.rules && (
          <div className="combat-rules-box">
            <b>Règle / effet appliqué</b>
            <p>{info.rules}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
function buildPcCombatant(p) {
  const level = Number(p.level || 1);

  const baseAc = Number(p.ac || 14);
  const hp = Number(p.hp || p.maxHp || 20);

  return {
    id: uid(),
    sourceId: p.id,
    name: p.name,
    isPC: true,
    kind: `${p.race || ''} ${p.cls || ''}`.trim(),
    level,
    maxHp: hp,
    hp,
    ac: baseAc,
    baseAc,
    init: abilityMod(p.dex || 10),
    speed: p.speed || '30 ft.',
    str: Number(p.str || 10),
    dex: Number(p.dex || 10),
    con: Number(p.con || 10),
    int: Number(p.int || 10),
    wis: Number(p.wis || 10),
    cha: Number(p.cha || 10),
    attacks: normalizeCombatActions(
      p.attacks || p.actions || getDefaultPcAttacks(p)
    ),
    effects: normalizeCombatEffects(p.effects || getDefaultCombatEffects(true)),
    token: makeDefaultToken(true),
  };
}

function buildNpcCombatant(n) {
  const baseAc = Number(n.ac || 12);
  const hp = Number(n.hp || 10);

  return {
    id: uid(),
    sourceId: n.id,
    name: n.name,
    isPC: false,
    kind: n.kind || n.role || '',
    maxHp: hp,
    hp,
    ac: baseAc,
    baseAc,
    init: abilityMod(n.dex || 10),
    speed: n.speed || '30 ft.',
    str: Number(n.str || 10),
    dex: Number(n.dex || 10),
    con: Number(n.con || 10),
    int: Number(n.int || 10),
    wis: Number(n.wis || 10),
    cha: Number(n.cha || 10),
    tactics: n.tactics || '',
    attacks: normalizeCombatActions(n.actions || n.attacks || []),
    effects: normalizeCombatEffects(n.effects || []),
    token: makeDefaultToken(false),
    image: n.token || '',
    saves: asSheetText(n.saves),
    skills: asSheetText(n.skills),
    senses: asSheetText(n.senses),
    languages: asSheetText(n.languages),
    cr: asSheetText(n.cr || n.challenge),
  };
}

/** Champ de fiche en texte lisible (« Perception +4, Discrétion +6 »), quelle que soit sa forme. */
function asSheetText(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map(asSheetText).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k} ${x}`).join(', ');
  return String(v);
}

/** Fiche SRD (créature de la carte de combat) au format d’une fiche de PNJ, pour en faire un combattant complet. */
function npcFromSrd(stat) {
  const lead = (x) => parseInt(String(x || ''), 10);
  const [str, dex, con, int, wis, cha] = stat.abil;
  return {
    id: `srd:${stat.id}`,
    name: stat.name,
    kind: stat.meta,
    hp: lead(stat.hp) || 10,
    ac: lead(stat.ac) || 12,
    speed: stat.speed,
    str, dex, con, int, wis, cha,
    actions: [
      ...stat.actions.map(([name, desc]) => ({ name, desc, type: 'action' })),
      ...(stat.reactions || []).map(([name, desc]) => ({ name, desc, type: 'reaction' })),
    ],
    effects: (stat.traits || []).map(([name, desc]) => ({ name, desc, short: desc.split('.')[0], source: 'Trait' })),
    saves: stat.saves,
    skills: stat.skills,
    senses: stat.senses,
    languages: stat.languages,
    cr: stat.cr,
  };
}

/** Combattant tiré d’un jeton de la carte de combat (même identifiant) : fiche du groupe, du bestiaire ou du SRD. */
function combatantFromToken(t, party, npcs) {
  const hero = t.heroId && party.find((p) => p.id === t.heroId);
  const npc = t.npcId && npcs.find((n) => n.id === t.npcId);
  const isPC = t.kind === 'pc';
  const base = hero
    ? buildPcCombatant(hero)
    : npc
      ? buildNpcCombatant(npc)
      : t.statId && STATS[t.statId]
        ? buildNpcCombatant(npcFromSrd(STATS[t.statId]))
        : {
            sourceId: '', isPC, maxHp: 10, hp: 10, ac: 12, baseAc: 12, init: 0, speed: '30 ft.',
            attacks: [], effects: getDefaultCombatEffects(isPC), token: makeDefaultToken(isPC),
          };
  return {
    ...base,
    id: t.id,
    name: t.name,
    isPC,
    hp: t.hp ?? base.hp,
    maxHp: t.maxHp ?? base.maxHp,
    ac: t.ac ?? base.ac,
    baseAc: t.ac ?? base.baseAc,
    init: t.init ?? base.init,
    conditions: [...(t.conditions || [])],
  };
}

/** Jeton de carte tiré d’un combattant (même identifiant) ; les créatures arrivent cachées aux joueurs. */
function tokenFromCombatant(c) {
  const srd = String(c.sourceId || '').startsWith('srd:') ? String(c.sourceId).slice(4) : undefined;
  return {
    id: c.id,
    name: c.name,
    kind: c.isPC ? 'pc' : 'monster',
    size: 1,
    visible: !!c.isPC,
    hp: Number(c.hp),
    maxHp: Number(c.maxHp),
    ac: Number(c.ac),
    init: c.init === '' || c.init === undefined ? undefined : Number(c.init),
    heroId: c.isPC ? c.sourceId || undefined : undefined,
    sight: c.isPC ? sightFor(c.kind) : undefined,
    npcId: !c.isPC && c.sourceId && !srd ? c.sourceId : undefined,
    statId: srd,
    image: c.image || undefined,
    conditions: c.conditions?.length ? [...c.conditions] : undefined,
  };
}
function refreshCombatantFromNpc(current, source) {
  const fresh = buildNpcCombatant(source);

  return {
    ...current,

    name: fresh.name,
    kind: fresh.kind,

    ac: fresh.ac,
    baseAc: fresh.baseAc,
    speed: fresh.speed,

    str: fresh.str,
    dex: fresh.dex,
    con: fresh.con,
    int: fresh.int,
    wis: fresh.wis,
    cha: fresh.cha,

    attacks: fresh.attacks,
    effects: fresh.effects,
    tactics: fresh.tactics,

    maxHp: fresh.maxHp,
    hp: Math.min(
      Number(current.hp || fresh.hp),
      Number(fresh.maxHp || current.maxHp || fresh.hp)
    ),
  };
}
function normalizeCombatActions(actions) {
  return (actions || []).map((a) => {
    const fullText = [a.attack, a.desc, a.description, a.damage, a.range]
      .filter(Boolean)
      .join(' ');

    const parsedAttackBonus = parseAttackBonus(fullText);
    const parsedDamage = parseDamageParts(fullText);
    const parsedRange = parseAttackRange(fullText);

    return {
      name: a.name || 'Action',
      type: a.type || 'action',

      attackBonus:
        numberOrNull(a.attackBonus) !== null
          ? Number(a.attackBonus)
          : parsedAttackBonus,

      ability: a.ability || guessAttackAbility(a),
      proficiency:
        numberOrNull(a.attackBonus) !== null || parsedAttackBonus !== null
          ? false
          : a.proficiency !== false,

      magicBonus: Number(a.magicBonus || 0),

      damageDice:
        a.damageDice ||
        parsedDamage.damageDice ||
        parseDamageDice(a.damage) ||
        '',

      damageBonus:
        numberOrNull(a.damageBonus) !== null
          ? Number(a.damageBonus)
          : parsedDamage.damageBonus,

      damageType:
        a.damageType ||
        parsedDamage.damageType ||
        parseDamageType(a.damage) ||
        '',

      range: a.range || parsedRange || '',

      desc: a.desc || a.description || a.attack || '',
      save: a.save || '',

      usesMax: Number(a.usesMax || 0),
      usesLeft: Number(a.usesLeft ?? a.usesMax ?? 0),
      reset: a.reset || 'none',
    };
  });
}
function parseAttackBonus(text) {
  const raw = (text || '').toString();

  const patterns = [
    /([+-]\s*\d+)\s*to hit/i,
    /([+-]\s*\d+)\s*pour toucher/i,
    /([+-]\s*\d+)\s*au toucher/i,
    /attack\s*bonus\s*:?\s*([+-]?\s*\d+)/i,
    /bonus\s*d['’]attaque\s*:?\s*([+-]?\s*\d+)/i,
    /toucher\s*:?\s*([+-]?\s*\d+)/i,
    /jet\s*d['’]attaque\s*:?\s*([+-]?\s*\d+)/i,
  ];

  for (const re of patterns) {
    const match = raw.match(re);
    if (match) return Number(match[1].replace(/\s+/g, ''));
  }

  return null;
}

function parseDamageParts(text) {
  const raw = (text || '').toString();

  const patterns = [
    // SRD en français : « Touché : 4 (1d6 + 1) tranchants ».
    /touch[ée]\s*:\s*\d+\s*\(\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*\)\s*(?:dégâts?\s+(?:d[e'’]\s*)?)?([a-zA-Zéûîôàèùç-]+)?/i,
    /hit\s*:?\s*\d*\s*\(?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*\)?\s*([a-zA-Zéûîôàèùç -]+)?\s*damage/i,
    /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([a-zA-Zéûîôàèùç -]+)?\s*damage/i,
    /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*dégâts?\s*([a-zA-Zéûîôàèùç -]+)?/i,
    /dégâts?\s*:?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([a-zA-Zéûîôàèùç -]+)?/i,
    /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*de\s*dégâts?\s*([a-zA-Zéûîôàèùç -]+)?/i,
  ];

  let hitMatch = null;

  for (const re of patterns) {
    hitMatch = raw.match(re);
    if (hitMatch) break;
  }

  if (!hitMatch) {
    return {
      damageDice: '',
      damageBonus: null,
      damageType: '',
    };
  }

  const formula = hitMatch[1].replace(/\s+/g, '');
  const typeText = (hitMatch[2] || '').trim().toLowerCase();
  const diceMatch = formula.match(/^(\d+d\d+)([+-]\d+)?$/i);

  return {
    damageDice: diceMatch ? diceMatch[1] : formula,
    damageBonus: diceMatch && diceMatch[2] ? Number(diceMatch[2]) : 0,
    damageType: normalizeDamageType(typeText || raw),
  };
}

function parseAttackRange(text) {
  const raw = (text || '').toString();

  const reach = raw.match(/reach\s+([\d/]+)\s*ft/i);
  if (reach) return `reach ${reach[1]} ft.`;

  const range = raw.match(/range\s+([\d/]+(?:\s*\/\s*[\d/]+)?)\s*ft/i);
  if (range) return `range ${range[1]} ft.`;

  const portee = raw.match(
    /portée\s+([\d/]+(?:\s*\/\s*[\d/]+)?)\s*(?:ft|pi|pieds|mètres|m)/i
  );
  if (portee) return `portée ${portee[1]}`;

  const meleeFrench = raw.match(/à un ennemi|au corps à corps|mêlée|melee/i);
  if (meleeFrench) return 'mêlée';

  return '';
}

function normalizeDamageType(value) {
  const raw = (value || '').toLowerCase();

  const map = [
    ['slashing', 'tranchants'],
    ['tranchant', 'tranchants'],
    ['tranchants', 'tranchants'],

    ['piercing', 'perforants'],
    ['perforant', 'perforants'],
    ['perforants', 'perforants'],

    ['bludgeoning', 'contondants'],
    ['contondant', 'contondants'],
    ['contondants', 'contondants'],

    ['fire', 'feu'],
    ['feu', 'feu'],

    ['cold', 'froid'],
    ['froid', 'froid'],

    ['necrotic', 'nécrotiques'],
    ['nécrotique', 'nécrotiques'],
    ['nécrotiques', 'nécrotiques'],

    ['radiant', 'radiants'],
    ['radiant', 'radiants'],
    ['radiants', 'radiants'],

    ['poison', 'poison'],
    ['acid', 'acide'],
    ['acide', 'acide'],

    ['psychic', 'psychiques'],
    ['psychique', 'psychiques'],
    ['psychiques', 'psychiques'],

    ['force', 'force'],

    ['thunder', 'tonnerre'],
    ['tonnerre', 'tonnerre'],

    ['lightning', 'foudre'],
    ['foudre', 'foudre'],
  ];

  const found = map.find(([needle]) => raw.includes(needle));
  return found ? found[1] : '';
}
function normalizeCombatEffects(effects) {
  return (effects || []).map((e) => ({
    name: e.name || 'Effet',
    icon: e.icon || '✦',
    source: e.source || '',
    short: e.short || '',
    desc: e.desc || '',
    active: !!e.active,
    modifier: e.modifier || inferKnownEffectModifier(e.name),
    usesMax: Number(e.usesMax || 0),
    usesLeft: Number(e.usesLeft ?? e.usesMax ?? 0),
    reset: e.reset || 'none',
  }));
}

function getDefaultPcAttacks(p) {
  const cls = (p.cls || '').toLowerCase();
  const level = Number(p.level || 1);
  const prof = proficiencyBonus(level);

  if (
    cls.includes('wizard') ||
    cls.includes('sorc') ||
    cls.includes('warlock')
  ) {
    return [
      {
        name: 'Cantrip offensif',
        type: 'action',
        ability: 'int',
        proficiency: true,
        attackBonus: prof + abilityMod(p.int || p.cha || 10),
        damageDice: level >= 5 ? '2d10' : '1d10',
        damageBonus: 0,
        damageType: 'force/fire',
        range: '60–120 ft.',
        desc: 'Attaque magique générique. Remplace par le sort exact dans la fiche si besoin.',
      },
      {
        name: 'Dague',
        type: 'action',
        ability: 'dex',
        proficiency: true,
        damageDice: '1d4',
        damageBonus: abilityMod(p.dex || 10),
        damageType: 'piercing',
        range: '5 ft. / 20-60 ft.',
        desc: 'Attaque simple de secours.',
      },
    ];
  }

  return [
    {
      name: 'Attaque principale',
      type: 'action',
      ability: Number(p.dex || 10) > Number(p.str || 10) ? 'dex' : 'str',
      proficiency: true,
      damageDice: '1d8',
      damageBonus: Math.max(abilityMod(p.str || 10), abilityMod(p.dex || 10)),
      damageType: 'weapon',
      range: '5 ft.',
      desc: 'Attaque d’arme principale générique. Ajuste la fiche du personnage pour plus de précision.',
    },
  ];
}

function getDefaultCombatEffects(isPC) {
  const common = [
    {
      name: 'Avantage',
      icon: '△',
      short: 'Lancer 2d20, garder le meilleur.',
      desc: 'Avantage sur le prochain jet pertinent.',
      active: false,
      modifier: { advantage: true },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Règle D&D 5e',
    },
    {
      name: 'Désavantage',
      icon: '▽',
      short: 'Lancer 2d20, garder le pire.',
      desc: 'Désavantage sur le prochain jet pertinent.',
      active: false,
      modifier: { disadvantage: true },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Règle D&D 5e',
    },
    {
      name: 'Bless',
      icon: '✚',
      short: '+1d4 aux attaques et sauvegardes.',
      desc: 'Tant que Bless est actif, la créature ajoute 1d4 à ses jets d’attaque et jets de sauvegarde.',
      active: false,
      modifier: { attackDice: '1d4', saveDice: '1d4' },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Sort classique 5e',
    },
    {
      name: 'Bane',
      icon: '✖',
      short: '-1d4 aux attaques et sauvegardes.',
      desc: 'Tant que Bane est actif, la créature soustrait 1d4 à ses jets d’attaque et jets de sauvegarde.',
      active: false,
      modifier: { attackDice: '-1d4', saveDice: '-1d4' },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Sort classique 5e',
    },
    {
      name: 'Cover +2',
      icon: '◩',
      short: '+2 AC.',
      desc: 'Demi-couverture : bonus de +2 à l’AC et aux sauvegardes de Dextérité, selon la situation.',
      active: false,
      modifier: { ac: 2 },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Couverture 5e',
    },
    {
      name: 'Cover +5',
      icon: '▣',
      short: '+5 AC.',
      desc: 'Trois-quarts de couverture : bonus de +5 à l’AC et aux sauvegardes de Dextérité, selon la situation.',
      active: false,
      modifier: { ac: 5 },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Couverture 5e',
    },
  ];

  if (!isPC) return common;

  return [
    ...common,
    {
      name: 'Shield',
      icon: '⛨',
      short: '+5 AC jusqu’au début du prochain tour.',
      desc: 'Réaction défensive typique : +5 à l’AC contre une attaque déclenchante, puis jusqu’au début du prochain tour.',
      active: false,
      modifier: { ac: 5 },
      usesMax: 0,
      usesLeft: 0,
      reset: 'none',
      source: 'Sort Shield',
    },
    {
      name: 'Rage',
      icon: '🔥',
      short: '+2 dégâts mêlée STR.',
      desc: 'Rage barbare : bonus aux dégâts des attaques de mêlée basées sur la Force. La résistance aux dégâts doit être gérée narrativement/HP pour l’instant.',
      active: false,
      modifier: { meleeDamage: 2 },
      usesMax: 2,
      usesLeft: 2,
      reset: 'long rest',
      source: 'Barbare',
    },
  ];
}

function getCombatantDerivedStats(t) {
  const active = (t.effects || []).filter((e) => e.active);
  const acBonus = active.reduce(
    (sum, e) => sum + Number(e.modifier?.ac || 0),
    0
  );

  const attackFlat = active.reduce(
    (sum, e) => sum + Number(e.modifier?.attack || 0),
    0
  );
  const damageFlat = active.reduce(
    (sum, e) => sum + Number(e.modifier?.damage || 0),
    0
  );
  const meleeDamage = active.reduce(
    (sum, e) => sum + Number(e.modifier?.meleeDamage || 0),
    0
  );

  const attackDice = active.map((e) => e.modifier?.attackDice).filter(Boolean);

  const advantage = active.some((e) => e.modifier?.advantage);
  const disadvantage = active.some((e) => e.modifier?.disadvantage);

  return {
    ac: Number(t.baseAc || t.ac || 10) + acBonus,
    attackFlat,
    damageFlat,
    meleeDamage,
    attackDice,
    advantage,
    disadvantage,
  };
}

function calculateAttackLine(combatant, attack, derived) {
  const ability = attack.ability || 'str';
  const abilityBonus = abilityMod(combatant[ability] || 10);
  const prof = attack.proficiency ? proficiencyBonus(combatant.level || 1) : 0;

  const baseAttack =
    numberOrNull(attack.attackBonus) !== null
      ? Number(attack.attackBonus)
      : abilityBonus + prof + Number(attack.magicBonus || 0);

  const flatAttack = baseAttack + Number(derived.attackFlat || 0);
  const attackDice = derived.attackDice?.length
    ? ' ' + derived.attackDice.join(' ')
    : '';

  const advText =
    derived.advantage && derived.disadvantage
      ? ''
      : derived.advantage
      ? ' adv.'
      : derived.disadvantage
      ? ' disadv.'
      : '';

  const parsedDamage = parseDamageParts(
    attack.desc || attack.attack || attack.damage || ''
  );

  const damageDice = attack.damageDice || parsedDamage.damageDice || '';

  const damageBonus =
    numberOrNull(attack.damageBonus) !== null
      ? Number(attack.damageBonus)
      : numberOrNull(parsedDamage.damageBonus) !== null
      ? Number(parsedDamage.damageBonus)
      : 0;

  const damageType = attack.damageType || parsedDamage.damageType || '';

  const meleeBonus =
    (attack.range || '').toLowerCase().includes('reach') ||
    (attack.range || '').toLowerCase().includes('mêlée') ||
    (attack.range || '').includes('5') ||
    (attack.type || '').toLowerCase().includes('melee')
      ? Number(derived.meleeDamage || 0)
      : 0;

  const totalDamageBonus =
    damageBonus + Number(derived.damageFlat || 0) + meleeBonus;
  const dmgSign = totalDamageBonus >= 0 ? '+' : '';

  return {
    toHit: `d20 ${signed(flatAttack)}${attackDice}${advText}`,
    damage: damageDice
      ? `${damageDice}${
          totalDamageBonus ? ` ${dmgSign}${totalDamageBonus}` : ''
        }${damageType ? ' ' + damageType : ''}`
      : '—',
    // Valeurs brutes, pour résoudre l’attaque sur la carte (jet du d20, puis des dégâts).
    attackBonus: flatAttack,
    attackDice: derived.attackDice || [],
    damageDice,
    damageBonus: totalDamageBonus,
    damageType,
  };
}
function abilityMod(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

function proficiencyBonus(level) {
  const l = Number(level || 1);
  if (l >= 17) return 6;
  if (l >= 13) return 5;
  if (l >= 9) return 4;
  if (l >= 5) return 3;
  return 2;
}

function signed(n) {
  const v = Number(n || 0);
  return v >= 0 ? `+${v}` : `${v}`;
}

function numberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function guessAttackAbility(action) {
  const txt = `${action.name || ''} ${action.desc || ''}`.toLowerCase();

  if (txt.includes('spell') || txt.includes('sort')) return 'int';
  if (
    txt.includes('bow') ||
    txt.includes('arc') ||
    txt.includes('crossbow') ||
    txt.includes('finesse')
  )
    return 'dex';

  return 'str';
}

function parseDamageDice(text) {
  const match = (text || '').match(/\d+d\d+(?:\s*[+-]\s*\d+)?/i);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function parseDamageType(text) {
  const lower = (text || '').toLowerCase();
  const types = [
    'slashing',
    'piercing',
    'bludgeoning',
    'fire',
    'cold',
    'necrotic',
    'radiant',
    'poison',
    'acid',
    'psychic',
    'force',
    'thunder',
    'lightning',
  ];

  return types.find((t) => lower.includes(t)) || '';
}

function inferKnownEffectModifier(name) {
  const n = (name || '').toLowerCase();

  if (n.includes('bless')) return { attackDice: '1d4', saveDice: '1d4' };
  if (n.includes('bane')) return { attackDice: '-1d4', saveDice: '-1d4' };
  if (n.includes('shield of faith')) return { ac: 2 };
  if (n === 'shield' || n.includes('shield ')) return { ac: 5 };
  if (n.includes('rage')) return { meleeDamage: 2 };
  if (n.includes('magic weapon +1')) return { attack: 1, damage: 1 };
  if (n.includes('magic weapon +2')) return { attack: 2, damage: 2 };
  if (n.includes('magic weapon +3')) return { attack: 3, damage: 3 };

  return {};
}

function getKnownEffectRules(effect) {
  const name = (effect?.name || '').toLowerCase();

  if (name.includes('bless')) {
    return 'Bless ajoute 1d4 aux jets d’attaque et aux jets de sauvegarde de la cible tant que l’effet est actif.';
  }

  if (name.includes('bane')) {
    return 'Bane soustrait 1d4 aux jets d’attaque et aux jets de sauvegarde de la cible tant que l’effet est actif.';
  }

  if (name.includes('shield of faith')) {
    return 'Shield of Faith donne typiquement +2 AC à une créature protégée tant que le sort est maintenu.';
  }

  if (name === 'shield' || name.includes('shield ')) {
    return 'Shield donne typiquement +5 AC contre l’attaque déclenchante, puis jusqu’au début du prochain tour du lanceur.';
  }

  if (name.includes('rage')) {
    return 'Rage donne un bonus aux dégâts de mêlée basés sur la Force. Le bonus dépend du niveau; ici, l’app applique +2 par défaut.';
  }

  if (name.includes('cover +2')) {
    return 'Demi-couverture : +2 AC et +2 aux sauvegardes de Dextérité pertinentes.';
  }

  if (name.includes('cover +5')) {
    return 'Trois-quarts de couverture : +5 AC et +5 aux sauvegardes de Dextérité pertinentes.';
  }

  if (effect?.modifier) {
    return 'Cet effet modifie automatiquement les calculs selon les valeurs enregistrées dans sa fiche.';
  }

  return 'Effet narratif ou mécanique personnalisé. Les détails viennent de la fiche du personnage, du monstre ou de l’objet.';
}

function buildAttackRulesText(attack, calc) {
  return `Jet pour toucher affiché : ${calc.toHit}. Dégâts affichés : ${calc.damage}. Les bonus actifs viennent des effets cochés sur la ligne du combattant.`;
}

function makeDefaultToken(isPC) {
  return {
    x: isPC ? 2 : 9,
    y: isPC ? 8 : 3,
    threat: 1,
    color: isPC ? 'pc' : 'enemy',
  };
}

function getInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function buildCombatStrategy(combatants, context = {}) {
  const round = Number(context.round || 1);
  const activeCombatant = context.activeCombatant || null;
  const blockedCells = context.blockedCells || [];

  if (!combatants.length) {
    return {
      round,
      activeName: '',
      effectGroups: [],
      tactics: [
        {
          severity: 'normal',
          title: 'Aucun combattant',
          text: 'Ajoute des PJ, PNJ ou monstres pour obtenir une lecture tactique dynamique.',
        },
      ],
      rules: [],
    };
  }

  const pcs = combatants.filter((t) => t.isPC);
  const enemies = combatants.filter((t) => !t.isPC);

  const effectGroups = combatants.map((t) => {
    const derived = getCombatantDerivedStats(t);

    const effects = (t.effects || [])
      .map((e) => {
        const max = Number(e.usesMax || 0);
        const left = Number(e.usesLeft ?? max);
        const hasUsesLeft = max <= 0 || left > 0;
        const recommended =
          !e.active && hasUsesLeft && isEffectWorthSurfacing(e, t, combatants);

        return {
          name: e.name || 'Effet sans nom',
          active: !!e.active,
          recommended,
          status: e.active
            ? 'Actif maintenant. Ses bonus ou malus doivent déjà influencer les calculs du combattant.'
            : recommended
            ? 'Disponible ou pertinent à considérer ce tour-ci.'
            : 'Inactif ou situationnel.',
          impact: describeEffectImpact(e),
          why: explainEffectTiming(e, t, combatants, activeCombatant),
        };
      })
      .filter((e) => e.active || e.recommended);

    return {
      id: t.id,
      name: t.name,
      isPC: !!t.isPC,
      hp: Number(t.hp || 0),
      maxHp: Number(t.maxHp || 0),
      ac: derived.ac,
      effects,
    };
  });

  const tactics = [];
  const rules = [];

  const lowHpPcs = pcs.filter(
    (t) =>
      Number(t.hp || 0) > 0 && Number(t.hp || 0) <= Number(t.maxHp || 1) * 0.35
  );
  const downedPcs = pcs.filter((t) => Number(t.hp || 0) <= 0);
  const lowHpEnemies = enemies.filter(
    (t) =>
      Number(t.hp || 0) > 0 && Number(t.hp || 0) <= Number(t.maxHp || 1) * 0.35
  );

  if (activeCombatant) {
    const activeDerived = getCombatantDerivedStats(activeCombatant);

    tactics.push({
      severity: activeCombatant.isPC ? 'good' : 'warning',
      title: `Tour actif : ${activeCombatant.name}`,
      text: `${activeCombatant.name} agit maintenant. AC actuelle ${activeDerived.ac}, HP ${activeCombatant.hp}/${activeCombatant.maxHp}. Vérifie ses effets actifs, ressources limitées et réactions disponibles avant de résoudre son action.`,
    });

    const activeAvailableBuffs = (activeCombatant.effects || []).filter(
      (e) => !e.active && isEffectWorthSurfacing(e, activeCombatant, combatants)
    );

    if (activeAvailableBuffs.length > 0) {
      const firstBuff = activeAvailableBuffs[0];
      const ally = findBestAllyForBuff(activeCombatant, combatants);

      tactics.push({
        severity: 'warning',
        title: `${activeCombatant.name} a un effet à considérer`,
        text: `${activeCombatant.name} pourrait activer ${firstBuff.name}. ${
          ally
            ? `Cela pourrait aider ${ally.name} à tenir, frapper plus fort ou survivre au prochain échange.`
            : 'Vérifie si le timing vaut mieux maintenant ou au prochain tour.'
        }`,
      });
    }

    const notableAction = findNotableAction(activeCombatant);

    if (notableAction) {
      tactics.push({
        severity: 'warning',
        title: `Ressource importante : ${notableAction.name}`,
        text: `${activeCombatant.name} peut utiliser ${notableAction.name}. Vérifie portée, cible, sauvegarde, recharge et usages restants avant de passer à une attaque de base.`,
      });
    }

    if (!activeCombatant.isPC) {
      const target = findMostVulnerablePc(pcs);

      if (target) {
        tactics.push({
          severity:
            Number(target.hp || 0) <= Number(target.maxHp || 1) * 0.35
              ? 'danger'
              : 'warning',
          title: `${activeCombatant.name} peut mettre de la pression`,
          text: `${target.name} est la cible la plus vulnérable côté PJ (${target.hp}/${target.maxHp} HP). ${activeCombatant.name} pourrait l’attaquer, le contourner, le forcer à se déplacer ou menacer quelqu’un qu’il protège.`,
        });
      }
    }
  }

  if (downedPcs.length > 0) {
    tactics.push({
      severity: 'danger',
      title: 'PJ à 0 HP',
      text: `${downedPcs
        .map((t) => t.name)
        .join(
          ', '
        )} est à 0 HP. Le combat doit maintenant créer une urgence : stabiliser, soigner, couvrir, détourner l’ennemi ou payer le prix narratif.`,
    });

    rules.push({
      title: 'Death saves / stabilisation',
      text: 'Un PJ à 0 HP peut nécessiter des jets de sauvegarde contre la mort, une stabilisation, un soin ou une intervention rapide selon tes règles de table.',
    });
  }

  if (lowHpPcs.length > 0) {
    tactics.push({
      severity: 'danger',
      title: 'PJ en danger',
      text: `${lowHpPcs
        .map((t) => `${t.name} (${t.hp}/${t.maxHp})`)
        .join(
          ', '
        )} est bas en PV. Un monstre intelligent peut le cibler; un monstre instinctif peut plutôt attaquer la menace la plus proche ou la plus bruyante.`,
    });
  }

  if (lowHpEnemies.length > 0) {
    tactics.push({
      severity: 'good',
      title: 'Ennemis affaiblis',
      text: `${lowHpEnemies
        .map((t) => `${t.name} (${t.hp}/${t.maxHp})`)
        .join(
          ', '
        )} est mal en point. Pense à la fuite, reddition, appel à l’aide, action désespérée ou négociation plutôt qu’un simple échange de coups.`,
    });
  }

  const activeEffects = combatants.flatMap((t) =>
    (t.effects || [])
      .filter((e) => e.active)
      .map((e) => ({ combatant: t, effect: e }))
  );

  activeEffects.forEach(({ combatant, effect }) => {
    rules.push({
      title: `${combatant.name} · ${effect.name}`,
      text: `${getKnownEffectRules(
        effect
      )} Impact actuel : ${describeEffectImpact(effect)}`,
    });
  });

  const rangedCombatants = combatants.filter((t) =>
    (t.attacks || []).some((a) => {
      const range = String(a.range || '').toLowerCase();
      return range.includes('ft') && !range.startsWith('5');
    })
  );

  if (rangedCombatants.length > 0) {
    rules.push({
      title: 'Portée, couverture et ligne de vue',
      text: `${rangedCombatants
        .map((t) => t.name)
        .join(
          ', '
        )} a au moins une option à distance. Vérifie distance, ligne de vue, couverture et cases bloquantes avant de résoudre l’attaque.`,
    });
  }

  if (blockedCells.length > 0) {
    rules.push({
      title: 'Cases bloquantes',
      text: 'Des cases de la mini-map sont marquées comme inaccessibles. Utilise-les comme murs, piliers, meubles lourds, terrain impossible ou angles morts pour décider des lignes de vue et déplacements.',
    });
  }

  const concentrationLike = combatants.filter((t) =>
    (t.effects || []).some((e) => e.active && effectLooksLikeConcentration(e))
  );

  if (concentrationLike.length > 0) {
    rules.push({
      title: 'Concentration possible',
      text: `${concentrationLike
        .map((t) => t.name)
        .join(
          ', '
        )} maintient peut-être un effet de concentration. Après des dégâts, pense à demander le jet approprié si tes règles l’exigent.`,
    });
  }

  if (round >= 3) {
    tactics.push({
      severity: 'warning',
      title: `Round ${round} : fais évoluer la scène`,
      text: 'Le combat dure depuis plusieurs rounds. Ajoute une complication : renfort, terrain qui change, feu qui s’étend, porte qui s’ouvre, otage en danger, rituel qui progresse ou ennemi qui tente de fuir.',
    });
  }

  return {
    round,
    activeName: activeCombatant?.name || '',
    effectGroups,
    tactics: tactics.slice(0, 8),
    rules: rules.slice(0, 8),
  };
}

function isEffectWorthSurfacing(effect, owner, combatants) {
  const name = (effect?.name || '').toLowerCase();
  const max = Number(effect?.usesMax || 0);
  const left = Number(effect?.usesLeft ?? max);

  if (max > 0 && left <= 0) return false;

  return (
    name.includes('bless') ||
    name.includes('bane') ||
    name.includes('rage') ||
    name.includes('shield') ||
    name.includes('cover') ||
    name.includes('advantage') ||
    name.includes('disadvantage') ||
    name.includes('magic weapon') ||
    name.includes('faith') ||
    name.includes('haste') ||
    name.includes('slow') ||
    name.includes('invisible') ||
    name.includes('poison') ||
    name.includes('fear') ||
    name.includes('peur') ||
    name.includes('stun') ||
    name.includes('paraly') ||
    max > 0
  );
}

function describeEffectImpact(effect) {
  const modifier = {
    ...inferKnownEffectModifier(effect?.name),
    ...(effect?.modifier || {}),
  };

  const bits = [];

  if (modifier.ac) bits.push(`${signed(modifier.ac)} AC`);
  if (modifier.attack) bits.push(`${signed(modifier.attack)} aux attaques`);
  if (modifier.damage) bits.push(`${signed(modifier.damage)} aux dégâts`);
  if (modifier.meleeDamage)
    bits.push(`${signed(modifier.meleeDamage)} dégâts de mêlée`);
  if (modifier.attackDice) bits.push(`${modifier.attackDice} aux attaques`);
  if (modifier.saveDice) bits.push(`${modifier.saveDice} aux sauvegardes`);

  if (bits.length > 0) {
    return `Impact mécanique détecté : ${bits.join(', ')}.`;
  }

  return getKnownEffectRules(effect);
}

function explainEffectTiming(effect, owner, combatants, activeCombatant) {
  const name = (effect?.name || '').toLowerCase();

  if (effect?.active) {
    return 'À vérifier maintenant : cet effet est déjà actif. Assure-toi qu’il est inclus dans AC, jets d’attaque, dégâts, sauvegardes ou décisions ennemies.';
  }

  if (owner?.id === activeCombatant?.id) {
    return 'C’est le tour de ce combattant : bon moment pour décider si l’effet doit être activé avant l’action principale.';
  }

  if (name.includes('shield')) {
    return 'Probablement réactionnel : garde-le en tête quand ce combattant est ciblé par une attaque.';
  }

  if (
    name.includes('bless') ||
    name.includes('magic weapon') ||
    name.includes('haste')
  ) {
    return 'Bon avant une offensive importante ou si un allié va attaquer bientôt.';
  }

  if (name.includes('bane') || name.includes('fear') || name.includes('slow')) {
    return 'Bon pour réduire la menace d’un ennemi dangereux avant son prochain tour.';
  }

  if (name.includes('rage')) {
    return 'Bon si le combattant va engager ou recevoir des attaques en mêlée.';
  }

  return 'Effet situationnel : vérifie s’il change la décision tactique du round.';
}

function findMostVulnerablePc(pcs) {
  return (
    [...pcs]
      .filter((t) => Number(t.hp || 0) > 0)
      .sort((a, b) => {
        const ar = Number(a.hp || 0) / Math.max(1, Number(a.maxHp || 1));
        const br = Number(b.hp || 0) / Math.max(1, Number(b.maxHp || 1));
        return ar - br;
      })[0] || null
  );
}

function findBestAllyForBuff(owner, combatants) {
  const allies = combatants.filter(
    (t) => t.id !== owner.id && !!t.isPC === !!owner.isPC
  );

  return (
    allies.sort((a, b) => {
      const ar = Number(a.hp || 0) / Math.max(1, Number(a.maxHp || 1));
      const br = Number(b.hp || 0) / Math.max(1, Number(b.maxHp || 1));
      return ar - br;
    })[0] || null
  );
}

function findNotableAction(t) {
  return (t.attacks || []).find((a) => {
    const name = (a.name || '').toLowerCase();
    const desc = (a.desc || a.description || '').toLowerCase();
    const max = Number(a.usesMax || 0);
    const left = Number(a.usesLeft ?? max);

    return (
      (max > 0 && left > 0) ||
      name.includes('breath') ||
      name.includes('souffle') ||
      name.includes('recharge') ||
      name.includes('legendary') ||
      name.includes('légendaire') ||
      name.includes('sort') ||
      name.includes('spell') ||
      desc.includes('recharge') ||
      desc.includes('once') ||
      desc.includes('repos') ||
      desc.includes('rest')
    );
  });
}

function effectLooksLikeConcentration(effect) {
  const txt = `${effect?.name || ''} ${effect?.desc || ''} ${
    effect?.description || ''
  }`.toLowerCase();

  return (
    txt.includes('concentration') ||
    txt.includes('bless') ||
    txt.includes('bane') ||
    txt.includes('shield of faith') ||
    txt.includes('haste') ||
    txt.includes('slow')
  );
}
function getCombatantNotableTraits(t) {
  const lines = [];
  const textParts = [];

  if (t.kind) textParts.push(t.kind);
  if (t.description) textParts.push(t.description);
  if (t.shortDescription) textParts.push(t.shortDescription);
  if (t.tactics) textParts.push(t.tactics);
  if (t.senses) textParts.push(t.senses);

  if (Array.isArray(t.traits)) {
    t.traits.forEach((tr) => {
      if (typeof tr === 'string') textParts.push(tr);
      else
        textParts.push(`${tr.name || ''} ${tr.desc || tr.description || ''}`);
    });
  }

  if (Array.isArray(t.effects)) {
    t.effects.forEach((e) => {
      textParts.push(`${e.name || ''} ${e.short || ''} ${e.desc || ''}`);
    });
  }

  const joined = textParts.join(' ').toLowerCase();

  if (joined.includes('darkvision') || joined.includes('vision dans le noir')) {
    lines.push(
      `${t.name}: darkvision / vision dans le noir. N’oublie pas que l’obscurité ne le gêne probablement pas comme les autres.`
    );
  }

  if (
    joined.includes('blind') ||
    joined.includes('blindsight') ||
    joined.includes('aveugle')
  ) {
    lines.push(
      `${t.name}: perception spéciale possible. Vérifie blindsight, tremorsense ou perception sans vision normale.`
    );
  }

  if (
    joined.includes('fly') ||
    joined.includes('vol') ||
    joined.includes('flying')
  ) {
    lines.push(
      `${t.name}: mobilité verticale. Pense aux hauteurs, obstacles, attaques hors de portée et lignes de vue.`
    );
  }

  if (
    joined.includes('invisible') ||
    joined.includes('invisibility') ||
    joined.includes('invisibilité')
  ) {
    lines.push(
      `${t.name}: invisibilité possible. Rappelle-toi avantage/désavantage, position approximative et perception passive.`
    );
  }

  if (joined.includes('resistance') || joined.includes('résistance')) {
    lines.push(
      `${t.name}: résistance possible. Vérifie le type de dégâts avant de retirer les HP.`
    );
  }

  if (joined.includes('immunity') || joined.includes('immunité')) {
    lines.push(
      `${t.name}: immunité possible. Vérifie avant d’appliquer condition ou dégâts.`
    );
  }

  if (joined.includes('concentration')) {
    lines.push(
      `${t.name}: concentration. Pense au jet de concentration après les dégâts.`
    );
  }

  if (joined.includes('opportunity') || joined.includes('opportunité')) {
    lines.push(
      `${t.name}: attaques d’opportunité pertinentes si un ennemi quitte sa portée.`
    );
  }

  if (t.skills) {
    const skillText = Array.isArray(t.skills)
      ? t.skills.join(', ')
      : typeof t.skills === 'object'
      ? Object.entries(t.skills)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
      : String(t.skills);

    if (skillText.trim()) {
      lines.push(
        `${t.name}: skills à retenir — ${skillText}. Utile pour contestations, perception, discrétion, athlétisme ou intimidation.`
      );
    }
  }

  if (t.saves) {
    const saveText = Array.isArray(t.saves)
      ? t.saves.join(', ')
      : typeof t.saves === 'object'
      ? Object.entries(t.saves)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
      : String(t.saves);

    if (saveText.trim()) {
      lines.push(
        `${t.name}: sauvegardes fortes — ${saveText}. Utile contre sorts, poisons, peur, contrôle et effets de zone.`
      );
    }
  }

  return lines.slice(0, 4);
}
/* ----------------------------- Quests ----------------------------------- */
function Quests({ dispatch, quests, campaigns, flash }) {
  const [adding, setAdding] = useState(false);
  const main = quests.filter((q) => q.type === 'main');
  const side = quests.filter((q) => q.type === 'side');
  return (
    <>
      <h1 className="view">Quêtes</h1>
      <p className="sub">
        Track the main thread and side quests. Check off beats as the party
        clears them; the bar shows how far each story has come.
      </p>
      <button
        className="btn primary"
        style={{ marginBottom: 18 }}
        onClick={() => setAdding(true)}
      >
        + New quest
      </button>
      {quests.length === 0 && (
        <div className="empty">
          <div className="big">No quests yet</div>
          <p className="muted">
            Add a main or side quest to start tracking progress.
          </p>
        </div>
      )}
      {main.length > 0 && (
        <>
          <div className="eyebrow">Main thread</div>
          <div className="grid">
            {main.map((q) => (
              <QuestCard key={q.id} q={q} dispatch={dispatch} flash={flash} />
            ))}
          </div>
        </>
      )}
      {side.length > 0 && (
        <>
          <div className="eyebrow">Side quests</div>
          <div className="grid">
            {side.map((q) => (
              <QuestCard key={q.id} q={q} dispatch={dispatch} flash={flash} />
            ))}
          </div>
        </>
      )}
      {adding && (
        <QuestFormModal
          dispatch={dispatch}
          flash={flash}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

function QuestCard({ q, dispatch, flash }) {
  const [newCp, setNewCp] = useState('');
  const done = q.checkpoints.filter((c) => c.done).length;
  const pct = q.checkpoints.length
    ? Math.round((done / q.checkpoints.length) * 100)
    : 0;
  const toggle = (cid) =>
    dispatch({
      type: 'UPDATE_QUEST',
      id: q.id,
      patch: {
        checkpoints: q.checkpoints.map((c) =>
          c.id === cid ? { ...c, done: !c.done } : c
        ),
      },
    });
  const addCp = () => {
    if (!newCp.trim()) return;
    dispatch({
      type: 'UPDATE_QUEST',
      id: q.id,
      patch: {
        checkpoints: [
          ...q.checkpoints,
          { id: uid(), text: newCp, done: false },
        ],
      },
    });
    setNewCp('');
  };
  const delCp = (cid) =>
    dispatch({
      type: 'UPDATE_QUEST',
      id: q.id,
      patch: { checkpoints: q.checkpoints.filter((c) => c.id !== cid) },
    });
  return (
    <div className="panel">
      <div className="card-h">
        <div>
          <span className={'tag ' + (q.type === 'main' ? 'ember' : '')}>
            {q.type}
          </span>
          <div
            style={{
              fontFamily: 'Cinzel,serif',
              fontSize: 17,
              marginTop: 6,
              color: '#f0e2bb',
            }}
          >
            {q.title}
          </div>
        </div>
        <button
          className="btn ghost sm danger"
          style={{ flex: 'none' }}
          onClick={() => {
            if (confirm('Delete quest?'))
              dispatch({ type: 'DELETE_QUEST', id: q.id });
          }}
        >
          ✕
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {done}/{q.checkpoints.length} cleared
      </div>
      <div className="qbar">
        <i style={{ width: pct + '%' }} />
      </div>
      {q.checkpoints.map((c) => (
        <div className="check" key={c.id}>
          <div
            className="box"
            data-on={c.done ? 1 : 0}
            onClick={() => toggle(c.id)}
          >
            {c.done ? '✓' : ''}
          </div>
          <span className="lab" data-on={c.done ? 1 : 0}>
            {c.text}
          </span>
          <button
            className="btn ghost sm"
            style={{ flex: 'none', padding: '2px 7px' }}
            onClick={() => delCp(c.id)}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="in"
          placeholder="Add a checkpoint…"
          value={newCp}
          onChange={(e) => setNewCp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addCp();
          }}
        />
        <button className="btn sm" style={{ flex: 'none' }} onClick={addCp}>
          Add
        </button>
      </div>
      <Field label="Notes">
        <textarea
          className="in"
          rows={2}
          value={q.notes || ''}
          placeholder="Clues, NPC promises, complications…"
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_QUEST',
              id: q.id,
              patch: { notes: e.target.value },
            })
          }
        />
      </Field>
    </div>
  );
}

function QuestFormModal({ dispatch, flash, onClose }) {
  const [f, setF] = useState({ title: '', type: 'main', checkpoints: '' });
  return (
    <Modal title="New quest" onClose={onClose}>
      <Field label="Title">
        <input
          className="in"
          value={f.title}
          onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))}
        />
      </Field>
      <Field label="Type">
        <select
          className="in"
          value={f.type}
          onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}
        >
          <option value="main">Main thread</option>
          <option value="side">Side quest</option>
        </select>
      </Field>
      <Field label="Checkpoints (one per line)">
        <textarea
          className="in"
          rows={4}
          value={f.checkpoints}
          placeholder={
            'Meet the informant\nRecover the relic\nConfront the betrayer'
          }
          onChange={(e) => setF((s) => ({ ...s, checkpoints: e.target.value }))}
        />
      </Field>
      <button
        className="btn primary"
        disabled={!f.title.trim()}
        onClick={() => {
          const cps = f.checkpoints
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({ id: uid(), text: t, done: false }));
          dispatch({
            type: 'ADD_QUEST',
            q: {
              id: uid(),
              title: f.title,
              type: f.type,
              checkpoints: cps,
              notes: '',
            },
          });
          flash('Quest added');
          onClose();
        }}
      >
        Create quest
      </button>
    </Modal>
  );
}

/* ----------------------------- Conjure (quick improv) ------------------- */
function Conjure({ dispatch, universe, party, state, flash }) {
  const { ai } = useContext(AIContext);
  const [kind, setKind] = useState('dialogue');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const log = state.log.filter((l) => l.universeId === universe.id);
  const KINDS = {
    dialogue: {
      label: 'Dialogue',
      hint: "an NPC barks back at the rogue's threat",
      sys: 'improvise vivid in-character D&D NPC dialogue with a one-line stage direction. Plain text, no JSON.',
    },
    npc: {
      label: 'New NPC',
      hint: 'a nervous dockside informant',
      sys: 'improvise a quick D&D NPC: name, one-line look, a secret, a want, and a voice tip. Plain text, no JSON.',
    },
    place: {
      label: 'New place',
      hint: "a smuggler's chapel under the docks",
      sys: 'improvise a quick D&D location: a sensory read-aloud line, one feature, one danger, one hidden detail. Plain text.',
    },
    monster: {
      label: 'Quick threat',
      hint: 'something lurking in the bilge water',
      sys: 'improvise a quick D&D threat with rough AC/HP and one signature move. Plain text, no full stat block.',
    },
    twist: {
      label: 'Plot twist',
      hint: "the patron isn't who they seem",
      sys: 'improvise a surprising but fair D&D plot twist that ties to the party. Plain text.',
    },
  };
  async function conjure() {
    setBusy(true);
    try {
      const pb = party.length
        ? party.map((c) => c.name).join(', ')
        : 'the party';
      const out = await callAI(ai, {
        json: false,
        system: `You are a quick-thinking D&D 5e DM aid. ${KINDS[kind].sys} Keep it under 90 words.`,
        prompt: `Universe: ${universe.name}. Tone: ${universe.tone}. Canon: ${
          universe.lore
        }. Party: ${pb}.
   DM asks for ${KINDS[kind].label}: ${prompt || KINDS[kind].hint}`,
      });
      dispatch({
        type: 'ADD_LOG',
        entry: { kind, prompt: prompt || KINDS[kind].hint, out },
      });
      setPrompt('');
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }
  return (
    <>
      <h1 className="view">Conjurer</h1>
      <p className="sub">
        Mid-session improv. Pick what you need, give a nudge, and the AI hands
        you something to say — seeded with this universe's canon and your party.
        Everything lands in the session log.
      </p>
      <div className="panel">
        <div className="row" style={{ gap: 6, marginBottom: 14 }}>
          {Object.entries(KINDS).map(([k, v]) => (
            <button
              key={k}
              className={'btn sm' + (kind === k ? ' ember' : ' ghost')}
              style={{ flex: 'none' }}
              onClick={() => setKind(k)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Field label="Nudge (optional)">
          <input
            className="in"
            placeholder={KINDS[kind].hint}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') conjure();
            }}
          />
        </Field>
        <button className="btn primary" disabled={busy} onClick={conjure}>
          {busy ? (
            <>
              <Spin /> Conjuring…
            </>
          ) : (
            '✦ Conjure ' + KINDS[kind].label.toLowerCase()
          )}
        </button>
      </div>
      <div className="eyebrow">
        Session log
        {log.length > 0 && (
          <button
            className="btn ghost sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              if (confirm("Clear this universe's log?"))
                dispatch({ type: 'CLEAR_LOG' });
            }}
          >
            Clear
          </button>
        )}
      </div>
      {log.length === 0 ? (
        <div className="empty muted">Conjured lines will appear here.</div>
      ) : (
        <div>
          {log.map((l) => (
            <div className="logentry" key={l.id}>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span className="tag arcane">
                  {KINDS[l.kind]?.label || l.kind}
                </span>
                <span className="faint" style={{ fontSize: 11 }}>
                  {l.prompt}
                </span>
              </div>
              <div className="scroll" style={{ marginTop: 4 }}>
                {l.out}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
