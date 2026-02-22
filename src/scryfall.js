import axios from 'axios';
import fs from 'fs';
import path from 'path';

class ScryfallAgent {
    constructor() {
        this.apiUrl = process.env.SCRYFALL_API_URL || 'https://api.scryfall.com';
        this.cache = new Map();
        this.cacheTTL = (parseInt(process.env.CACHE_TTL) || 86400) * 1000; // default 24h
        this.maxMemory = parseInt(process.env.CACHE_MAX_MEMORY) || 0; // 0 = unlimited
        this.gcInterval = parseInt(process.env.CACHE_GC_INTERVAL) || 300000; // 5 minutes
        this.lastRequestTime = 0;
        this.minDelay = 100; // 100ms delay between requests

        // Get version from package.json
        const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
        this.userAgent = `UnofficialScryfallMatrixBot/${pkg.version}`;

        this.startGC();
    }

    async getCardByName(name, fuzzy = true) {
        const cacheKey = `name:${name.toLowerCase().trim()}:${fuzzy}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        await this.throttle();

        try {
            console.log(`[SCRYFALL] Fetching card: ${name}`);
            const response = await axios.get(`${this.apiUrl}/cards/named`, {
                params: fuzzy ? { fuzzy: name } : { exact: name },
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            const cardData = response.data;
            this.setCache(cacheKey, cardData);
            return cardData;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            throw error;
        }
    }

    async searchCards(query, options = {}) {
        const params = {
            q: query,
            unique: options.unique || 'cards',
            order: options.order || 'name',
            dir: options.dir || 'auto',
            include_extras: options.include_extras || false,
            include_multilingual: options.include_multilingual || false,
            include_variations: options.include_variations || false,
            page: 1, // Always request first page for most relevant card
            format: 'json',
            pretty: false
        };

        const cacheKey = `search:${JSON.stringify(params)}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        await this.throttle();

        try {
            console.log(`[SCRYFALL] Searching cards: ${query}`);
            const response = await axios.get(`${this.apiUrl}/cards/search`, {
                params,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            const searchResults = response.data;
            const mostRelevantCard = (searchResults.data && searchResults.data.length > 0) ? searchResults.data[0] : null;
            
            if (mostRelevantCard) {
                this.setCache(cacheKey, mostRelevantCard);
            }
            
            return mostRelevantCard;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            throw error;
        }
    }

    async throttle() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minDelay) {
            const delay = this.minDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    }

    getCache(key) {
        const entry = this.cache.get(key);
        if (entry) {
            if (Date.now() - entry.timestamp > this.cacheTTL) {
                this.cache.delete(key);
                return null;
            }
            entry.lastAccess = Date.now();
            return entry.data;
        }
        return null;
    }

    setCache(key, data) {
        // Simple memory limit check if enabled
        if (this.maxMemory > 0) {
            // Rough estimation of memory usage
            const currentSize = this.cache.size;
            if (currentSize >= this.maxMemory) {
                this.evictOldest();
            }
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            lastAccess: Date.now()
        });
    }

    evictOldest() {
        let oldestKey = null;
        let oldestAccess = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            console.log(`[CACHE] Evicting oldest item: ${oldestKey}`);
            this.cache.delete(oldestKey);
        }
    }

    startGC() {
        this.gcTimer = setInterval(() => {
            console.log('[CACHE] Running garbage collection...');
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.cacheTTL) {
                    this.cache.delete(key);
                }
            }

            // If still over memory (if maxMemory is interpreted as count for simplicity here,
            // or we could use actual memory if needed, but the prompt said "memory size limit"
            // and usually NodeCache uses count or we can use rough object size)
            // Re-reading prompt: "The cache will also have a memory size limit. By default, it's unlimited"
            // "If we're over memory, we'll GC the oldest cache items first."
            // Implementing as count of items for now as it's more standard for simple caches unless specified MB.
            if (this.maxMemory > 0) {
                while (this.cache.size > this.maxMemory) {
                    this.evictOldest();
                }
            }
        }, this.gcInterval);

        // Unref to prevent keeping the process alive
        if (this.gcTimer.unref) {
            this.gcTimer.unref();
        }
    }

    stopGC() {
        if (this.gcTimer) {
            clearInterval(this.gcTimer);
            this.gcTimer = null;
        }
    }
}

export const scryfall = new ScryfallAgent();
