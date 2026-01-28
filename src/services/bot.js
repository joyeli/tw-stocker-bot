require('dotenv').config();
const { Telegraf } = require('telegraf');
const Conf = require('conf');
const chalk = require('chalk');
const https = require('https'); // Import https
const memory = require('../memory'); 
const aiCli = require('../adapters/ai-cli');
const SchedulerService = require('./scheduler');

class BotService {
    constructor() {
        this.config = new Conf({ projectName: 'tw-stocker-bot' });
        this.token = process.env.BOT_TOKEN || this.config.get('telegram.token');
        
        if (!this.token) {
            throw new Error('找不到 Telegram Bot Token。請在 .env 檔案中設定 BOT_TOKEN，或使用 config 指令設定。');
        }

        // Force IPv4 Agent to prevent ETIMEDOUT on some networks
        const agent = new https.Agent({ family: 4, keepAlive: true });
        this.bot = new Telegraf(this.token, { telegram: { agent } });
        
        // Setup AI Adapter
        const cliName = this.config.get('ai.cli') || 'gemini';
        this.model = this.config.get('ai.model') || 'gemini-1.5-pro';
        this.adapter = aiCli.getAdapter(cliName);
        
        if (!this.adapter) {
            throw new Error(`找不到 AI Adapter '${cliName}'。請先執行 'init' 初始化。`);
        }

        // Setup Scheduler
        this.scheduler = new SchedulerService(this);
    }

    start() {
        console.log(chalk.blue('🚀 正在啟動 Stocker Bot 服務...'));
        console.log(chalk.gray(`   AI 引擎: ${this.adapter.cmd} (${this.model})`));

        // Get Owner ID
        const ownerId = this.config.get('telegram.ownerId');
        if (ownerId) {
            console.log(chalk.green(`   🔒 安全鎖定模式: 僅接受 ID ${ownerId} 的指令`));
        } else {
            console.warn(chalk.yellow('   ⚠️  警告: 未設定 Owner ID，Bot 將對所有人開放！'));
        }

        // Start Scheduler
        this.scheduler.start();

        // --- Middlewares ---
        this.bot.use(async (ctx, next) => {
            const start = Date.now();
            
            // Security Check
            if (ownerId && ctx.from && ctx.from.id !== ownerId) {
                console.log(chalk.yellow(`[Security] 拒絕未授權存取: ${ctx.from.id} (${ctx.from.username})`));
                // Optional: ctx.reply('⛔ 未授權的使用者。');
                return; // Stop processing
            }

            await next();
            const ms = Date.now() - start;
            console.log(chalk.gray(`[Bot] 請求已處理 (耗時 ${ms}ms)`));
        });

        // --- Commands ---
        this.bot.start((ctx) => {
            const user = memory.getUser(ctx.from.id, ctx.from.username);
            ctx.reply(`👋 您好 ${user.username || ''}！\n我是您的 AI 投資助理 (Powered by ${this.adapter.cmd})。\n\n請直接輸入股票代碼或問題，例如：\n"分析 2330"\n"我的 0050 套牢了怎麼辦"`);
        });

        this.bot.command('help', (ctx) => {
            ctx.reply(
                '🤖 指令清單：\n' +
                '/start - 啟用/配對\n' +
                '/add <代號> - 加入觀察\n' +
                '/del <代號> - 移除觀察\n' +
                '/cost <代號> <價格> - 設定持倉成本\n' +
                '/note <代號> <筆記> - 新增投資筆記\n' +
                '/list - 查看資產與觀察清單\n' +
                '直接輸入文字即可與 AI 對話分析。'
            );
        });

        this.bot.command('add', (ctx) => {
            const args = ctx.message.text.split(' ');
            if (args.length < 2) return ctx.reply('用法: /add <代號>');
            const code = args[1];
            
            const list = memory.addToWatchlist(ctx.from.id, code);
            ctx.reply(`✅ 已加入 ${code}。目前清單共 ${list.length} 檔。`);
        });

        this.bot.command('del', (ctx) => {
            const args = ctx.message.text.split(' ');
            if (args.length < 2) return ctx.reply('用法: /del <代號>');
            const code = args[1];
            
            const list = memory.removeFromWatchlist(ctx.from.id, code);
            ctx.reply(`🗑️ 已移除 ${code}。`);
        });

        this.bot.command('cost', (ctx) => {
            const args = ctx.message.text.split(' ');
            if (args.length < 3) return ctx.reply('用法: /cost <代號> <成本價>');
            const code = args[1];
            const price = parseFloat(args[2]);
            
            if (isNaN(price)) return ctx.reply('❌ 價格格式錯誤');
            
            memory.setHolding(ctx.from.id, code, price);
            ctx.reply(`💰 已設定 ${code} 成本為 ${price} 元。AI 分析時將會參考此數據。`);
        });

        this.bot.command('note', (ctx) => {
            const args = ctx.message.text.split(' ');
            if (args.length < 3) return ctx.reply('用法: /note <代號> <筆記內容...>');
            const code = args[1];
            const content = args.slice(2).join(' ');
            
            memory.addNote(ctx.from.id, code, content);
            ctx.reply(`📝 已紀錄對 ${code} 的筆記。`);
        });

        this.bot.command('list', (ctx) => {
            const user = memory.getUser(ctx.from.id);
            const watchlist = Object.keys(user.watchlist || {});
            const holdings = user.holdings || {};
            
            let msg = '📋 **您的投資概況**\n\n';
            
            if (Object.keys(holdings).length > 0) {
                msg += '💰 **持倉庫存**:\n';
                for (const [code, data] of Object.entries(holdings)) {
                    msg += `- ${code}: 成本 ${data.cost}\n`;
                }
                msg += '\n';
            }
            
            if (watchlist.length > 0) {
                msg += '👀 **觀察清單**:\n';
                msg += watchlist.join(', ') + '\n';
            } else {
                msg += '(觀察清單為空)\n';
            }

            ctx.replyWithMarkdown(msg);
        });

        // --- AI Chat Handler ---
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const userMsg = ctx.message.text;
            
            // Ignore commands
            if (userMsg.startsWith('/')) return;

            // Notify user "Thinking..." using native Chat Action
            // Telegram 'typing' status lasts for ~5s, so we need a loop for long tasks
            await ctx.sendChatAction('typing');
            const typingInterval = setInterval(() => {
                ctx.sendChatAction('typing').catch(() => {}); // Ignore errors if user blocked bot etc.
            }, 4000);

            try {
                // 1. Get Context (Memory v2)
                const context = memory.getAIContext(userId);
                
                // Add current message to history
                memory.addHistory(userId, 'user', userMsg);
                
                // 2. Call AI CLI
                console.log(chalk.cyan(`[AI] 正在處理來自 ${userId} 的訊息: ${userMsg}`));
                
                const response = await this.adapter.execute(userMsg, context, this.model);
                
                // Stop typing loop
                clearInterval(typingInterval);

                // Add response to history
                memory.addHistory(userId, 'model', response);
                
                // 3. Reply
                await ctx.replyWithMarkdown(response); 

            } catch (e) {
                clearInterval(typingInterval); // Ensure we stop typing
                console.error(chalk.red(`[AI 錯誤] ${e.message}`));
                await ctx.reply(`💥 抱歉，分析過程中發生錯誤：\n${e.message}\n\n請稍後再試。`);
            }
        });

        // --- Launch ---
        this.bot.launch();
        
        // Graceful Stop
        process.once('SIGINT', () => {
            this.scheduler.stop();
            this.bot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            this.scheduler.stop();
            this.bot.stop('SIGTERM');
        });
    }
}

module.exports = BotService;