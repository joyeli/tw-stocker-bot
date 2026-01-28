const shell = require('shelljs');
const chalk = require('chalk');
const axios = require('axios');

/**
 * Base Adapter Class
 */
class BaseAdapter {
    constructor(cmd) {
        this.cmd = cmd;
    }

    check() {
        return shell.which(this.cmd) !== null;
    }

    async getModels() {
        throw new Error("Not implemented");
    }

    async installSkill(repoUrl) {
        throw new Error("Not implemented");
    }

    getInstallCommand() {
        return `npm install -g ${this.cmd}`; // Default guess
    }

    /**
     * Execute the AI Agent
     * @param {string} prompt - The user's request
     * @param {object} context - User memory/context (JSON)
     * @param {string} model - Selected model
     */
    async execute(prompt, context = {}, model) {
        throw new Error("Not implemented");
    }
}

/**
 * Gemini Adapter
 */
class GeminiAdapter extends BaseAdapter {
    constructor() {
        super('gemini');
        this.modelUrl = 'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/model.md';
    }

    async getModels() {
        // Real implementation: Fetch from GitHub Docs
        console.log(chalk.gray('   [Gemini] 正在從 GitHub 獲取線上模型列表...'));
        
        try {
            const response = await axios.get(this.modelUrl);
            const content = response.data;
            
            // Regex to find words starting with gemini- followed by version numbers/words
            // We specifically look for strings that look like model names
            const regex = /\bgemini-[a-zA-Z0-9.-]+\b/g;
            const found = content.match(regex);
            
            if (!found || found.length === 0) {
                console.warn(chalk.yellow('   [Warning] 找不到模型資訊，將使用預設值。'));
                return ['gemini-1.5-pro', 'gemini-1.5-flash'];
            }

            // Deduplicate
            const uniqueModels = [...new Set(found)];
            
            // Filter: remove things that end with dot or are just 'gemini-cli' if any
            // Also filter out .md files
            const cleaned = uniqueModels
                .filter(m => !m.endsWith('.'))
                .filter(m => !m.endsWith('.md'))
                .filter(m => m !== 'gemini-cli'); 
            
            return cleaned.length > 0 ? cleaned : ['gemini-1.5-pro', 'gemini-1.5-flash'];

        } catch (e) {
            console.warn(chalk.yellow(`   [Warning] 獲取模型失敗: ${e.message}`));
            return ['gemini-1.5-pro', 'gemini-1.5-flash']; // Fallback
        }
    }

    async installSkill(repoUrl) {
        console.log(`[Gemini] 正在安裝 Skill: ${repoUrl}...`);
        
        // Use --consent to skip confirmation prompt
        // HACK: Prepend a dummy API key to bypass Gemini CLI's strict auth check during install
        const cmd = `GEMINI_API_KEY=placeholder gemini skills install ${repoUrl} --scope workspace --consent`;
        
        // Execute with logging enabled
        const res = shell.exec(cmd, { silent: false });
        const output = res.stdout + res.stderr;
        
        // Check for success keywords even if exit code is non-zero
        if (res.code !== 0) {
            if (output.includes('Successfully installed') || output.includes('already exists')) {
                console.log(chalk.green('   ✅ Skill 安裝成功 (已忽略非致命警告)'));
                return true;
            }

            console.warn(chalk.yellow('\n⚠️  自動安裝 Skill 失敗。'));
            console.log(chalk.white('這可能是因為 API Key 未設定或網路問題。請嘗試手動執行以下指令：'));
            console.log(chalk.cyan(`\n  ${cmd}\n`));
            console.log(chalk.gray('若您已經安裝過此 Skill，請忽略此訊息。'));
            return false;
        }
        return true;
    }

    async execute(prompt, context = {}, model) {
        if (!model) {
            throw new Error("AI Model not specified. Please run 'init' to select a model.");
        }

        // 1. Construct System Context
        const contextStr = JSON.stringify(context, null, 2);
        const fullPrompt = `
[System Context]
You are a professional Taiwan Stock Investment Consultant.
User Context (Holdings/Preferences): ${contextStr}

[User Request]
${prompt}

[Instruction]
Use available tools (tw-stocker-consultant) to gather data if needed. 
Reply in Traditional Chinese (Taiwan).
Analyze deeply based on the user's holdings (cost, strategy).
`;

        // 2. Execute Gemini CLI
        console.log(`[Gemini] 正在執行模型: ${model}`);
        
        // Sanitize prompt for shell using JSON.stringify to handle escapes
        // This wraps the string in quotes and escapes internal quotes
        // e.g. 'Hello "World"' -> '"Hello \"World\""'
        // We might need to wrap it in single quotes for shell if we use bash directly,
        // but shell.exec handles basic execution.
        // A simpler way for basic usage: escape double quotes manually if JSON.stringify adds outer quotes we don't want inside the shell string.
        
        const safePrompt = fullPrompt.replace(/"/g, '\\"');
        const cmd = `gemini run -m ${model} "${safePrompt}"`;
        
        return new Promise((resolve, reject) => {
            shell.exec(cmd, { silent: true }, (code, stdout, stderr) => {
                if (code !== 0) {
                    if (stderr && !stdout) {
                        return reject(new Error(`Gemini CLI 錯誤: ${stderr}`));
                    }
                }
                resolve(stdout.trim());
            });
        });
    }
}

/**
 * Claude Adapter (Claude Code CLI)
 */
class ClaudeAdapter extends BaseAdapter {
    constructor() {
        super('claude');
        this.modelUrl = 'https://code.claude.com/docs/en/model-config.md';
    }

