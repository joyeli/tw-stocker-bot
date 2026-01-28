const { Telegraf } = require('telegraf');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const https = require('https');

/**
 * Handles the interactive pairing process with Telegram
 * Returns: { token, ownerId, botUsername }
 */
async function startPairing(existingToken = null) {
    console.log(chalk.blue.bold('\n🔐 Telegram 安全配對程序'));

    // 1. Ask for Token
    let token = existingToken;
    if (!token) {
        const answer = await inquirer.prompt([{
            type: 'password',
            name: 'token',
            message: '請輸入您的 Telegram Bot Token:',
            validate: input => input.length > 20 ? true : 'Token 長度似乎不正確'
        }]);
        token = answer.token;
    }

    // 2. Verify Token
    const spinner = ora('驗證 Token 中...').start();
    
    // Force IPv4 Agent to avoid timeout issues in some environments
    const agent = new https.Agent({ family: 4, keepAlive: true });
    const tempBot = new Telegraf(token, { telegram: { agent } });
    
    let botInfo = { username: 'UnknownBot' };
    
    try {
        botInfo = await tempBot.telegram.getMe();
        spinner.succeed(`Token 有效！Bot 名稱: @${botInfo.username}`);
    } catch (e) {
        spinner.warn(`Token 驗證連線異常 (${e.message})，嘗試強制繼續配對...`);
        // throw new Error(`Invalid Token: ${e.message}`); // Allow proceed
    }

    // 3. Generate OTP & Deep Link
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit code
    const botLink = `https://t.me/${botInfo.username}?start=${otp}`;

    console.log(chalk.yellow('\n⚠️  請執行以下動作完成配對：'));
    console.log(`1. 請點擊此連結 (或複製到瀏覽器開啟)：`);
    console.log(chalk.cyan.underline(botLink));
    console.log(`2. 在 Telegram 中點擊 **Start**`);
    console.log(chalk.gray(`(或者手動搜尋 @${botInfo.username} 並發送驗證碼: ${otp})`));

    // 4. Wait for user message
    const waitSpinner = ora(`等待配對訊號... (逾時 60秒)`).start();
    
    return new Promise((resolve, reject) => {
        let isDone = false;
        
        // Setup timeout
        const timeout = setTimeout(() => {
            if (!isDone) {
                tempBot.stop();
                waitSpinner.fail('配對逾時。');
                reject(new Error('Pairing Timeout'));
            }
        }, 60000);

        // Handle /start specially - Don't treat it as a wrong code
        tempBot.start((ctx) => {
            // Check if start payload contains OTP
            // /start 1234
            const payload = ctx.message.text.split(' ')[1];
            
            if (payload === otp) {
                // Success via Deep Link
                completePairing(ctx);
            } else {
                ctx.reply('👋 配對模式已啟動。請輸入 CLI 顯示的 4 位數驗證碼。');
            }
        });

        tempBot.on('text', async (ctx) => {
            const text = ctx.message.text.trim();
            if (text === otp) {
                // Success via Manual Entry
                completePairing(ctx);
            } else {
                if (/^\d{4}$/.test(text)) {
                    await ctx.reply('❌ 驗證碼錯誤，請重新輸入 CLI 顯示的代碼。');
                }
            }
        });

        function completePairing(ctx) {
            if (isDone) return;
            isDone = true;
            clearTimeout(timeout);
            
            const ownerId = ctx.from.id;
            const username = ctx.from.username;
            
            ctx.reply('✅ 配對成功！我是您的專屬助理。');
            waitSpinner.succeed(`收到訊號！配對成功。 (Owner ID: ${ownerId})`);
            
            tempBot.stop();
            resolve({
                token: token,
                ownerId: ownerId,
                username: username
            });
        }

        // dropPendingUpdates: true => Ignore messages sent while bot was offline
        tempBot.launch({ dropPendingUpdates: true });
    });
}

module.exports = { startPairing };
