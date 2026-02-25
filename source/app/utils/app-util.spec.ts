import test from 'ava';

// Test command parsing edge cases
// These tests document the expected behavior of parsing patterns

test('bash command detection - message starting with !', t => {
	const message = '!ls -la';
	const isBashCommand = message.startsWith('!');
	t.true(isBashCommand);
});

test('bash command detection - message not starting with !', t => {
	const message = 'ls -la';
	const isBashCommand = message.startsWith('!');
	t.false(isBashCommand);
});

test('slash command detection - message starting with /', t => {
	const message = '/help';
	const isSlashCommand = message.startsWith('/');
	t.true(isSlashCommand);
});

test('slash command parsing - extracts command name correctly', t => {
	const message = '/model gpt-4';
	const commandName = message.slice(1).split(/\s+/)[0];
	t.is(commandName, 'model');
});

test('slash command parsing - handles command without args', t => {
	const message = '/clear';
	const commandName = message.slice(1).split(/\s+/)[0];
	t.is(commandName, 'clear');
});

test('slash command parsing - handles command with multiple args', t => {
	const message = '/checkpoint load my-checkpoint';
	const parts = message.slice(1).split(/\s+/);
	t.is(parts[0], 'checkpoint');
	t.is(parts[1], 'load');
	t.is(parts[2], 'my-checkpoint');
});

// Test custom command argument extraction
test('custom command args extraction - with arguments', t => {
	const message = '/mycommand arg1 arg2 arg3';
	const commandName = 'mycommand';
	const args = message
		.slice(commandName.length + 2)
		.trim()
		.split(/\s+/)
		.filter(arg => arg);

	t.deepEqual(args, ['arg1', 'arg2', 'arg3']);
});

test('custom command args extraction - no arguments', t => {
	const message = '/mycommand';
	const commandName = 'mycommand';
	const args = message
		.slice(commandName.length + 2)
		.trim()
		.split(/\s+/)
		.filter(arg => arg);

	t.deepEqual(args, []);
});

test('custom command args extraction - extra whitespace', t => {
	const message = '/mycommand   arg1    arg2  ';
	const commandName = 'mycommand';
	const args = message
		.slice(commandName.length + 2)
		.trim()
		.split(/\s+/)
		.filter(arg => arg);

	t.deepEqual(args, ['arg1', 'arg2']);
});

// Test checkpoint load detection
test('checkpoint load detection - load subcommand', t => {
	const commandParts = ['checkpoint', 'load'];
	const isCheckpointLoad =
		commandParts[0] === 'checkpoint' &&
		(commandParts[1] === 'load' || commandParts[1] === 'restore') &&
		commandParts.length === 2;
	t.true(isCheckpointLoad);
});

test('checkpoint load detection - restore subcommand', t => {
	const commandParts = ['checkpoint', 'restore'];
	const isCheckpointLoad =
		commandParts[0] === 'checkpoint' &&
		(commandParts[1] === 'load' || commandParts[1] === 'restore') &&
		commandParts.length === 2;
	t.true(isCheckpointLoad);
});

test('checkpoint load detection - with specific checkpoint name', t => {
	const commandParts = ['checkpoint', 'load', 'my-checkpoint'];
	const isCheckpointLoad =
		commandParts[0] === 'checkpoint' &&
		(commandParts[1] === 'load' || commandParts[1] === 'restore') &&
		commandParts.length === 2;
	// Should be false - specific checkpoint specified
	t.false(isCheckpointLoad);
});

test('checkpoint load detection - other checkpoint subcommand', t => {
	const commandParts = ['checkpoint', 'save'];
	const isCheckpointLoad =
		commandParts[0] === 'checkpoint' &&
		(commandParts[1] === 'load' || commandParts[1] === 'restore') &&
		commandParts.length === 2;
	t.false(isCheckpointLoad);
});

// Test setup-mcp command parsing
test('setup-mcp command parsing - extracts command name correctly', t => {
	const message = '/setup-mcp';
	const commandName = message.slice(1).split(/\s+/)[0];
	t.is(commandName, 'setup-mcp');
});

test('setup-mcp command parsing - handles command with extra whitespace', t => {
	const message = '/setup-mcp   ';
	const commandName = message.slice(1).split(/\s+/)[0];
	t.is(commandName, 'setup-mcp');
});

