/**
 * app.js — Frontend JS Chat Logic (Enhanced with Markdown Support & Ultimate Timer Protection)
 */

"use strict";

/* =========================
   Backend API Domain
========================= */

const API_BASE = "https://jaundice-server.onrender.com";
const api = (p) => `${API_BASE}${p}`;

/* =========================
   No-login Multi-user: clientId
========================= */

const CID_KEY = "fourleaf_client_id";
let clientId = localStorage.getItem(CID_KEY);

if (!clientId) {
  clientId =
    (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(CID_KEY, clientId);
}

/* =========================
   Flutter WebView: babyId
========================= */

const BABY_ID_KEY = "babyID";
let babyId = localStorage.getItem(BABY_ID_KEY) || null;

window.setBabyId = function (id) {
  if (id && typeof id === "string" && id.trim()) {
    babyId = id.trim();
    localStorage.setItem(BABY_ID_KEY, babyId);
  }
};

// Called by the App when this session has no specific baby in context
// (e.g. clinician home page). Clears any babyId left over in localStorage
// from a previous WebView session sharing the same origin storage.
window.clearBabyId = function () {
  babyId = null;
  localStorage.removeItem(BABY_ID_KEY);
};

/* =========================
   Flutter WebView: clinicianId
========================= */

const CLINICIAN_ID_KEY = "clinicianID";
let clinicianId = localStorage.getItem(CLINICIAN_ID_KEY) || null;

window.setClinicianId = function (id) {
  if (id && typeof id === "string" && id.trim()) {
    clinicianId = id.trim();
    localStorage.setItem(CLINICIAN_ID_KEY, clinicianId);
  }
};

/* =========================
   Flutter WebView: Firebase ID Token
========================= */

let authToken = null;

window.setAuthToken = function (token) {
  if (token && typeof token === "string" && token.trim()) {
    authToken = token.trim();
  }
};

/* =========================
   DOM References
========================= */

const elMessages = document.getElementById("messages");
const elInput = document.getElementById("txtInput");
const elBtnSend = document.getElementById("btnSend");
const elThinking = document.getElementById("thinking");
const elDangerModal = document.getElementById("dangerAlertModal");
const elDangerConfirm = document.getElementById("dangerAlertConfirm");
const elTopbar = document.getElementById("topbar");
const elHeaderToggle = document.getElementById("btnHeaderToggle");

/* =========================
   Message State
========================= */

const messages = [];

/* =========================
   危險關鍵字攔截機制
   ⚠️ 清單尚未完善，目前僅供測試，之後會再擴充
========================= */

const DANGEROUS_KEYWORDS = ["抽搐", "抽筋", "痙攣", "癲癇", "抽蓄", "抽畜", "seizure", "convulsion", "全身僵硬", "全身僵直", "身體僵直", "手腳不停抖動", "全身一直抖", "手腳一直抖", "沒呼吸", "沒有呼吸", "不呼吸", "停止呼吸", "呼吸暫停", "呼吸停", "呼吸困難", "呼吸急促", "呼吸很喘", "喘不過氣", "喘很大力", "憋氣", "屏氣", "窒息", "胸口凹陷", "肋骨凹陷", "鼻翼搧動", "鼻翼煽動", "一直呻吟", "呻吟聲", "喘氣聲", "發紫", "發青", "發紺", "紫紺", "嘴唇紫", "嘴唇青", "嘴唇發黑", "臉色發青", "臉變紫", "臉色發紫", "全身發紫", "身體發紫", "全身發青", "叫不醒", "喚不醒", "很難叫醒", "喚醒不了", "叫都叫不起來", "昏睡", "昏迷", "意識不清", "沒有反應", "沒反應", "反應很差", "軟趴趴", "軟綿綿", "全身癱軟", "癱軟", "像布娃娃", "無力下垂", "眼神呆滯", "眼睛上吊", "眼球上翻", "落日眼", "翻白眼", "角弓反張", "弓起來", "弓著背", "身體拱起", "背拱起來", "反弓", "頭往後仰", "脖子後仰", "頸部後仰", "尖叫", "哭聲尖銳", "哭聲很尖", "哭聲高亢", "哭聲淒厲", "哭聲很怪", "哭聲不一樣", "高頻哭", "哭得很尖", "吐血", "便血", "血便", "大量出血", "流很多血", "噎到", "哽到", "被悶住", "臉被蓋住", "摔下來", "掉下床", "從床上掉", "跌落", "撞到頭", "頭撞到", "搖晃寶寶", "搖了寶寶", "搖寶寶", "不想要寶寶", "想把寶寶丟掉", "想悶死", "想傷害寶寶", "忍不住打他", "忍不住打寶寶", "打了寶寶", "打了他", "後悔生下", "恨寶寶", "想打他", "想打她", "想打寶寶", "想打小孩", "想打孩子", "想打嬰兒", "想掐他", "想掐她", "想掐寶寶", "想掐小孩", "想掐孩子", "想掐嬰兒", "想摔他", "想摔她", "想摔寶寶", "想摔小孩", "想摔孩子", "想摔嬰兒", "想丟他", "想丟她", "想丟寶寶", "想丟小孩", "想丟孩子", "想丟嬰兒", "想搖他", "想搖她", "想搖寶寶", "想搖小孩", "想搖孩子", "想搖嬰兒", "想悶他", "想悶她", "想悶寶寶", "想悶小孩", "想悶孩子", "想悶嬰兒", "想傷害他", "想傷害她", "想傷害寶寶", "想傷害小孩", "想傷害孩子", "想傷害嬰兒", "想死", "不想活", "活不下去", "想自殺", "想結束生命", "想傷害自己", "想消失", "不如死了", "想跳樓", "家暴", "被家暴", "虐待", "老公打", "先生打", "老公打我", "家人打寶寶", "保母打", "保姆打", "被打"];

function findDangerousKeyword(text) {
  if (!text || typeof text !== "string") return null;
  return DANGEROUS_KEYWORDS.find((kw) => text.includes(kw)) || null;
}

function containsDangerousKeyword(text) {
  return findDangerousKeyword(text) !== null;
}

/* =========================
   危險事件上報（寫入 Supabase，經後端 API）
   需後端 POST /api/danger-event 與 Supabase danger_events 表已就緒；
   要送哪些 ID／是否送完整內容，只需調整此設定（enabled: false 可關閉上報）
========================= */

const DANGER_REPORT_CONFIG = {
  enabled: true,
  endpoint: "/api/danger-event",
  includeUserId: true, // clinicianId
  includeClientId: true,
  includeBabyId: true,
  includeText: true, // false 則只送命中的關鍵字
};

function reportDangerEvent({ text, keyword }) {
  const cfg = DANGER_REPORT_CONFIG;
  if (!cfg.enabled) return;

  try {
    const payload = {
      source: "clinician",
      keyword,
      ts: Date.now(),
    };
    if (cfg.includeText) payload.text = text;
    if (cfg.includeUserId) payload.userId = clinicianId || null;
    if (cfg.includeClientId) payload.clientId = clientId;
    if (cfg.includeBabyId) payload.babyId = babyId || null;

    const headers = {
      "Content-Type": "application/json",
      "X-Client-Id": clientId,
    };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    // fire-and-forget：上報失敗不得影響警示視窗與輸入鎖定
    fetch(api(cfg.endpoint), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((err) => console.warn("danger report failed:", err));
  } catch (err) {
    console.warn("danger report failed:", err);
  }
}

function isDangerLocked() {
  return !!elDangerModal && !elDangerModal.classList.contains("hidden");
}

function triggerDangerAlert(text) {
  if (isDangerLocked()) return;
  // 必須在清空輸入框前取得內容
  reportDangerEvent({ text, keyword: findDangerousKeyword(text) });
  if (elInput) {
    elInput.value = "";
    elInput.disabled = true;
  }
  if (elBtnSend) elBtnSend.disabled = true;
  elDangerModal?.classList.remove("hidden");
  elDangerConfirm?.focus();
}

function dismissDangerAlert() {
  elDangerModal?.classList.add("hidden");
  if (elInput) elInput.disabled = false;
  if (elBtnSend) elBtnSend.disabled = false;
  elInput?.focus();
}

// IME 組字狀態：組字中途的內容尚未確認，不攔截，避免破壞輸入法狀態
let isComposing = false;

function checkDangerInput() {
  if (containsDangerousKeyword(elInput.value)) {
    triggerDangerAlert(elInput.value);
  }
}

elInput?.addEventListener("compositionstart", () => {
  isComposing = true;
});
elInput?.addEventListener("compositionend", () => {
  isComposing = false;
  checkDangerInput();
});
elInput?.addEventListener("input", (e) => {
  if (e.isComposing || isComposing) return;
  checkDangerInput();
});

elDangerConfirm?.addEventListener("click", dismissDangerAlert);

/* =========================
   全域狀態管理器 (核彈級防護)
========================= */
window.isChatFetching = false;
window.globalReqId = 0;

/* =========================
   Utilities
========================= */

const uid = () => Math.random().toString(36).slice(2);

function scrollToBottom() {
  elMessages?.scrollTo({ top: elMessages.scrollHeight, behavior: "smooth" });
}

/**
 * Toggle "thinking" animation (增強防護：強制鎖住按鈕與輸入框)
 */
function setThinking(on) {
  if (elThinking) {
    if (on) elThinking.classList.remove("hidden");
    else elThinking.classList.add("hidden");
  }

  if (on) {
    if (elBtnSend) elBtnSend.disabled = true;
    if (elInput) elInput.disabled = true;
  } else if (!isDangerLocked()) {
    if (elBtnSend) elBtnSend.disabled = false;
    if (elInput) elInput.disabled = false;
    elInput?.focus();
  }
}

/**
 * Smart question mark processing (for user input)
 */
function processQuestionMarks(text) {
  let result = text;
  result = result.replace(/[?？]\s*$/g, '');
  result = result.replace(/[?？](?=.)/g, '\n');
  result = result.replace(/\n\s*\n/g, '\n');
  return result.trim();
}

/**
 * HTML escaping (prevent XSS)
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 判斷內容是否為 HTML 格式
 */
function isHtmlFormat(text) {
  if (!text || typeof text !== 'string') return false;
  const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;
  const commonHtmlTags = /<(p|div|span|h[1-6]|ul|ol|li|a|strong|em|br|img|table|tr|td|th)[\s>]/i;
  return htmlTagPattern.test(text) || commonHtmlTags.test(text);
}

/**
 * 機器人回覆中 <img> 的來源白名單（與 index.html CSP 的 img-src 保持一致，修改時兩邊要同步）
 * 不在白名單的圖片（例如 LLM 搜尋時附上的外部圖片網址）會被 CSP 擋下，
 * 只留下壞圖示，因此在 DOMPurify 清洗時直接移除該 <img>。
 */
const ALLOWED_IMG_ORIGINS = ["https://jaundice.smartchat.live"];

function isAllowedImgSrc(src) {
  if (!src) return false;
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin || ALLOWED_IMG_ORIGINS.includes(url.origin);
  } catch (err) {
    return false;
  }
}

if (typeof DOMPurify !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG' && !isAllowedImgSrc(node.getAttribute('src') || '')) {
      node.remove();
    }
  });
}

