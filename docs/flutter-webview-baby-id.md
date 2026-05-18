# Flutter WebView × BabyID 交互設計說明

## 概述

本專案的前端（Web 頁面）以 WebView 形式嵌入 Flutter App 中執行。  
App 在開啟 WebView 後，會透過 JavaScript Channel 將當前登入使用者的 `babyId`（寶寶識別碼）注入網頁，讓後續每一筆聊天請求都能帶上該識別碼，使後端得以區分是哪位寶寶的問診紀錄。

---

## 整體流程

```
Flutter App
    │
    │  1. 開啟 WebView，載入網頁
    ▼
Web 頁面載入完成（DOMContentLoaded / window.onload）
    │
    │  2. Flutter 呼叫 window.setBabyId(id)
    ▼
JavaScript setBabyId()
    ├─ 驗證參數（非空字串）
    ├─ 寫入模組變數 babyId
    └─ 持久化至 localStorage（key: "babyID"）
    │
    │  3. 使用者傳送訊息
    ▼
POST /api/chat  ←── body 包含 babyId 欄位
```

---

## Web 端實作（`app.js`）

### 1. 初始化：讀取 localStorage

```js
const BABY_ID_KEY = "babyID";
let babyId = localStorage.getItem(BABY_ID_KEY) || null;
```

頁面每次載入時，先嘗試從 `localStorage` 讀取上次存入的 `babyId`。  
若 App 尚未注入、或是全新的 WebView session，則預設為 `null`。

### 2. 注入介面：`window.setBabyId()`

```js
window.setBabyId = function (id) {
  if (id && typeof id === "string" && id.trim()) {
    babyId = id.trim();
    localStorage.setItem(BABY_ID_KEY, babyId);
  }
};
```

- **掛載在 `window`**：Flutter 的 `evaluateJavascript` 可直接呼叫全域函式。
- **型別與空值防護**：只接受非空字串，避免 App 傳入 `null`、`undefined`、或空白時污染狀態。
- **雙重存儲**：寫入模組變數（當次有效）及 `localStorage`（跨頁重整保留）。

### 3. 隨每次請求送出

```js
body: JSON.stringify({
  text: contentToSend,
  clientId,
  babyId: babyId || null,   // 若尚未注入則為 null
  language: "繁體中文",
  role: "user"
}),
```

`babyId` 作為 POST body 的一個欄位送往後端。未注入時為 `null`，後端應視同匿名問診處理。

---

## Flutter 端施作方式

### 使用 `flutter_inappwebview`（建議）

```dart
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

InAppWebView(
  initialUrlRequest: URLRequest(
    url: WebUri("https://your-webview-url.github.io"),
  ),
  onWebViewCreated: (controller) {
    // 儲存 controller 供後續呼叫
    webViewController = controller;
  },
  onLoadStop: (controller, url) async {
    // 頁面載入完成後立即注入 babyId
    final String babyId = getCurrentBabyId(); // 從 App 狀態取得
    await controller.evaluateJavascript(
      source: "window.setBabyId('$babyId');",
    );
  },
)
```

### 使用 `webview_flutter`（官方套件）

```dart
import 'package:webview_flutter/webview_flutter.dart';

late final WebViewController _controller;

_controller = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..setNavigationDelegate(NavigationDelegate(
    onPageFinished: (String url) async {
      final String babyId = getCurrentBabyId();
      await _controller.runJavaScript("window.setBabyId('$babyId');");
    },
  ))
  ..loadRequest(Uri.parse("https://your-webview-url.github.io"));
```

> **注意**：必須在 `onPageFinished` / `onLoadStop` 之後才呼叫，確保 `app.js` 已執行完畢、`window.setBabyId` 已掛載。

---

## 注意事項

| 事項 | 說明 |
|---|---|
| 呼叫時機 | 必須等頁面完全載入（`onPageFinished`）後才能呼叫，否則 `window.setBabyId` 尚未定義 |
| 特殊字元 | `babyId` 若含單引號或反斜線，需在 Dart 端先做跳脫，避免 JS 注入語法錯誤 |
| 換帳號 / 換寶寶 | 需關閉並重開 WebView，或再次呼叫 `window.setBabyId(newId)` 覆蓋舊值（localStorage 也會同步更新） |
| 匿名狀態 | `babyId` 未注入時為 `null`，後端應能接受並以匿名方式處理，不應拋出錯誤 |
| localStorage 持久化 | 若 WebView 共用同一 session（非每次重建），重整頁面後會自動讀回上次的 `babyId`，不需要重新注入 |
