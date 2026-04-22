import 'dotenv/config';
import { execSync } from 'child_process';

const image = `${process.env.DOCKER_USER}/scryfall-matrix:dev`;
const command = process.argv[2];

if (!process.env.DOCKER_USER) {
  console.error('Error: DOCKER_USER not set in .env');
  process.exit(1);
}

if (command === 'build') {
  execSync(`docker build -t ${image} .`, { stdio: 'inherit' });
} else if (command === 'push') {
  execSync(`docker push ${image}`, { stdio: 'inherit' });
} else {
  console.error('Usage: node dev-deploy.js build|push');
  process.exit(1);
}