// Test /commands create detection
test('commands create detection - matches commands create', t => {
	const message = '/commands create my-tool';
	const parts = message.slice(1).trim().split(/\s+/);
	const isCommandCreate =
		(parts[0] === 'commands' || parts[0] === 'custom-commands') &&
		parts[1] === 'create';
	t.true(isCommandCreate);
	t.is(parts[2], 'my-tool');
});

test('commands create detection - matches custom-commands create', t => {
	const message = '/custom-commands create review-code';
	const parts = message.slice(1).trim().split(/\s+/);
	const isCommandCreate =
		(parts[0] === 'commands' || parts[0] === 'custom-commands') &&
		parts[1] === 'create';
	t.true(isCommandCreate);
	t.is(parts[2], 'review-code');
});

test('commands create detection - does not match other subcommands', t => {
	const message = '/commands show my-tool';
	const parts = message.slice(1).trim().split(/\s+/);
	const isCommandCreate =
		(parts[0] === 'commands' || parts[0] === 'custom-commands') &&
		parts[1] === 'create';
	t.false(isCommandCreate);
});

test('commands create detection - does not match unrelated commands', t => {
	const message = '/schedule create my-task';
	const parts = message.slice(1).trim().split(/\s+/);
	const isCommandCreate =
		(parts[0] === 'commands' || parts[0] === 'custom-commands') &&
		parts[1] === 'create';
	t.false(isCommandCreate);
});

test('commands create detection - missing name yields undefined part', t => {
	const message = '/commands create';
	const parts = message.slice(1).trim().split(/\s+/);
	const isCommandCreate =
		(parts[0] === 'commands' || parts[0] === 'custom-commands') &&
		parts[1] === 'create';
	t.true(isCommandCreate);
	t.is(parts[2], undefined);
});

test('commands create - appends .md extension when missing', t => {
	const fileName = 'my-tool';
	const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
	t.is(safeName, 'my-tool.md');
});

test('commands create - preserves .md extension when present', t => {
	const fileName = 'my-tool.md';
	const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
	t.is(safeName, 'my-tool.md');
});

// Test parseContextLimit — imported from the actual module
import {parseContextLimit} from './app-util.js';

test('parseContextLimit - plain number', t => {
	t.is(parseContextLimit('8192'), 8192);
});

test('parseContextLimit - k suffix lowercase', t => {
	t.is(parseContextLimit('128k'), 128000);
});

test('parseContextLimit - K suffix uppercase', t => {
	t.is(parseContextLimit('128K'), 128000);
});

test('parseContextLimit - fractional k value', t => {
	t.is(parseContextLimit('4.5k'), 4500);
});

test('parseContextLimit - zero returns null', t => {
	t.is(parseContextLimit('0'), null);
});

test('parseContextLimit - negative returns null', t => {
	t.is(parseContextLimit('-5'), null);
});

test('parseContextLimit - non-numeric returns null', t => {
	t.is(parseContextLimit('abc'), null);
});

test('parseContextLimit - just k returns null', t => {
	t.is(parseContextLimit('k'), null);
});

test('parseContextLimit - whitespace is trimmed', t => {
	t.is(parseContextLimit('  8192  '), 8192);
});

test('parseContextLimit - large value with k suffix', t => {
	t.is(parseContextLimit('256k'), 256000);
});

test('parseContextLimit - decimal without k suffix', t => {
	t.is(parseContextLimit('1024.5'), 1025);
});

// Test /ide command parsing
test('ide command parsing - extracts command name correctly', t => {
	const message = '/ide';
	const commandName = message.slice(1).split(/\s+/)[0];
	t.is(commandName, 'ide');
});

test('ide command parsing - recognized as special command', t => {
	const SPECIAL_COMMANDS: Record<string, string> = {
		CLEAR: 'clear',
		MODEL: 'model',
		PROVIDER: 'provider',
		MODEL_DATABASE: 'model-database',
		SETUP_PROVIDERS: 'setup-providers',
		SETUP_MCP: 'setup-mcp',
		SETTINGS: 'settings',
		STATUS: 'status',
		CHECKPOINT: 'checkpoint',
		EXPLORER: 'explorer',
		IDE: 'ide',
		SCHEDULE: 'schedule',
		COMMANDS: 'commands',
	};
	const commandName = 'ide';
	t.is(
		Object.values(SPECIAL_COMMANDS).includes(commandName),
		true,
	);
});
