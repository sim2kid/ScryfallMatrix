import assert from 'node:assert';
import test from 'node:test';
import { scryfall } from '../src/scryfall.js';

test('ScryfallAgent Cache Logic', async (t) => {
    // Mock card data
    const mockCard = { name: 'Black Lotus', set_name: 'Limited Edition Alpha' };

    // Test set and get cache
    scryfall.setCache('name:black lotus:true', mockCard);
    const cached = scryfall.getCache('name:black lotus:true');
    assert.deepStrictEqual(cached, mockCard, 'Should retrieve cached card');

    // Test cache miss
    const miss = scryfall.getCache('name:nonexistent:true');
    assert.strictEqual(miss, null, 'Should return null for cache miss');
});

test('ScryfallAgent Memory Limit', async (t) => {
    // Save original maxMemory
    const originalMaxMemory = scryfall.maxMemory;
    scryfall.maxMemory = 2; // Set limit to 2 items for testing
    scryfall.cache.clear();

    scryfall.setCache('item1', { id: 1 });
    scryfall.setCache('item2', { id: 2 });
    assert.strictEqual(scryfall.cache.size, 2);

    // Adding third item should trigger eviction
    scryfall.setCache('item3', { id: 3 });
    assert.strictEqual(scryfall.cache.size, 2, 'Should maintain size limit');
    assert.strictEqual(scryfall.cache.has('item1'), false, 'Item 1 should be evicted (oldest)');
    assert.ok(scryfall.cache.has('item2'));
    assert.ok(scryfall.cache.has('item3'));

    // Restore original maxMemory
    scryfall.maxMemory = originalMaxMemory;
});

test('ScryfallAgent User-Agent', (t) => {
    assert.match(scryfall.userAgent, /^UnofficialScryfallMatrixBot\/\d+\.\d+\.\d+$/, 'User-Agent should match required format');
});
