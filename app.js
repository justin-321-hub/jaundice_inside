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
   DOM References
========================= */

const elMessages = document.getElementById("messages");
const elInput = document.getElementById("txtInput");
const elBtnSend = document.getElementById("btnSend");
const elThinking = document.getElementById("thinking");

/* =========================
   Message State
========================= */

const messages = [];

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
  } else {
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
 * 判斷並轉換 Markdown 為 HTML
 */
function processContent(text) {
  if (!text || typeof text !== 'string') return '';
  if (isHtmlFormat(text)) return text;

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
      return marked.parse(text);
    } catch (err) {
      console.error('Markdown parsing error:', err);
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }

  return escapeHtml(text).replace(/\n/g, '<br>');
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
    const res = await fetch(api("/api/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
      },
      body: JSON.stringify({
        text: contentToSend,
        clientId,
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
    e.preventDefault();
    sendText();
  }
});

window.addEventListener("load", () => elInput?.focus());

// Welcome message
messages.push({
  id: uid(),
  role: "assistant",
  text: "<p><span style=color: #0056b3; font-weight: bold;>您好！歡迎使用嬰兒黃疸衛教資訊服務 🏥</span> 寶寶皮膚黃黃的讓您擔心了嗎？我是您的專屬小幫手，可以為您解答關於生理性/病理性黃疸、母乳哺餵與大便顏色觀察等衛教知識。請問今天想了解什麼呢？📋🩺</p>",
  
  ts: Date.now(),
});

render();
