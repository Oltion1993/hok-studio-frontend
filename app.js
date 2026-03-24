// =====================================================
// BACKEND BASE URL — Railway Production
// =====================================================
const API_BASE = "https://hok-studio-backend-production.up.railway.app";

// =====================================================
// SUPABASE CLIENT (frontend)
// =====================================================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL  = "https://jsfsjuxzpwzgwdnbnqru.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZnNqdXh6cHd6Z3dkbmJucXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDE0MjksImV4cCI6MjA4OTAxNzQyOX0.vNTRuKEJwZ1treZ3-Aw67N4GXM0WufHm6T1VsJge39A";
const supabase      = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================
// STATE GLOBALS
// =====================================================
window.credits     = 0;
window.currentUser = null;
window.authToken   = null;

// =====================================================
// AUTH — Init & Session Management
// =====================================================
export const initAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    window.authToken   = session.access_token;
    window.currentUser = session.user;
    await loadProfile();
  }

  // Listen for auth changes (login/logout)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      window.authToken   = session.access_token;
      window.currentUser = session.user;
      await loadProfile();
    } else {
      window.authToken   = null;
      window.currentUser = null;
      window.credits     = 0;
      updateCreditsDisplay();
    }
  });

  // Check payment success from URL
  checkPaymentReturn();
};

const loadProfile = async () => {
  try {
    const res = await authFetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      window.credits = data.profile?.credits || 0;
      updateCreditsDisplay();
    }
  } catch (err) {
    console.error("Profile load failed:", err);
  }
};

const updateCreditsDisplay = () => {
  // Update all credits displays in the UI
  document.querySelectorAll("[data-credits-display]").forEach(el => {
    el.textContent = window.credits;
  });
  // Legacy IDs
  ["audCreditsAvailable","vidCreditsAvailable","imgCreditsAvailable","charCreditsAvailable"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = window.credits;
  });
};

// Check if returning from Stripe payment
const checkPaymentReturn = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "success") {
    const plan    = params.get("plan") || "";
    const credits = params.get("credits") || "";
    showPaymentSuccess(plan, credits);
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    // Refresh profile credits
    setTimeout(loadProfile, 2000);
  } else if (params.get("payment") === "cancelled") {
    showPaymentCancelled();
    window.history.replaceState({}, "", window.location.pathname);
  }
};

// =====================================================
// AUTH FETCH — adds Bearer token automatically
// =====================================================
export const authFetch = async (endpoint, options = {}) => {
  const url     = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (window.authToken) {
    headers["Authorization"] = `Bearer ${window.authToken}`;
  }

  return fetch(url, { ...options, headers });
};

// =====================================================
// MODEL → TYPE
// =====================================================
function getTypeFromModel(model) {
  if (!model) return "image";
  const m = model.toLowerCase();
  if (m.includes("runway") || m.includes("luma") || m.includes("kling")) return "video";
  if (m.includes("eleven") || m.includes("minimax") || m.includes("suno") || m.includes("audio")) return "audio";
  if (m.includes("character")) return "character";
  return "image";
}

// =====================================================
// UNIVERSAL GENERATE — with auth
// =====================================================
export async function openArtCreate({ prompt, model, file, extra = {} }) {
  if (!prompt || !model) { alert("Prompt and model are required"); return; }
  if (!window.authToken) { showLoginRequired(); return; }

  try {
    let endpoint = `/api/generate/image`;
    if (model === "runway-gen3") endpoint = `/api/runway/video`;
    else if (model === "kling")  endpoint = `/api/kling/video`;
    else if (["eleven-v2","eleven-v3","minimax-turbo","minimax-hd","suno"].includes(model))
      endpoint = `/api/generate/audio`;

    const body = {
      prompt, model,
      aspect:   extra.aspect   || "1:1",
      duration: extra.duration || "10",
      type:     getTypeFromModel(model)
    };

    const res = await authFetch(endpoint, {
      method: "POST",
      body:   JSON.stringify(body)
    });

    // Handle insufficient credits
    if (res.status === 402) {
      const err = await res.json();
      showUpgradeModal(err.required, err.available);
      return { error: "Insufficient credits", result_url: null };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || "Server error", result_url: null };
    }

    const data = await res.json();

    // Update credits after successful generation
    if (data.credits_used) {
      window.credits = Math.max(0, window.credits - data.credits_used);
      updateCreditsDisplay();
    }

    return { result_url: data.path || data.url || null, error: null };

  } catch (err) {
    return { error: "Cannot connect to server: " + err.message, result_url: null };
  }
}

