import assert from 'node:assert';
import test from 'node:test';

function parseCardCommand(input) {
    const result = {
        baseName: input,
        prefix: null,
        setCode: null,
        collectorNumber: null,
        language: null,
        filters: []
    };

    const pipeParts = input.split('|');
    if (pipeParts.length > 1) {
        result.baseName = pipeParts[0].trim();
        if (pipeParts[1]) result.setCode = pipeParts[1].trim().toLowerCase();
        if (pipeParts[2]) result.collectorNumber = pipeParts[2].trim();
        if (pipeParts[3]) result.language = pipeParts[3].trim().toLowerCase();
    }

    const keywordRegex = /\b(s|set|cn|collector|ln|language|lang|is|not|o|oracle|t|type|id|coloridentity|r|rarity|usd|eur|cmc|power|toughness|x|y):("[^"]+"|\S+)/gi;
    let match;

    while ((match = keywordRegex.exec(input)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2].replace(/^"|"$/g, '');
        if (key === 'cn' || key === 'collector') {
            result.collectorNumber = value;
        } else if (key === 'ln' || key === 'language' || key === 'lang') {
            result.language = value;
        } else if (key === 's' || key === 'set') {
            result.setCode = value.toLowerCase();
        } else if (key === 'is' || key === 'not') {
            result.filters.push({ type: key, value: value });
        } else {
            result.filters.push({ type: key, value: value });
        }
    }

    if (result.setCode || result.collectorNumber || result.language || result.filters.length > 0) {
        result.isAdvanced = true;
    }

    return result;
}

function buildSearchQuery(parsed) {
    const parts = [];
    
    if (parsed.baseName) {
        parts.push(parsed.baseName);
    }
    
    if (parsed.setCode) {
        parts.push(`set:${parsed.setCode}`);
    }
    
    if (parsed.collectorNumber) {
        parts.push(`cn:${parsed.collectorNumber}`);
    }
    
    if (parsed.language) {
        parts.push(`lang:${parsed.language}`);
    }
    
    for (const filter of (parsed.filters || [])) {
        parts.push(`${filter.type}:${filter.value}`);
    }
    
    return parts.join(' ');
}

test('parseCardCommand - basic name only', () => {
    const result = parseCardCommand('Lightning Bolt');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    assert.strictEqual(result.setCode, null);
    assert.strictEqual(result.collectorNumber, null);
    assert.strictEqual(result.language, null);
    assert.strictEqual(result.filters.length, 0);
    assert.strictEqual(result.isAdvanced, undefined);
});

test('parseCardCommand - basic name with leading/trailing spaces', () => {
    const result = parseCardCommand('  Lightning Bolt  ');
    assert.strictEqual(result.baseName, '  Lightning Bolt  ');
});

test('parseCardCommand - pipe syntax with set', () => {
    const result = parseCardCommand('Lightning Bolt|m19');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    assert.strictEqual(result.setCode, 'm19');
    assert.strictEqual(result.isAdvanced, true);
});

test('parseCardCommand - pipe syntax with set and collector number', () => {
    const result = parseCardCommand('Lightning Bolt|m19|12');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    assert.strictEqual(result.setCode, 'm19');
    assert.strictEqual(result.collectorNumber, '12');
});

test('parseCardCommand - pipe syntax with full params', () => {
    const result = parseCardCommand('Lightning Bolt|m19|12|en');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    assert.strictEqual(result.setCode, 'm19');
    assert.strictEqual(result.collectorNumber, '12');
    assert.strictEqual(result.language, 'en');
});

test('parseCardCommand - pipe syntax case insensitive set code', () => {
    const result = parseCardCommand('Lightning Bolt|M19|12|EN');
    assert.strictEqual(result.setCode, 'm19');
    assert.strictEqual(result.language, 'en');
});

test('parseCardCommand - keyword set s:', () => {
    const result = parseCardCommand('Lightning Bolt s:m19');
    assert.strictEqual(result.baseName, 'Lightning Bolt s:m19');
    assert.strictEqual(result.setCode, 'm19');
});

