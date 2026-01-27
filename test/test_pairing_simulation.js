const mock = require('mock-require');
const chalk = require('chalk');

// --- Mocks ---

// 1. Mock Inquirer (Simulate User Input)
mock('inquirer', {
    prompt: async (questions) => {
        console.log(chalk.gray(`   [MockUser] 被問到: ${questions[0].message}`));
        console.log(chalk.gray(`   [MockUser] 輸入: "FAKE_TOKEN_123456"`));
        return { token: 'FAKE_TOKEN_123456' };
    }
});

// 2. Mock Telegraf (Simulate Telegram API)
class MockTelegraf {
    constructor(token) {
        console.log(chalk.gray(`   [MockTelegram] Bot 初始化 (Token: ${token})`));
        this.telegram = {
            getMe: async () => {
                console.log(chalk.gray(`   [MockTelegram] 驗證 Token... 成功！`));
                return { username: 'TestBot' };
            }
        };
        this.listeners = [];
    }

    on(event, callback) {
        this.listeners.push(callback);
    }

    launch() {
        console.log(chalk.gray(`   [MockTelegram] Bot 啟動 Polling...`));
    }

    stop() {
        console.log(chalk.gray(`   [MockTelegram] Bot 停止。`));
    }

    // Helper to simulate incoming message
    emit(text, userId) {
        const ctx = {
            message: { text },
            from: { id: userId, username: 'TestUser' },
            reply: async (msg) => console.log(chalk.green(`   [BotReply] ${msg}`))
        };
        this.listeners.forEach(cb => cb(ctx));
    }
}

mock('telegraf', { Telegraf: MockTelegraf });

// --- Run Test ---

async function runTest() {
    console.log(chalk.blue.bold('🧪 啟動 Telegram 配對邏輯模擬測試...\n'));

    // Load the module AFTER mocking
    const { startPairing } = require('./src/utils/telegram-pairing');
    
    // We need to capture the MockTelegraf instance to emit events
    // Since startPairing creates a new instance internally, we rely on the fact that
    // our Mock class logs to console. 
    // To emit an event, we need a slight hack or we just modify the mock to auto-emit
    // But since startPairing generates a random OTP, the mock needs to know it?
    // Wait, the Mock doesn't know the OTP generated inside startPairing.
    
    // Trick: We will intercept console.log to catch the OTP, then emit it. 
    
    const originalLog = console.log;
    let capturedOTP = null;
    let mockBotInstance = null;

    // Hook into MockTelegraf constructor to get the instance
    const OriginalMock = require('telegraf').Telegraf;
    mock('telegraf', { 
        Telegraf: class extends OriginalMock {
            constructor(t) {
                super(t);
                mockBotInstance = this;
            }
        }
    });

    // Intercept stdout to find OTP
    console.log = function (msg) {
        if (typeof msg === 'string' && msg.includes('發送驗證碼:')) {
            // Extract OTP (it's colored, so strip ansi)
            const cleanMsg = msg.replace(/\u001b\[.*?m/g, ''); 
            const match = cleanMsg.match(/發送驗證碼: (\d{4})/);
            if (match) {
                capturedOTP = match[1];
                originalLog(chalk.magenta(`   [TestHarness] 攔截到 OTP: ${capturedOTP}`));
                
                // Simulate User Action after 1 second
                setTimeout(() => {
                    originalLog(chalk.magenta(`   [TestHarness] 模擬使用者發送 OTP...`));
                    if (mockBotInstance) {
                        mockBotInstance.emit(capturedOTP, 999888);
                    }
                }, 1000);
            }
        }
        originalLog(msg);
    };

    try {
        const result = await startPairing();
        console.log(chalk.blue('\n🧪 測試結果:'));
        console.log(JSON.stringify(result, null, 2));
        
        if (result.ownerId === 999888) {
            console.log(chalk.green.bold('\n✅ 測試成功：正確鎖定 Owner ID！'));
        } else {
            console.error(chalk.red('\n❌ 測試失敗：ID 不匹配'));
        }

    } catch (e) {
        console.error(chalk.red(`\n❌ 測試發生錯誤: ${e}`));
    } finally {
        // Restore
        console.log = originalLog;
    }
}

runTest();
