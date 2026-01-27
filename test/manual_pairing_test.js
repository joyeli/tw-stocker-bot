const path = require('path');
// Try to load from root .env regardless of where script is run from
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const { startPairing } = require('../src/utils/telegram-pairing');
const chalk = require('chalk');

const TOKEN = process.env.BOT_TOKEN;

async function test() {
    console.log(chalk.blue.bold('🚀 啟動真實配對測試 (Manual Pairing)...'));

    if (!TOKEN) {
        console.error(chalk.red('❌ 錯誤: 找不到 BOT_TOKEN'));
        console.log(chalk.yellow('請在專案根目錄建立 .env 檔案，並填入:'));
        console.log(chalk.gray('BOT_TOKEN=你的_Telegram_Token'));
        process.exit(1);
    }

    console.log(`使用 Token: ${TOKEN.substring(0, 5)}...******`);

    try {
        const result = await startPairing(TOKEN);
        
        console.log(chalk.green.bold('\n🎉 配對成功！'));
        console.log('-----------------------------------');
        console.log(`Token:      ${result.token.substring(0, 10)}...`);
        console.log(`Owner ID:   ${result.ownerId}`);
        console.log(`Username:   ${result.username}`);
        console.log('-----------------------------------');
        console.log(chalk.gray('測試結束。'));
        
        process.exit(0);
    } catch (e) {
        console.error(chalk.red(`\n❌ 配對失敗: ${e.message}`));
        process.exit(1);
    }
}

test();