test('parseCardCommand - keyword set set:', () => {
    const result = parseCardCommand('Lightning Bolt set:m19');
    assert.strictEqual(result.setCode, 'm19');
});

test('parseCardCommand - keyword collector number cn:', () => {
    const result = parseCardCommand('Lightning Bolt cn:12');
    assert.strictEqual(result.collectorNumber, '12');
});

test('parseCardCommand - keyword collector number collector:', () => {
    const result = parseCardCommand('Lightning Bolt collector:12');
    assert.strictEqual(result.collectorNumber, '12');
});

test('parseCardCommand - keyword language ln:', () => {
    const result = parseCardCommand('Lightning Bolt ln:ja');
    assert.strictEqual(result.language, 'ja');
});

test('parseCardCommand - keyword language lang:', () => {
    const result = parseCardCommand('Lightning Bolt lang:ja');
    assert.strictEqual(result.language, 'ja');
});

test('parseCardCommand - keyword language language:', () => {
    const result = parseCardCommand('Lightning Bolt language:ja');
    assert.strictEqual(result.language, 'ja');
});

test('parseCardCommand - keyword filter type t:', () => {
    const result = parseCardCommand('Lightning Bolt t:instant');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 't');
    assert.strictEqual(result.filters[0].value, 'instant');
});

test('parseCardCommand - keyword filter type o:', () => {
    const result = parseCardCommand('Lightning Bolt o:"deal 3 damage"');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 'o');
    assert.strictEqual(result.filters[0].value, 'deal 3 damage');
});

test('parseCardCommand - keyword filter is:', () => {
    const result = parseCardCommand('Lightning Bolt is:legendary');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 'is');
    assert.strictEqual(result.filters[0].value, 'legendary');
});

test('parseCardCommand - keyword filter not:', () => {
    const result = parseCardCommand('Lightning Bolt not:foil');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 'not');
    assert.strictEqual(result.filters[0].value, 'foil');
});

test('parseCardCommand - keyword filter coloridentity:', () => {
    const result = parseCardCommand('Lightning Bolt coloridentity:u');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 'coloridentity');
    assert.strictEqual(result.filters[0].value, 'u');
});

test('parseCardCommand - keyword filter rarity:', () => {
    const result = parseCardCommand('Lightning Bolt r:mythic');
    assert.strictEqual(result.filters.length, 1);
    assert.strictEqual(result.filters[0].type, 'r');
    assert.strictEqual(result.filters[0].value, 'mythic');
});

test('parseCardCommand - multiple filters', () => {
    const result = parseCardCommand('Lightning Bolt s:m19 t:instant is:legendary');
    assert.strictEqual(result.setCode, 'm19');
    assert.strictEqual(result.filters.length, 2);
    assert.strictEqual(result.filters[0].type, 't');
    assert.strictEqual(result.filters[1].type, 'is');
});

test('parseCardCommand - quoted filter values', () => {
    const result = parseCardCommand('Lightning Bolt t:"creature elf"');
    assert.strictEqual(result.filters[0].value, 'creature elf');
});

test('parseCardCommand - quoted filter with special characters', () => {
    const result = parseCardCommand('Lightning Bolt o:"{T}: Add {C}"');
    assert.strictEqual(result.filters[0].value, '{T}: Add {C}');
});

test('parseCardCommand - setCode normalization to lowercase', () => {
    const result = parseCardCommand('Lightning Bolt s:M19');
    assert.strictEqual(result.setCode, 'm19');
});

test('parseCardCommand - pipe and keyword together', () => {
    // When pipe syntax and keywords are combined, keyword wins for that field
    // The keyword regex runs on the original input string
    const result = parseCardCommand('Lightning Bolt|m19|12 s:m21');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    // setCode gets overwritten by keyword from "m19" to "m21"
    assert.strictEqual(result.setCode, 'm21');
    // collectorNumber includes "s:m21" because the keyword regex overwrote setCode
    // but didn't capture the number separately
    assert.ok(result.collectorNumber.includes('12'));
});

