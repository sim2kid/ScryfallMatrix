import axios from 'axios';
import fs from 'fs';
import path from 'path';

class ScryfallAgent {
    constructor() {
        this.apiUrl = process.env.SCRYFALL_API_URL || 'https://api.scryfall.com';
        this.cache = new Map();
        this.cacheTTL = (parseInt(process.env.CACHE_TTL) || 86400) * 1000; // default 24h
        this.maxMemory = parseInt(process.env.CACHE_MAX_MEMORY) || 0; // 0 = unlimited
        this.gcInterval = parseInt(process.env.CACHE_GC_GC_INTERVAL) || 300000; // 5 minutes
        this.lastRequestTime = 0;
        this.minDelay = 100; // 100ms delay between requests

        this.imageCache = new Map();
        this.imageCacheTTL = 7 * 24 * 60 * 60 * 1000; // 1 week for images
        
        this.cacheDir = path.resolve('cache');
        this.imageCacheDir = path.join(this.cacheDir, 'images');
        this.ensureDirectories();

        // Get version from package.json
        const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
        this.userAgent = `UnofficialScryfallMatrixBot/${pkg.version}`;

        this.startGC();
    }
    
    ensureDirectories() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.imageCacheDir)) {
            fs.mkdirSync(this.imageCacheDir, { recursive: true });
        }
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

    async getRulings(rulingsUri) {
        const cacheKey = `rulings:${rulingsUri}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        await this.throttle();

        try {
            console.log(`[SCRYFALL] Fetching rulings from: ${rulingsUri}`);
            const response = await axios.get(rulingsUri, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            const rulingsData = response.data;
            this.setCache(cacheKey, rulingsData);
            return rulingsData;
        } catch (error) {
            console.error(`[SCRYFALL] Error fetching rulings: ${error.message}`);
            return null;
        }
    }

    async getSymbology() {
        const cacheKey = 'symbology';
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        await this.throttle();

        try {
            console.log('[SCRYFALL] Fetching symbology...');
            const response = await axios.get(`${this.apiUrl}/symbology`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            const symbologyData = response.data;
            this.setCache(cacheKey, symbologyData);
            return symbologyData;
        } catch (error) {
            console.error(`[SCRYFALL] Error fetching symbology: ${error.message}`);
            return null;
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

    async getImage(imageUrl) {
        const cacheKey = imageUrl;
        const cached = this.getImageCache(cacheKey);
        if (cached) return cached;

        await this.throttle();

        try {
            console.log(`[SCRYFALL] Fetching image: ${imageUrl}`);
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': this.userAgent
                }
            });

            const contentType = response.headers['content-type'] || 'image/png';
            const imageData = {
                buffer: Buffer.from(response.data, 'binary'),
                contentType
            };

            this.setImageCache(cacheKey, imageData);
            return imageData;
        } catch (error) {
            console.error(`[SCRYFALL] Error fetching image: ${error.message}`);
            return null;
        }
    }

    getImageCache(key) {
        const entry = this.imageCache.get(key);
        if (entry) {
            if (Date.now() - entry.timestamp > this.imageCacheTTL) {
                this.imageCache.delete(key);
                return null;
            }
            entry.lastAccess = Date.now();
            return entry.data;
        }
        return null;
    }

    setImageCache(key, data) {
        this.imageCache.set(key, {
            data,
            timestamp: Date.now(),
            lastAccess: Date.now()
        });
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

            for (const [key, entry] of this.imageCache.entries()) {
                if (now - entry.timestamp > this.imageCacheTTL) {
                    this.imageCache.delete(key);
                }
            }

            if (this.maxMemory > 0) {
                while (this.cache.size > this.maxMemory) {
                    this.evictOldest();
                }
            }
        }, this.gcInterval);

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