// =====================================================
// STRIPE PAYMENT — Checkout
// =====================================================
export const startCheckout = async (plan) => {
  if (!window.authToken) {
    showLoginRequired();
    return;
  }

  const btn = document.querySelector(`[data-plan="${plan}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Redirecting..."; }

  try {
    const res  = await authFetch("/api/stripe/checkout", {
      method: "POST",
      body:   JSON.stringify({ plan })
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Payment error: " + (data.error || "Unknown error"));
      if (btn) { btn.disabled = false; btn.textContent = "Buy Now"; }
    }
  } catch (err) {
    alert("Payment error: " + err.message);
    if (btn) { btn.disabled = false; btn.textContent = "Buy Now"; }
  }
};

// =====================================================
// UPGRADE MODAL — shown when credits are insufficient
// =====================================================
export const showUpgradeModal = (required = 0, available = 0) => {
  const existing = document.getElementById("upgradeModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id    = "upgradeModal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  modal.innerHTML = `
    <div style="background:#0f172a;border:1px solid #334155;border-radius:20px;
                padding:36px;max-width:480px;width:100%;position:relative;
                box-shadow:0 25px 60px rgba(0,0,0,0.5);">
      <button onclick="document.getElementById('upgradeModal').remove()"
              style="position:absolute;top:16px;right:16px;background:none;border:none;
                     color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>

      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:48px;margin-bottom:12px;">⚡</div>
        <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 8px;">Credits të pamjaftueshme</h2>
        <p style="color:#94a3b8;margin:0;">
          Kjo gjenerim kërkon <strong style="color:#f87171">${required} credits</strong>.
          Ke <strong style="color:#fbbf24">${available} credits</strong>.
        </p>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        ${renderPlanCard("starter","Starter","500","$9.99","Ideal për fillestarë")}
        ${renderPlanCard("pro","Pro","1,500","$24.99","Për krijues aktivë","#6366f1",true)}
        ${renderPlanCard("studio","Studio","5,000","$69.99","Për studio profesionale")}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

const renderPlanCard = (id, name, credits, price, desc, color="#334155", featured=false) => `
  <div style="border:${featured?"2px solid #6366f1":"1px solid #334155"};border-radius:14px;
              padding:16px 20px;display:flex;align-items:center;justify-content:space-between;
              background:${featured?"rgba(99,102,241,0.1)":"transparent"};">
    <div>
      <div style="color:#f1f5f9;font-weight:600;">${name}</div>
      <div style="color:#94a3b8;font-size:13px;">${credits} credits — ${desc}</div>
    </div>
    <button data-plan="${id}" onclick="window.startCheckout('${id}')"
            style="background:${featured?"#6366f1":"#1e293b"};color:#f1f5f9;border:1px solid #475569;
                   border-radius:10px;padding:8px 18px;cursor:pointer;font-weight:600;
                   font-size:14px;white-space:nowrap;">
      ${price}
    </button>
  </div>
`;

// =====================================================
// PAYMENT SUCCESS / CANCEL notifications
// =====================================================
const showPaymentSuccess = (plan, credits) => {
  showNotification(`✅ Pagesa u krye! +${credits} credits u shtuan te llogaria jote.`, "success");
};

const showPaymentCancelled = () => {
  showNotification("❌ Pagesa u anulua. Mund të provosh përsëri kur të dëshirosh.", "error");
};

const showLoginRequired = () => {
  showNotification("🔒 Duhet të kyçesh para se të vazhdosh.", "warning");
};

export const showNotification = (message, type = "info") => {
  const colors = {
    success: "#22c55e",
    error:   "#ef4444",
    warning: "#f59e0b",
    info:    "#6366f1"
  };

  const el = document.createElement("div");
  el.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:99999;
    background:#0f172a;border:1px solid ${colors[type]};color:#f1f5f9;
    padding:14px 20px;border-radius:12px;max-width:380px;
    font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation:slideIn 0.3s ease;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
};

// Expose to window for onclick handlers
window.startCheckout    = startCheckout;
window.showUpgradeModal = showUpgradeModal;

// =====================================================
// SHOW PREVIEW
// =====================================================
export function showPreview({ type, url }) {
  if (!url) return;
  const map = { image:"previewBoxImage", audio:"previewBoxAudio", video:"previewBoxVideo", character:"previewBoxCharacter" };
  const box = document.getElementById(map[type]);
  if (!box) return;

  if (type === "image" || type === "character") {
    box.innerHTML = `<img src="${url}" style="width:100%;border-radius:12px;margin-top:12px;" crossorigin="anonymous">`;
  } else if (type === "audio") {
    box.innerHTML = `<audio controls style="width:100%;margin-top:12px;"><source src="${url}"></audio>`;
  } else if (type === "video") {
    box.innerHTML = `<video controls style="width:100%;border-radius:12px;margin-top:12px;"><source src="${url}"></video>`;
  }
}

// =====================================================
// AUDIO CREATOR
// =====================================================
export const initAudioCreator = () => {
  const creditsEl = document.getElementById("audCreditsAvailable");
  const costEl    = document.getElementById("audCreditsCost");
  const modelEl   = document.getElementById("audModel");
  const trimEl    = document.getElementById("audTrim");
  const trimVal   = document.getElementById("audTrimValue");
  const btn       = document.getElementById("btnCreateAudio");
  const loading   = document.getElementById("audLoading");
  const preview   = document.getElementById("previewBoxAudio");
  const startEl   = document.getElementById("audStart");
  const endEl     = document.getElementById("audEnd");

  if (!btn || !trimEl) return;

  const BASE_COST = { "eleven-v2":40,"eleven-v3":50,"minimax-turbo":30,"minimax-hd":40,"suno":35 };
  const calcCost  = () => {
    const base = BASE_COST[modelEl?.value] || 40;
    const s    = parseInt(startEl?.value || "0", 10);
    const e    = parseInt(endEl?.value || trimEl.value || "30", 10);
    return Math.round(base * (Math.max(1, e - s) / 30));
  };

  const render = () => {
    if (creditsEl) creditsEl.textContent = window.credits || 0;
    if (costEl)    costEl.textContent    = calcCost();
    if (trimVal)   trimVal.textContent   = trimEl.value;
  };

  trimEl.addEventListener("input", render);
  modelEl?.addEventListener("change", render);
  [startEl,endEl].forEach(el => el?.addEventListener("input", render));
  render();

  btn.addEventListener("click", () => {
    if (!window.authToken) { showLoginRequired(); return; }
    const cost = calcCost();
    if ((window.credits || 0) < cost) { showUpgradeModal(cost, window.credits); return; }

    btn.disabled = true;
    if (loading) loading.style.display = "flex";

    openArtCreate({ prompt: document.getElementById("audPrompt")?.value, model: modelEl?.value })
      .then(result => {
        btn.disabled = false;
        if (loading) loading.style.display = "none";
        if (result?.result_url && preview) {
          preview.innerHTML = `<audio controls style="width:100%;"><source src="${API_BASE}${result.result_url}"></audio>`;
        } else if (preview) {
          preview.innerHTML = `<div style="padding:12px;border:1px solid #f87171;border-radius:12px;background:#020617;color:#f87171;">❌ ${result?.error || "Failed"}</div>`;
        }
      });
  });
};

// =====================================================
// CHARACTER CREATOR
// =====================================================
export const initCharacterCreator = () => {
  const modelEl   = document.getElementById("charModel");
  const btn       = document.getElementById("btnCreateCharacter");
  const camBtn    = document.getElementById("btnCharOpenCamera");
  const camBox    = document.getElementById("charCameraBox");
  const camVideo  = document.getElementById("charCameraVideo");
  const camCanvas = document.getElementById("charCameraCanvas");
  const camSnap   = document.getElementById("btnCharTakePhoto");
  const fileInput = document.getElementById("charFile");

  if (!btn) return;

  const BASE_COST = { "runway":200,"flux":12,"luma-ray":180,"kling":160,"sdxl":16 };
  const calcCost  = () => BASE_COST[modelEl?.value] ?? 20;
  const render    = () => {
    const el = document.getElementById("charCreditsAvailable");
    if (el) el.textContent = window.credits || 0;
    const costEl = document.getElementById("charCreditsCost");
    if (costEl) costEl.textContent = calcCost();
  };

  modelEl?.addEventListener("change", render);
  render();

  let stream = null;
  camBtn?.addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video:true });
      camVideo.srcObject = stream;
      camBox.style.display = "block";
    } catch { alert("Camera not available."); }
  });

  camSnap?.addEventListener("click", () => {
    camCanvas.width = camVideo.videoWidth; camCanvas.height = camVideo.videoHeight;
    camCanvas.getContext("2d").drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);
    camCanvas.toBlob(blob => {
      const f  = new File([blob], "char.jpg", { type:"image/jpeg" });
      const dt = new DataTransfer(); dt.items.add(f);
      if (fileInput) fileInput.files = dt.files;
      if (stream) stream.getTracks().forEach(t => t.stop());
      camBox.style.display = "none";
      alert("Photo captured ✍️");
    }, "image/jpeg", 0.95);
  });

  btn.addEventListener("click", () => {
    if (!window.authToken) { showLoginRequired(); return; }
    const cost = calcCost();
    if ((window.credits || 0) < cost) { showUpgradeModal(cost, window.credits); return; }
  });
};

