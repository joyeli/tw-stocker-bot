const schedule = require('node-schedule');
const chalk = require('chalk');
const memory = require('../memory');

class SchedulerService {
    constructor(botService) {
        this.bot = botService.bot;
        this.adapter = botService.adapter;
        this.model = botService.model;
        this.jobs = [];
        this.config = botService.config;
    }

    start() {
        console.log(chalk.blue('⏰ 啟動排程監控服務...'));

        // 1. 盤中監控 (Intraday Monitor)
        // 週一至週五，09:00 - 13:30
        const intervalMinutes = this.config.get('scheduler.interval') || 30;
        
        // Generate Cron based on minutes (simple approximation)
        // e.g. */30 9-13 * * 1-5
        const cronExpr = `*/${intervalMinutes} 9-13 * * 1-5`;
        
        const intradayJob = schedule.scheduleJob(cronExpr, () => {
            this.runIntradayCheck();
        });
        this.jobs.push(intradayJob);
        console.log(chalk.gray(`   ✅ 已排程: 盤中監控 (每 ${intervalMinutes} 分鐘)`));

        // 2. 盤後分析 (After-hours Report)
        // 週一至週五，15:00
        const closeJob = schedule.scheduleJob('0 15 * * 1-5', () => {
            this.runAfterHoursReport();
        });
        this.jobs.push(closeJob);
        console.log(chalk.gray('   ✅ 已排程: 盤後日報 (15:00)'));
    }

    stop() {
        this.jobs.forEach(job => job.cancel());
        console.log(chalk.yellow('⏰ 排程服務已停止。'));
    }

    /**
     * 核心邏輯: 執行盤中檢查
     */
    async runIntradayCheck() {
        console.log(chalk.magenta('🔍 [Scheduler] 執行盤中掃描...'));
        
        // 取得所有使用者 (目前設計是單人 Bot，但架構支援多人)
        const ownerId = this.config.get('telegram.ownerId');
        if (!ownerId) {
            console.warn('⚠️  無法執行排程：找不到 Owner ID。');
            return;
        }

        const user = memory.getUser(ownerId);
        const watchlist = Object.keys(user.watchlist || {});
        
        if (watchlist.length === 0) {
            console.log('   (觀察清單為空，跳過)');
            return;
        }

        // 組合 Prompt
        // 這裡我們不希望 AI 廢話太多，只要求它檢查「異常」。
        const stocks = watchlist.join(', ');
        const prompt = `
[System Task: Intraday Monitor]
Target Stocks: ${stocks}
Current Time: ${new Date().toLocaleTimeString('zh-TW')}

Action:
1. Check real-time price and technical status for these stocks.
2. Compare with User's Cost (if any in context).
3. **ONLY** report if there are significant events (e.g., price surge/drop > 3%, breaking support/resistance, crossing cost price).
4. If everything is calm, reply with "NONE".
5. Keep it concise.
`;
        
        try {
            // Get Context
            const context = memory.getAIContext(ownerId);
            
            // Call AI
            console.log(`   Asking AI to check: ${stocks}`);
            const response = await this.adapter.execute(prompt, context, this.model);

            // Filter response
            if (response.includes("NONE") || response.length < 10) {
                console.log('   (AI 回報無異常)');
                return; 
            }

            // Push Notification
            await this.bot.telegram.sendMessage(ownerId, `🚨 **盤中警示**\n\n${response}`, { parse_mode: 'Markdown' });
            console.log('   ✅ 已發送警示通知。');

        } catch (e) {
            console.error(chalk.red(`   ❌ 盤中檢查失敗: ${e.message}`));
        }
    }

    /**
     * 核心邏輯: 執行盤後日報
     */
    async runAfterHoursReport() {
        console.log(chalk.magenta('📊 [Scheduler] 執行盤後結算...'));
        
        const ownerId = this.config.get('telegram.ownerId');
        if (!ownerId) return;

        const context = memory.getAIContext(ownerId);
        const prompt = `
[System Task: Daily Report]
Time: Market Closed (15:00)

Action:
1. Summarize today's performance for User's Holdings and Watchlist.
2. Calculate estimated P/L based on User's Cost.
3. Give advice for tomorrow.
`;

        try {
            await this.bot.telegram.sendMessage(ownerId, '📊 收盤了！正在為您生成今日投資日報...');
            const response = await this.adapter.execute(prompt, context, this.model);
            await this.bot.telegram.sendMessage(ownerId, response, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(chalk.red(`   ❌ 盤後報告失敗: ${e.message}`));
        }
    }
}

module.exports = SchedulerService;