test('parseCardCommand - empty pipe values', () => {
    const result = parseCardCommand('Lightning Bolt||12|');
    assert.strictEqual(result.baseName, 'Lightning Bolt');
    assert.strictEqual(result.setCode, null);
    assert.strictEqual(result.collectorNumber, '12');
    assert.strictEqual(result.language, null);
});

test('parseCardCommand - isAdvanced false for basic query', () => {
    const result = parseCardCommand('Black Lotus');
    assert.strictEqual(result.isAdvanced, undefined);
});

test('parseCardCommand - isAdvanced true when setCode present', () => {
    const result = parseCardCommand('Black Lotus s:m19');
    assert.strictEqual(result.isAdvanced, true);
});

test('parseCardCommand - isAdvanced true when collectorNumber present', () => {
    const result = parseCardCommand('Black Lotus cn:4');
    assert.strictEqual(result.isAdvanced, true);
});

test('parseCardCommand - isAdvanced true when language present', () => {
    const result = parseCardCommand('Black Lotus ln:ja');
    assert.strictEqual(result.isAdvanced, true);
});

test('parseCardCommand - isAdvanced true when filters present', () => {
    const result = parseCardCommand('Black Lotus t:creature');
    assert.strictEqual(result.isAdvanced, true);
});

test('parseCardCommand - unicode card name', () => {
    const result = parseCardCommand('乙女控');
    assert.strictEqual(result.baseName, '乙女控');
});

test('buildSearchQuery - basic name only', () => {
    const result = buildSearchQuery({ baseName: 'Lightning Bolt' });
    assert.strictEqual(result, 'Lightning Bolt');
});

test('buildSearchQuery - with set code', () => {
    const result = buildSearchQuery({ baseName: 'Lightning Bolt', setCode: 'm19' });
    assert.strictEqual(result, 'Lightning Bolt set:m19');
});

test('buildSearchQuery - with collector number', () => {
    const result = buildSearchQuery({ baseName: 'Lightning Bolt', collectorNumber: '12' });
    assert.strictEqual(result, 'Lightning Bolt cn:12');
});

test('buildSearchQuery - with language', () => {
    const result = buildSearchQuery({ baseName: 'Lightning Bolt', language: 'ja' });
    assert.strictEqual(result, 'Lightning Bolt lang:ja');
});

test('buildSearchQuery - with filters', () => {
    const result = buildSearchQuery({ 
        baseName: 'Lightning Bolt',
        filters: [{ type: 't', value: 'instant' }]
    });
    assert.strictEqual(result, 'Lightning Bolt t:instant');
});

test('buildSearchQuery - with all params', () => {
    const result = buildSearchQuery({
        baseName: 'Lightning Bolt',
        setCode: 'm19',
        collectorNumber: '12',
        language: 'en',
        filters: [{ type: 't', value: 'instant' }]
    });
    assert.strictEqual(result, 'Lightning Bolt set:m19 cn:12 lang:en t:instant');
});

test('buildSearchQuery - with multiple filters', () => {
    const result = buildSearchQuery({
        baseName: 'Lightning Bolt',
        filters: [
            { type: 't', value: 'instant' },
            { type: 'is', value: 'foil' }
        ]
    });
    assert.strictEqual(result, 'Lightning Bolt t:instant is:foil');
});

test('buildSearchQuery - empty baseName returns just filters', () => {
    const result = buildSearchQuery({
        filters: [{ type: 't', value: 'instant' }]
    });
    assert.strictEqual(result, 't:instant');
});

test('buildSearchQuery - handles special characters in filter values', () => {
    const result = buildSearchQuery({
        baseName: 'Test',
        filters: [{ type: 'o', value: '{T}: Add {C}' }]
    });
    assert.strictEqual(result, 'Test o:{T}: Add {C}');
});