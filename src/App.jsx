/* =========================================================================
   LORESMITH — Game Master Console  (v2)
   StackBlitz / Vite setup:
     1) This is your App component (e.g. src/App.jsx). Render <App/> from main.jsx.
     2) Install the PDF reader once:   npm i pdfjs-dist
     3) Open Settings (gear, top-right) and paste an API key for any provider.
        Free options: Google Gemini (Flash), OpenRouter (:free models), Groq.
   Data is saved to your browser (localStorage). Use Universes → Backups to
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
   .nav{display:flex;gap:2px;margin-left:auto;flex-wrap:wrap}
   .nav button{background:transparent;border:1px solid transparent;color:var(--muted);padding:8px 13px;border-radius:4px;font-size:13px;font-family:'Cinzel';letter-spacing:.03em;transition:.15s}
   .nav button:hover{color:var(--gold-lt)}
   .nav button[data-on="1"]{color:#f3e6c0;border-color:var(--gold-dk);background:linear-gradient(180deg,rgba(201,162,74,.16),rgba(201,162,74,.04));box-shadow:inset 0 0 10px rgba(201,162,74,.14)}
   .iconbtn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--gold);font-size:15px;transition:.15s;margin-left:4px}
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
   .scroll::before{content:"\\276F READ-ALOUD";position:absolute;top:-10px;left:14px;background:var(--parch);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;color:#8a6a2c;padding:2px 8px;border:1px solid var(--parch-line);border-radius:6px}
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
   @media (max-width:640px){.nav{order:3;width:100%;margin-left:0}.top{flex-wrap:wrap}}
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
    model: 'llama-3.3-70b-versatile',
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
});
const AIContext = createContext({ ai: defaultAI(), setAI: () => {} });

async function callAIMessages(ai, messages, json) {
  if (!ai || !ai.apiKey)
    throw new Error("Configure l'IA dans Réglages (clé API manquante).");
  const url = (ai.baseUrl || '').replace(/\/$/, '') + '/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + ai.apiKey,
  };
  if (ai.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://loresmith.local';
    headers['X-Title'] = 'Loresmith';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ai.model,
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
      temperature: json ? 0.2 : 0.85,
      max_tokens: json ? 4000 : 1800,
    }),
  });
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
    console.warn('Réponse IA non JSON. Utilisation du fallback texte.');
    console.warn("Réponse brute de l'IA:", text);

    return {
      _parseFailed: true,
      _rawText: text,
    };
  }
}
const callAI = (ai, { system, prompt, json = true }) =>
  callAIMessages(
    ai,
    (system ? [{ role: 'system', content: system }] : []).concat([
      { role: 'user', content: prompt },
    ]),
    json
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

function fallbackCampaignFromText(rawText, form) {
  const title = getJsonStringField(rawText, 'title');
  const premise = getJsonStringField(rawText, 'premise');
  const hook = getJsonStringField(rawText, 'hook');

  return {
    title: cleanCampaignTitle(title, form.theme),
    premise:
      premise ||
      rawText ||
      'The AI returned text instead of structured campaign data.',
    hook: hook || premise || rawText || '',
    scenes: [
      {
        title: 'Opening Hook',
        type: 'social',
        summary:
          'Introduce the situation, the main threat, and the first decision.',
      },
      {
        title: 'Investigation',
        type: 'exploration',
        summary:
          'Let the party discover clues, locations, factions, or consequences.',
      },
      {
        title: 'Escalation',
        type: 'combat',
        summary: 'Bring the conflict into direct danger.',
      },
      {
        title: 'Final Choice',
        type: 'climax',
        summary:
          'Resolve the adventure through combat, negotiation, sacrifice, or discovery.',
      },
    ],
  };
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
  if (a.type === 'HYDRATE') return a.state;
  if (!s) return seedUniverse();
  const U = s.activeUniverseId;
  switch (a.type) {
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
        campaigns: { ...s.campaigns, [a.c.id]: { ...a.c, universeId: U } },
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
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'dashboard';
  });
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(STORE_KEY);
        const parsed = saved ? JSON.parse(saved) : seedUniverse();

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
    saveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      } catch {}
    }, 400);
  }, [state, hydrated]);
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
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(obj));
          } catch {}
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
            <div style={{ marginTop: 12 }}>Opening the grimoire…</div>
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

  const NAV = [
    ['dashboard', 'Universes'],
    ['library', 'Bibliothèque'],
    ['forge', 'Campaigns'],
    ['chat', 'Generator'],
    ['scene', 'Scene Runner'],
    ['encounter', 'Combat'],
    ['quests', 'Quest Log'],
    ['bestiary', 'NPCs & Monsters'],
    ['party', 'Party'],
    ['assets', 'Images'],
    ['conjure', 'Conjure'],
  ];

  return (
    <AIContext.Provider value={{ ai, setAI }}>
      <>
        <style>{STYLE}</style>
        <div className="ls-root">
          <div className="top">
            <div className="brand">
            <img
  className="brand-emblem"
  src={BRAND.emblem}
  alt="Loresmith"
/>
<div className="brand-text">
  <img
    className="brand-wordmark"
    src={BRAND.wordmark}
    alt="Loresmith"
  />
  <span>GAME MASTER CONSOLE</span>
</div>
            </div>
            <div className="uni-switch">
              <select
                value={U || ''}
                onChange={(e) =>
                  dispatch({ type: 'SET_UNIVERSE', id: e.target.value })
                }
              >
                {Object.values(state.universes).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="nav">
              {NAV.map(([k, l]) => (
                <button
                  key={k}
                  data-on={view === k ? 1 : 0}
                  onClick={() => setView(k)}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              className="iconbtn"
              title="Backup (export)"
              onClick={() => exportBackup(state)}
            >
              ⤓
            </button>
            <button
              className="iconbtn"
              title="Restaurer (import)"
              onClick={() => importRef.current && importRef.current.click()}
            >
              ⤒
            </button>
            <button
              className="iconbtn"
              title="Réglages IA"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙
            </button>
            <button
              className="iconbtn"
              title="Ouvrir Scene Runner dans un nouvel onglet"
              onClick={() => openViewInNewTab('scene')}
            >
              ↗S
            </button>

            <button
              className="iconbtn"
              title="Ouvrir Combat dans un nouvel onglet"
              onClick={() => openViewInNewTab('encounter')}
            >
              ↗C
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
          <div className="wrap">
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
              <Forge
                {...{
                  state,
                  dispatch,
                  universe,
                  party,
                  campaigns,
                  flash,
                  setView,
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
              <Encounter {...{ dispatch, state, party, npcs, flash }} />
            ) : view === 'quests' ? (
              <Quests {...{ dispatch, quests, campaigns, flash }} />
            ) : (
              <Conjure {...{ dispatch, universe, party, state, flash }} />
            )}
          </div>
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
            placeholder="ex. gemini-2.5-flash"
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
  return (
    <>
      <div className="dashboard-brand-mark">
  <img src={BRAND.horizontal} alt="Loresmith" />
</div>

<h1 className="view">{universe.name}</h1>
      <p className="sub">
        {universe.tone ||
          'Set the tone and lore below — it seeds everything the AI generates here.'}
      </p>
      <div className="warnbar">
        Moteur IA :{' '}
        <b>{ai.apiKey ? AI_PRESETS[ai.provider].label : 'non configuré'}</b>.{' '}
        {ai.apiKey ? (
          'Prêt.'
        ) : (
          <span>
            <span
              className="linkish"
              style={{
                color: 'var(--gold-lt)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => setSettingsOpen(true)}
            >
              Ouvre les Réglages
            </span>{' '}
            et colle une clé (Gemini gratuit conseillé).
          </span>
        )}{' '}
        Pense à exporter un <b>backup</b> (icône ⤓ en haut) pour ne rien perdre.
      </div>
      <div className="grid cols-3">
        {[
          ['Campaigns', campaigns.length, 'forge'],
          [
            'Bibliothèque',
            Object.values(state.libraryEntries || {}).filter(
              (e) => e.universeId === universe.id
            ).length,
            'library',
          ],
          ['Party', party.length, 'party'],
          ['Bestiary', npcs.length, 'bestiary'],
          ['Quests', quests.length, 'quests'],
        ].map(([l, n, v]) => (
          <div
            className="panel"
            key={l}
            style={{ cursor: 'pointer' }}
            onClick={() => setView(v)}
          >
            <div
              className="faint"
              style={{
                fontSize: 12,
                letterSpacing: '.1em',
                fontFamily: 'Cinzel',
              }}
            >
              {l.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: 'Cinzel,serif',
                fontSize: 30,
                marginTop: 4,
                color: 'var(--gold-lt)',
              }}
            >
              {n}
            </div>
          </div>
        ))}
      </div>
      <UniverseBrainPanel
        universe={universe}
        campaigns={campaigns}
        dispatch={dispatch}
        flash={flash}
      />
      <div className="eyebrow">Universe canon</div>
      <div className="panel">
        <Field label="Name">
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
        <Field label="Tone (one line)">
          <input
            className="in"
            value={universe.tone}
            placeholder="grimdark / hopeful / pulpy swashbuckling…"
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_UNIVERSE',
                id: universe.id,
                patch: { tone: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Lore & canon — the AI reads this on every generation">
          <textarea
            className="in"
            rows={4}
            value={universe.lore}
            placeholder="Factions, geography, what magic means here, the gods, recent history…"
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
                  name: 'New Universe',
                  tone: '',
                  lore: '',
                  createdAt: now(),
                },
              });
              flash('New universe bound');
            }}
          >
            ✦ New universe
          </button>
          {Object.keys(state.universes).length > 1 && (
            <button
              className="btn ghost danger"
              style={{ flex: 'none' }}
              onClick={() => {
                if (confirm('Delete this universe and switch to another?')) {
                  dispatch({ type: 'DELETE_UNIVERSE', id: universe.id });
                  flash('Universe deleted');
                }
              }}
            >
              Delete universe
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
            ⤓ Export backup (.json)
          </button>
          <button
            className="btn"
            style={{ flex: 'none' }}
            onClick={() => importRef.current && importRef.current.click()}
          >
            ⤒ Import / restore
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
    </>
  );
}
function UniverseBrainPanel({ universe, campaigns, dispatch, flash }) {
  const { ai } = useContext(AIContext);

  const [notes, setNotes] = useState(universe.brainScratch || '');
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});

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
  
    dispatch({
      type: 'UPDATE_UNIVERSE',
      id: universe.id,
      patch: {
        memoryLog: (universe.memoryLog || []).filter((m) => m.id !== memoryId),
      },
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
Tu ne dois pas écrire une campagne. Tu dois aider à structurer l'univers.

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
  ],
  "canonPatch": "Optionnel: court texte de synthèse à ajouter au canon si le mind dump contient déjà des faits solides."
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

      flash('Suggestions de lore générées.');
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
        consequences: data.consequences || [],
        futureSeeds: data.futureSeeds || [],
        nostalgicEchoes: data.nostalgicEchoes || [],
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

    const nextBlocks = (suggestions.loreBlocks || []).filter(
      (_, i) => i !== index
    );

    patchUniverse({
      lore: nextLore,
      loreSuggestions: {
        ...suggestions,
        loreBlocks: nextBlocks,
      },
    });

    flash('Bloc intégré au canon.');
  }

  function removeLoreBlock(index) {
    patchUniverse({
      loreSuggestions: {
        ...suggestions,
        loreBlocks: (suggestions.loreBlocks || []).filter((_, i) => i !== index),
      },
    });
  }

  function addAnswerToMindDump(question, i) {
    const answer = String(answers[i] || '').trim();

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

    setAnswers((prev) => ({ ...prev, [i]: '' }));

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
  className="btn primary"
  style={{ flex: 'none' }}
  disabled={busy}
  onClick={() => {
    flash('Prochaine étape : génération AI des questions et blocs.');
  }}
>
  Générer questions et blocs
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

<div className="grid cols-3" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Questions AI</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Les questions suggérées apparaîtront ici après l’analyse du mind
              dump.
            </p>
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Blocs de lore proposés</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Les blocs intégrables au canon apparaîtront ici.
            </p>
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Entités détectées</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Personnages, lieux, artefacts, factions, mystères et documents
              détectés apparaîtront ici.
            </p>
          </div>
        </div>

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
                        style={{ fontSize: 12, lineHeight: 1.35, marginBottom: 8 }}
                      >
                        {q.why}
                      </div>
                    )}

                    <textarea
                      className="in"
                      value={answers[i] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [i]: e.target.value,
                        }))
                      }
                      placeholder="Ta réponse..."
                    />

                    <button
                      className="btn sm"
                      style={{ flex: 'none', marginTop: 8 }}
                      onClick={() => addAnswerToMindDump(q, i)}
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
                        onClick={() => removeLoreBlock(i)}
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
function Forge({
  state,
  dispatch,
  universe,
  party,
  campaigns,
  flash,
  setView,
}) {
  const { ai } = useContext(AIContext);

  const [mode, setMode] = useState('short'); // "short" | "long"

  const [form, setForm] = useState({
    hours: 3,
    level: party[0]?.level || 3,
    theme: '',
    beats: '',

    mindDump: '',

    longTitle: '',
    campaignScope: 'arc',
    campaignLength: '8-12 sessions',
    centralConflict: '',
    mainVillain: '',
    villainGoal: '',
    startingSituation: '',
    finalStakes: '',
    mainLocations: '',
    factions: '',
    recurringSymbols: '',
    mysteries: '',
    playerBackstoryHooks: '',
    toneNotes: '',
    constraints: '',
    rewardStyle: 'modeste, narratif, rarement magique',
    customQuestions: '',
    actStructure: '3 acts',

    plannedScenes: [
      makeLongCampaignSceneSeed(1),
      makeLongCampaignSceneSeed(2),
      makeLongCampaignSceneSeed(3),
    ],
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const partyBlurb = party.length
    ? party
        .map(
          (c) =>
            `${c.name} (lv${c.level} ${c.race} ${c.cls}${
              c.background ? ', ' + c.background : ''
            })`
        )
        .join('; ')
    : 'a generic party of four adventurers';

  function updatePlannedScene(index, patch) {
    setForm((f) => ({
      ...f,
      plannedScenes: f.plannedScenes.map((sc, i) =>
        i === index ? { ...sc, ...patch } : sc
      ),
    }));
  }

  function addPlannedScene() {
    setForm((f) => ({
      ...f,
      plannedScenes: [
        ...f.plannedScenes,
        makeLongCampaignSceneSeed(f.plannedScenes.length + 1),
      ],
    }));
  }

  function removePlannedScene(index) {
    setForm((f) => ({
      ...f,
      plannedScenes: f.plannedScenes.filter((_, i) => i !== index),
    }));
  }

  async function populateLongCampaignFromMindDump() {
    if (!form.mindDump.trim()) {
      flash("Ajoute d'abord un mind dump de campagne.");
      return;
    }

    setBusy(true);
    setErr('');

    try {
      const data = await callAI(ai, {
        system: `Tu es un architecte de campagne TTRPG pour Loresmith.
    
    Réponds uniquement en JSON valide.
    Tu dois transformer un mind dump libre en squelette de campagne longue.
    Tu dois extraire les champs de campagne, proposer des scènes, créer des PNJ potentiels,
    des lieux, des artefacts, des factions, des mystères et des encounters.
    Langue: français.
    Style: clair, structuré, jouable, immersif sans être opaque.`,
        prompt: `Univers: ${universe.name}
    Ton: ${universe.tone}
    Canon:
    ${universe.lore || ''}
    
    Mémoire vivante:
    ${
      (universe.memoryLog || [])
        .slice(0, 12)
        .map((m) => `- ${m.title}: ${m.summary}`)
        .join('\n') || 'Aucune mémoire enregistrée.'
    }
    
    Personnages du groupe:
    ${partyBlurb}
    
    Mind dump de campagne:
    ${form.mindDump}
    
    Retourne exactement:
    {
      "longTitle": "titre provisoire",
      "theme": "thème / prémisse",
      "campaignScope": "arc|season|sandbox|epic",
      "campaignLength": "longueur visée",
      "actStructure": "3 acts|5 acts|open web|mystery spiral",
      "centralConflict": "conflit central",
      "startingSituation": "situation de départ",
      "mainVillain": "antagoniste principal",
      "villainGoal": "objectif de l'antagoniste",
      "finalStakes": "enjeux finaux",
      "mainLocations": "lieux majeurs",
      "factions": "factions importantes",
      "mysteries": "mystères à révéler",
      "recurringSymbols": "symboles et motifs",
      "playerBackstoryHooks": "hooks liés aux joueurs",
      "toneNotes": "notes de ton",
      "constraints": "contraintes / à éviter / à inclure",
      "rewardStyle": "style de récompenses",
      "customQuestions": "questions ouvertes à clarifier",
      "plannedScenes": [
        {
          "title": "titre",
          "type": "social|exploration|combat|puzzle|climax",
          "purpose": "but de la scène",
          "location": "lieu",
          "npcs": "PNJ présents",
          "encounter": "opposition / encounter",
          "decision": "choix ou dilemme",
          "clue": "indice ou secret",
          "loot": "loot possible",
          "questions": "questions à répondre"
        }
      ],
      "suggestedNpcs": [
        {
          "name": "nom",
          "role": "rôle",
          "motivation": "motivation",
          "secret": "secret"
        }
      ],
      "suggestedLibraryEntries": [
        {
          "title": "nom",
          "archiveType": "artifact|person|place|event|faction|mystery|document",
          "shortSummary": "résumé"
        }
      ]
    }`,
      });

      setForm((f) => ({
        ...f,
        longTitle: data.longTitle || f.longTitle,
        theme: data.theme || f.theme,
        campaignScope: data.campaignScope || f.campaignScope,
        campaignLength: data.campaignLength || f.campaignLength,
        actStructure: data.actStructure || f.actStructure,
        centralConflict: data.centralConflict || f.centralConflict,
        startingSituation: data.startingSituation || f.startingSituation,
        mainVillain: data.mainVillain || f.mainVillain,
        villainGoal: data.villainGoal || f.villainGoal,
        finalStakes: data.finalStakes || f.finalStakes,
        mainLocations: data.mainLocations || f.mainLocations,
        factions: data.factions || f.factions,
        mysteries: data.mysteries || f.mysteries,
        recurringSymbols: data.recurringSymbols || f.recurringSymbols,
        playerBackstoryHooks:
          data.playerBackstoryHooks || f.playerBackstoryHooks,
        toneNotes: data.toneNotes || f.toneNotes,
        constraints: data.constraints || f.constraints,
        rewardStyle: data.rewardStyle || f.rewardStyle,
        customQuestions: data.customQuestions || f.customQuestions,
        plannedScenes:
          Array.isArray(data.plannedScenes) && data.plannedScenes.length
            ? data.plannedScenes.map((sc, i) => ({
                ...makeLongCampaignSceneSeed(i + 1),
                ...sc,
              }))
            : f.plannedScenes,
        suggestedNpcs: data.suggestedNpcs || [],
        suggestedLibraryEntries: data.suggestedLibraryEntries || [],
      }));

      flash('Squelette de campagne rempli à partir du mind dump.');
    } catch (e) {
      setErr(e.message);
    }

    setBusy(false);
  }

  async function forge() {
    setBusy(true);
    setErr('');

    try {
      const isLong = mode === 'long';

      const sceneCount = isLong
        ? Math.max(6, form.plannedScenes.length || 6)
        : Math.max(3, Math.min(8, Math.round(form.hours * 1.3)));

      const system = isLong
        ? `You are a master long-form D&D / TTRPG campaign architect.
  
  Respond with ONLY valid JSON, no prose, no markdown fences.
  
  LANGUAGE RULES:
  - All player-facing narration must be in French.
  - All campaign notes, scene summaries, NPC notes, encounters, hooks, rewards and lore must be in French.
  - Mechanical labels may remain short and simple.
  - The campaign must feel coherent, consequential, seeded, and playable over multiple sessions.
  - Use previous universe memory naturally: callbacks, consequences, recurring symbols, unresolved tensions, easter eggs.
  - Do not over-explain callbacks. Make them useful to the DM.
  
  DESIGN RULES:
  - This is a LONG campaign, not a one-shot.
  - Build acts, recurring NPCs, locations, factions, evolving threats, clues, secrets, encounters and possible outcomes.
  - Scenes should include prep fields that the DM can later expand.
  - Encounters should include possible enemies, goals, terrain, complications, and modest loot.
  - Loot should usually be mundane, personal, funny, damaged, clue-based or modest. Avoid powerful magic unless justified.`
        : `You are a master D&D 5e adventure designer.
  
  Respond with ONLY valid JSON, no prose, no markdown fences.
  
  LANGUAGE RULES:
  - All player-facing narration must be in French.
  - All read-aloud text must be in French.
  - All NPC dialogue must be in French.
  - Mechanical labels may remain short and simple.
  - Dialogue must reflect the creature or character's voice.
  - A frog-like character may include occasional "croa".
  - A serpent-like character should stretch some s sounds, like "sss".
  - A goblin should sound nervous, twitchy, hesitant, and fragmented.
  - A noble should sound formal and controlled.
  - A monster should sound primal, broken, or strange when appropriate.
  - Do not overdo verbal tics. Use them lightly but clearly.`;

      const prompt = isLong
        ? `Universe: "${universe.name}".
  Tone: ${universe.tone}.
  Canon:
  ${universe.lore || ''}
  
  Recent living memory:
  ${
    (universe.memoryLog || [])
      .slice(0, 12)
      .map((m) => `- ${m.title}: ${m.summary}`)
      .join('\n') || 'No recorded memory yet.'
  }
  
  Party:
  ${partyBlurb}
  
  LONG CAMPAIGN BRIEF:
  Working title: ${form.longTitle || form.theme || 'Untitled long campaign'}
  Scope: ${form.campaignScope}
  Expected length: ${form.campaignLength}
  Party level at start: ${form.level}
  Act structure: ${form.actStructure}
  
  Core theme / prompt:
  ${form.theme || 'not specified'}
  
  Central conflict:
  ${form.centralConflict || 'not specified'}
  
  Starting situation:
  ${form.startingSituation || 'not specified'}
  
  Main villain / antagonist:
  ${form.mainVillain || 'not specified'}
  
  Villain goal:
  ${form.villainGoal || 'not specified'}
  
  Final stakes:
  ${form.finalStakes || 'not specified'}
  
  Main locations:
  ${form.mainLocations || 'not specified'}
  
  Factions:
  ${form.factions || 'not specified'}
  
  Recurring symbols / motifs:
  ${form.recurringSymbols || 'not specified'}
  
  Mysteries / questions:
  ${form.mysteries || 'not specified'}
  
  Player backstory hooks:
  ${form.playerBackstoryHooks || 'not specified'}
  
  Tone notes:
  ${form.toneNotes || 'not specified'}
  
  Constraints / must avoid / must include:
  ${form.constraints || 'not specified'}
  
  Reward style:
  ${form.rewardStyle || 'modest'}
  
  Custom questions / loose notes:
  ${form.customQuestions || 'not specified'}
  
  PLANNED SCENES / BUILDING BLOCKS:
  ${form.plannedScenes
    .map(
      (sc, i) => `
  Scene ${i + 1}
  Title: ${sc.title || 'Untitled'}
  Type: ${sc.type}
  Purpose: ${sc.purpose || 'not specified'}
  Location: ${sc.location || 'not specified'}
  Key NPCs: ${sc.npcs || 'not specified'}
  Encounter idea: ${sc.encounter || 'not specified'}
  Decision / dilemma: ${sc.decision || 'not specified'}
  Clue / secret: ${sc.clue || 'not specified'}
  Possible loot: ${sc.loot || 'not specified'}
  Questions to answer: ${sc.questions || 'not specified'}
  `
    )
    .join('\n')}
  
  Create a long campaign plan that can be saved into LORESMITH.
  IMPORTANT:
- Génère beaucoup de matière utilisable par le MJ.
- Chaque acte doit avoir du lore, des secrets, des seeds et des conséquences.
- Chaque séance doit être jouable comme une unité.
- Chaque scène doit être riche, pas seulement un résumé.
- Crée plusieurs suggestions de bibliothèque : lieux, artefacts, personnages, événements, factions, mystères.
- La campagne peut être construite séance par séance, mais le squelette doit déjà contenir la vision globale.
  Return JSON:
{
  "title": str,
  "setting": str,
  "premise": str,
  "hook": str,

  "campaignCanon": "Texte de lore long, 5 à 10 paragraphes, qui explique le contexte profond de la campagne.",
  "campaignThemes": ["thème 1", "thème 2", "thème 3"],
  "dmOverview": "Résumé très utile pour le MJ : structure, secrets, vérité cachée, enjeux, rythme.",
  "openingSituation": "Description détaillée du point de départ.",
  "finalTruth": "La grande vérité cachée de la campagne.",
  "failureState": "Ce qui arrive si les PJ échouent.",
  "campaignQuestions": ["question dramatique 1", "question de lore 2", "question personnelle 3"],

  "acts": [
    {
      "title": str,
      "summary": "Résumé de l’acte.",
      "purpose": "Fonction narrative de cet acte.",
      "lore": "Lore détaillé de l’acte, 3 à 6 paragraphes.",
      "openingBeat": "Comment l’acte commence.",
      "turningPoint": "Moment de bascule.",
      "finale": "Comment l’acte devrait culminer.",
      "secrets": ["secret 1", "secret 2"],
      "seeds": ["seed futur 1", "seed futur 2"],
      "consequences": ["conséquence possible 1", "conséquence possible 2"]
    }
  ],

  "sessions": [
    {
      "title": str,
      "act": str,
      "sessionNumber": num,
      "summary": "Résumé jouable de la séance.",
      "dmBrief": "Brief dense pour le MJ.",
      "openingImage": "Image mentale forte pour démarrer.",
      "mainGoal": "Objectif de séance.",
      "dramaticQuestion": "Question dramatique centrale.",
      "loreToReveal": ["lore 1", "lore 2", "lore 3"],
      "importantChoices": ["choix 1", "choix 2"],
      "expectedScenes": ["scène prévue 1", "scène prévue 2"],
      "possibleEndings": ["fin possible 1", "fin possible 2"]
    }
  ],

  "recurringNpcs": [
    {
      "name": str,
      "role": str,
      "motivation": str,
      "secret": str,
      "voice": str,
      "firstAppearance": str,
      "arc": "Comment ce personnage évolue.",
      "librarySuggestion": true
    }
  ],

  "factions": [
    {
      "name": str,
      "goal": str,
      "methods": str,
      "relationshipToParty": str,
      "publicFace": str,
      "hiddenTruth": str,
      "resources": str,
      "librarySuggestion": true
    }
  ],

  "majorLocations": [
    {
      "name": str,
      "description": str,
      "sensoryDetails": str,
      "history": str,
      "secrets": str,
      "campaignUse": str,
      "librarySuggestion": true
    }
  ],

  "artifacts": [
    {
      "title": str,
      "shortSummary": str,
      "origin": str,
      "historicalContext": str,
      "currentLocation": str,
      "owner": str,
      "campaignUse": str,
      "secrets": str,
      "imagePrompt": str,
      "librarySuggestion": true
    }
  ],

  "historicalEvents": [
    {
      "title": str,
      "shortSummary": str,
      "historicalContext": str,
      "consequences": str,
      "campaignUse": str,
      "secrets": str,
      "librarySuggestion": true
    }
  ],

  "mysteries": [
    {
      "question": str,
      "truth": str,
      "clues": [str],
      "redHerrings": [str],
      "payoff": str,
      "librarySuggestion": true
    }
  ],

  "librarySuggestions": [
    {
      "title": str,
      "archiveType": "artifact|person|place|event|faction|mystery|document",
      "shortSummary": str,
      "body": "Description riche, 2 à 5 paragraphes.",
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
      "title": str,
      "type": "social"|"exploration"|"combat"|"puzzle"|"climax",
      "summary": str,
      "readAloud": "Texte à lire aux joueurs, 2 à 4 paragraphes.",
      "purpose": str,
      "act": str,
      "sessionNumber": num,
      "location": str,

      "lore": "Lore détaillé de la scène, 3 à 7 paragraphes.",
      "dmNotes": "Notes MJ détaillées : rythme, secrets, ambiance, intentions.",
      "sensoryDetails": "Sons, odeurs, lumière, textures, météo, présences.",
      "hiddenTruth": "Ce qui se passe vraiment derrière la scène.",
      "playerChoices": ["choix 1", "choix 2", "choix 3"],
      "consequences": [str],
      "seeds": [str],
      "callbacks": [str],

      "npcs": [
        {
          "name": str,
          "role": str,
          "note": str,
          "motivation": str,
          "secret": str,
          "voice": str
        }
      ],

      "encounters": [
        {
          "name": str,
          "detail": str,
          "goal": str,
          "terrain": str,
          "complication": str,
          "tactics": str,
          "nonCombatResolution": str,
          "loot": [str]
        }
      ],

      "skillChecks": [
        {
          "check": str,
          "dc": num,
          "why": str,
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

      "loot": [str],
      "questions": [str],
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
}`
        : `Universe: "${universe.name}".
  Tone: ${universe.tone}.
  Canon:
  ${universe.lore || ''}
  
  Recent living memory:
  ${
    (universe.memoryLog || [])
      .slice(0, 10)
      .map((m) => `- ${m.title}: ${m.summary}`)
      .join('\n') || 'No recorded memory yet.'
  }
  
  Party: ${partyBlurb}.
  Target level: ${form.level}.
  Length: ~${form.hours}h.
  Theme/prompt: ${form.theme || 'your choice, fitting the universe'}.
  Must-hit beats: ${form.beats || 'none'}.
  
  Design an outline of ~${sceneCount} scenes; tie hooks to party backstories where natural.
  Use the living memory to create consequence, seeding, callbacks, echoes, subtle easter eggs, unresolved tensions and nostalgic reminders from previous play. Do not over-explain them; integrate them naturally.
  
  JSON:
  {
    "title": str,
    "setting": str,
    "premise": str,
    "hook": str,
    "scenes": [
      {
        "title": str,
        "type": "social"|"exploration"|"combat"|"puzzle"|"climax",
        "summary": str,
        "readAloud": str
      }
    ]
  }`;

      const data = await callAI(ai, {
        system,
        prompt,
      });

      const campaignData = data._parseFailed
        ? fallbackCampaignFromText(data._rawText, form)
        : data;

      dispatch({
        type: 'ADD_CAMPAIGN',
        c: {
          id: uid(),
          title: cleanCampaignTitle(
            campaignData.title,
            form.longTitle || form.theme
          ),
          premise: campaignData.premise || 'No premise generated.',
          hook: campaignData.hook || campaignData.premise || '',
          setting: campaignData.setting || '',
          campaignMode: mode,
          mindDump: form.mindDump || '',
          suggestedNpcs: form.suggestedNpcs || [],
          suggestedLibraryEntries: form.suggestedLibraryEntries || [],
          linkedLibraryEntryIds: [],
          campaignCanon: campaignData.campaignCanon || '',
          acts: campaignData.acts || [],
          recurringNpcs: campaignData.recurringNpcs || [],
          factions: campaignData.factions || [],
          majorLocations: campaignData.majorLocations || [],
          mysteries: campaignData.mysteries || [],
          hours: form.hours,
          level: form.level,
          theme: form.theme,
          createdAt: now(),
          campaignThemes: campaignData.campaignThemes || [],
          dmOverview: campaignData.dmOverview || '',
          openingSituation: campaignData.openingSituation || '',
          finalTruth: campaignData.finalTruth || '',
          failureState: campaignData.failureState || '',
          campaignQuestions: campaignData.campaignQuestions || [],
          sessions: campaignData.sessions || [],
          artifacts: campaignData.artifacts || [],
          historicalEvents: campaignData.historicalEvents || [],
          librarySuggestions: [
            ...(campaignData.librarySuggestions || []),
            ...(campaignData.artifacts || []).map((a) => ({
              ...a,
              archiveType: 'artifact',
            })),
            ...(campaignData.historicalEvents || []).map((e) => ({
              ...e,
              archiveType: 'event',
            })),
            ...(campaignData.majorLocations || []).map((l) => ({
              title: l.name,
              archiveType: 'place',
              shortSummary: l.description,
              body: `${l.description || ''}\n\n${l.sensoryDetails || ''}\n\n${
                l.history || ''
              }`,
              campaignUse: l.campaignUse || '',
              secrets: l.secrets || '',
            })),
            ...(campaignData.recurringNpcs || []).map((n) => ({
              title: n.name,
              archiveType: 'person',
              shortSummary: n.role,
              body: `${n.motivation || ''}\n\n${n.arc || ''}`,
              campaignUse: n.firstAppearance || '',
              secrets: n.secret || '',
            })),
            ...(campaignData.factions || []).map((f) => ({
              title: f.name,
              archiveType: 'faction',
              shortSummary: f.goal,
              body: `${f.publicFace || ''}\n\n${f.methods || ''}\n\n${
                f.resources || ''
              }`,
              campaignUse: f.relationshipToParty || '',
              secrets: f.hiddenTruth || '',
            })),
            ...(campaignData.mysteries || []).map((m) => ({
              title: m.question,
              archiveType: 'mystery',
              shortSummary: m.truth,
              body: `Indices:\n${(m.clues || []).join(
                '\n'
              )}\n\nFausses pistes:\n${(m.redHerrings || []).join('\n')}`,
              campaignUse: m.payoff || '',
              secrets: m.truth || '',
            })),
          ],
          scenes: (campaignData.scenes || []).map((sc) => ({
            id: uid(),
            title: sc.title || 'Untitled Scene',
            type: sc.type || 'exploration',
            summary: sc.summary || '',
            expanded: isLong
              ? {
                  setting: sc.location || '',
                  readAloud: sc.readAloud || '',
                  purpose: sc.purpose || '',
                  lore: sc.lore || '',
                  dmNotes: sc.dmNotes || '',
                  sensoryDetails: sc.sensoryDetails || '',
                  hiddenTruth: sc.hiddenTruth || '',
                  playerChoices: sc.playerChoices || [],
                  consequences: sc.consequences || [],
                  seeds: sc.seeds || [],
                  callbacks: sc.callbacks || [],
                  npcs: sc.npcs || [],
                  encounters: sc.encounters || [],
                  skillChecks: sc.skillChecks || [],
                  branches: sc.branches || [],
                  loot: sc.loot || [],
                  questions: sc.questions || [],
                  libraryLinksToCreate: sc.libraryLinksToCreate || [],
                  sessionNumber: sc.sessionNumber || null,
                  act: sc.act || '',
                }
              : null,
          })),
        },
      });

      flash(
        isLong
          ? 'Campagne longue forgée — structure complète créée'
          : 'Campaign forged — expand any scene for detail'
      );
    } catch (e) {
      setErr(e.message);
    }

    setBusy(false);
  }

  return (
    <>
      <h1 className="view">Campaign Forge</h1>

      <p className="sub">
        Forge une campagne courte rapidement, ou construis une campagne longue
        avec arcs, scènes, PNJ, factions, encounters, mystères, conséquences et
        mémoire d’univers.
      </p>

      <div className="panel">
        <div className="bestiary-toggle" style={{ marginBottom: 18 }}>
          <button
            type="button"
            data-on={mode === 'short' ? 1 : 0}
            onClick={() => setMode('short')}
          >
            Campagne courte
          </button>

          <button
            type="button"
            data-on={mode === 'long' ? 1 : 0}
            onClick={() => setMode('long')}
          >
            Campagne longue
          </button>
        </div>

        {mode === 'short' ? (
          <>
            <div className="row">
              <Field label="Session length (hours)">
                <input
                  className="in"
                  type="number"
                  min="1"
                  max="8"
                  value={form.hours}
                  onChange={(e) => set('hours', +e.target.value)}
                />
              </Field>

              <Field label="Party level">
                <input
                  className="in"
                  type="number"
                  min="1"
                  max="20"
                  value={form.level}
                  onChange={(e) => set('level', +e.target.value)}
                />
              </Field>
            </div>

            <Field label="Theme / prompt">
              <input
                className="in"
                placeholder="a heist beneath the drowned cathedral; a betrayal among the guilds…"
                value={form.theme}
                onChange={(e) => set('theme', e.target.value)}
              />
            </Field>

            <Field label="Must-hit beats (optional)">
              <textarea
                className="in"
                rows={2}
                placeholder="Introduce the villain early; reward Kael's search for his sister…"
                value={form.beats}
                onChange={(e) => set('beats', e.target.value)}
              />
            </Field>
          </>
        ) : (
          <LongCampaignForgeFields
            form={form}
            set={set}
            busy={busy}
            onPopulateFromMindDump={populateLongCampaignFromMindDump}
            updatePlannedScene={updatePlannedScene}
            addPlannedScene={addPlannedScene}
            removePlannedScene={removePlannedScene}
          />
        )}

        <div className="faint" style={{ fontSize: 12, marginBottom: 14 }}>
          Party seed: {partyBlurb}
        </div>

        <button className="btn primary" disabled={busy} onClick={forge}>
          {busy ? (
            <>
              <Spin /> Forging…
            </>
          ) : mode === 'long' ? (
            '⚒ Forge long campaign'
          ) : (
            '⚒ Forge campaign'
          )}
        </button>

        {err && (
          <div style={{ color: 'var(--blood)', marginTop: 12, fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>

      <div className="eyebrow">Forged campaigns</div>

      {campaigns.length === 0 ? (
        <div className="empty">
          <div className="big">No campaigns yet</div>
          <p className="muted">
            Fill the form above and forge your first adventure.
          </p>
        </div>
      ) : (
        <div className="grid">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              camp={c}
              {...{ state, dispatch, universe, party, flash, setView }}
            />
          ))}
        </div>
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

function makeLongCampaignSceneSeed(n) {
  return {
    title:
      n === 1
        ? 'Ouverture'
        : n === 2
        ? 'Première complication'
        : n === 3
        ? 'Point de bascule'
        : `Scène ${n}`,
    type:
      n === 1
        ? 'social'
        : n === 2
        ? 'exploration'
        : n === 3
        ? 'combat'
        : 'exploration',
    purpose: '',
    location: '',
    npcs: '',
    encounter: '',
    decision: '',
    clue: '',
    loot: '',
    questions: '',
  };
}

function LongCampaignForgeFields({
  form,
  set,
  busy,
  onPopulateFromMindDump,
  updatePlannedScene,
  addPlannedScene,
  removePlannedScene,
}) {
  return (
    <>
      <div className="eyebrow" style={{ marginTop: 0 }}>
        Mind dump de campagne
      </div>

      <div className="panel brain-panel" style={{ marginBottom: 18 }}>
        <p
          className="muted"
          style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}
        >
          Dépose ici tout ce que tu as en tête : ambiance, méchant, scènes,
          lieux, twists, inspirations, contraintes, personnages, mystères,
          images mentales, moments cools. Loresmith va ensuite remplir le
          squelette de campagne longue automatiquement.
        </p>

        <Field label="Mind dump libre">
          <textarea
            className="in"
            value={form.mindDump}
            onChange={(e) => set('mindDump', e.target.value)}
            placeholder="Ex. Je veux une campagne dans une cité portuaire hantée par un ancien pacte. Les joueurs commencent comme escorte d'un convoi. Le vrai méchant est un juge immortel. Je veux des factions, un artefact brisé, une scène dans un théâtre abandonné..."
            style={{ minHeight: 180 }}
          />
        </Field>

        <button
          className="btn primary"
          style={{ flex: 'none' }}
          disabled={busy}
          type="button"
          onClick={onPopulateFromMindDump}
        >
          {busy ? (
            <>
              <Spin /> Analyse…
            </>
          ) : (
            'Remplir le squelette avec l’IA'
          )}
        </button>

        {(form.suggestedNpcs?.length > 0 ||
          form.suggestedLibraryEntries?.length > 0) && (
          <div className="memory-list">
            {form.suggestedNpcs?.length > 0 && (
              <div className="memory-item">
                <b>PNJ suggérés</b>
                <p>
                  {form.suggestedNpcs
                    .map((n) => `${n.name} — ${n.role}`)
                    .join(' / ')}
                </p>
              </div>
            )}

            {form.suggestedLibraryEntries?.length > 0 && (
              <div className="memory-item">
                <b>Archives suggérées</b>
                <p>
                  {form.suggestedLibraryEntries
                    .map((e) => `${e.title} (${e.archiveType})`)
                    .join(' / ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="eyebrow" style={{ marginTop: 0 }}>
        Fondation de campagne
      </div>

      <div className="row">
        <Field label="Titre provisoire">
          <input
            className="in"
            value={form.longTitle}
            onChange={(e) => set('longTitle', e.target.value)}
            placeholder="ex. Les Cendres du Serment Stellaire"
          />
        </Field>

        <Field label="Niveau de départ">
          <input
            className="in"
            type="number"
            min="1"
            max="20"
            value={form.level}
            onChange={(e) => set('level', +e.target.value)}
          />
        </Field>

        <Field label="Longueur visée">
          <input
            className="in"
            value={form.campaignLength}
            onChange={(e) => set('campaignLength', e.target.value)}
            placeholder="ex. 8-12 sessions, 3 actes, campagne ouverte..."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Portée">
          <select
            className="in"
            value={form.campaignScope}
            onChange={(e) => set('campaignScope', e.target.value)}
          >
            <option value="arc">Arc narratif</option>
            <option value="season">Saison complète</option>
            <option value="sandbox">Sandbox évolutif</option>
            <option value="epic">Épopée longue</option>
          </select>
        </Field>

        <Field label="Structure">
          <select
            className="in"
            value={form.actStructure}
            onChange={(e) => set('actStructure', e.target.value)}
          >
            <option value="3 acts">3 actes</option>
            <option value="5 acts">5 actes</option>
            <option value="open web">Structure ouverte en toile</option>
            <option value="mystery spiral">Spirale de mystère</option>
          </select>
        </Field>
      </div>

      <Field label="Thème central / prémisse">
        <textarea
          className="in"
          value={form.theme}
          onChange={(e) => set('theme', e.target.value)}
          placeholder="De quoi parle cette campagne? Trahison, dette ancienne, royaume mourant, dieux oubliés, exploration d'une région..."
        />
      </Field>

      <div className="row">
        <Field label="Conflit central">
          <textarea
            className="in"
            value={form.centralConflict}
            onChange={(e) => set('centralConflict', e.target.value)}
            placeholder="Quelle tension fait avancer la campagne?"
          />
        </Field>

        <Field label="Situation de départ">
          <textarea
            className="in"
            value={form.startingSituation}
            onChange={(e) => set('startingSituation', e.target.value)}
            placeholder="Où sont les PJ au début? Qu'est-ce qui vient de se produire?"
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Antagoniste principal">
          <textarea
            className="in"
            value={form.mainVillain}
            onChange={(e) => set('mainVillain', e.target.value)}
            placeholder="Nom, nature, réputation, lien avec l'univers..."
          />
        </Field>

        <Field label="Objectif de l'antagoniste">
          <textarea
            className="in"
            value={form.villainGoal}
            onChange={(e) => set('villainGoal', e.target.value)}
            placeholder="Que veut-il vraiment? Pourquoi maintenant?"
          />
        </Field>

        <Field label="Enjeux finaux">
          <textarea
            className="in"
            value={form.finalStakes}
            onChange={(e) => set('finalStakes', e.target.value)}
            placeholder="Qu'est-ce qui arrive si les PJ échouent?"
          />
        </Field>
      </div>

      <div className="eyebrow">Monde, factions et mystères</div>

      <div className="row">
        <Field label="Lieux majeurs">
          <textarea
            className="in"
            value={form.mainLocations}
            onChange={(e) => set('mainLocations', e.target.value)}
            placeholder="Villes, ruines, donjons, routes, sanctuaires, régions..."
          />
        </Field>

        <Field label="Factions">
          <textarea
            className="in"
            value={form.factions}
            onChange={(e) => set('factions', e.target.value)}
            placeholder="Guildes, cultes, maisons nobles, clans, ordres, monstres organisés..."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Mystères à révéler">
          <textarea
            className="in"
            value={form.mysteries}
            onChange={(e) => set('mysteries', e.target.value)}
            placeholder="Questions sans réponse, mensonges historiques, secrets de famille, artefacts inconnus..."
          />
        </Field>

        <Field label="Symboles récurrents / motifs">
          <textarea
            className="in"
            value={form.recurringSymbols}
            onChange={(e) => set('recurringSymbols', e.target.value)}
            placeholder="Corbeaux blancs, marteaux brisés, étoiles noires, chansons, rêves, cicatrices..."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Hooks liés aux backgrounds des joueurs">
          <textarea
            className="in"
            value={form.playerBackstoryHooks}
            onChange={(e) => set('playerBackstoryHooks', e.target.value)}
            placeholder="Promesses, ennemis personnels, dettes, familles, mentors, objets hérités..."
          />
        </Field>

        <Field label="Contraintes / choses à inclure ou éviter">
          <textarea
            className="in"
            value={form.constraints}
            onChange={(e) => set('constraints', e.target.value)}
            placeholder="Pas trop d'horreur, beaucoup d'exploration, moins de politique, inclure tel PNJ..."
          />
        </Field>
      </div>

      <div className="row">
        <Field label="Notes de ton">
          <textarea
            className="in"
            value={form.toneNotes}
            onChange={(e) => set('toneNotes', e.target.value)}
            placeholder="Épique, intime, étrange, drôle, sombre mais chaleureux..."
          />
        </Field>

        <Field label="Style de récompenses">
          <textarea
            className="in"
            value={form.rewardStyle}
            onChange={(e) => set('rewardStyle', e.target.value)}
            placeholder="Modeste, narratif, clues, objets personnels, peu de magie..."
          />
        </Field>
      </div>

      <Field label="Questions personnalisées / notes libres">
        <textarea
          className="in"
          value={form.customQuestions}
          onChange={(e) => set('customQuestions', e.target.value)}
          placeholder="Écris ici tout ce qui ne rentre pas dans les champs. Tu peux poser des questions à l'IA ou mettre des idées décousues."
        />
      </Field>

      <div className="eyebrow">Scènes planifiées</div>

      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        Ces scènes servent de squelette. L’IA va les transformer en scènes
        jouables avec PNJ, encounters, skill checks, branches, loot,
        conséquences et seeds.
      </p>

      <div className="grid">
        {form.plannedScenes.map((sc, i) => (
          <div className="panel" key={i}>
            <div className="card-h">
              <div>
                <div
                  style={{
                    fontFamily: 'Cinzel,serif',
                    color: 'var(--gold-lt)',
                    fontSize: 16,
                  }}
                >
                  Scène {i + 1}
                </div>

                <div className="muted" style={{ fontSize: 12 }}>
                  Bloc de préparation personnalisable
                </div>
              </div>

              {form.plannedScenes.length > 1 && (
                <button
                  className="btn ghost sm danger"
                  style={{ flex: 'none' }}
                  onClick={() => removePlannedScene(i)}
                >
                  ×
                </button>
              )}
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <Field label="Titre de scène">
                <input
                  className="in"
                  value={sc.title}
                  onChange={(e) =>
                    updatePlannedScene(i, { title: e.target.value })
                  }
                />
              </Field>

              <Field label="Type">
                <select
                  className="in"
                  value={sc.type}
                  onChange={(e) =>
                    updatePlannedScene(i, { type: e.target.value })
                  }
                >
                  <option value="social">Social</option>
                  <option value="exploration">Exploration</option>
                  <option value="combat">Combat</option>
                  <option value="puzzle">Puzzle</option>
                  <option value="climax">Climax</option>
                </select>
              </Field>

              <Field label="Lieu">
                <input
                  className="in"
                  value={sc.location}
                  onChange={(e) =>
                    updatePlannedScene(i, { location: e.target.value })
                  }
                  placeholder="ex. Le pont effondré, la halle des guildes..."
                />
              </Field>
            </div>

            <div className="row">
              <Field label="But de la scène">
                <textarea
                  className="in"
                  value={sc.purpose}
                  onChange={(e) =>
                    updatePlannedScene(i, { purpose: e.target.value })
                  }
                  placeholder="Pourquoi cette scène existe-t-elle?"
                />
              </Field>

              <Field label="PNJ / personnages présents">
                <textarea
                  className="in"
                  value={sc.npcs}
                  onChange={(e) =>
                    updatePlannedScene(i, { npcs: e.target.value })
                  }
                  placeholder="Noms, rôles, attitudes, secrets..."
                />
              </Field>
            </div>

            <div className="row">
              <Field label="Encounter / opposition">
                <textarea
                  className="in"
                  value={sc.encounter}
                  onChange={(e) =>
                    updatePlannedScene(i, { encounter: e.target.value })
                  }
                  placeholder="Monstres, obstacles, terrain, complication..."
                />
              </Field>

              <Field label="Décision / dilemme">
                <textarea
                  className="in"
                  value={sc.decision}
                  onChange={(e) =>
                    updatePlannedScene(i, { decision: e.target.value })
                  }
                  placeholder="Quel choix intéressant les joueurs doivent-ils faire?"
                />
              </Field>
            </div>

            <div className="row">
              <Field label="Indice / secret révélé">
                <textarea
                  className="in"
                  value={sc.clue}
                  onChange={(e) =>
                    updatePlannedScene(i, { clue: e.target.value })
                  }
                  placeholder="Indice, vérité, mensonge, symbole, révélation..."
                />
              </Field>

              <Field label="Loot possible">
                <textarea
                  className="in"
                  value={sc.loot}
                  onChange={(e) =>
                    updatePlannedScene(i, { loot: e.target.value })
                  }
                  placeholder="Objet banal, drôle, personnel, clue, petite récompense..."
                />
              </Field>
            </div>

            <Field label="Questions à répondre dans cette scène">
              <textarea
                className="in"
                value={sc.questions}
                onChange={(e) =>
                  updatePlannedScene(i, { questions: e.target.value })
                }
                placeholder="Qu'est-ce que cette scène doit clarifier? Quel mystère doit avancer?"
              />
            </Field>
          </div>
        ))}
      </div>

      <button
        className="btn"
        style={{ flex: 'none', marginTop: 12 }}
        type="button"
        onClick={addPlannedScene}
      >
        + Ajouter une scène
      </button>
    </>
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
}) {
  const [open, setOpen] = useState(false);
  const { ai } = useContext(AIContext);
  const [brainNotes, setBrainNotes] = useState(camp.brainScratch || '');
  const [brainBusy, setBrainBusy] = useState(false);

  async function assimilateCampaignMemory() {
    if (!brainNotes.trim()) {
      flash('Ajoute des notes de campagne à assimiler.');
      return;
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
            ~{camp.hours}h · lv {camp.level} · {camp.scenes.length} scenes
          </div>
        </div>

        <div className="row" style={{ flex: 'none' }}>
          <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Open'}
          </button>
          <button
            className="btn ghost sm"
            style={{ flex: 'none' }}
            onClick={() => setEditing(true)}
          >
            Edit Scene
          </button>
          {editing && (
            <SceneEditModal
              scene={scene}
              camp={camp}
              universe={universe}
              state={state}
              dispatch={dispatch}
              onClose={() => setEditing(false)}
              flash={flash}
            />
          )}
          <button
            className="btn ghost sm danger"
            onClick={() => {
              if (confirm('Delete campaign?')) {
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
            )}
          </div>

          <div className="scroll">{camp.hook}</div>

          <div className="eyebrow" style={{ marginTop: 22 }}>
            Scenes
          </div>

          {camp.scenes.map((sc, i) => (
            <SceneRow
              key={sc.id}
              scene={sc}
              idx={i}
              camp={camp}
              {...{ state, dispatch, universe, party, flash, setView }}
            />
          ))}
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

      <Field label="Read-aloud">
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
}) {
  const { ai } = useContext(AIContext);
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
          {busy ? <Spin /> : x ? show ? 'Collapse' : 'Detail' : '✦ Expand'}
        </button>
      </div>
      {x && show && (
        <div style={{ marginTop: 12, paddingLeft: 26 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            <b style={{ color: 'var(--txt)' }}>Setting. </b>
            {x.setting}
          </div>
          {x.readAloud && <div className="scroll">{x.readAloud}</div>}
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
            <Block title="NPCs">
              {x.npcs.map((n, i) => (
                <div key={i} className="feat">
                  <b>{n.name}.</b> {n.note}
                </div>
              ))}
            </Block>
          )}
          {x.encounters?.length > 0 && (
            <Block title="Encounters">
              {x.encounters.map((e, i) => (
                <div key={i} className="feat">
                  <b>{e.name}.</b> {e.detail}
                </div>
              ))}
            </Block>
          )}
          {x.skillChecks?.length > 0 && (
            <Block title="Skill checks">
              {x.skillChecks.map((c, i) => (
                <div key={i} className="feat">
                  <b>
                    {c.check} (DC {c.dc}).
                  </b>{' '}
                  {c.on_success}
                </div>
              ))}
            </Block>
          )}
          {x.branches?.length > 0 && (
            <Block title="If / then">
              {x.branches.map((b, i) => (
                <div key={i} className="feat">
                  <b>If</b> {b.if} <b>→</b> {b.then}
                </div>
              ))}
            </Block>
          )}
          {x.loot?.length > 0 && (
            <Block title="Loot">
              <div className="row" style={{ gap: 6 }}>
                {x.loot.map((l, i) => (
                  <span key={i} className="tag ember" style={{ flex: 'none' }}>
                    {l}
                  </span>
                ))}
              </div>
            </Block>
          )}
        </div>
      )}
    </div>
  );
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
}) {
  const { ai } = useContext(AIContext);

  const [mode, setMode] = useState('gm'); // "gm" | "npc"
  const [activeThreadId, setActiveThreadId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

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
      <h1 className="view">Generator</h1>
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

  const [activeCampaignId, setActiveCampaignId] = useState(
    campaigns[0]?.id || ''
  );
  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  const [activeSceneId, setActiveSceneId] = useState(
    activeCampaign?.scenes?.[0]?.id || ''
  );

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
          <h1>{activeScene ? activeScene.title : 'Scene Runner'}</h1>
          <div className="scene-pill">
            {activeScene ? activeScene.type : 'Aucune scène'}
          </div>
        </div>

        <section className="readaloud-panel">
          <div className="scene-label dark">Read-Aloud Text</div>

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

function Library({ state, dispatch, universe, campaigns, flash }) {
  const { ai } = useContext(AIContext);

  const [type, setType] = useState('artifact');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);

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
    "imagePrompt": "prompt d'image dark fantasy sans texte ni watermark"
  }`,
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
  "authenticity": "évaluation d'authenticité"
}`,
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
                const img = getPrimaryAsset(state, 'library', entry.id);

                return (
                  <div
                    key={entry.id}
                    className="library-card"
                    data-on={selected?.id === entry.id ? 1 : 0}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    {img?.dataUrl && (
                      <img
                        src={img.dataUrl}
                        alt={entry.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(img.dataUrl, '_blank');
                        }}
                      />
                    )}

                    <div className="library-card-type">
                      {LIBRARY_TYPES[entry.archiveType]?.singular || 'Archive'}
                    </div>

                    <div className="library-card-title">{entry.title}</div>

                    {entry.shortSummary && <p>{entry.shortSummary}</p>}
                  </div>
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
            />
          )}
        </main>
      </div>
    </>
  );
}

function splitLines(value) {
  return String(value || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function firstParagraph(value) {
  return (
    String(value || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)[0] || ''
  );
}

function entryLines(entry, key, fallback = []) {
  const value = entry?.[key];

  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  if (Array.isArray(fallback)) {
    return fallback.map((x) => String(x || '').trim()).filter(Boolean);
  }

  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function ArchivePanel({ title, icon = '✦', children, className = '' }) {
  return (
    <section className={`archive-panel ${className}`}>
      <div className="archive-panel-title">
        <span>{icon}</span>
        {title}
      </div>
      <div className="archive-panel-body">{children}</div>
    </section>
  );
}

function ArchiveList({ items = [] }) {
  const safeItems = Array.isArray(items)
    ? items.map((x) => String(x || '').trim()).filter(Boolean)
    : String(items || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);

  if (!safeItems.length) {
    return <p className="archive-muted">Aucune donnée pour le moment.</p>;
  }

  return (
    <ul className="archive-list">
      {safeItems.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ArchiveMetaTable({ rows = [] }) {
  return (
    <div className="archive-meta-table">
      {rows
        .filter((row) => row && row[1])
        .map(([label, value, icon], i) => (
          <React.Fragment key={i}>
            <div className="archive-meta-label">
              <span>{icon || '◆'}</span>
              {label}
            </div>
            <div className="archive-meta-value">{value}</div>
          </React.Fragment>
        ))}
    </div>
  );
}

function CampaignMentionList({ entry, campaigns }) {
  const linked = campaigns.filter((c) =>
    (entry.linkedCampaignIds || []).includes(c.id)
  );

  if (!linked.length) {
    return <p className="archive-muted">Aucune mention en campagne.</p>;
  }

  return (
    <ul className="archive-mentions">
      {linked.map((c) => (
        <li key={c.id}>
          <b>{c.title}</b>
          <span>{c.premise || c.hook || 'Campagne liée'}</span>
        </li>
      ))}
    </ul>
  );
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
}) {
  const img = getPrimaryAsset(state, 'library', entry.id);

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
        campaigns={campaigns}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
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
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  const type = entry.archiveType || 'document';

  const props = {
    entry,
    img,
    campaigns,
    onUploadImage,
    onPolish,
    busy,
  };

  if (type === 'artifact') return <ArtifactArchivePage {...props} />;
  if (type === 'person') return <PersonArchivePage {...props} />;
  if (type === 'place') return <PlaceArchivePage {...props} />;
  if (type === 'event') return <EventArchivePage {...props} />;
  if (type === 'faction') return <FactionArchivePage {...props} />;
  if (type === 'mystery') return <MysteryArchivePage {...props} />;

  return <DocumentArchivePage {...props} />;
}

function ArchiveTopActions({ entry, onUploadImage, onPolish, busy }) {
  const inputId = `archive-top-upload-${entry.id}`;

  return (
    <div className="archive-actions">
      <label
        className="archive-icon-btn"
        title="Ajouter ou remplacer l’image"
        htmlFor={inputId}
      >
        ⬆
        <input
          id={inputId}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            onUploadImage(entry, e.target.files && e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>

      <button
        className="archive-icon-btn"
        title="Reformuler avec l’IA"
        disabled={busy}
        onClick={() => onPolish(entry)}
      >
        ✎
      </button>
    </div>
  );
}

function ArchiveHeroImage({
  img,
  entry,
  variant = 'wide',
  onUploadImage,
}) {
  const inputId = `archive-image-upload-${entry.id}-${variant}`;

  if (!img?.dataUrl) {
    return (
      <label
        className={`archive-image-empty ${variant}`}
        htmlFor={inputId}
        title="Cliquer pour ajouter une image"
      >
        <span>Image à ajouter</span>
        <small>Cliquer pour importer</small>

        <input
          id={inputId}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            onUploadImage(entry, e.target.files && e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>
    );
  }

  return (
    <label
      className={`archive-image-click-wrap ${variant}`}
      htmlFor={inputId}
      title="Cliquer pour remplacer l’image"
    >
      <img
        className={`archive-hero-image ${variant}`}
        src={img.dataUrl}
        alt={entry.title}
      />

      <span className="archive-image-overlay">Remplacer l’image</span>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          onUploadImage(entry, e.target.files && e.target.files[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function ArtifactArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  const properties = entryLines(entry, 'properties', [
    entry.campaignUse,
    entry.secrets,
  ]).filter(Boolean);

  return (
    <article className="archive-page archive-artifact">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Artefacts › {entry.title}
      </div>

      <header className="archive-header">
        <div>
          <h1>{entry.title}</h1>
          <div className="archive-subtitle">
            ◆ {entry.subtitle || 'Artefact légendaire'}
          </div>
        </div>
      </header>

      <div className="artifact-layout">
        <div>
          <div className="artifact-showcase">
          <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
            <div className="artifact-plaque">
              <b>{entry.title}</b>
              <span>{entry.subtitle || 'Artefact'}</span>
            </div>
          </div>
        </div>

        <ArchivePanel title="Plaque d’inventaire" icon="◇">
          <ArchiveMetaTable
            rows={[
              ['Époque', entry.era || entry.historicalContext, '◴'],
              ['Matériaux', entry.materials || entry.tags?.join(', '), '▰'],
              ['Civilisation', entry.civilization || entry.origin, '▣'],
              ['État', entry.condition || entry.currentLocation, '⬟'],
              ['Gardien', entry.owner, '♛'],
            ]}
          />
        </ArchivePanel>
      </div>

      <div className="archive-grid three">
        <ArchivePanel title="Description" icon="✎" className="span-two">
          <p>{entry.shortSummary || firstParagraph(entry.body)}</p>
          {entry.body && <p>{entry.body}</p>}
        </ArchivePanel>

        <ArchivePanel title="Propriétés connues" icon="◆">
          <ArchiveList items={properties} />
        </ArchivePanel>

        <ArchivePanel title="Contexte historique" icon="⌛">
          <p>{entry.historicalContext || 'Contexte non documenté.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Origine" icon="✥">
          <p>{entry.origin || 'Origine inconnue.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Malédictions / secrets" icon="✦">
          <ArchiveList items={entryLines(entry, 'secrets', [entry.secrets])} />
        </ArchivePanel>

        <ArchivePanel title="Mentions en campagne" icon="▣">
          <CampaignMentionList entry={entry} campaigns={campaigns} />
        </ArchivePanel>
      </div>
    </article>
  );
}
function MysteryArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  const fragments = entryLines(entry, 'fragments', [
    entry.shortSummary,
    entry.body,
  ]);

  const clues = entryLines(entry, 'clues');
  const witnesses = entryLines(entry, 'witnesses');
  const places = entryLines(entry, 'places', [entry.currentLocation]);
  const redHerrings = entryLines(entry, 'redHerrings');
  const questions = entryLines(entry, 'questions');
  const truth = entry.secrets || entry.campaignUse || '';

  return (
    <article className="archive-page archive-mystery">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Mystères › {entry.title || 'Mystère sans titre'}
      </div>

      <header className="archive-header mystery-header">
        <div>
          <h1>{entry.title || 'Mystère sans titre'}</h1>
          <div className="archive-subtitle">
            ● {entry.subtitle || 'Mystère actif'}
          </div>
        </div>

        <div className="mystery-progress">
          <span>Ouvert</span>
          <span>Enquête</span>
          <span>Confrontation</span>
          <span>Résolution</span>
        </div>
      </header>

      <div className="mystery-board">
        <ArchivePanel title="Fragments connus" icon="✎">
          <ArchiveList items={fragments} />
        </ArchivePanel>

        <ArchivePanel title="Indices" icon="⌕" className="burned-note">
          <ArchiveList items={clues.length ? clues : fragments} />
        </ArchivePanel>

        <ArchivePanel title="Témoins" icon="☷">
          <ArchiveList items={witnesses} />
        </ArchivePanel>

        <ArchivePanel title="Lieux liés" icon="⌖">
          <ArchiveList items={places} />
        </ArchivePanel>

        <ArchivePanel title="Fausses pistes" icon="×" className="dark-note">
          <ArchiveList items={redHerrings} />
        </ArchivePanel>

        <ArchivePanel title="Questions ouvertes" icon="?">
          <ArchiveList items={questions} />
        </ArchivePanel>

        <ArchivePanel
          title="Vérité cachée"
          icon="▣"
          className="truth-panel span-two"
        >
          <p>{truth || 'Vérité non révélée.'}</p>
        </ArchivePanel>
      </div>
    </article>
  );
}
function PersonArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  return (
    <article className="archive-page archive-person">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Personnages › {entry.title}
      </div>

      <header className="archive-header">
        <div>
          <h1>{entry.title}</h1>
          <div className="archive-subtitle">
            {entry.subtitle || 'NPC majeur'}
          </div>
        </div>
      </header>

      <div className="person-layout">
        <div className="person-portrait-card">
        <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
          <div className="person-quote">
            “{entry.quote || entry.shortSummary || 'Aucune citation consignée.'}
            ”
          </div>
        </div>

        <div className="person-main-grid">
          <ArchivePanel title="Résumé narratif" icon="✒">
            <p>{entry.shortSummary || firstParagraph(entry.body)}</p>
          </ArchivePanel>

          <ArchivePanel title="Identité" icon="◆">
            <ArchiveMetaTable
              rows={[
                ['Race', entry.race, '☻'],
                ['Occupation', entry.occupation || entry.subtitle, '▣'],
                ['Âge', entry.age, '⌛'],
                ['Statut', entry.status, '♛'],
                ['Allégeance', entry.allegiance || entry.owner, '⬟'],
                ['Résidence', entry.currentLocation, '⌂'],
              ]}
            />
          </ArchivePanel>

          <ArchivePanel title="Apparence" icon="◎">
            <p>{entry.appearance || 'Apparence non documentée.'}</p>
          </ArchivePanel>

          <ArchivePanel title="Personnalité" icon="◈">
            <p>
              {entry.personality ||
                entry.body ||
                'Personnalité non documentée.'}
            </p>
          </ArchivePanel>

          <ArchivePanel title="Objectifs" icon="☉">
            <ArchiveList
              items={entryLines(entry, 'goals', [entry.campaignUse])}
            />
          </ArchivePanel>

          <ArchivePanel title="Secrets" icon="▣">
            <p>{entry.secrets || 'Aucun secret consigné.'}</p>
          </ArchivePanel>
        </div>
      </div>

      <div className="archive-grid two">
        <ArchivePanel title="Dialogues de rencontre" icon="☷">
          <ArchiveList items={entryLines(entry, 'dialogues')} />
        </ArchivePanel>

        <ArchivePanel title="Apparitions en campagne" icon="▣">
          <CampaignMentionList entry={entry} campaigns={campaigns} />
        </ArchivePanel>
      </div>
    </article>
  );
}
function PlaceArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  return (
    <article className="archive-page archive-place">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Lieux › {entry.title}
      </div>

      <header className="archive-header place-header">
        <div>
          <h1>{entry.title}</h1>
          <div className="archive-subtitle">
            ⌖ {entry.subtitle || 'Lieu majeur'}
          </div>
        </div>
        <div className="archive-compass">
          N<br />✦<br />S
        </div>
      </header>

      <div className="place-map-frame">
      <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
      </div>

      <div className="archive-grid four">
        <ArchivePanel title="Description" icon="✎" className="span-two">
          <p>{entry.shortSummary || firstParagraph(entry.body)}</p>
          {entry.body && <p>{entry.body}</p>}
        </ArchivePanel>

        <ArchivePanel title="Région" icon="✥">
          <p>{entry.region || entry.currentLocation || 'Région inconnue.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Population" icon="☷">
          <p>{entry.population || 'Population non documentée.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Quartiers" icon="▣">
          <ArchiveList items={entryLines(entry, 'districts')} />
        </ArchivePanel>

        <ArchivePanel title="Points d’intérêt" icon="●">
          <ArchiveList items={entryLines(entry, 'pointsOfInterest')} />
        </ArchivePanel>

        <ArchivePanel title="Histoire du lieu" icon="⌛">
          <p>{entry.historicalContext || 'Histoire non documentée.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Rumeurs locales" icon="☷">
          <ArchiveList items={entryLines(entry, 'rumors', [entry.secrets])} />
        </ArchivePanel>
      </div>
    </article>
  );
}
function EventArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  return (
    <article className="archive-page archive-event">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Événements › {entry.title}
      </div>

      <header className="archive-header event-header">
        <div className="illuminated-letter">{(entry.title || 'E')[0]}</div>
        <div>
          <h1>{entry.title}</h1>
          <div className="archive-subtitle">Événement majeur</div>
        </div>
      </header>

      <div className="event-engraving">
      <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
      </div>

      <div className="archive-grid three">
        <ArchivePanel title="Date" icon="▣">
          <p>{entry.date || entry.era || 'Date inconnue.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Lieu" icon="⌖">
          <p>{entry.currentLocation || 'Lieu inconnu.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Acteurs principaux" icon="♟">
          <ArchiveList items={entryLines(entry, 'actors', [entry.owner])} />
        </ArchivePanel>

        <ArchivePanel title="Résumé historique" icon="✎" className="span-two">
          <p>{entry.shortSummary || firstParagraph(entry.body)}</p>
          {entry.body && <p>{entry.body}</p>}
        </ArchivePanel>

        <ArchivePanel title="Chronologie des faits" icon="⌛">
          <ArchiveList items={entryLines(entry, 'timeline')} />
        </ArchivePanel>

        <ArchivePanel title="Causes" icon="C">
          <ArchiveList items={entryLines(entry, 'causes', [entry.origin])} />
        </ArchivePanel>

        <ArchivePanel title="Conséquences" icon="◆">
          <ArchiveList
            items={entryLines(entry, 'consequences', [entry.campaignUse])}
          />
        </ArchivePanel>

        <ArchivePanel title="Versions contradictoires" icon="※">
          <p>{entry.secrets || 'Aucune contradiction consignée.'}</p>
        </ArchivePanel>
      </div>
    </article>
  );
}
function FactionArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  return (
    <article className="archive-page archive-faction">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Factions › {entry.title}
      </div>

      <div className="faction-layout">
        <div className="faction-banner">
        <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
        </div>

        <div className="faction-main">
          <header className="archive-header">
            <div>
              <h1>{entry.title}</h1>
              <div className="archive-subtitle">
                {entry.subtitle || 'Faction secrète'}
              </div>
            </div>
          </header>

          <div className="faction-motto">
            « {entry.motto || entry.shortSummary || 'Devise inconnue.'} »
          </div>

          <ArchivePanel title="Doctrine" icon="▣">
            <p>
              {entry.body || entry.shortSummary || 'Doctrine non documentée.'}
            </p>
          </ArchivePanel>
        </div>

        <ArchivePanel
          title="Dossier d’information"
          icon="◇"
          className="confidential-panel"
        >
          <ArchiveMetaTable
            rows={[
              ['Type', entry.subtitle || 'Faction', '◈'],
              ['Taille', entry.size, '☷'],
              ['Influence', entry.influence || entry.campaignUse, '✥'],
              ['Statut', entry.status, '⬟'],
              ['Niveau de secret', entry.secrecy || entry.secrets, '▣'],
            ]}
          />
          <div className="confidential-stamp">CONFIDENTIEL</div>
        </ArchivePanel>
      </div>

      <div className="archive-grid three">
        <ArchivePanel title="Hiérarchie" icon="♛">
          <ArchiveList items={entryLines(entry, 'hierarchy', [entry.owner])} />
        </ArchivePanel>

        <ArchivePanel title="Territoires" icon="⌖">
          <ArchiveList
            items={entryLines(entry, 'territories', [entry.currentLocation])}
          />
        </ArchivePanel>

        <ArchivePanel title="Alliés" icon="☷">
          <ArchiveList items={entryLines(entry, 'allies')} />
        </ArchivePanel>

        <ArchivePanel title="Ennemis" icon="⚔">
          <ArchiveList items={entryLines(entry, 'enemies')} />
        </ArchivePanel>

        <ArchivePanel title="Ressources" icon="▰">
          <ArchiveList items={entryLines(entry, 'resources')} />
        </ArchivePanel>

        <ArchivePanel title="Secrets" icon="▣">
          <p>{entry.secrets || 'Aucun secret consigné.'}</p>
        </ArchivePanel>
      </div>
    </article>
  );
}
function DocumentArchivePage({
  entry,
  img,
  campaigns,
  onUploadImage,
  onPolish,
  busy,
}) {
  return (
    <article className="archive-page archive-document">
      <ArchiveTopActions
        entry={entry}
        onUploadImage={onUploadImage}
        onPolish={onPolish}
        busy={busy}
      />

      <div className="archive-breadcrumb">
        Bibliothèque › Documents › {entry.title}
      </div>

      <header className="archive-header">
        <div>
          <h1>{entry.title}</h1>
          <div className="archive-subtitle">
            ▧ {entry.subtitle || 'Document trouvé'}
          </div>
        </div>
      </header>

      <div className="document-layout">
        <div className="document-scan">
        <ArchiveHeroImage
  img={img}
  entry={entry}
  variant="..."
  onUploadImage={onUploadImage}
/>
        </div>

        <ArchivePanel title="Cote d’archivage" icon="▣">
          <ArchiveMetaTable
            rows={[
              ['Type', entry.subtitle || 'Document', '▧'],
              ['Classification', entry.classification, '◈'],
              ['Support', entry.materials || entry.tags?.join(', '), '▰'],
              ['État', entry.condition, '⬟'],
              ['Langue', entry.language, '☷'],
            ]}
          />
        </ArchivePanel>
      </div>

      <div className="archive-grid three">
        <ArchivePanel title="Transcription" icon="✎" className="span-two">
          <p>{entry.body || entry.shortSummary || 'Aucune transcription.'}</p>
        </ArchivePanel>

        <ArchivePanel title="Découverte" icon="✥">
          <ArchiveMetaTable
            rows={[
              ['Lieu', entry.currentLocation, '⌖'],
              ['Découvert par', entry.owner, '☷'],
              ['Date', entry.date || entry.era, '⌛'],
            ]}
          />
        </ArchivePanel>

        <ArchivePanel title="Authenticité" icon="⬟">
          <p>
            {entry.authenticity || entry.secrets || 'Authenticité non évaluée.'}
          </p>
        </ArchivePanel>

        <ArchivePanel title="Liens narratifs" icon="◆" className="span-two">
          <CampaignMentionList entry={entry} campaigns={campaigns} />
        </ArchivePanel>
      </div>
    </article>
  );
}
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
function Party({ state, dispatch, party, universe, flash }) {
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <h1 className="view">The Party</h1>
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
function Bestiary({
  dispatch,
  state,
  universe,
  npcs,
  party,
  campaigns,
  flash,
}) {
  const { ai } = useContext(AIContext);

  const [mode, setMode] = useState('npc'); // "npc" | "monster"

  const [f, setF] = useState({
    name: '',
    function: '',
    ancestry: '',
    role: '',
    difficulty: 'moderate',
    backstory: '',
    notes: '',
    sceneIds: [],
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const lvl = party[0]?.level || 3;
  const size = party.length || 4;

  const sceneOptions = campaigns.flatMap((c) =>
    (c.scenes || []).map((sc) => ({
      id: sc.id,
      label: `${c.title} → ${sc.title}`,
      campaignId: c.id,
      campaignTitle: c.title,
      sceneTitle: sc.title,
    }))
  );

  function toggleScene(sceneId) {
    set(
      'sceneIds',
      f.sceneIds.includes(sceneId)
        ? f.sceneIds.filter((id) => id !== sceneId)
        : [...f.sceneIds, sceneId]
    );
  }

  async function generate() {
    setBusy(true);
    setErr('');

    try {
      const d = await callAI(ai, {
        system: `You are a D&D 5e / TTRPG creature and NPC designer.
  
  Respond with ONLY valid JSON, no prose, no Markdown fences.
  
  LANGUAGE RULES:
  - All descriptions, backstories, actions, traits, loot, effects and roleplay notes must be in French.
  - Names may be fantasy names.
  - Dialogue style, voice, motivations and personality must fit the universe.
  - If the subject is a goblin, it can sound nervous, opportunistic and hesitant.
  - If serpentine, it may lightly stretch some “s”.
  - If frog-like, occasional “croa” is allowed, without exaggeration.
  - Avoid making every verbal tic a gimmick.
  
  DESIGN RULES:
  - NPCs may have stats, but their personality, function, secrets, voice and scene usefulness matter most.
  - Monsters need clear combat information: stats, skills, actions, bonus actions/reactions if relevant, tactics, effects/buffs, limited-use resources.
  - Loot should be rare and modest. It can be mundane, funny, damaged, useless, personal, or story-relevant. Avoid powerful rewards unless strongly justified.
  - Loot tables should use roll ranges such as "1-5", "6-14", "15-19", "20".`,
        prompt: `Universe: ${universe.name}
  Tone: ${universe.tone}
  Canon: ${universe.lore}
  
  Party: ${size} heroes around level ${lvl}.
  
  Create this as a ${mode === 'npc' ? 'NPC' : 'MONSTER'}.
  
  User-provided rough notes:
  Name: ${f.name || 'not specified'}
  Function / job / purpose: ${f.function || 'not specified'}
  Ancestry / creature type: ${f.ancestry || 'not specified'}
  Role: ${f.role || 'not specified'}
  Difficulty: ${f.difficulty}
  Backstory invented on the fly: ${f.backstory || 'not specified'}
  Messy notes / constraints / things players invented: ${
    f.notes || 'not specified'
  }
  
  JSON:
  {
    "entityType": "${mode}",
    "name": str,
    "kind": str,
    "role": str,
    "faction": str,
    "attitude": "hostile"|"neutral"|"friendly"|"fearful"|"manipulative"|"unknown",
    "function": str,
    "backstory": str,
    "description": str,
    "shortDescription": str,
    "voice": str,
    "speechPatterns": str,
    "motivation": str,
    "secret": str,
    "sceneUse": str,
  
    "cr": str,
    "ac": num,
    "hp": num,
    "speed": str,
  
    "str": num,
    "dex": num,
    "con": num,
    "int": num,
    "wis": num,
    "cha": num,
  
    "skills": [
      {
        "name": str,
        "bonus": str,
        "desc": str
      }
    ],
  
    "saves": [
      {
        "name": str,
        "bonus": str
      }
    ],
  
    "traits": [
      {
        "name": str,
        "desc": str
      }
    ],
  
    "actions": [
      {
        "name": str,
        "type": "action"|"bonus action"|"reaction"|"legendary action"|"lair action",
        "ability": "str"|"dex"|"con"|"int"|"wis"|"cha",
        "attackBonus": num,
        "damageDice": str,
        "damageBonus": num,
        "damageType": str,
        "range": str,
        "desc": str,
        "save": str,
        "usesMax": num,
        "usesLeft": num,
        "reset": "round"|"turn"|"short rest"|"long rest"|"day"|"encounter"|"none"
      }
    ],
  
    "effects": [
      {
        "name": str,
        "icon": str,
        "short": str,
        "desc": str,
        "active": false,
        "usesMax": num,
        "usesLeft": num,
        "reset": "round"|"turn"|"short rest"|"long rest"|"day"|"encounter"|"none"
      }
    ],
  
    "tactics": str,
  
    "lootTable": [
      {
        "roll": str,
        "item": str,
        "desc": str,
        "rarity": "mundane"|"funny"|"damaged"|"clue"|"minor"|"valuable"|"magical"
      }
    ]
  }`,
      });

      const entity = {
        id: uid(),
        createdAt: now(),
        ...d,
        entityType: mode,
        isMonster: mode === 'monster',
        linkedSceneIds: f.sceneIds,
        sourceNotes: f.notes,
      };

      dispatch({
        type: 'ADD_NPC',
        n: entity,
      });

      flash(`${entity.name} ajouté au bestiaire`);

      setF({
        name: '',
        function: '',
        ancestry: '',
        role: '',
        difficulty: f.difficulty,
        backstory: '',
        notes: '',
        sceneIds: [],
      });
    } catch (e) {
      setErr(e.message);
    }

    setBusy(false);
  }

  const shown = npcs;

  return (
    <>
      <h1 className="view">Bestiary</h1>
      <p className="sub">
        Crée des PNJ ou des monstres séparément. Les PNJ servent surtout au
        rôleplay, aux scènes et aux dialogues. Les monstres servent aux
        encounters, au combat, aux actions, aux effets activables et au loot.
      </p>

      <div className="panel bestiary-forge-panel">
        <div className="bestiary-toggle">
          <button
            type="button"
            data-on={mode === 'npc' ? 1 : 0}
            onClick={() => setMode('npc')}
          >
            PNJ
          </button>

          <button
            type="button"
            data-on={mode === 'monster' ? 1 : 0}
            onClick={() => setMode('monster')}
          >
            Monstre
          </button>
        </div>

        <div className="row">
          <Field label={mode === 'npc' ? 'Nom du PNJ' : 'Nom du monstre'}>
            <input
              className="in"
              value={f.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={
                mode === 'npc'
                  ? 'ex. Mira la passeuse'
                  : 'ex. Gribble Scrappy Shank'
              }
            />
          </Field>

          <Field
            label={mode === 'npc' ? 'Fonction / rôle social' : 'Type / espèce'}
          >
            <input
              className="in"
              value={f.function}
              onChange={(e) => set('function', e.target.value)}
              placeholder={
                mode === 'npc'
                  ? 'aubergiste, garde, noble, enfant témoin...'
                  : 'gobelin, orc, abomination fongique...'
              }
            />
          </Field>
        </div>

        <div className="row">
          <Field label="Origine / nature">
            <input
              className="in"
              value={f.ancestry}
              onChange={(e) => set('ancestry', e.target.value)}
              placeholder="humain, demi-elfe, gobelin, esprit ancien, créature aquatique..."
            />
          </Field>

          <Field
            label={mode === 'npc' ? 'Utilité dans l’histoire' : 'Rôle combat'}
          >
            <input
              className="in"
              value={f.role}
              onChange={(e) => set('role', e.target.value)}
              placeholder={
                mode === 'npc'
                  ? 'indice de quête, suspect, allié fragile...'
                  : 'brute, skirmisher, controller, boss...'
              }
            />
          </Field>
        </div>

        <div className="row">
          <Field
            label={mode === 'npc' ? 'Complexité / dangerosité' : 'Difficulté'}
          >
            <select
              className="in"
              value={f.difficulty}
              onChange={(e) => set('difficulty', e.target.value)}
            >
              {['trivial', 'easy', 'moderate', 'hard', 'deadly', 'boss'].map(
                (d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Associer à des scènes">
            <div className="scene-link-box">
              {sceneOptions.length === 0 ? (
                <span>Aucune scène disponible.</span>
              ) : (
                sceneOptions.slice(0, 12).map((sc) => (
                  <button
                    type="button"
                    key={sc.id}
                    data-on={f.sceneIds.includes(sc.id) ? 1 : 0}
                    onClick={() => toggleScene(sc.id)}
                  >
                    {sc.label}
                  </button>
                ))
              )}
            </div>
          </Field>
        </div>

        <Field label="Backstory / ce que tu as inventé sur le fly">
          <textarea
            className="in"
            rows={3}
            value={f.backstory}
            onChange={(e) => set('backstory', e.target.value)}
            placeholder="Ex. Les joueurs ont décidé qu’il connaissait leur ancien mentor. Il ment peut-être, mais il semble sincère..."
          />
        </Field>

        <Field label="Notes libres pêle-mêle">
          <textarea
            className="in"
            rows={4}
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={
              mode === 'npc'
                ? 'Traits, secrets, contradictions, accent, liens avec la scène, comportement...'
                : 'Attaques souhaitées, ambiance, faiblesse, loot drôle possible, danger approximatif...'
            }
          />
        </Field>

        <div className="faint" style={{ fontSize: 12, marginBottom: 14 }}>
          Équilibré autour de {size} héros au niveau {lvl}. Tu peux laisser
          plusieurs champs vides : les notes libres suffisent.
        </div>

        <button
          className="btn primary"
          disabled={
            busy || (!f.name.trim() && !f.function.trim() && !f.notes.trim())
          }
          onClick={generate}
        >
          {busy ? (
            <>
              <Spin /> Génération…
            </>
          ) : mode === 'npc' ? (
            '✦ Générer le PNJ'
          ) : (
            '✦ Générer le monstre'
          )}
        </button>

        {err && (
          <div style={{ color: 'var(--blood)', marginTop: 12, fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>

      <div className="eyebrow">Fiches créées</div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="big">Le bestiaire est vide</div>
          <p className="muted">
            Crée un PNJ ou un monstre avec le formulaire ci-dessus.
          </p>
        </div>
      ) : (
        <div className="grid cols-2">
          {shown.map((n) => (
            <StatBlockCard
              key={n.id}
              n={n}
              state={state}
              dispatch={dispatch}
              campaigns={campaigns}
              flash={flash}
            />
          ))}
        </div>
      )}
    </>
  );
}
function StatBlockCard({ n, state, dispatch, campaigns, flash }) {
  const [open, setOpen] = useState(false);

  const mod = (v) => {
    const m = Math.floor(((Number(v) || 10) - 10) / 2);
    return (m >= 0 ? '+' : '') + m;
  };

  const isMonster = n.entityType === 'monster' || n.isMonster;
  const portraitTargetType = isMonster ? 'creature' : 'npc';

  const portrait =
    getPrimaryAsset(state, portraitTargetType, n.id) ||
    getPrimaryAsset(state, isMonster ? 'npc' : 'creature', n.id);

  async function uploadPortrait(file) {
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);

      dispatch({
        type: 'ADD_ASSET',
        asset: {
          id: uid(),
          name: file.name,
          category: portraitTargetType,
          targetType: portraitTargetType,
          targetId: n.id,
          dataUrl,
          source: 'upload',
          prompt: '',
          createdAt: now(),
        },
      });

      flash('Portrait assigné à la fiche.');
    } catch (e) {
      flash(e.message);
    }
  }
  const linkedScenes = getLinkedSceneLabels(n.linkedSceneIds || [], campaigns);

  function updateEffect(index, patch) {
    const effects = [...(n.effects || [])];
    effects[index] = { ...effects[index], ...patch };

    dispatch({
      type: 'UPDATE_NPC',
      id: n.id,
      patch: { effects },
    });
  }

  function spendActionUse(index, delta) {
    const actions = [...(n.actions || [])];
    const action = actions[index];

    if (!action) return;

    const max = Number(action.usesMax || 0);
    const current = Number(action.usesLeft ?? max);

    actions[index] = {
      ...action,
      usesLeft: Math.max(0, Math.min(max, current + delta)),
    };

    dispatch({
      type: 'UPDATE_NPC',
      id: n.id,
      patch: { actions },
    });
  }

  return (
    <div className="panel statblock bestiary-card">
      <div className="card-h">
        <div style={{ display: 'flex', gap: 12 }}>
          {portrait?.dataUrl ? (
            <img
              src={portrait.dataUrl}
              alt={n.name}
              className="scene-mini-portrait"
              style={{ width: 54, height: 54 }}
              onClick={() =>
                window.open(portrait.dataUrl, '_blank', 'noopener,noreferrer')
              }
            />
          ) : (
            <PortraitToken seed={n.name + n.kind} size={54} />
          )}

          <div>
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
            <div
              className="muted"
              style={{ fontSize: 12, fontStyle: 'italic' }}
            >
              {isMonster ? 'Monstre' : 'PNJ'} · {n.kind || 'nature inconnue'} ·{' '}
              {n.role || 'rôle non défini'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn ghost sm"
            style={{ flex: 'none' }}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Réduire' : 'Fiche'}
          </button>

          <button
            className="btn ghost sm danger"
            style={{ flex: 'none' }}
            onClick={() => {
              if (confirm('Supprimer ' + n.name + ' ?')) {
                dispatch({ type: 'DELETE_NPC', id: n.id });
              }
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {n.shortDescription && (
        <p
          className="muted"
          style={{ fontSize: 13, lineHeight: 1.45, marginTop: 10 }}
        >
          {n.shortDescription}
        </p>
      )}

      {linkedScenes.length > 0 && (
        <div className="linked-scene-chips">
          {linkedScenes.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 10, gap: 16, fontSize: 12.5 }}>
        <span>
          <b className="muted">CR</b> {n.cr || '—'}
        </span>
        <span>
          <b className="muted">AC</b> {n.ac || '—'}
        </span>
        <span>
          <b className="muted">HP</b> {n.hp || '—'}
        </span>
        <span>
          <b className="muted">Speed</b> {n.speed || '—'}
        </span>
      </div>

      <div className="abil">
        {[
          ['STR', n.str],
          ['DEX', n.dex],
          ['CON', n.con],
          ['INT', n.int],
          ['WIS', n.wis],
          ['CHA', n.cha],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="ab">{v || 10}</div>
            <div className="lbl">
              {l} {mod(v)}
            </div>
          </div>
        ))}
      </div>

      {!open && (
        <div className="faint" style={{ fontSize: 12, marginTop: 12 }}>
          {isMonster
            ? 'Les actions, effets et loot sont dans la fiche détaillée.'
            : 'La voix, le secret et les notes de rôleplay sont dans la fiche détaillée.'}
        </div>
      )}

      {open && (
        <div className="bestiary-detail">
          {!isMonster && (
            <>
              <BestiarySection title="Rôleplay">
                <p>
                  <b>Fonction :</b> {n.function || '—'}
                </p>
                <p>
                  <b>Voix :</b> {n.voice || '—'}
                </p>
                <p>
                  <b>Tics / style :</b> {n.speechPatterns || '—'}
                </p>
                <p>
                  <b>Attitude :</b> {n.attitude || '—'}
                </p>
                <p>
                  <b>Motivation :</b> {n.motivation || '—'}
                </p>
                <p>
                  <b>Secret :</b> {n.secret || '—'}
                </p>
                <p>
                  <b>Utilité en scène :</b> {n.sceneUse || '—'}
                </p>
              </BestiarySection>

              {n.backstory && (
                <BestiarySection title="Backstory">
                  <p>{n.backstory}</p>
                </BestiarySection>
              )}
            </>
          )}

          {isMonster && (
            <>
              <BestiarySection title="Tactiques">
                <p>{n.tactics || 'Aucune tactique définie.'}</p>
              </BestiarySection>

              <BestiarySection title="Skills">
                {(n.skills || []).length === 0 ? (
                  <p>Aucune compétence spéciale.</p>
                ) : (
                  (n.skills || []).map((s, i) => (
                    <div className="bestiary-line" key={i}>
                      <b>
                        {s.name} {s.bonus || ''}
                      </b>
                      <span>{s.desc}</span>
                    </div>
                  ))
                )}
              </BestiarySection>
            </>
          )}

          {(n.traits || []).length > 0 && (
            <BestiarySection title="Traits">
              {n.traits.map((t, i) => (
                <div className="bestiary-line" key={i}>
                  <b>{t.name}</b>
                  <span>{t.desc}</span>
                </div>
              ))}
            </BestiarySection>
          )}

          {(n.actions || []).length > 0 && (
            <BestiarySection title="Actions de combat">
              {n.actions.map((a, i) => (
                <ActionCard
                  key={i}
                  action={a}
                  onSpend={() => spendActionUse(i, -1)}
                  onRestore={() => spendActionUse(i, +1)}
                />
              ))}
            </BestiarySection>
          )}

          {(n.effects || []).length > 0 && (
            <BestiarySection title="Effets / buffs activables">
              {n.effects.map((effect, i) => (
                <EffectCard
                  key={i}
                  effect={effect}
                  onToggle={() => updateEffect(i, { active: !effect.active })}
                  onSpend={() =>
                    updateEffect(i, {
                      usesLeft: Math.max(
                        0,
                        Number(effect.usesLeft ?? effect.usesMax ?? 0) - 1
                      ),
                    })
                  }
                  onRestore={() =>
                    updateEffect(i, {
                      usesLeft: Math.min(
                        Number(effect.usesMax || 0),
                        Number(effect.usesLeft ?? effect.usesMax ?? 0) + 1
                      ),
                    })
                  }
                />
              ))}
            </BestiarySection>
          )}

          <BestiarySection title="Loot">
            <LootTable lootTable={n.lootTable || []} />
          </BestiarySection>

          <div className="faint" style={{ fontSize: 12, marginTop: 12 }}>
            Ajout au combat : Combat → Add from bestiary.
          </div>
        </div>
      )}
    </div>
  );
}
function BestiarySection({ title, children }) {
  return (
    <div className="bestiary-section">
      <div className="bestiary-section-title">{title}</div>
      {children}
    </div>
  );
}

function ActionCard({ action, onSpend, onRestore }) {
  const max = Number(action.usesMax || 0);
  const left = Number(action.usesLeft ?? max);
  const hasUses = max > 0;

  return (
    <div className="action-card">
      <div className="action-card-head">
        <div>
          <b>{action.name}</b>
          <span>
            {action.type || 'action'}
            {action.reset && action.reset !== 'none'
              ? ` · reset: ${action.reset}`
              : ''}
          </span>
        </div>

        {hasUses && (
          <div className="use-tracker">
            <button type="button" onClick={onSpend}>
              −
            </button>
            <span>
              {left}/{max}
            </span>
            <button type="button" onClick={onRestore}>
              +
            </button>
          </div>
        )}
      </div>

      <div className="action-card-body">
        {action.attack && (
          <p>
            <b>Attaque :</b> {action.attack}
          </p>
        )}
        {action.range && (
          <p>
            <b>Portée :</b> {action.range}
          </p>
        )}
        {action.damage && (
          <p>
            <b>Dégâts :</b> {action.damage}
          </p>
        )}
        {action.save && (
          <p>
            <b>Save :</b> {action.save}
          </p>
        )}
        <p>{action.desc}</p>
      </div>
    </div>
  );
}

function EffectCard({ effect, onToggle, onSpend, onRestore }) {
  const max = Number(effect.usesMax || 0);
  const left = Number(effect.usesLeft ?? max);
  const hasUses = max > 0;

  return (
    <div className="effect-card" data-active={effect.active ? 1 : 0}>
      <button type="button" className="effect-toggle" onClick={onToggle}>
        <span className="effect-icon">{effect.icon || '✦'}</span>

        <span className="effect-main">
          <b>{effect.name}</b>
          <small>{effect.short || 'Effet spécial'}</small>
        </span>

        <span className="effect-state">{effect.active ? 'ON' : 'OFF'}</span>
      </button>

      <p>{effect.desc}</p>

      {hasUses && (
        <div className="use-tracker effect-uses">
          <button type="button" onClick={onSpend}>
            −
          </button>
          <span>
            {left}/{max}{' '}
            {effect.reset && effect.reset !== 'none' ? `· ${effect.reset}` : ''}
          </span>
          <button type="button" onClick={onRestore}>
            +
          </button>
        </div>
      )}
    </div>
  );
}

function LootTable({ lootTable }) {
  if (!lootTable || lootTable.length === 0) {
    return (
      <p className="muted">
        Aucun loot évident. Peut-être rien, ou seulement des objets banals sans
        valeur.
      </p>
    );
  }

  return (
    <div className="loot-table">
      {lootTable.map((l, i) => (
        <div className="loot-table-row" key={i}>
          <span className="loot-roll">{l.roll || '—'}</span>

          <div>
            <b>{l.item}</b>
            <p>{l.desc}</p>
            {l.rarity && <small>{l.rarity}</small>}
          </div>
        </div>
      ))}
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
function Encounter({ dispatch, state, party, npcs, flash }) {
  const c = state.combat || { combatants: [], round: 1 };
  const [dmg, setDmg] = useState({});
  const [infoModal, setInfoModal] = useState(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [mapMode, setMapMode] = useState('move');

  const setC = (patch) => dispatch({ type: 'COMBAT_SET', patch });

  const combatants = c.combatants || [];
  const blockedCells = c.blockedCells || [];

  const sorted = [...combatants].sort(
    (a, b) => (Number(b.init) || 0) - (Number(a.init) || 0)
  );
  const turnIndex = Number(c.turnIndex || 0);
  const activeCombatant = sorted.length
    ? sorted[Math.min(turnIndex, sorted.length - 1) % sorted.length]
    : null;

  function update(id, patch) {
    setC({
      combatants: combatants.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
  }

  function remove(id) {
    setC({
      combatants: combatants.filter((x) => x.id !== id),
    });
  }

  function addCombatant(source, isPC) {
    const combatant = isPC
      ? buildPcCombatant(source)
      : buildNpcCombatant(source);

    setC({
      combatants: [...combatants, combatant],
    });

    flash(`${combatant.name} ajouté au combat`);
  }

  function addBlank() {
    setC({
      combatants: [
        ...combatants,
        {
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
        },
      ],
    });
  }

  function applyHp(id, sign) {
    const v = parseInt(dmg[id], 10);
    if (!v) return;

    const t = combatants.find((x) => x.id === id);
    if (!t) return;

    update(id, {
      hp: Math.max(0, Math.min(t.maxHp, t.hp - sign * v)),
    });

    setDmg((d) => ({ ...d, [id]: '' }));
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

    update(id, { effects });
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

    update(id, { effects });
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

    update(id, { attacks });
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

    update(id, {
      token: {
        ...(combatants.find((t) => t.id === id)?.token || {}),
        x,
        y,
      },
    });
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
    setC({
      round: c.round + 1,
      turnIndex: 0,
      combatants: refreshRoundResources(combatants),
    });
  }

  function advanceTurn() {
    if (!sorted.length) return;

    const nextIndex = (turnIndex + 1) % sorted.length;
    const wrapsToNextRound = nextIndex === 0;

    setC({
      turnIndex: nextIndex,
      round: wrapsToNextRound ? Number(c.round || 1) + 1 : c.round,
      combatants: wrapsToNextRound
        ? refreshRoundResources(combatants)
        : combatants,
    });
  }

  const dmStrategy = buildCombatStrategy(sorted, {
    round: c.round,
    activeCombatant,
    blockedCells,
  });

  return (
    <>
      <h1 className="view">Combat</h1>
      <p className="sub">
        Suivi d’initiative, HP, attaques, buffs/malus, ressources limitées et
        positionnement tactique.
      </p>

      <div className="combat-layout-advanced">
        <main className="combat-main-col">
          <div className="panel combat-control-panel">
            <div className="row" style={{ alignItems: 'center' }}>
              <div
                style={{
                  flex: 'none',
                  fontFamily: 'Cinzel,serif',
                  fontSize: 15,
                  color: 'var(--gold-lt)',
                }}
              >
                Round {c.round}
              </div>

              <button
                className="btn sm"
                style={{ flex: 'none' }}
                onClick={resetRoundResources}
              >
                Next round ▸
              </button>

              <button
                className="btn primary sm"
                style={{ flex: 'none' }}
                onClick={advanceTurn}
              >
                Tour suivant →
              </button>

              {activeCombatant && (
                <div
                  style={{ flex: 'none', color: 'var(--muted)', fontSize: 13 }}
                >
                  Tour :{' '}
                  <b style={{ color: 'var(--gold-lt)' }}>
                    {activeCombatant.name}
                  </b>
                </div>
              )}

              <button
                className="btn ghost sm"
                style={{ flex: 'none' }}
                onClick={() => setC({ round: 1, combatants: [] })}
              >
                Reset
              </button>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <select
                className="in"
                value=""
                onChange={(e) => {
                  const p = party.find((x) => x.id === e.target.value);
                  if (p) addCombatant(p, true);
                }}
              >
                <option value="">+ Add party member…</option>
                {party.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                className="in"
                value=""
                onChange={(e) => {
                  const m = npcs.find((x) => x.id === e.target.value);
                  if (m) addCombatant(m, false);
                }}
              >
                <option value="">+ Add from bestiary…</option>
                {npcs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{' '}
                    {m.isMonster || m.entityType === 'monster'
                      ? '(monstre)'
                      : '(PNJ)'}
                  </option>
                ))}
              </select>

              <button
                className="btn"
                style={{ flex: 'none' }}
                onClick={addBlank}
              >
                + Blank
              </button>
            </div>
          </div>

          {combatants.length === 0 ? (
            <div className="empty">
              <div className="big">No combatants</div>
              <p className="muted">
                Ajoute des héros, PNJ ou monstres pour commencer.
              </p>
            </div>
          ) : (
            sorted.map((t) => (
              <CombatantRowAdvanced
                key={t.id}
                t={t}
                sourceNpc={npcs.find((n) => n.id === t.sourceId)}
                dmg={dmg[t.id] || ''}
                selected={selectedTokenId === t.id}
                onSelect={() => setSelectedTokenId(t.id)}
                onDmgChange={(v) => setDmg((d) => ({ ...d, [t.id]: v }))}
                onHit={() => applyHp(t.id, +1)}
                onHeal={() => applyHp(t.id, -1)}
                onRemove={() => remove(t.id)}
                onUpdate={(patch) => update(t.id, patch)}
                onRefreshFromSheet={() => {
                  const source = npcs.find((n) => n.id === t.sourceId);
                  if (!source) {
                    flash('Aucune fiche source trouvée pour ce combattant.');
                    return;
                  }

                  update(t.id, refreshCombatantFromNpc(t, source));
                  flash(`${t.name} réimporté depuis sa fiche.`);
                }}
                onToggleEffect={(index) => toggleEffect(t.id, index)}
                onEffectUses={(index, delta) =>
                  changeEffectUses(t.id, index, delta)
                }
                onActionUses={(index, delta) =>
                  changeActionUses(t.id, index, delta)
                }
                onInfo={setInfoModal}
              />
            ))
          )}
        </main>

        <aside className="combat-side-col">
          <div className="panel combat-map-panel">
            <div className="combat-panel-head">
              <div>
                <b>Mini-map</b>
                <span>1 case = 5 ft.</span>
              </div>
            </div>

            <div className="combat-map-tools">
              <button
                type="button"
                data-on={mapMode === 'move' ? 1 : 0}
                onClick={() => setMapMode('move')}
              >
                Déplacer
              </button>

              <button
                type="button"
                data-on={mapMode === 'block' ? 1 : 0}
                onClick={() => setMapMode('block')}
              >
                Blocants
              </button>

              <button type="button" onClick={() => setC({ blockedCells: [] })}>
                Effacer blocants
              </button>
            </div>

            <p className="combat-map-help">
              Mode Déplacer : sélectionne un jeton, puis clique une case. Mode
              Blocants : clique les cases à rendre inaccessibles pour tracer
              murs, couloirs, salles ou obstacles.
            </p>

            <CombatMiniMap
              combatants={combatants}
              selectedTokenId={selectedTokenId}
              blockedCells={blockedCells}
              mode={mapMode}
              onSelect={setSelectedTokenId}
              onMove={moveToken}
              onToggleBlocked={toggleBlockedCell}
            />
          </div>

          <div className="panel dm-strategy-panel">
            <div className="combat-panel-head">
              <div>
                <b>Stratégie MJ</b>
                <span>Rappels tactiques, effets, capacités et règles</span>
              </div>
            </div>

            <DmStrategyPanel strategy={dmStrategy} />
          </div>
        </aside>
      </div>

      {infoModal && (
        <CombatInfoModal info={infoModal} onClose={() => setInfoModal(null)} />
      )}
    </>
  );
}
function CombatantRowAdvanced({
  t,
  sourceNpc,
  dmg,
  selected,
  onSelect,
  onDmgChange,
  onHit,
  onHeal,
  onRemove,
  onUpdate,
  onRefreshFromSheet,
  onToggleEffect,
  onEffectUses,
  onActionUses,
  onInfo,
}) {
  const pct = Math.round(
    (Number(t.hp || 0) / Math.max(1, Number(t.maxHp || 1))) * 100
  );
  const col =
    pct > 50 ? 'var(--verdant)' : pct > 20 ? 'var(--ember)' : 'var(--blood)';
  const calc = getCombatantDerivedStats(t);
  const [editing, setEditing] = useState(false);

  function updateAttack(index, patch) {
    const attacks = [...(t.attacks || [])];

    attacks[index] = {
      ...attacks[index],
      ...patch,
    };

    onUpdate({ attacks });
  }

  function addAttack() {
    onUpdate({
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
    onUpdate({
      attacks: (t.attacks || []).filter((_, i) => i !== index),
    });
  }

  return (
    <div
      className={'combatant-advanced ' + (t.isPC ? 'pc' : 'enemy')}
      data-selected={selected ? 1 : 0}
      onClick={onSelect}
    >
      <div className="combatant-topline">
        <input
          className="mini combat-init"
          value={t.init}
          onChange={(e) => onUpdate({ init: Number(e.target.value) || 0 })}
          onClick={(e) => e.stopPropagation()}
        />

        <PortraitToken seed={t.name + (t.kind || '')} size={42} />

        <div className="combatant-name-block">
          <div>
            <b>{t.name}</b>
            {t.isPC ? (
              <span className="combat-type-badge pc">PJ</span>
            ) : (
              <span className="combat-type-badge enemy">MENACE</span>
            )}
          </div>

          <span>
            AC {calc.ac} · HP {t.hp}/{t.maxHp} · Speed {t.speed || '30 ft.'}
          </span>

          <div className="hpbar combat-hpbar">
            <i style={{ width: pct + '%', background: col }} />
          </div>
        </div>

        <div className="combat-hp-tools" onClick={(e) => e.stopPropagation()}>
          <input
            className="mini"
            value={dmg}
            onChange={(e) => onDmgChange(e.target.value)}
          />

          <button
            className="btn ghost sm"
            style={{ flex: 'none' }}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Fermer' : 'Éditer'}
          </button>

          <button className="btn sm" style={{ flex: 'none' }} onClick={onHit}>
            Hit
          </button>

          <button className="btn sm" style={{ flex: 'none' }} onClick={onHeal}>
            Heal
          </button>

          {sourceNpc && (
            <button
              className="btn ghost sm"
              style={{ flex: 'none' }}
              onClick={onRefreshFromSheet}
              title="Réimporter les actions, effets, AC et stats depuis la fiche"
            >
              ↻
            </button>
          )}

          <button
            className="btn ghost sm danger"
            style={{ flex: 'none' }}
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      </div>

      {editing && (
        <CombatantEditPanel
          t={t}
          onUpdate={onUpdate}
          onUpdateAttack={updateAttack}
          onAddAttack={addAttack}
          onDeleteAttack={deleteAttack}
        />
      )}

      <div className="combatant-body">
        <CombatAttacksPanel
          combatant={t}
          derived={calc}
          onActionUses={onActionUses}
          onInfo={onInfo}
        />

        <CombatEffectsPanel
          combatant={t}
          onToggleEffect={onToggleEffect}
          onEffectUses={onEffectUses}
          onInfo={onInfo}
        />
      </div>
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

function CombatAttacksPanel({ combatant, derived, onActionUses, onInfo }) {
  const attacks = combatant.attacks || [];

  return (
    <div className="combat-subpanel">
      <div className="combat-subtitle">Attaques / actions</div>

      {attacks.length === 0 ? (
        <p className="combat-small-muted">Aucune attaque définie.</p>
      ) : (
        attacks.map((attack, i) => {
          const calc = calculateAttackLine(combatant, attack, derived);
          const max = Number(attack.usesMax || 0);
          const left = Number(attack.usesLeft ?? max);
          const hasUses = max > 0;

          return (
            <div className="combat-attack-line" key={i}>
              <div className="combat-attack-main">
                <button
                  type="button"
                  className="combat-info-dot"
                  onClick={() =>
                    onInfo({
                      title: attack.name,
                      subtitle: attack.type || 'Action',
                      body: attack.desc || 'Aucune description.',
                      rules: buildAttackRulesText(attack, calc),
                    })
                  }
                >
                  ?
                </button>

                <div>
                  <b>{attack.name}</b>
                  <span>
                    {attack.type || 'action'}
                    {attack.range ? ` · ${attack.range}` : ''}
                  </span>
                </div>
              </div>

              <div className="combat-roll-formula">
                <span>Toucher</span>
                <b>{calc.toHit}</b>
              </div>

              <div className="combat-roll-formula">
                <span>Dégâts</span>
                <b>{calc.damage}</b>
              </div>

              {hasUses && (
                <UseTracker
                  left={left}
                  max={max}
                  reset={attack.reset}
                  onSpend={() => onActionUses(i, -1)}
                  onRestore={() => onActionUses(i, +1)}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function CombatEffectsPanel({
  combatant,
  onToggleEffect,
  onEffectUses,
  onInfo,
}) {
  const effects = combatant.effects || [];

  return (
    <div className="combat-subpanel">
      <div className="combat-subtitle">Buffs / malus / ressources</div>

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
  blockedCells = [],
  mode = 'move',
  onSelect,
  onMove,
  onToggleBlocked,
}) {
  const cols = 12;
  const rows = 12;

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
    const radius = Number(token.token?.threat || 1);

    const dist = Math.max(Math.abs(tx - x), Math.abs(ty - y));
    return dist > 0 && dist <= radius;
  }

  return (
    <div className="combat-map-grid">
      {cells.map((cell) => {
        const token = tokenAt(cell.x, cell.y);
        const blocked = isBlocked(cell.x, cell.y);
        const threatened =
          selected && !blocked && isInThreatRadius(cell.x, cell.y, selected);

        return (
          <button
            key={`${cell.x}-${cell.y}`}
            type="button"
            className="combat-map-cell"
            data-threat={threatened ? 1 : 0}
            data-blocked={blocked ? 1 : 0}
            data-editing={mode === 'block' ? 1 : 0}
            onClick={() => {
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
                title={token.name}
              >
                {getInitials(token.name)}
              </span>
            )}
          </button>
        );
      })}
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
      <h1 className="view">Quest Log</h1>
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
      <h1 className="view">Conjure</h1>
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
