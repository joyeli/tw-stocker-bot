const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const Conf = require('conf');
const aiCli = require('../adapters/ai-cli');
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const { startPairing } = require('../utils/telegram-pairing');

// Separate configs
// 1. bot-config.json (Preferences, managed by 'conf')
// Force config to be in current working directory
const userConfig = new Conf({ 
    projectName: 'tw-stocker-bot', 
    configName: 'bot-config',
    cwd: process.cwd()
});
// 2. bot-env.json (System Paths)
const ENV_CONFIG_PATH = path.join(process.cwd(), 'bot-env.json');
// 3. .env (Secrets)
const DOTENV_PATH = path.join(process.cwd(), '.env');

const SKILL_REPO = 'https://github.com/joyeli/tw-stocker-consultant';

async function initCommand(options) {
    console.log(chalk.blue.bold('\n🤖 Stocker Bot 智慧初始化 (v2)\n'));

    const envData = {};

    // --- Phase 1: Environment Snapshot ---
    console.log(chalk.cyan('🔍 Phase 1: 環境掃描'));
    
    // 1. Node
    envData.nodePath = shell.which('node').stdout;
    console.log(`   Node.js: ${envData.nodePath}`);

    // 2. AI CLI
    const availableCLIs = aiCli.detectAvailableCLIs();
    if (availableCLIs.length === 0) {
        console.error(chalk.red('❌ 找不到支援的 AI CLI 工具！'));
        console.log('請安裝: gemini-cli 或 claude-code');
        process.exit(1);
    }
    
    // Select CLI
    let selectedCLI = availableCLIs[0];
    if (availableCLIs.length > 1) {
        const answer = await inquirer.prompt([{ 
            type: 'list',
            name: 'cli',
            message: '偵測到多個 AI CLI，請選擇核心引擎：',
            choices: availableCLIs
        }]);
        selectedCLI = answer.cli;
    }
    envData.aiCli = selectedCLI;
    console.log(`   AI Engine: ${selectedCLI}`);

    // Select Model
    const adapter = aiCli.getAdapter(selectedCLI);
    const spinner = ora('獲取模型列表中...').start();
    const models = await adapter.getModels();
    spinner.stop();

    const modelAnswer = await inquirer.prompt([{ 
        type: 'list',
        name: 'model',
        message: `選擇 ${selectedCLI} 模型：`,
        choices: models
    }]);
    
    // Save to User Config (Preferences)
    userConfig.set('ai.cli', selectedCLI);
    userConfig.set('ai.model', modelAnswer.model);
    
    // Also keep in envData for reference if needed, or remove from envData
    // envData.aiModel = modelAnswer.model; // Duplicate, removing for clarity

    // --- Phase 2: Skill Installation & Python ---
    console.log(chalk.cyan('\n📦 Phase 2: Skill 部署'));
    
    // Install Skill
    try {
        await adapter.installSkill(SKILL_REPO);
    } catch (e) {
        console.warn(chalk.yellow(`   Skill 安裝非致命錯誤: ${e.message}`));
    }

    // Resolve Python Path (Skill specific)
    // Assuming relative path based on workspace installation strategy
    let skillRoot = '';
    if (selectedCLI === 'gemini') {
         // Gemini (Workspace Scope) installs to .gemini/skills/...
         skillRoot = path.resolve(process.cwd(), '.gemini/skills/tw-stocker-consultant');
    } else {
         // Claude (Manual Clone) installs to .claude/skills/...
         skillRoot = path.resolve(process.cwd(), '.claude/skills/tw-stocker-consultant');
    }

    if (skillRoot && fs.existsSync(skillRoot)) {
        envData.skillPath = skillRoot;
        const cliScript = path.join(skillRoot, 'scripts', 'cli.py');

        if (fs.existsSync(cliScript)) {
            console.log(`   Skill Core: ${cliScript}`);
            // Python Init
            console.log(chalk.gray('   正在初始化 Python 環境 (venv)... 這可能需要幾分鐘...'));
            
            // Execute python init INSIDE the skill directory to ensure venv is created there
            const initRes = shell.exec(`python3 scripts/cli.py init --mode venv`, { 
                silent: false,
                cwd: skillRoot // Critical: Run inside the skill dir
            });
            
            if (initRes.code !== 0) {
                 console.error(chalk.red('   ❌ Python init 失敗，請稍後手動檢查。'));
            } else {
                 console.log(chalk.green('   ✅ Python 環境就緒 (Dependencies Installed)'));
                 envData.pythonMode = 'venv';
                 // Try to find venv path (relative to skill root)
                 const venvPath = path.join(skillRoot, '.venv/bin/python'); // Linux/Mac
                 if (fs.existsSync(venvPath)) envData.pythonExec = venvPath;
                 else envData.pythonExec = 'python3'; // Fallback
            }
        } else {
            console.warn(chalk.yellow(`   ⚠️  警告：找不到 Skill 入口 (${cliScript})`));
        }
    } else {
        console.warn(chalk.yellow(`   ⚠️  警告：找不到 Skill 目錄 (${skillRoot})，跳過 Python 初始化。`));
        if (selectedCLI === 'gemini') {
            console.log(chalk.gray('   (請確認 gemini skills install 是否成功)'));
        }
    }

    // Save Environment Config
    fs.writeFileSync(ENV_CONFIG_PATH, JSON.stringify(envData, null, 2));
    console.log(chalk.green(`   ✅ 環境變數已寫入 ${ENV_CONFIG_PATH}`));

    // --- Phase 3: Telegram Pairing ---
    console.log(chalk.cyan('\n🔐 Phase 3: 安全配對'));
    
    // Check if .env exists
    let existingToken = null;
    if (fs.existsSync(DOTENV_PATH)) {
        const envContent = fs.readFileSync(DOTENV_PATH, 'utf-8');
        const match = envContent.match(/BOT_TOKEN=(.+)/);
        if (match) existingToken = match[1].trim();
    }

    let doPairing = true;
    if (existingToken) {
        const ans = await inquirer.prompt([{
            type: 'confirm',
            name: 're-pair',
            message: '偵測到現有 Token，是否重新配對？',
            default: false
        }]);
        if (!ans['re-pair']) doPairing = false;
        else existingToken = null; // Reset if re-pairing
    }

    if (doPairing) {
        try {
            const result = await startPairing(existingToken);
            
            // Save .env
            const envContent = `BOT_TOKEN=${result.token}\n`;
            fs.writeFileSync(DOTENV_PATH, envContent);
            console.log(chalk.green('   ✅ Token 已寫入 .env'));

            // Save Owner ID
            userConfig.set('telegram.ownerId', result.ownerId);
            if (result.username) {
                userConfig.set('telegram.username', result.username);
            }
            console.log(chalk.green(`   ✅ 綁定擁有者 ID: ${result.ownerId}`));

        } catch (e) {
            console.error(chalk.red(`   ❌ 配對失敗: ${e.message}`));
            console.log('   您可以稍後再次執行 init 進行重試。');
        }
    } else {
        console.log(chalk.gray('   跳過配對流程。'));
    }

    // --- Phase 4: User Profile ---
    console.log(chalk.cyan('\n👤 Phase 4: 個人化設定'));
    const profile = await inquirer.prompt([
        {
            type: 'list',
            name: 'strategy',
            message: '您的投資風格偏向？',
            choices: ['保守 (Conservative)', '穩健 (Moderate)', '積極 (Aggressive)']
        }
    ]);
    userConfig.set('preferences.strategy', profile.strategy);
    console.log(chalk.green('   ✅ 設定已儲存。'));

    console.log(chalk.green.bold('\n🎉 系統設定完成！'));
    console.log(`請執行 ${chalk.cyan('tw-stocker-bot start')} 啟動您的專屬助理。`);
}

module.exports = initCommand;
