// =====================================================
// BASIC UI – CHIPS / VIEWS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const viewCharacters  = document.querySelector(".character-workspace");
  const viewStyles      = document.querySelector(".view-styles");
  const viewCollections = document.querySelector(".view-collections");
  const chips = document.querySelectorAll(".chip");

  const hideAll = () => {
    if (viewCharacters) viewCharacters.style.display = "none";
    if (viewStyles) viewStyles.style.display = "none";
    if (viewCollections) viewCollections.style.display = "none";
  };

  hideAll();
  if (viewCharacters) viewCharacters.style.display = "block";

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      hideAll();
      const mode = chip.innerText.trim();
      if (mode === "Characters" && viewCharacters) viewCharacters.style.display = "block";
      if (mode === "Styles" && viewStyles) viewStyles.style.display = "block";
      if (mode === "Collections" && viewCollections) viewCollections.style.display = "block";
    });
  });

  const btnSignIn = document.getElementById("btnSignIn");
  if (btnSignIn) {
    btnSignIn.addEventListener("click", () => {
      console.log("Sign in clicked");
    });
  }

  // Boot all modules
  initAudioCreator();
  initCharacterCreator();
  initVoiceSelector();
});

// =====================================================
// BACKEND BASE URL — ndrysho kete per production
// =====================================================
const API_BASE = "https://hok-studio-backend-production.up.railway.app";

// =====================================================
// MODEL → TYPE
// FIX: Nje version i vetem, i sakte (pa duplicate)
// =====================================================
function getTypeFromModel(model) {
  if (!model) return "image";
  const m = model.toLowerCase();
  if (m.includes("runway") || m.includes("luma") || m.includes("kling") || m.includes("banana")) return "video";
  if (m.includes("suno") || m.includes("music") || m.includes("audio") || m.includes("riff")) return "audio";
  if (m.includes("character")) return "character";
  return "image";
}

// MODEL → VIDEO ENDPOINT MAPPING
const VIDEO_ENDPOINTS = {
  "runway-gen3": "/api/runway/video",
  "luma-ray":    "/api/luma/video",
  "kling":       "/api/kling/video",
  "n-banana":    "/api/banana/video"
};

// =====================================================
// UNIVERSAL GENERATE
// =====================================================
async function openArtCreate({ prompt, model, file, extra = {} }) {
  if (!prompt || !model) { alert("Prompt dhe model jane te detyrueshme"); return; }

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", model);
  if (file) formData.append("file", file);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  try {
    const type = getTypeFromModel(model);
    let endpoint = `${API_BASE}/api/generate`;
    if (type === "image") endpoint = `${API_BASE}/api/generate/image`;
    if (type === "video") endpoint = `${API_BASE}${VIDEO_ENDPOINTS[model] || "/api/generate/video"}`;

    const res = await fetch(endpoint, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Backend error");

    const data = await res.json();
    console.log("CREATED:", type, data);
    showPreview({ type, url: data.url || data.outputUrl || data.path });
    return data;
  } catch (err) {
    console.error("Create failed:", err);
    alert("Generation failed");
  }
}

// =====================================================
// BUTTONS
// FIX: btnCreateImage ka vetem NJE listener (hequr generateImage duplicate)
// =====================================================
document.getElementById("btnCreateCharacter")?.addEventListener("click", () => {
  openArtCreate({
    prompt: document.getElementById("charPrompt")?.value,
    model:  document.getElementById("charModel")?.value,
    file:   document.getElementById("charFile")?.files[0]
  });
});

document.getElementById("btnCreateImage")?.addEventListener("click", () => {
  openArtCreate({
    prompt: document.getElementById("imgPrompt")?.value,
    model:  document.getElementById("imgModel")?.value,
    file:   document.getElementById("imgFile")?.files[0],
    extra:  { aspect: document.getElementById("imgAspect")?.value }
  });
});

document.getElementById("btnCreateVideo")?.addEventListener("click", () => {
  openArtCreate({
    prompt: document.getElementById("vidPrompt")?.value,
    model:  document.getElementById("vidModel")?.value,
    file:   document.getElementById("vidFile")?.files[0],
    extra:  {
      duration: document.getElementById("vidDuration")?.value,
      aspect:   document.getElementById("vidAspect")?.value
    }
  });
});

document.getElementById("btnCreateAudio")?.addEventListener("click", () => {
  openArtCreate({
    prompt: document.getElementById("audPrompt")?.value,
    model:  document.getElementById("audModel")?.value,
    file:   document.getElementById("audFile")?.files[0],
    extra:  { length: document.getElementById("audTrim")?.value }
  });
});

// =====================================================
// MODAL CLOSE
// =====================================================
document.querySelectorAll(".modal-close-char, .modal-close-img, .modal-close-vid, .modal-close-aud")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) modal.style.display = "none";
    });
  });

