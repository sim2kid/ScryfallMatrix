import assert from 'node:assert';
import test from 'node:test';
import { scryfall } from '../src/scryfall.js';
import { formatter } from '../src/formatter.js';

test('Formatter - All card images should be scryfall.io URLs', async (t) => {
    const mockCard = {
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        scryfall_uri: 'https://scryfall.com/card/m12/136/lightning-bolt',
        image_uris: {
            small: 'https://cards.scryfall.io/small/front/1/2/123456.jpg',
            normal: 'https://cards.scryfall.io/normal/front/1/2/123456.jpg',
            large: 'https://cards.scryfall.io/large/front/1/2/123456.jpg'
        }
    };

    scryfall.setCache('symbology', {
        data: [
            { symbol: '{R}', svg_uri: 'https://svgs.scryfall.io/card-symbols/R.svg' }
        ]
    });

    const result = await formatter.formatGeneral(mockCard);

    assert.ok(result.html.includes('<img src="https://cards.scryfall.io/normal/front/1/2/123456.jpg"'),
        'Should contain scryfall card image URL');
});

test('Formatter - Double-faced card images should be scryfall.io URLs', async (t) => {
    const mockCard = {
        name: 'Insectile Aberration',
        scryfall_uri: 'https://scryfall.com/card/roe/42/insectile-aberration',
        card_faces: [
            {
                name: 'Insectile Aberration',
                mana_cost: '{3}{U}',
                type_line: 'Creature — Aberration',
                oracle_text: 'Flying',
                image_uris: {
                    small: 'https://cards.scryfall.io/small/front/b/1/b123456.jpg',
                    normal: 'https://cards.scryfall.io/normal/front/b/1/b123456.jpg'
                }
            },
            {
                name: 'Reach consciousness',
                type_line: 'Sorcery',
                oracle_text: 'Draw a card.',
                image_uris: {
                    small: 'https://cards.scryfall.io/small/back/b/1/b123456.jpg',
                    normal: 'https://cards.scryfall.io/normal/back/b/1/b123456.jpg'
                }
            }
        ]
    };

    scryfall.setCache('symbology', {
        data: [
            { symbol: '{3}{U}', svg_uri: 'https://svgs.scryfall.io/card-symbols/3U.svg' }
        ]
    });

    const result = await formatter.formatDoubleFaced(mockCard);

    assert.ok(result.html.includes('<img data-card-front src="https://cards.scryfall.io/normal/front/b/1/b123456.jpg"'),
        'Should contain front card image');
    assert.ok(result.html.includes('<img data-card-back src="https://cards.scryfall.io/normal/back/b/1/b123456.jpg"'),
        'Should contain back card image');
});

test('Formatter - Image format should contain scryfall.io URL', async (t) => {
    const mockCard = {
        name: 'Counterspell',
        scryfall_uri: 'https://scryfall.com/card/dmc/158/counterspell',
        image_uris: {
            normal: 'https://cards.scryfall.io/normal/front/c/1/c123456.jpg'
        }
    };

    const result = await formatter.formatImage(mockCard);

    assert.ok(result.html.includes('<img src="https://cards.scryfall.io/normal/front/c/1/c123456.jpg"'),
        'Should contain scryfall card image URL');
});