#!/usr/bin/env node

const { Command } = require('commander');
const packageJson = require('../package.json');
const initCommand = require('../src/commands/init');
const chalk = require('chalk');

const program = new Command();

program
  .name('tw-stocker-bot')
  .description('AI-powered Stocker Bot CLI')
  .version(packageJson.version);

program.command('init')
  .description('Initialize the bot environment, select AI CLI, and install skills.')
  .option('-f, --force', 'Force re-initialization')
  .action(initCommand);

program.command('start')
  .description('Start the bot daemon')
  .action(require('../src/commands/start'));


program.command('config')
  .description('Manage configuration')
  .action(() => {
    console.log('Config management coming soon.');
  });

program.parse(process.argv);
