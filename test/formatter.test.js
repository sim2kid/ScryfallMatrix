import assert from 'node:assert';
import test from 'node:test';
import { scryfall } from '../src/scryfall.js';
import { formatter } from '../src/formatter.js';

test('Formatter - General Info', async (t) => {
    const mockCard = {
        name: 'Asmoranomardicadaistinaculdacar',
        mana_cost: '',
        type_line: 'Legendary Creature — Human Wizard',
        oracle_text: 'As long as you\'ve discarded a card this turn, you may pay {B/R} to cast this spell.',
        scryfall_uri: 'https://scryfall.com/card/mh2/186/asmoranomardicadaistinaculdacar',
        image_uris: {
            small: 'https://cards.scryfall.io/small/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg'
        }
    };

    // Inject mock symbology
    scryfall.setCache('symbology', {
        data: [
            { symbol: '{B/R}', svg_uri: 'https://svgs.scryfall.io/card-symbols/BR.svg' }
        ]
    });

    const result = await formatter.formatGeneral(mockCard);

    assert.ok(result.plainText.includes('Asmoranomardicadaistinaculdacar'));
    assert.ok(result.html.includes('https://svgs.scryfall.io/card-symbols/BR.svg'), 'Should contain symbol SVG URI');
    assert.ok(result.html.includes('<img src="https://cards.scryfall.io/small/front/d/9/d99a9a7d-d9ca-4c11-80ab-e39d5943a315.jpg"'), 'Should contain card image');
});

test('Formatter - Prices', async (t) => {
    const mockCard = {
        name: 'Black Lotus',
        prices: {
            usd: '500000.00',
            usd_foil: null,
            eur: '400000.00',
            tix: '50.00'
        },
        scryfall_uri: 'https://scryfall.com/card/vma/4/black-lotus'
    };

    const result = await formatter.formatPrices(mockCard);
    assert.ok(result.plainText.includes('$500000.00'));
    assert.ok(result.plainText.includes('400000.00'));
    assert.ok(result.html.includes('<li>USD: $500000.00</li>'));
});

test('Formatter - Rulings', async (t) => {
    const mockCard = {
        name: 'Gush',
        rulings_uri: 'https://api.scryfall.com/cards/d5135755-e4d0-496a-86c8-89c5658097b8/rulings'
    };

    scryfall.setCache(`rulings:${mockCard.rulings_uri}`, {
        data: [
            { published_at: '2019-07-12', comment: 'You can return any two Islands you control.' }
        ]
    });

    const result = await formatter.formatRulings(mockCard);
    assert.ok(result.plainText.includes('You can return any two Islands you control.'));
    assert.ok(result.html.includes('<li>[2019-07-12] You can return any two Islands you control.</li>'));
});

test('Formatter - Legality', async (t) => {
    const mockCard = {
        name: 'Brainstorm',
        legalities: {
            standard: 'not_legal',
            modern: 'not_legal',
            legacy: 'legal',
            vintage: 'restricted'
        },
        scryfall_uri: 'https://scryfall.com/card/a25/46/brainstorm'
    };

    const result = await formatter.formatLegality(mockCard);
    assert.ok(result.plainText.includes('legacy: legal'));
    assert.ok(result.plainText.includes('vintage: restricted'));
    assert.ok(result.html.includes('<td>legacy</td><td>legal</td>'));
});