/**
 * 判斷並轉換 Markdown 為 HTML
 * 不論走哪條路徑（原始 HTML 直傳 / marked 轉換 / escapeHtml 備援），
 * 最終輸出一律經過 DOMPurify.sanitize() 才回傳，避免任何一條路徑漏未清洗的內容流入 innerHTML。
 */
function processContent(text) {
  if (!text || typeof text !== 'string') return '';

  let html;

  if (isHtmlFormat(text)) {
    html = text;
  } else {
    const markdownPatterns = [
      /^#{1,6}\s/m,
      /\*\*.*\*\*/,
      /\*.*\*/,
      /\[.*\]\(.*\)/,
      /^\s*[-*+]\s/m,
      /^\s*\d+\.\s/m,
      /```[\s\S]*```/,
      /`[^`]+`/,
    ];

    const hasMarkdown = markdownPatterns.some(pattern => pattern.test(text));

    if (hasMarkdown && typeof marked !== 'undefined') {
      try {
        html = marked.parse(text);
      } catch (err) {
        console.error('Markdown parsing error:', err);
        html = escapeHtml(text).replace(/\n/g, '<br>');
      }
    } else {
      html = escapeHtml(text).replace(/\n/g, '<br>');
    }
  }

  if (typeof DOMPurify === 'undefined') {
    console.error('DOMPurify not loaded — falling back to plain-text rendering.');
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  return DOMPurify.sanitize(html);
}

/**
 * Check if response contains incomplete processing markers
 */
function containsIncompleteMarkers(text) {
  if (typeof text !== 'string') return false;
  const lowerText = text.toLowerCase();
  return lowerText.includes('search results') && lowerText.includes('html');
}

/* =========================
   Render messages to screen
========================= */

function render() {
  if (!elMessages) return;
  elMessages.innerHTML = "";

  for (const m of messages) {
    const isUser = m.role === "user";

    const row = document.createElement("div");
    row.className = `msg ${isUser ? "user" : "bot"}`;

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = isUser
      ? './assets/jaundice_user.jpg'
      : './assets/jaundice_chatbot.jpg';
    avatar.alt = isUser ? "you" : "bot";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (isUser) {
      bubble.innerHTML = escapeHtml(m.text).replace(/\n/g, '<br>');
    } else {
      bubble.innerHTML = processContent(m.text);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    elMessages.appendChild(row);
  }

  scrollToBottom();
}

/* =========================
   Call backend logic
========================= */

async function sendText(text, retryCounts = {}) {
  const content = (text ?? elInput?.value ?? "").trim();
  if (!content) return;

  // 與 input 事件共用同一套偵測，避免非打字來源（程式塞值、直接呼叫）繞過攔截
  if (containsDangerousKeyword(content)) {
    triggerDangerAlert(content);
    return;
  }

  const contentToSend = processQuestionMarks(content);

  // 初始化重試計數器
  if (!retryCounts.emptyResponse) retryCounts.emptyResponse = 0;
  if (!retryCounts.incompleteMarkers) retryCounts.incompleteMarkers = 0;
  if (!retryCounts.httpErrors) retryCounts.httpErrors = 0;

  const isFirstRequest =
    retryCounts.emptyResponse === 0 &&
    retryCounts.incompleteMarkers === 0 &&
    retryCounts.httpErrors === 0;

  if (isFirstRequest) {
    // ★ 第一道鎖：如果已經在請求中，直接擋掉所有新的連點
    if (window.isChatFetching) return;
    window.isChatFetching = true;

    const userMsg = { id: uid(), role: "user", text: content, ts: Date.now() };
    messages.push(userMsg);
    if (elInput) elInput.value = "";
    render();
  }

  setThinking(true);

  // ==========================================
  // 核彈級防護：獨立請求 ID 與全域清掃機制
  // ==========================================
  window.globalReqId++;
  const currentReqId = window.globalReqId; 

  const clearAllTempMessages = () => {
    let hasTemp = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isTemp) {
        messages.splice(i, 1);
        hasTemp = true;
      }
    }
    if (hasTemp) render();
  };

  const updateTempMsg = (msgText) => {
    // 嚴格核對身分證與狀態，不符立刻作廢
    if (currentReqId !== window.globalReqId) return;
    if (!window.isChatFetching) return;

    const existingIdx = messages.findIndex(m => m.isTemp === true);
    if (existingIdx === -1) {
      messages.push({ id: uid(), role: "assistant", text: msgText, ts: Date.now(), isTemp: true });
    } else {
      messages[existingIdx].text = msgText;
    }
    render();
  };

  setTimeout(() => updateTempMsg("正在為你加速查詢中..."), 4000);
  setTimeout(() => updateTempMsg("資訊已查詢清楚，正在回傳中..."), 8000);
  // ==========================================

  try {
    const res = await fetch(api("/api/chat-clinical"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
        ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        text: contentToSend,
        clientId,
        babyId: babyId || null,
        clinicianId: clinicianId || null,
        language: "繁體中文",
        role: "user"
      }),
    });

    const raw = await res.text();
    let data;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { errorRaw: raw };
    }

    // ★★★ 3. HTTP 500/502/503/504/401/404 Error Handling ★★★
    const commonHttpErrors = [500, 502, 503, 504, 401, 404];
    if (commonHttpErrors.includes(res.status)) {
      if (retryCounts.httpErrors === 0) {
        retryCounts.httpErrors++;
        clearAllTempMessages(); 
        setThinking(false);
        messages.push({ id: uid(), role: "assistant", text: "Network is unstable, retrying your request.", ts: Date.now() });
        render();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendText(content, retryCounts);
      } else {
        throw new Error("Sorry, the network is unstable. Please try again later.");
      }
    }

    if (res.status === 429) {
      throw new Error("請求太頻繁，請稍後再試");
    }

    if (!res.ok) {
      throw new Error("Sorry, the network is unstable. Please try again later.");
    }

    // ★★★ 1. HTTP 200 Empty Response Error Handling ★★★
    if (res.status === 200) {
      let isEmptyResponse = false;

      if (typeof data === "object" && data !== null) {
        const isPlainEmptyObject = !Array.isArray(data) && Object.keys(data).filter(k => k !== 'clientId').length === 0;
        const hasTextField = 'text' in data || 'message' in data;

        if (hasTextField) {
          const textValue = data.text !== undefined ? data.text : data.message;
          if (textValue === "" || textValue === null || textValue === undefined) isEmptyResponse = true;
        } else if (isPlainEmptyObject) {
          isEmptyResponse = true;
        }
      }

      if (isEmptyResponse && retryCounts.emptyResponse === 0) {
        retryCounts.emptyResponse++;
        clearAllTempMessages(); 
        setThinking(false);
        messages.push({ id: uid(), role: "assistant", text: "Network is unstable, retrying your request.", ts: Date.now() });
        render();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendText(content, retryCounts);
      }

      if (isEmptyResponse && retryCounts.emptyResponse >= 1) {
        throw new Error("Sorry, the network is unstable. Please try again later.");
      }
    }

    let replyText;
    if (typeof data === "string") {
      replyText = data.trim() || "Please rephrase your question, thank you.";
    } else if (data && typeof data === "object") {
      const hasTextField = 'text' in data || 'message' in data;
      if (hasTextField) {
        const textValue = data.text !== undefined ? data.text : data.message;
        replyText = textValue === "" || textValue === null || textValue === undefined ? "Please rephrase your question, thank you." : String(textValue).trim() || "Please rephrase your question, thank you.";
      } else {
        const isPlainEmptyObject = !Array.isArray(data) && Object.keys(data).filter(k => k !== 'clientId').length === 0;
        replyText = isPlainEmptyObject ? "Network is unstable, please try again." : JSON.stringify(data, null, 2);
      }
    } else {
      replyText = "Please rephrase your question, thank you.";
    }

    // ★★★ 2. Backend Incomplete Processing Error ★★★
    if (containsIncompleteMarkers(replyText)) {
      if (retryCounts.incompleteMarkers === 0) {
        retryCounts.incompleteMarkers++;
        clearAllTempMessages(); 
        setThinking(false);
        messages.push({ id: uid(), role: "assistant", text: "Still thinking, please wait.", ts: Date.now() });
        render();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendText(content, retryCounts);
      } else {
        clearAllTempMessages(); 
        window.isChatFetching = false; 
        setThinking(false);
        messages.push({ id: uid(), role: "assistant", text: "Sorry, the network is unstable. Please try again later.", ts: Date.now() });
        render();
        return;
      }
    }

    // ==========================================
    // ★★★ 完美結尾：印出答案前，清掃所有殘留訊息並解除鎖定 ★★★
    // ==========================================
    clearAllTempMessages();
    window.isChatFetching = false; 

    // Push bot message
    const botMsg = { id: uid(), role: "assistant", text: replyText, ts: Date.now() };
    messages.push(botMsg);
    setThinking(false);
    render();

  } catch (err) {
    // ==========================================
    // ★★★ 發生錯誤時：同樣要清掃殘留訊息並解除鎖定 ★★★
    // ==========================================
    clearAllTempMessages();
    window.isChatFetching = false;
    setThinking(false);

    if (!navigator.onLine) {
      messages.push({ id: uid(), role: "assistant", text: "You are currently offline. Please check your network connection and try again.", ts: Date.now() });
      render();
      return;
    }

    const friendly = `${err?.message || err}`;
    messages.push({ id: uid(), role: "assistant", text: friendly, ts: Date.now() });
    render();
  }
}

// Event bindings
elBtnSend?.addEventListener("click", () => sendText());
elInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    // 組字中的 Enter 是「確認選字」，不是送出（keyCode 229 為部分瀏覽器的組字訊號）
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    sendText();
  }
});

// Header collapse toggle (state not persisted; always expanded on load)
elHeaderToggle?.addEventListener("click", () => {
  const collapsed = elTopbar.classList.toggle("hidden");
  elHeaderToggle.textContent = collapsed ? "▼" : "▲";
  elHeaderToggle.setAttribute("aria-expanded", String(!collapsed));
  elHeaderToggle.setAttribute("aria-label", collapsed ? "展開頂部標題區域" : "隱藏頂部標題區域");
});

window.addEventListener("load", () => elInput?.focus());

// Welcome message
messages.push({
  id: uid(),
  role: "assistant",
  text: "<p><span style=color: #0056b3; font-weight: bold;>您好！歡迎使用新生兒黃臨床疸衛教資訊服務 🏥</span> 寶寶皮膚黃黃的讓您擔心了嗎？我是您的專屬小幫手，可以為您解答關於生理性/病理性黃疸、母乳哺餵與大便顏色觀察等衛教知識。請問今天想了解什麼呢？📋🩺</p>",
  
  ts: Date.now(),
});

render();
