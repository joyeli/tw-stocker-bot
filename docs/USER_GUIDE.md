# 📘 TW-Stocker Bot 使用者手冊 (User Guide)

歡迎使用 TW-Stocker Bot！本手冊將協助您深入了解如何配置、使用並最大化此 AI 助理的價值。

---

## 1. 初始化與配對

在使用 Bot 之前，必須先完成 `init` 流程。這是為了確保安全性與環境正確性。

### A. AI 引擎選擇
系統支援兩種 AI 核心，請確保您已安裝對應的 CLI 工具：
*   **Gemini CLI (推薦)**: `npm install -g @google/gemini-cli`
*   **Claude Code**: `npm install -g @anthropic-ai/claude-code`

### B. Telegram 安全配對
為了防止他人使用您的 Bot（消耗您的 API 額度），我們設計了配對機制：

#### 如何申請 Telegram Bot Token？
1.  開啟 Telegram，搜尋 **[@BotFather](https://t.me/BotFather)** (這是 Telegram 官方的機器人管理員)。
2.  傳送指令 `/newbot`。
3.  依指示輸入 **Bot 顯示名稱** (例如: `My Stock Assistant`)。
4.  依指示輸入 **Bot ID** (必須以 `bot` 結尾，例如: `my_stock_2026_bot`)。
5.  成功後，BotFather 會給您一串 **HTTP API Token** (例如: `123456:ABC-DEF...`)。**請妥善保管此 Token**。

#### 建議的隱私設定 (Privacy Settings)
為了確保您的 Bot 不會被隨意拉入群組或讀取不相關訊息，建議進行以下設定：
1.  對 @BotFather 傳送 `/mybots`。
2.  選擇您的 Bot -> **Bot Settings**。
3.  **Allow Groups?**: 建議設為 **Turn groups off** (除非您想在群組使用)。
4.  **Group Privacy**: 建議設為 **Turn on** (Bot 只讀取跟它有關的指令)。

#### 開始配對
1.  在工作目錄下執行 `tw-stocker-bot init` 並輸入 Token。
2.  CLI 會顯示一組 **4 位數驗證碼** (例如 `8826`)。
3.  開啟您的 Bot，發送這組號碼。
4.  **配對成功！** 系統會鎖定您的 Telegram ID，此後只有您能操作此 Bot。

---

## 2. 指令與操作

Bot 支援以下指令，您可以直接在 Telegram 對話框輸入：

### 基礎管理
*   `/start`: 顯示歡迎訊息與基本指令說明。
*   `/help`: 列出所有可用指令。

### 觀察清單 (Watchlist)
*   `/add <股號>`
    *   範例: `/add 2330`
    *   說明: 加入關注。加入後，**盤中監控** 就會開始掃描這檔股票。
*   `/del <股號>`
    *   範例: `/del 2330`
    *   說明: 移除關注，不再接收警示。
*   `/list`
    *   說明: 列出目前所有持倉與觀察股，包含成本與最新筆記。

### 資產與記憶 (Memory)
這是本 Bot 的核心價值所在，請務必善用：

*   `/cost <股號> <價格>`
    *   範例: `/cost 2330 600`
    *   說明: 告訴 AI 您的持倉成本。
    *   **效果**: 當您詢問分析時，AI 會說「目前獲利 30%，建議...」而不是只報價。
*   `/note <股號> <筆記>`
    *   範例: `/note 2330 跌破季線要停損`
    *   說明: 記錄您的操作策略。
    *   **效果**: AI 分析時會提醒您：「注意，目前股價已跌破季線，**觸發您設定的停損條件**。」

### AI 對話
*   直接輸入任何文字，例如：「分析 2330」、「大盤現在情況如何？」、「幫我檢查庫存」。
*   Bot 會結合您的**持倉成本**、**筆記**與**即時數據**，給出個人化的回答。

---

## 3. 自動化排程

Bot 內建 `Scheduler` 服務，只要執行 `tw-stocker-bot start` 就會自動運作。

### 盤中監控 (Intraday Monitor)
*   **時間**: 週一至週五，09:00 - 13:30。
*   **頻率**: 預設每 30 分鐘一次。
*   **行為**: 默默掃描您的清單。**只有在發生重大事件**（如急跌、突破、觸發停損）時，才會發送訊息通知您。平時保持安靜。

### 盤後日報 (Daily Report)
*   **時間**: 週一至週五，15:00。
*   **行為**: 自動彙整今日損益，並提供明日操作建議。

### 修改頻率
若您希望調整監控頻率（例如改為 60 分鐘）：
1.  開啟 `bot-config.json` (位於設定檔目錄)。
2.  修改或新增 `"scheduler": { "interval": 60 }`。
3.  重啟 Bot。

---

## 4. 疑難排解 (Troubleshooting)

### Q: 啟動時顯示 "Invalid Token"？
*   請檢查 `.env` 檔案中的 Token 是否正確。
*   嘗試刪除 `.env` 與 `bot-config.json`，重新執行 `tw-stocker-bot init` 進行配對。

### Q: AI 回應 "Model not found"？
*   可能是您選擇的模型名稱已過期或無權限。
*   請重新執行 `init`，選擇列表中的其他模型 (如 `gemini-1.5-flash`)。

### Q: 盤中都沒有收到警示？
*   這是正常的！設計上只有「異常」才會通知。
*   如果想確認 Bot 是否活著，可以手動發送 `/list` 測試。

### Q: 如何更新 Skill？
*   Skill (`tw-stocker-consultant`) 會定期更新分析邏輯。
*   目前請手動進入 Skill 目錄執行 `git pull`，或等待未來的 Bot 版本提供 `/update` 指令。

---

## 5. 常駐執行 (Deployment)

預設的 `tw-stocker-bot start` 指令會在前台執行，當您關閉視窗時服務就會停止。若要讓 Bot 在背景 24 小時運作（如部署在 VPS 或家中 Server），建議使用 **PM2**。

### 步驟 1: 安裝 PM2
```bash
npm install -g pm2
```

### 步驟 2: 啟動 Bot
使用以下指令啟動，PM2 會負責在背景執行並自動重啟：
```bash
pm2 start tw-stocker-bot --name stocker-bot -- start
```

### 步驟 3: 開機自啟
確保伺服器重開機後 Bot 也會自動復活：
```bash
pm2 save
pm2 startup
```

### 管理指令
*   **查看狀態**: `pm2 status`
*   **查看 Log**: `pm2 logs stocker-bot`
*   **停止服務**: `pm2 stop stocker-bot`
*   **重啟服務**: `pm2 restart stocker-bot`