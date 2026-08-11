# 👶 新生兒黃疸臨床衛教智慧客服小幫手

一個純前端（Vanilla JS，無建置流程、無 npm）的繁體中文聊天機器人網頁，提供**醫護人員／臨床端**使用的新生兒黃疸衛教問答服務。使用者可透過 App 的 WebView 與後端 AI 客服對話，取得生理性／病理性黃疸、母乳哺餵、大便顏色觀察等衛教資訊。

線上網址由 GitHub Pages 自動部署（見下方「部署」章節）。

> 本專案為姊妹儲存庫 `jaundice`（面向一般家長）的臨床變體版本，兩者為**各自獨立的 git 儲存庫**，非同一庫的分支，變更不會自動同步。

---

## 功能特色

- **Markdown ／ HTML 混合渲染**：後端回覆若為 HTML 直接注入；若偵測到 Markdown 語法則用 `marked.js` 轉換；其餘則以純文字＋斷行呈現。
- **XSS 防護**：所有機器人訊息在渲染前，一律經過 `DOMPurify.sanitize()` 清洗，避免惡意 HTML／腳本注入。使用者輸入則一律走 `escapeHtml()` 逃逸後再顯示，不會被當作 HTML 解析。
- **危險關鍵字攔截**：偵測到使用者輸入包含高風險字詞（目前僅「自殺」）時，立即鎖住輸入框與送出鍵，並跳出警示視窗（`#dangerAlertModal`），提醒使用者尋求專業協助。⚠️ 目前關鍵字清單僅供測試，尚待擴充。
- **重試機制**：針對三種失敗情境（HTTP 200 但回覆內容為空、回覆內容包含未完成處理標記、HTTP 5xx／401／404 錯誤）各自提供一次自動重試，重試失敗才顯示錯誤訊息給使用者。
- **請求防抖與防重入**：`window.isChatFetching` 防止使用者連點造成重複送出；`window.globalReqId` 確保逾時的暫時提示訊息（4 秒／8 秒）不會在新請求送出後才過期顯示。
- **WebView 橋接**：供原生 App（Flutter）注入 `babyId`、`clinicianId`、Firebase `authToken`，並提供 `clearBabyId()` 清除殘留的 `babyId`，避免同一 WebView 來源的舊 session 資料外洩到新 session（例如切回無特定病患情境的醫護首頁）。
- **行動裝置優先的 RWD**：處理 iOS 安全區域（`safe-area-inset`）、動態視窗高度（`dvh`）、鍵盤彈出等手機瀏覽情境。
- **內容安全政策（CSP）**：`index.html` 內建 CSP，限制腳本／樣式／連線／圖片來源，降低前端被注入攻擊的風險。

---

## 技術架構

無建置流程、無框架，僅由三個核心檔案構成：

| 檔案 | 說明 |
|---|---|
| `index.html` | 頁面骨架（header／main／footer），不含任何內嵌邏輯 |
| `app.js` | 所有前端行為邏輯（狀態管理、API 呼叫、渲染、重試、安全防護） |
| `styles.css` | Mobile-first 響應式樣式，暖色系醫療照護主題 |

### 第三方函式庫（已 vendor 進版本庫，非 npm 套件）

| 檔案 | 用途 |
|---|---|
| `marked.umd.js` | 將後端回覆的 Markdown 文字轉換為 HTML |
| `dompurify.umd.js` | 清洗所有即將寫入 `innerHTML` 的內容，防止 XSS |

### 後端 API

外部 REST API：`https://jaundice-server.onrender.com`

與面向家長的 `jaundice` 前端（POST `/api/chat`）不同，本臨床變體改為 `POST /api/chat-clinical`，傳送 JSON：

```json
{
  "text": "...",
  "clientId": "...",
  "babyId": null,
  "clinicianId": null,
  "language": "繁體中文",
  "role": "user"
}
```

- `clientId` 同時會附加在請求標頭 `X-Client-Id`。
- 若已透過 `window.setAuthToken()` 注入 Firebase ID Token，會附加 `Authorization: Bearer <token>` 標頭。
- `language` 固定為「繁體中文」（本變體無語言選單，也沒有 `parentId` 欄位）。

---

## `app.js` 核心邏輯說明

### 使用者身份

| 識別碼 | 儲存位置 | 說明 |
|---|---|---|
| `clientId` | `localStorage.fourleaf_client_id` | 匿名多使用者辨識用的 UUID，首次載入時自動產生 |
| `babyId` | `localStorage.babyID` | 由 App WebView 呼叫 `window.setBabyId(id)` 注入；呼叫 `window.clearBabyId()` 可清除（記憶體與 `localStorage` 都會清空） |
| `clinicianId` | `localStorage.clinicianID` | 由 App WebView 呼叫 `window.setClinicianId(id)` 注入，代表登入中的醫護人員 |
| `authToken` | 僅存於記憶體 | 由 App WebView 呼叫 `window.setAuthToken(token)` 注入，重新整理後需重新注入 |

詳細的 WebView 注入時機與 Flutter 端範例程式碼，見 [`docs/flutter-webview-baby-id.md`](docs/flutter-webview-baby-id.md)（文件撰寫時間早於 `clearBabyId`／`clinicianId`／`setAuthToken` 的加入，僅供設計脈絡參考）。