// =====================================================
// SHOW PREVIEW
// =====================================================
function showPreview({ type, url }) {
  if (!url) return;
  const map = { image: "previewBoxImage", audio: "previewBoxAudio", video: "previewBoxVideo", character: "previewBoxCharacter" };
  const box = document.getElementById(map[type]);
  if (!box) return;

  if (type === "image" || type === "character") {
    box.innerHTML = `<img src="${url}" style="width:100%;border-radius:12px;margin-top:12px;">`;
  } else if (type === "audio") {
    box.innerHTML = `<audio controls style="width:100%;margin-top:12px;"><source src="${url}"></audio>`;
  } else if (type === "video") {
    box.innerHTML = `<video controls style="width:100%;border-radius:12px;margin-top:12px;"><source src="${url}"></video>`;
  }
}

// =====================================================
// AUDIO CREATOR
// FIX: calcCost nuk eshte me e mbivendosur brenda vetes
// =====================================================
const initAudioCreator = () => {
  const creditsEl = document.getElementById("audCreditsAvailable");
  const costEl    = document.getElementById("audCreditsCost");
  const modelEl   = document.getElementById("audModel");
  const modeEl    = document.getElementById("audMode");
  const trimEl    = document.getElementById("audTrim");
  const trimVal   = document.getElementById("audTrimValue");
  const btn       = document.getElementById("btnCreateAudio");
  const loading   = document.getElementById("audLoading");
  const preview   = document.getElementById("previewBoxAudio");
  const fileEl    = document.getElementById("audFile");
  const startEl   = document.getElementById("audStart");
  const endEl     = document.getElementById("audEnd");
  const infoEl    = document.getElementById("audFileInfo");
  const audPrev   = document.getElementById("audFilePreview");
  const vidPrev   = document.getElementById("vidFilePreview");

  if (!creditsEl || !costEl || !modelEl || !btn || !trimEl) return;

  let credits = 600;

  const BASE_COST = {
    "eleven-v2": 5, "eleven-v3": 6,
    "minimax-turbo": 4, "minimax-hd": 5, "suno": 3
  };

  const MULTIPLIER = 4;

  // FIX: Funksion i rregullt, nuk eshte nested
  const calcCost = () => {
    const base    = BASE_COST[modelEl.value] || 4;
    const s       = parseInt(startEl?.value || "0", 10);
    const e       = parseInt(endEl?.value || trimEl.value || "30", 10);
    const seconds = Math.max(1, e - s);
    return Math.round(base * MULTIPLIER * (seconds / 10));
  };

  const renderCredits = () => {
    creditsEl.textContent = credits;
    costEl.textContent    = calcCost();
    if (trimVal) trimVal.textContent = trimEl.value;
  };

  const showFilePreview = (file) => {
    const url = URL.createObjectURL(file);
    if (audPrev) audPrev.style.display = "none";
    if (vidPrev) vidPrev.style.display = "none";

    if (file.type.startsWith("video/") && vidPrev) {
      vidPrev.src = url;
      vidPrev.style.display = "block";
      vidPrev.onloadedmetadata = () => {
        if (infoEl) infoEl.textContent = `Video length: ${Math.round(vidPrev.duration)}s`;
        if (endEl) endEl.max = endEl.value = Math.min(parseInt(endEl.value, 10), Math.floor(vidPrev.duration));
        renderCredits();
      };
    } else if (audPrev) {
      audPrev.src = url;
      audPrev.style.display = "block";
      audPrev.onloadedmetadata = () => {
        if (infoEl) infoEl.textContent = `Audio length: ${Math.round(audPrev.duration)}s`;
        if (endEl) endEl.max = Math.floor(audPrev.duration);
        renderCredits();
      };
    }
  };

  fileEl?.addEventListener("change", () => { if (fileEl.files?.[0]) showFilePreview(fileEl.files[0]); });
  [startEl, endEl].forEach(el => el?.addEventListener("input", () => {
    const s = parseInt(startEl?.value || "0", 10);
    const e = parseInt(endEl?.value   || "1", 10);
    if (e <= s && endEl) endEl.value = String(s + 1);
    renderCredits();
  }));
  trimEl.addEventListener("input", renderCredits);
  modelEl.addEventListener("change", renderCredits);
  modeEl?.addEventListener("change", renderCredits);

  btn.addEventListener("click", () => {
    const cost = calcCost();
    if (credits < cost) { alert("Not enough credits"); return; }
    credits -= cost;
    renderCredits();
    btn.disabled = true;
    if (loading) loading.style.display = "flex";
    setTimeout(() => {
      btn.disabled = false;
      if (loading) loading.style.display = "none";
      if (preview) preview.innerHTML = `
        <audio controls style="width:100%;"><source src="" /></audio>
        <p class="modal-text">Audio created (${trimEl.value}s)</p>`;
    }, 1200);
  });

  renderCredits();
};