// =====================================================
// VOICE SELECTOR
// =====================================================
export const initVoiceSelector = () => {
  const modal   = document.getElementById("voiceModal");
  const openBtn = document.getElementById("btnChooseVoice");
  const closeBtn= document.getElementById("closeVoiceModal");
  const list    = document.getElementById("voiceList");
  const label   = document.getElementById("audVoiceName");
  const fA = document.getElementById("filterAccent");
  const fG = document.getElementById("filterGender");
  const fAg= document.getElementById("filterAge");
  const fU = document.getElementById("filterUse");

  if (!modal || !openBtn || !list) return;

  const voices = [
    {name:"Rachel",accent:"American",gender:"Female",age:"Young",  use:"Conversational"},
    {name:"Drew",  accent:"American",gender:"Male",  age:"Middle", use:"News"},
    {name:"Clyde", accent:"American",gender:"Male",  age:"Middle", use:"Characters"},
    {name:"Aria",  accent:"American",gender:"Female",age:"Middle", use:"Narration"},
    {name:"Domi",  accent:"American",gender:"Female",age:"Young",  use:"Narration"},
  ];

  const rv = () => {
    list.innerHTML = "";
    const a=fA?.value||"", g=fG?.value||"", ag=fAg?.value||"", u=fU?.value||"";
    voices
      .filter(v => (!a||v.accent===a)&&(!g||v.gender===g)&&(!ag||v.age===ag)&&(!u||v.use===u))
      .forEach(v => {
        const d = document.createElement("div");
        d.className = "voice-item";
        d.innerHTML = `<strong>${v.name}</strong><br><small>${v.accent}·${v.gender}·${v.age}·${v.use}</small>`;
        d.onclick = () => { if (label) label.textContent = v.name; modal.style.display = "none"; };
        list.appendChild(d);
      });
  };

  openBtn.onclick  = () => { modal.style.display = "flex"; rv(); };
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = "none"; };
  [fA,fG,fAg,fU].forEach(s => s?.addEventListener("change", rv));
};