### 輸入前處理

`processQuestionMarks()` 會在送出前：去除句尾的 `?`／`？`，並將句中問號轉換為換行，方便後端斷句解析。

### 內容渲染流程（僅套用於機器人訊息）

1. `isHtmlFormat()`：偵測回覆是否包含 HTML 標籤，若是則直接視為 HTML。
2. `processContent()`：偵測 Markdown 語法（標題、粗體、清單、連結、程式碼區塊等），若命中且 `marked` 已載入，呼叫 `marked.parse()` 轉換。
3. 備援：兩者皆未命中則走 `escapeHtml()` + 換行轉 `<br>`。
4. **無論走哪條路徑，最終輸出一律經過 `DOMPurify.sanitize()` 才寫入畫面**，確保沒有任何路徑會讓未清洗的內容流入 `innerHTML`。

使用者自己的訊息一律走 `escapeHtml()` 備援路徑，不會被當成 HTML／Markdown 解析。

### 危險關鍵字攔截

`DANGEROUS_KEYWORDS` 陣列（目前僅含「自殺」）在使用者輸入時即時比對，一旦命中：
- 清空並鎖住輸入框、鎖住送出鍵
- 顯示 `#dangerAlertModal` 警示視窗，引導使用者尋求專業協助
- 使用者點擊「我知道了，繼續使用」後才解除鎖定

### 暫時訊息與併發防護

- 送出請求後第 4 秒、第 8 秒各插入一則進度提示訊息（`isTemp: true`）。
- `window.globalReqId` 每次請求遞增，逾時回呼比對此 ID，若請求已被新的請求取代則不再更新畫面，避免舊的提示訊息覆蓋新對話。
- 最終回覆或錯誤訊息顯示前，會先呼叫 `clearAllTempMessages()` 清除所有殘留的暫時訊息。
- `window.isChatFetching` 為第一道防線，避免使用者連點送出鍵造成重複請求。

### 重試邏輯

`retryCounts` 內有三組各自獨立、最多重試一次的計數器：

| 情境 | 判斷條件 | 重試上限 |
|---|---|---|
| `emptyResponse` | HTTP 200 但 `text`／`message` 欄位為空、null 或整包物件為空 | 1 次 |
| `incompleteMarkers` | 回覆內容同時包含 `"search results"` 與 `"html"`（不分大小寫） | 1 次 |
| `httpErrors` | HTTP 500／502／503／504／401／404 | 1 次 |

每次重試流程：清除暫時訊息 → 插入一則過渡狀態訊息 → 等待 1 秒 → 遞迴呼叫 `sendText()`。第二次仍失敗則拋出錯誤，落入 `catch` 區塊顯示錯誤訊息給使用者。

---

## 專案結構

```
.
├── index.html                       # 頁面骨架 + CSP 設定
├── app.js                           # 前端所有行為邏輯
├── styles.css                       # 響應式樣式
├── marked.umd.js                    # Markdown 解析套件（vendor）
├── dompurify.umd.js                 # XSS 清洗套件（vendor）
├── assets/                          # Logo／大頭貼圖片（本機離線可正常顯示）
├── docs/
│   └── flutter-webview-baby-id.md   # Flutter WebView 注入 babyId 的設計文件（早於 clearBabyId/clinicianId）
├── .github/workflows/static.yml     # GitHub Pages 自動部署設定
└── CLAUDE.md                        # 給 Claude Code 的專案指引（已加入 .gitignore，不會出現在 GitHub 上）
```

> 與面向家長的 `jaundice` 前端不同，本專案沒有 `pic/`（衛教圖片）資料夾；大頭貼圖片是從本機 `assets/` 載入，而非 GitHub CDN，因此離線瀏覽時大頭貼仍可正常顯示。

---

## 部署

透過 GitHub Actions（`.github/workflows/static.yml`）設定，只要推送到 `main` 分支，即會自動將整個儲存庫部署至 GitHub Pages，無需手動部署步驟。

---

## 安全性重點

- **CSP**：`index.html` 設定了 Content-Security-Policy，限制腳本僅能來自同源、連線僅能打到後端 API、圖片僅能來自同源、`data:` 與指定網域（`jaundice.smartchat.live`）。
- **XSS 防護（雙層）**：Markdown／HTML 內容一律經 `DOMPurify` 清洗；使用者輸入一律經 `escapeHtml()` 逃逸，兩者互不信任彼此的輸出。
- **危險關鍵字攔截**：即時偵測高風險字詞並中斷對話，屬第一層防護，非醫療專業判斷，實際仍需使用者尋求專業協助。

---

## 相關儲存庫

姊妹儲存庫 `jaundice` 為面向一般家長的公開版本（POST `/api/chat`、支援語言切換與 `parentId`、大頭貼走 GitHub CDN）。為獨立的 git 儲存庫／remote，非本儲存庫的分支，兩者變更不會自動同步。

---

## 更多文件

- [`docs/flutter-webview-baby-id.md`](docs/flutter-webview-baby-id.md) — Flutter App WebView 注入 `babyId` 的設計文件與範例程式碼（文件內容早於 `clearBabyId`／`clinicianId`／`setAuthToken` 的加入）
