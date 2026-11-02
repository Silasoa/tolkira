import { phase, version } from './index.js';

console.error(
  `Tolkira ${version} is in the ${phase} phase. ` +
    'The report generator is not implemented yet. ' +
    'See openspec/changes/bootstrap-tolkira-core.',
);

process.exit(2);