    async getModels() {
        console.log(chalk.gray('   [Claude] 正在從官方文件獲取模型別名 (Alias)...'));
        
        try {
            const response = await axios.get(this.modelUrl);
            const content = response.data;
            
            // Parsing logic based on common markdown documentation structures.
            // We look for code blocks or list items that look like model aliases.
            // Based on the user provided link context, common aliases are 'sonnet', 'opus', 'haiku'.
            // We'll look for simple word matches that are commonly known aliases or specific patterns.
            
            // Regex to find typical short aliases in code ticks or table cells
            // Examples: `sonnet`, `opus`, `haiku`
            // We explicitly whitelist known patterns to avoid grabbing random text, 
            // but we try to be dynamic by parsing the doc.
            
            const possibleModels = [];
            
            // 1. Try to find table rows or lists
            // This is a heuristic. We look for words like 'sonnet', 'opus', 'haiku' 
            // potentially followed by version info, but the CLI uses the alias.
            
            const keywords = ['sonnet', 'opus', 'haiku', 'claude-3-5', 'claude-3'];
            const regex = /`([a-zA-Z0-9-.]+)`/g;
            const matches = content.match(regex);
            
            if (matches) {
                matches.forEach(m => {
                    const clean = m.replace(/`/g, '');
                    // Filter: must resemble a model name
                    if (keywords.some(k => clean.includes(k)) || clean === 'default') {
                        possibleModels.push(clean);
                    }
                });
            }

            const uniqueModels = [...new Set(possibleModels)];
            
            if (uniqueModels.length === 0) {
                 // Fallback if parsing fails
                 console.warn(chalk.yellow('   [Warning] 解析失敗，使用預設列表。'));
                 return ['sonnet', 'opus', 'haiku']; 
            }
            
            return uniqueModels;

        } catch (e) {
            console.warn(chalk.yellow(`   [Warning] 獲取 Claude 模型失敗: ${e.message}`));
            return ['sonnet', 'opus', 'haiku']; // Fallback
        }
    }

    async installSkill(repoUrl) {
        // Manual installation for Claude Code:
        // Clone into ./.claude/skills/
        const targetDir = '.claude/skills';
        const repoName = repoUrl.split('/').pop().replace('.git', '');
        const installPath = `${targetDir}/${repoName}`;

        console.log(`[Claude] 正在建立 Skill 目錄: ${targetDir}`);
        shell.mkdir('-p', targetDir);

        if (shell.test('-d', installPath)) {
            console.log(chalk.gray(`   [Claude] Skill 已存在於 ${installPath}，跳過下載。`));
        } else {
            console.log(`[Claude] 正在 Clone Skill 到 ${installPath}...`);
            if (shell.exec(`git clone ${repoUrl} ${installPath}`).code !== 0) {
                 throw new Error("Git Clone 失敗");
            }
            console.log(chalk.green(`✅ Skill 安裝完成 (${installPath})`));
        }
        return true;
    }

    async execute(prompt, context = {}, model) {
        // 1. Construct System Context
        const contextStr = JSON.stringify(context, null, 2);
        
        // Note: Claude Code is optimized for coding, but '-p' works for general queries.
        // We inject context into the prompt itself.
        const fullPrompt = `
[System Context]
You are a professional Taiwan Stock Investment Consultant.
User Context: ${contextStr}

[User Request]
${prompt}

[Instruction]
Reply in Traditional Chinese (Taiwan).
`;

        console.log(`[Claude] 正在執行... (Model: ${model})`);

        // 2. Execute Claude CLI
        // claude --model <model> -p "query"
        const safePrompt = fullPrompt.replace(/"/g, '\"');
        const cmd = `claude -p "${safePrompt}"`;
        
        return new Promise((resolve, reject) => {
            // Note: Claude might require authentication (claude login) beforehand.
            shell.exec(cmd, { silent: true }, (code, stdout, stderr) => {
                if (code !== 0) {
                     // Sometimes stderr has info even on success, but non-zero code is error.
                     if (stderr && !stdout) {
                        return reject(new Error(`Claude CLI 錯誤: ${stderr}`));
                     }
                }
                resolve(stdout.trim());
            });
        });
    }
}

const adapters = {
    gemini: new GeminiAdapter(),
    claude: new ClaudeAdapter()
};

module.exports = {
    detectAvailableCLIs: () => {
        const available = [];
        for (const [key, adapter] of Object.entries(adapters)) {
            if (adapter.check()) {
                available.push(key);
            }
        }
        return available;
    },
    getAdapter: (name) => adapters[name]
};
