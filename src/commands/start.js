const chalk = require('chalk');
const BotService = require('../services/bot');

async function startCommand(options) {
    try {
        const bot = new BotService();
        bot.start();
        
        console.log(chalk.green('✅ 常駐服務已啟動。請按 Ctrl+C 停止。'));
    } catch (e) {
        console.error(chalk.red(`❌ 啟動失敗: ${e.message}`));
        if (e.message.includes('Token')) {
            console.log(chalk.yellow('提示: 請建立 .env 檔案並設定 BOT_TOKEN=您的Token'));
        }
        if (e.message.includes('Adapter')) {
            console.log(chalk.yellow('提示: 請先執行 "tw-stocker-bot init" 進行初始化。'));
        }
        process.exit(1);
    }
}

module.exports = startCommand;