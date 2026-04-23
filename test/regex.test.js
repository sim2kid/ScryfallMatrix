import assert from 'node:assert';
import test from 'node:test';

test('Regex detection logic - basic prefixes', (t) => {
    const cardRegex = /\[\[([!$?#])?([^\]]+)\]\]/g;
    
    const testCases = [
        { input: '[[Black Lotus]]', expected: [['', 'Black Lotus']] },
        { input: 'Check out [[!Sol Ring]]', expected: [['!', 'Sol Ring']] },
        { input: 'Price for [[$Mox Opal]]?', expected: [['$', 'Mox Opal']] },
        { input: '[[?Gush]] rulings', expected: [['?', 'Gush']] },
        { input: 'Is [[#Brainstorm]] legal?', expected: [['#', 'Brainstorm']] },
        { input: 'Multiple [[Lightning Bolt]] and [[$Ancestral Recall]]', expected: [['', 'Lightning Bolt'], ['$', 'Ancestral Recall']] },
        { input: 'No card here', expected: [] },
        { input: '[[   spaces   ]]', expected: [['', '   spaces   ']] }
    ];

    for (const { input, expected } of testCases) {
        const matches = [];
        let match;
        while ((match = cardRegex.exec(input)) !== null) {
            matches.push([match[1] || '', match[2]]);
        }
        assert.deepStrictEqual(matches, expected, `Failed for input: ${input}`);
    }
});

test('Regex detection logic - edge cases', (t) => {
    const cardRegex = /\[\[([!$?#])?([^\]]+)\]\]/g;
    
    const testCases = [
        // Note: nested brackets break the regex - it stops at first ]
        // Note: [[]] returns empty - regex requires at least one char: [^\]]+
        // Multiple prefixes (first one wins)
        { input: '[[!!Lightning Bolt]]', expected: [['!', '!Lightning Bolt']] },
        // Unicode card names
        { input: '[[乙女控]]', expected: [['', '乙女控']] },
        { input: '[[Jötun]]', expected: [['', 'Jötun']] },
        // Special characters
        { input: '[[Fire // Ice]]', expected: [['', 'Fire // Ice']] },
        { input: '[[Card Name (Extended)]]', expected: [['', 'Card Name (Extended)']] },
        // Numbers in card name
        { input: '[[Path to Exile]]', expected: [['', 'Path to Exile']] },
        // All prefixes in one message
        { input: '[[!Card1]] [[$Card2]] [[?Card3]] [[#Card4]]', expected: [['!', 'Card1'], ['$', 'Card2'], ['?', 'Card3'], ['#', 'Card4']] }
    ];

    for (const { input, expected } of testCases) {
        const matches = [];
        let match;
        while ((match = cardRegex.exec(input)) !== null) {
            matches.push([match[1] || '', match[2]]);
        }
        assert.deepStrictEqual(matches, expected, `Failed for input: ${input}`);
    }
});