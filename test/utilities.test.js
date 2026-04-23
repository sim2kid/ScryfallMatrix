import assert from 'node:assert';
import test from 'node:test';

function isIgnored(sender, patterns) {
    for (const pattern of patterns) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(sender)) return true;
    }
    return false;
}

function getCardImageKey(cardData, faceIndex = 0) {
    const setId = cardData.set_id || cardData.set;
    const collectorNum = cardData.collector_number || '';
    return `${setId}:${collectorNum}:${faceIndex}`;
}

function replaceSymbolsWithMxcs(html, symbolMxcs) {
    if (!html) return html;
    
    return html.replace(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*\/>/g, (match, svgUri, altText) => {
        const mxc = symbolMxcs.get(altText);
        if (mxc) {
            return `<img data-mx-emoticon height="32" src="${mxc}" alt="${altText}" title="${altText}" />`;
        }
        return match;
    });
}

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

test('isIgnored - no patterns', () => {
    const patterns = [];
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('isIgnored - exact match pattern', () => {
    const patterns = ['@spam:matrix.org'];
    assert.strictEqual(isIgnored('@spam:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('isIgnored - wildcard prefix', () => {
    const patterns = ['@spam*'];
    assert.strictEqual(isIgnored('@spam1:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@spamuser:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('isIgnored - wildcard suffix', () => {
    const patterns = ['@*banned*'];
    assert.strictEqual(isIgnored('@banned:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@userbanned:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('isIgnored - wildcard both sides', () => {
    const patterns = ['@*bot*'];
    assert.strictEqual(isIgnored('@mybot:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@botuser:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@test:matrix.org', patterns), false);
});

test('isIgnored - domain wildcard', () => {
    const patterns = ['@bot*:matrix.org'];
    assert.strictEqual(isIgnored('@bot:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@bot1:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@bot:other.org', patterns), false);
});

test('isIgnored - multiple patterns', () => {
    const patterns = ['@spam*', '@banned*', '@evil*'];
    assert.strictEqual(isIgnored('@spam1:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@banned:matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('isIgnored - case sensitive', () => {
    const patterns = ['@BOT:matrix.org'];
    assert.strictEqual(isIgnored('@bot:matrix.org', patterns), false);
});

test('isIgnored - wildcard at end of domain', () => {
    const patterns = ['@user:*.matrix.org'];
    assert.strictEqual(isIgnored('@user:server.matrix.org', patterns), true);
    assert.strictEqual(isIgnored('@user:matrix.org', patterns), false);
});

test('getCardImageKey - basic with set and collector', () => {
    const cardData = { set: 'm19', collector_number: '12' };
    const result = getCardImageKey(cardData, 0);
    assert.strictEqual(result, 'm19:12:0');
});

test('getCardImageKey - with set_id', () => {
    const cardData = { set_id: 'm19', collector_number: '12' };
    const result = getCardImageKey(cardData, 0);
    assert.strictEqual(result, 'm19:12:0');
});

test('getCardImageKey - different face index', () => {
    const cardData = { set: 'm19', collector_number: '12' };
    const result = getCardImageKey(cardData, 1);
    assert.strictEqual(result, 'm19:12:1');
});

test('getCardImageKey - missing collector number', () => {
    const cardData = { set: 'm19' };
    const result = getCardImageKey(cardData, 0);
    assert.strictEqual(result, 'm19::0');
});

test('getCardImageKey - empty collector number', () => {
    const cardData = { set: 'm19', collector_number: '' };
    const result = getCardImageKey(cardData, 0);
    assert.strictEqual(result, 'm19::0');
});

test('getCardImageKey - double faced card', () => {
    const cardData = { set: 'dmu', collector_number: '181' };
    const result0 = getCardImageKey(cardData, 0);
    const result1 = getCardImageKey(cardData, 1);
    assert.strictEqual(result0, 'dmu:181:0');
    assert.strictEqual(result1, 'dmu:181:1');
});

test('replaceSymbolsWithMxcs - null html returns null', () => {
    const result = replaceSymbolsWithMxcs(null, new Map());
    assert.strictEqual(result, null);
});

test('replaceSymbolsWithMxcs - empty html returns empty', () => {
    const result = replaceSymbolsWithMxcs('', new Map());
    assert.strictEqual(result, '');
});

test('replaceSymbolsWithMxcs - replaces known symbol', () => {
    const symbolMxcs = new Map([['{W}', 'mxc://local/white']]);
    const input = '<img src="https://svgs.scryfall.io/w.svg" alt="{W}" title="{W}" />';
    const result = replaceSymbolsWithMxcs(input, symbolMxcs);
    assert.strictEqual(result.includes('mxc://local/white'), true);
    assert.strictEqual(result.includes('data-mx-emoticon'), true);
});

test('replaceSymbolsWithMxcs - unknown symbol unchanged', () => {
    const symbolMxcs = new Map([['{W}', 'mxc://local/white']]);
    const input = '<img src="https://svgs.scryfall.io/b.svg" alt="{B}" title="{B}" />';
    const result = replaceSymbolsWithMxcs(input, symbolMxcs);
    assert.strictEqual(result, input);
});

test('replaceSymbolsWithMxcs - multiple symbols', () => {
    const symbolMxcs = new Map([
        ['{W}', 'mxc://local/white'],
        ['{U}', 'mxc://local/blue']
    ]);
    const input = '<img src="https://w.svg" alt="{W}" title="{W}" /><img src="https://u.svg" alt="{U}" title="{U}" />';
    const result = replaceSymbolsWithMxcs(input, symbolMxcs);
    assert.strictEqual(result.includes('mxc://local/white'), true);
    assert.strictEqual(result.includes('mxc://local/blue'), true);
});

test('replaceSymbolsWithMxcs - empty map leaves unchanged', () => {
    const input = '<img alt="{W}" src="x" />';
    const result = replaceSymbolsWithMxcs(input, new Map());
    assert.strictEqual(result, input);
});

test('replaceCardImagesWithMxcs - null html returns null', () => {
    const result = replaceCardImagesWithMxcs(null, new Map());
    assert.strictEqual(result, null);
});

test('replaceCardImagesWithMxcs - null cache returns html unchanged', () => {
    const input = '<img src="https://cards.scryfall.io/normal/front/a/b/ab123.jpg" />';
    const result = replaceCardImagesWithMxcs(input, null);
    assert.strictEqual(result, input);
});

test('replaceCardImagesWithMxcs - replaces known card image', () => {
    const cardImageCache = new Map([[
        'https://cards.scryfall.io/normal/front/a/b/ab123.jpg',
        'mxc://local/card123'
    ]]);
    const input = '<img src="https://cards.scryfall.io/normal/front/a/b/ab123.jpg" />';
    const result = replaceCardImagesWithMxcs(input, cardImageCache);
    assert.strictEqual(result.includes('mxc://local/card123'), true);
});

test('replaceCardImagesWithMxcs - unknown card image unchanged', () => {
    const cardImageCache = new Map([['https://known.jpg', 'mxc://known']]);
    const input = '<img src="https://cards.unknown.io/image.jpg" />';
    const result = replaceCardImagesWithMxcs(input, cardImageCache);
    assert.strictEqual(result, input);
});

test('replaceCardImagesWithMxcs - multiple card images', () => {
    const cardImageCache = new Map([
        ['https://cards.scryfall.io/normal/front/a/b/ab123.jpg', 'mxc://card1'],
        ['https://cards.scryfall.io/normal/front/c/d/cd456.jpg', 'mxc://card2']
    ]);
    const input = '<img src="https://cards.scryfall.io/normal/front/a/b/ab123.jpg" /><img src="https://cards.scryfall.io/normal/front/c/d/cd456.jpg" />';
    const result = replaceCardImagesWithMxcs(input, cardImageCache);
    assert.strictEqual(result.includes('mxc://card1'), true);
    assert.strictEqual(result.includes('mxc://card2'), true);
});

test('replaceCardImagesWithMxcs - complex HTML with multiple img tags', () => {
    const cardImageCache = new Map([
        ['https://cards.scryfall.io/normal/front/a/b/ab123.jpg', 'mxc://card1']
    ]);
    const input = '<div><img src="https://cards.googleapis.io/normal/front/a/b/ab123.jpg" /><p>Text</p><img src="https://cards.scryfall.io/normal/front/a/b/ab123.jpg" /></div>';
    const result = replaceCardImagesWithMxcs(input, cardImageCache);
    assert.strictEqual(result.includes('mxc://card1'), true);
    assert.strictEqual(result.includes('https://cards.googleapis.io'), true);
});

test('replaceCardImagesWithMxcs - non-scryfall images unchanged', () => {
    const cardImageCache = new Map([['https://cards1.jpg', 'mxc://local']]);
    const input = '<img src="https://example.com/image.png" />';
    const result = replaceCardImagesWithMxcs(input, cardImageCache);
    assert.strictEqual(result, input);
});

test('replaceCardImagesWithMxcs - empty cache returns unchanged', () => {
    const input = '<img src="https://cards.scryfall.io/normal/front/a/b/ab123.jpg" />';
    const result = replaceCardImagesWithMxcs(input, new Map());
    assert.strictEqual(result, input);
});