# 🤖 TW-Stocker Bot (AI 股市投資管家)

> *Note: This project is specifically designed for the Taiwan Stock Market. As the target audience is primarily Taiwanese, all documentation and code comments are written in Traditional Chinese.*
>
> *本專案採用 "Vibe Coding" 模式開發，核心架構與程式碼由 **Google Gemini 3 Pro** 生成。*

> **您的 24 小時專屬 AI 投資助理，主動監控、深度分析、全自動化。**

`tw-stocker-bot` 是一個結合 **Node.js 排程服務** 與 **Python 深度分析引擎** 的 AI 投資機器人。它不是單純的報價工具，而是能記住您的持倉成本、投資筆記，並在盤中主動為您把關的智慧管家。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Gemini](https://img.shields.io/badge/AI-Gemini%20%7C%20Claude-purple)

## ✨ 核心亮點

*   **🧠 雙引擎 AI 核心**: 支援 **Google Gemini** 與 **Anthropic Claude**，自動聯網獲取最新模型。 *(註：目前僅完整測試 Gemini CLI，Claude Code 支援僅為理論驗證)*
*   **🛡️ 安全隱私**: 獨創 **Telegram 安全配對機制**，綁定專屬主人，拒絕路人濫用。
*   **📝 記憶功能**: 記得您的 **持倉成本** 與 **投資筆記**，分析不再空泛，而是針對您的損益給出建議。
*   **⏰ 全自動排程**:
    *   **盤中 (09:00-13:30)**: 每 30 分鐘自動快篩，異常主動推播。
    *   **盤後 (15:00)**: 自動結算今日績效，生成投資日報。

---

## 🚀 快速開始 (Quick Start)

### 0. 事前準備 (Prerequisite)
請先向 Telegram 的官方機器人 **[@BotFather](https://t.me/BotFather)** 申請一組 Bot Token。
*(詳細步驟請參閱 [使用者手冊](docs/USER_GUIDE.md#如何申請-telegram-bot-token))*

### 1. 安裝 CLI 工具
```bash
npm install -g joyeli/tw-stocker-bot
```

### 2. 準備工作目錄
建立一個資料夾來存放設定檔與 AI 記憶：
```bash
mkdir tw-stocker
cd tw-stocker
```

### 3. 初始化環境 (Init)
這一步會引導您選擇 AI 引擎、安裝分析套件，並進行 Telegram 配對。
```bash
tw-stocker-bot init
```
> 跟隨螢幕上的繁體中文指引操作即可。設定檔將產生於當前目錄。

### 4. 啟動服務 (Start)
啟動後，Bot 會開始常駐並監聽您的指令。
```bash
tw-stocker-bot start
```

---

## 💬 常用指令

在 Telegram 中與機器人對話：

*   **`/add 2330`**: 加入台積電到觀察清單。
*   **`/cost 2330 500`**: 設定台積電成本為 500 元 (AI 分析時會參考)。
*   **`/note 2330 看好先進製程`**: 寫下投資筆記。
*   **直接輸入文字**: 例如「分析 2330」、「我的 0050 套牢了怎麼辦」。

---

## 📚 進階文件

更多詳細設定與操作細節，請參閱 **[使用者手冊 (User Guide)](docs/USER_GUIDE.md)**。

*   [初始化與配對詳解](docs/USER_GUIDE.md#1-初始化與配對)
*   [指令完整說明](docs/USER_GUIDE.md#2-指令與操作)
*   [排程監控機制](docs/USER_GUIDE.md#3-自動化排程)
*   [常見問題排除](docs/USER_GUIDE.md#4-疑難排解)

---

## 🔧 維護 (Maintenance)

### 更新 Bot
```bash
npm update -g joyeli/tw-stocker-bot
```

### 移除 Bot
```bash
npm uninstall -g joyeli/tw-stocker-bot
```
