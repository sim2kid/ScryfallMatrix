import assert from 'node:assert';
import test from 'node:test';

function replaceCardImagesWithMxcs(html, cardImageCache) {
    if (!html || !cardImageCache) return html;
    
    const cardImageRegex = /<img[^>]+src="(https:\/\/cards\.scryfall\.io[^"]+)"[^>]*\/>/g;
    let result = html;
    let match;
    
    while ((match = cardImageRegex.exec(html)) !== null) {
        const imageUrl = match[1];
        const mxc = cardImageCache.get(imageUrl);
        if (mxc) {
            result = result.replace(imageUrl, mxc);
        }
    }
    
    return result;
}

test('replaceCardImagesWithMxcs - replaces scryfall URL with mxcurl', () => {
    const html = '<img src="https://cards.scryfall.io/normal/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg" alt="Card Image" />';
    const urlToMxc = new Map();
    urlToMxc.set('https://cards.scryfall.io/normal/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg', 'mxc://local/server/QnWzDnhQeiQzFKGciTTcCYSV');

    const result = replaceCardImagesWithMxcs(html, urlToMxc);
    
    assert.ok(result.includes('mxc://local/server/QnWzDnhQeiQzFKGciTTcCYSV'),
        'Should replace scryfall URL with MXC URI');
    assert.ok(!result.includes('https://cards.scryfall.io'),
        'Should not contain scryfall URL');
});

test('replaceCardImagesWithMxcs - handles double-faced cards', () => {
    const html = '<img data-card-front src="https://cards.scryfall.io/normal/front/b/1/b123456.jpg" />' +
                '<img data-card-back src="https://cards.scryfall.io/normal/back/b/1/b123456.jpg" />';
    const urlToMxc = new Map();
    urlToMxc.set('https://cards.scryfall.io/normal/front/b/1/b123456.jpg', 'mxc://local/server/frontImage');
    urlToMxc.set('https://cards.scryfall.io/normal/back/b/1/b123456.jpg', 'mxc://local/server/backImage');

    const result = replaceCardImagesWithMxcs(html, urlToMxc);
    
    assert.ok(result.includes('mxc://local/server/frontImage'), 'Should replace front image');
    assert.ok(result.includes('mxc://local/server/backImage'), 'Should replace back image');
    assert.ok(!result.includes('https://cards.scryfall.io'),
        'Should not contain any scryfall URLs');
});

test('replaceCardImagesWithMxcs - returns original if no cache provided', () => {
    const html = '<img src="https://cards.scryfall.io/normal/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg" />';
    
    const result = replaceCardImagesWithMxcs(html, null);
    
    assert.strictEqual(result, html, 'Should return original if no cache');
});

test('replaceCardImagesWithMxcs - returns original if no mxcurl found in cache', () => {
    const html = '<img src="https://cards.scryfall.io/normal/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg" />';
    const urlToMxc = new Map();
    urlToMxc.set('different.jpg', 'mxc://local/server/different');

    const result = replaceCardImagesWithMxcs(html, urlToMxc);
    
    assert.strictEqual(result, html, 'Should return original if no matching MXC found');
});

test('replaceCardImagesWithMxcs - handles empty html', () => {
    const urlToMxc = new Map();
    urlToMxc.set('test', 'mxc://test');

    assert.strictEqual(replaceCardImagesWithMxcs('', urlToMxc), '');
    assert.strictEqual(replaceCardImagesWithMxcs(null, urlToMxc), null);
    assert.strictEqual(replaceCardImagesWithMxcs(undefined, urlToMxc), undefined);
});