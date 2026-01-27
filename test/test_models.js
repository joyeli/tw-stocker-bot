const aiCli = require('../src/adapters/ai-cli');

async function testModels() {
    console.log("🔍 測試模型獲取邏輯...");
    const adapter = aiCli.getAdapter('gemini');
    
    try {
        const models = await adapter.getModels();
        console.log("\n✅ 獲取到的模型:");
        console.log(JSON.stringify(models, null, 2));
    } catch (e) {
        console.error("❌ 錯誤:", e);
    }
}

testModels();