// =====================================================
// PRICING SECTION — renders plan cards
// =====================================================
export const initPricing = async () => {
  const container = document.getElementById("pricingContainer");
  if (!container) return;

  try {
    const res   = await fetch(`${API_BASE}/api/stripe/plans`);
    const data  = await res.json();
    const plans = data.plans || [];

    const icons    = { starter:"🚀", pro:"⚡", studio:"🎬" };
    const featured = { starter:false, pro:true, studio:false };

    container.innerHTML = plans.map(p => `
      <div style="border:${featured[p.id]?"2px solid #6366f1":"1px solid #334155"};
                  border-radius:18px;padding:28px;text-align:center;
                  background:${featured[p.id]?"rgba(99,102,241,0.08)":"#0f172a"};
                  position:relative;">
        ${featured[p.id] ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);
          background:#6366f1;color:white;font-size:11px;font-weight:700;padding:4px 14px;
          border-radius:20px;letter-spacing:0.5px;">MOST POPULAR</div>` : ""}
        <div style="font-size:36px;margin-bottom:10px;">${icons[p.id]||"💎"}</div>
        <h3 style="color:#f1f5f9;font-size:20px;margin:0 0 6px;">${p.name}</h3>
        <div style="color:#6366f1;font-size:32px;font-weight:700;margin:12px 0;">${p.price}</div>
        <div style="color:#94a3b8;margin-bottom:20px;">${p.credits.toLocaleString()} AI Credits</div>
        <button data-plan="${p.id}" onclick="window.startCheckout('${p.id}')"
                style="width:100%;background:${featured[p.id]?"#6366f1":"transparent"};
                       border:1px solid ${featured[p.id]?"#6366f1":"#475569"};
                       color:#f1f5f9;border-radius:12px;padding:12px;
                       font-size:15px;font-weight:600;cursor:pointer;">
          Buy ${p.name}
        </button>
      </div>
    `).join("");
  } catch (err) {
    console.error("Pricing load failed:", err);
  }
};

// =====================================================
// INIT ALL on DOMContentLoaded
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  await initAuth();
  initAudioCreator();
  initCharacterCreator();
  initVoiceSelector();
  initPricing();
});
