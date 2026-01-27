const Conf = require('conf');

// --- Schema Definition (Documentation Only) ---
// {
//   "users": {
//     "123": {
//       "id": 123,
//       "username": "jdoe",
//       "preferences": { "risk": "medium", "strategy": "growth" },
//       "holdings": {
//         "2330": { "code": "2330", "cost": 500, "shares": 1000, "date": "2023-01-01" }
//       },
//       "watchlist": {
//         "0050": { "code": "0050", "triggers": [{ "type": "price_below", "value": 120 }] }
//       },
//       "journal": {
//         "2330": ["2023-10-01: 看好先進製程"]
//       },
//       "history": [
//         { "role": "user", "content": "..." },
//         { "role": "model", "content": "..." }
//       ]
//     }
//   }
// }

class MemoryManager {
    constructor() {
        this.db = new Conf({
            projectName: 'tw-stocker-bot',
            defaults: { users: {} }
        });
        this.HISTORY_LIMIT = 10; // Keep last 10 messages
    }

    /**
     * Get or initialize user
     */
    getUser(userId, username = '') {
        const key = `users.${userId}`;
        let user = this.db.get(key);
        
        if (!user) {
            user = {
                id: userId,
                username: username,
                preferences: { risk: 'medium', strategy: 'balanced' },
                holdings: {},
                watchlist: {},
                journal: {},
                history: []
            };
            this.db.set(key, user);
        }
        return user;
    }

    /**
     * Update User Holdings (Inventory)
     */
    setHolding(userId, code, cost, shares = 0) {
        const key = `users.${userId}.holdings.${code}`;
        this.db.set(key, {
            code,
            cost: parseFloat(cost),
            shares: parseInt(shares),
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Add to Watchlist with optional triggers
     */
    addToWatchlist(userId, code, triggers = []) {
        const key = `users.${userId}.watchlist.${code}`;
        const current = this.db.get(key) || { code, triggers: [] };
        
        // Merge triggers
        const newTriggers = [...current.triggers, ...triggers];
        
        this.db.set(key, {
            code,
            triggers: newTriggers,
            updatedAt: new Date().toISOString()
        });
        
        return Object.keys(this.getUser(userId).watchlist);
    }

    removeFromWatchlist(userId, code) {
        this.db.delete(`users.${userId}.watchlist.${code}`);
        return Object.keys(this.getUser(userId).watchlist);
    }

    /**
     * Add Investment Note (Journal)
     */
    addNote(userId, code, content) {
        const key = `users.${userId}.journal.${code}`;
        const notes = this.db.get(key) || [];
        const entry = `[${new Date().toISOString().split('T')[0]}] ${content}`;
        notes.push(entry);
        this.db.set(key, notes);
    }

    /**
     * Chat History Management
     */
    addHistory(userId, role, content) {
        const key = `users.${userId}.history`;
        let history = this.db.get(key) || [];
        
        history.push({ role, content, timestamp: Date.now() });
        
        // Trim
        if (history.length > this.HISTORY_LIMIT) {
            history = history.slice(-this.HISTORY_LIMIT);
        }
        
        this.db.set(key, history);
    }

    /**
     * Generate Context for AI Prompt
     * This is the "Brain Dump" function
     */
    getAIContext(userId) {
        const user = this.getUser(userId);
        
        // Simplify for AI consumption (save tokens)
        return {
            profile: {
                risk: user.preferences.risk,
                strategy: user.preferences.strategy
            },
            holdings: Object.values(user.holdings).map(h => `${h.code} (Cost: ${h.cost})`),
            watchlist: Object.keys(user.watchlist),
            recent_notes: user.journal, // Map of code -> notes
            conversation_history: user.history.map(h => `${h.role}: ${h.content}`)
        };
    }
    
    // Legacy support for basic list
    getWatchlist(userId) {
        return Object.keys(this.getUser(userId).watchlist);
    }
}

module.exports = new MemoryManager();
