const aiCli = require('./src/adapters/ai-cli');

async function test() {
    console.log("🔍 Testing Gemini Adapter...");
    const adapter = aiCli.getAdapter('gemini');
    
    const mockUser = {
        id: 123,
        username: "TestUser",
        watchlist: ["2330", "0050"],
        preferences: { strategy: "conservative" }
    };
    
    const prompt = "幫我分析台積電，我這檔套牢在 600 元";
    
    try {
        // We expect execute to try running a shell command. 
        // Since 'gemini' might not be in path or config is missing, it might fail or return mock.
        // But we want to see the LOGS of what command it generates.
        await adapter.execute(prompt, mockUser, 'gemini-1.5-pro-preview');
    } catch (e) {
        console.log("✅ Expected execution attempt (It might fail without real CLI):");
        console.log(e.message);
    }
}

test();
