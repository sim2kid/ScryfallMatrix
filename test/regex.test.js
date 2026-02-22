import assert from 'node:assert';
import test from 'node:test';

test('Regex detection logic', (t) => {
    const cardRegex = /\[\[([!$?#])?([^\]]+)\]\]/g;
    
    const testCases = [
        { input: '[[Black Lotus]]', expected: [['', 'Black Lotus']] },
        { input: 'Check out [[!Sol Ring]]', expected: [['!', 'Sol Ring']] },
        { input: 'Price for [[$Mox Opal]]?', expected: [['$', 'Mox Opal']] },
        { input: '[[?Gush]] rulings', expected: [['?', 'Gush']] },
        { input: 'Is [[#Brainstorm]] legal?', expected: [['#', 'Brainstorm']] },
        { input: 'Multiple [[Lightning Bolt]] and [[$Ancestral Recall]]', expected: [['', 'Lightning Bolt'], ['$', 'Ancestral Recall']] },
        { input: 'No card here', expected: [] },
        { input: '[[!]]', expected: [['', '!']] }, 
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
