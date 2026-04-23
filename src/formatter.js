import { scryfall } from './scryfall.js';

class Formatter {
    constructor() {
        this.symbols = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        const symbology = await scryfall.getSymbology();
        if (symbology && symbology.data) {
            for (const symbol of symbology.data) {
                this.symbols.set(symbol.symbol, symbol.svg_uri);
            }
            this.initialized = true;
        }
    }

    async replaceSymbols(text) {
        if (!this.initialized) await this.init();
        if (!text) return '';

        // Match symbols like {T}, {W}, {B/R}, {2}, {10}
        return text.replace(/\{[^}]+\}/g, (match) => {
            const svgUri = this.symbols.get(match);
            if (svgUri) {
                // height/attribute will be added later via replaceSymbolsWithMxcs in index.js
                return `<img data-mx-emoticon height="32" src="${svgUri}" alt="${match}" />`;
            }
            return match;
        });
    }

    async formatGeneral(card) {
        const name = card.name;
        const manaCost = await this.replaceSymbols(card.mana_cost);
        const normalImage = card.image_uris?.normal || card.image_uris?.large || '';
        const oracleText = await this.replaceSymbols(card.oracle_text || '');
        const flavorText = card.flavor_text ? await this.replaceSymbols(card.flavor_text) : '';
        const typeLine = card.type_line || '';

        let plainText = `${name} ${card.mana_cost || ''}\n${typeLine}\n${card.oracle_text || ''}`;
        if (flavorText) {
            plainText += `\n\n"${flavorText.replace(/\n/g, ' ')}"`;
        }
        if (card.power || card.toughness) {
            plainText += `\n${card.power}/${card.toughness}`;
        }
        plainText += `\n${card.scryfall_uri}`;

        let html = `<h3><a href="${card.scryfall_uri}">${name}</a> ${manaCost}</h3>` +
                 (normalImage ? `<img src="${normalImage}" alt="Card Image" style="max-width: 400px;" /><br/>` : '') +
                 `<em>${typeLine}</em><br/>` +
                 `<p>${oracleText.replace(/\n/g, '<br/>')}</p>`;
        
        if (flavorText) {
            html += `<p><em>"${flavorText.replace(/\n/g, '<br/>')}"</em></p>`;
        }

        if (card.power || card.toughness) {
            html += `<p>${card.power}/${card.toughness}</p>`;
        }

        return { plainText, html };
    }

    async formatImage(card) {
        const image = card.image_uris?.normal || card.image_uris?.large || '';
        const plainText = `${card.name} - ${image || 'No image available'}`;
        const html = `<strong>${card.name}</strong><br/>` +
                     (image ? `<img src="${image}" alt="Card Image" />` : 'No image available') +
                     `<br/><a href="${card.scryfall_uri}">Scryfall Link</a>`;
        return { plainText, html };
    }

    async formatPrices(card) {
        const prices = card.prices || {};
        const usd = prices.usd ? `$${prices.usd}` : 'N/A';
        const usdFoil = prices.usd_foil ? `$${prices.usd_foil} (Foil)` : 'N/A';
        const eur = prices.eur ? `€${prices.eur}` : 'N/A';
        const tix = prices.tix ? `${prices.tix} TIX` : 'N/A';

        const plainText = `Prices for ${card.name}:\nUSD: ${usd}\nUSD Foil: ${usdFoil}\nEUR: ${eur}\nTIX: ${tix}\n${card.scryfall_uri}`;
        const html = `<strong>Prices for ${card.name}:</strong><ul>` +
                     `<li>USD: ${usd}</li>` +
                     `<li>USD Foil: ${usdFoil}</li>` +
                     `<li>EUR: ${eur}</li>` +
                     `<li>TIX: ${tix}</li>` +
                     `</ul><a href="${card.scryfall_uri}">Scryfall Link</a>`;
        return { plainText, html };
    }

    async formatLegality(card) {
        const legalities = card.legalities || {};
        const formats = ['standard', 'future', 'historic', 'gladiator', 'pioneer', 'explorer', 'modern', 'legacy', 'pauper', 'vintage', 'penny', 'commander', 'brawl', 'historicbrawl', 'alchemy', 'paupercommander', 'duel', 'oldschool', 'premodern'];

        let plainText = `Legality for ${card.name}:\n`;
        let html = `<strong>Legality for ${card.name}:</strong><table border="1">`;

        // Split into chunks of 2 for table layout if we want, or just a list
        for (const format of formats) {
            const status = legalities[format] || 'not_legal';
            const statusText = status.replace(/_/g, ' ');
            plainText += `${format}: ${statusText}\n`;
            html += `<tr><td>${format}</td><td>${statusText}</td></tr>`;
        }

        html += `</table><br/><a href="${card.scryfall_uri}">Scryfall Link</a>`;
        return { plainText, html };
    }

    async formatRulings(card) {
        const rulings = await scryfall.getRulings(card.rulings_uri);
        let plainText = `Rulings for ${card.name}:\n`;
        let html = `<strong>Rulings for ${card.name}:</strong><ul>`;

        if (rulings && rulings.data && rulings.data.length > 0) {
            for (const ruling of rulings.data) {
                plainText += `- [${ruling.published_at}] ${ruling.comment}\n`;
                html += `<li>[${ruling.published_at}] ${ruling.comment}</li>`;
            }
        } else {
            plainText += 'No rulings found.';
            html += '<li>No rulings found.</li>';
        }

        html += `</ul><a href="${card.scryfall_uri}">Scryfall Link</a>`;
        return { plainText, html };
    }
}

export const formatter = new Formatter();