// =====================================================
// CHARACTER CREATOR
// =====================================================
const initCharacterCreator = () => {
  const creditsEl = document.getElementById("charCreditsAvailable");
  const costEl    = document.getElementById("charCreditsCost");
  const modelEl   = document.getElementById("charModel");
  const baseEl    = document.getElementById("charBase");
  const btn       = document.getElementById("btnCreateCharacter");
  const camBtn    = document.getElementById("btnCharOpenCamera");
  const camBox    = document.getElementById("charCameraBox");
  const camVideo  = document.getElementById("charCameraVideo");
  const camCanvas = document.getElementById("charCameraCanvas");
  const camSnap   = document.getElementById("btnCharTakePhoto");
  const fileInput = document.getElementById("charFile");

  if (!creditsEl || !costEl || !modelEl || !btn) return;

  let credits = 800;
  const BASE_COST = { "veo": 120, "n-banana": 60, "sora": 100, "kling": 80, "sdxl": 50 };
  const MULTIPLIER = 4;

  const calcCost    = () => Math.round((BASE_COST[modelEl.value] ?? 80) * MULTIPLIER);
  const renderCredits = () => { creditsEl.textContent = credits; costEl.textContent = calcCost(); };

  modelEl.addEventListener("change", renderCredits);
  baseEl?.addEventListener("change", renderCredits);
  renderCredits();

  let stream = null;
  camBtn?.addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camVideo.srcObject = stream;
      camBox.style.display = "block";
    } catch { alert("Camera not available."); }
  });

  camSnap?.addEventListener("click", () => {
    camCanvas.width  = camVideo.videoWidth;
    camCanvas.height = camVideo.videoHeight;
    camCanvas.getContext("2d").drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);
    camCanvas.toBlob(blob => {
      const file = new File([blob], "character.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer(); dt.items.add(file);
      if (fileInput) fileInput.files = dt.files;
      if (stream) stream.getTracks().forEach(t => t.stop());
      camBox.style.display = "none";
      alert("Photo captured. Describe your character ✍️");
    }, "image/jpeg", 0.95);
  });

  btn.addEventListener("click", () => {
    const cost = calcCost();
    if (credits < cost) { alert("Not enough credits."); return; }
    credits -= cost;
    renderCredits();
  });
};

// =====================================================
// VOICE SELECTOR
// =====================================================
const initVoiceSelector = () => {
  const modal         = document.getElementById("voiceModal");
  const openBtn       = document.getElementById("btnChooseVoice");
  const closeBtn      = document.getElementById("closeVoiceModal");
  const list          = document.getElementById("voiceList");
  const selectedLabel = document.getElementById("audVoiceName");
  const filterAccent  = document.getElementById("filterAccent");
  const filterGender  = document.getElementById("filterGender");
  const filterAge     = document.getElementById("filterAge");
  const filterUse     = document.getElementById("filterUse");

  if (!modal || !openBtn || !list) return;

  const voices = [
    { name: "Rachel", accent: "American", gender: "Female", age: "Young",  use: "Conversational" },
    { name: "Drew",   accent: "American", gender: "Male",   age: "Middle", use: "News" },
    { name: "Clyde",  accent: "American", gender: "Male",   age: "Middle", use: "Characters" },
    { name: "Aria",   accent: "American", gender: "Female", age: "Middle", use: "Narration" },
    { name: "Domi",   accent: "American", gender: "Female", age: "Young",  use: "Narration" }
  ];

  const renderVoices = () => {
    list.innerHTML = "";
    const a = filterAccent?.value || "", g = filterGender?.value || "",
          ag = filterAge?.value  || "", u = filterUse?.value    || "";
    voices
      .filter(v => (!a || v.accent===a) && (!g || v.gender===g) && (!ag || v.age===ag) && (!u || v.use===u))
      .forEach(v => {
        const div = document.createElement("div");
        div.className = "voice-item";
        div.innerHTML = `<strong>${v.name}</strong><br><small>${v.accent} · ${v.gender} · ${v.age} · ${v.use}</small>`;
        div.onclick = () => { if (selectedLabel) selectedLabel.textContent = v.name; modal.style.display = "none"; };
        list.appendChild(div);
      });
  };

  openBtn.onclick  = () => { modal.style.display = "flex"; renderVoices(); };
  closeBtn.onclick = () => { modal.style.display = "none"; };
  [filterAccent, filterGender, filterAge, filterUse].forEach(s => s?.addEventListener("change", renderVoices));
};
