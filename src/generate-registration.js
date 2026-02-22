import yaml from 'js-yaml';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const registration = {
    id: "scryfall-bot",
    url: process.env.REGISTRATION_URL || "http://scryfall-matrix:3000",
    as_token: process.env.AS_TOKEN || crypto.randomBytes(32).toString('hex'),
    hs_token: process.env.HS_TOKEN || crypto.randomBytes(32).toString('hex'),
    sender_localpart: "scryfall",
    namespaces: {
        users: [
            {
                exclusive: true,
                regex: "@scryfall:.*"
            }
        ],
        rooms: [],
        aliases: []
    }
};

const output = yaml.dump(registration);
const outputPath = path.resolve('registration.yaml');

fs.writeFileSync(outputPath, output);
console.log(`Registration file generated at: ${outputPath}`);
console.log('--- Registration YAML Content ---');
console.log(output);
console.log('---------------------------------');
console.log('Add this to your Synapse configuration (homeserver.yaml):');
console.log('app_service_config_files:');
console.log('  - "/path/to/registration.yaml"');
