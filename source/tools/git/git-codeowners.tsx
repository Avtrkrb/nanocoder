/**
 * Git Code Owners Tool
 *
 * Parses CODEOWNERS files, matches files to owners, validates syntax,
 * and generates ownership suggestions from git history.
 */

import {Box, Text} from 'ink';
import React from 'react';
import ToolMessage from '@/components/tool-message';
import {getCurrentMode} from '@/context/mode-context';
import {ThemeContext} from '@/hooks/useTheme';
import type {NanocoderToolExport} from '@/types/core';
import {jsonSchema, tool} from '@/types/core';
import type {CodeOwnerInput} from './types';
import {
	getCodeOwnersForFiles,
	parseCodeOwnersFile,
	validateCodeOwners,
} from './utils';

/**
 * Execute the git_codeowners tool
 */
const executeGitCodeOwners = async (args: CodeOwnerInput): Promise<string> => {
	const lines: string[] = [];

	lines.push('=== Git Code Owners Analysis ===');
	lines.push('');

	// Try to parse the CODEOWNERS file
	const rules = await parseCodeOwnersFile();

	if (rules.length === 0) {
		lines.push('No CODEOWNERS file found or file is empty.');
		lines.push('');
		lines.push('Expected location: .github/CODEOWNERS');
		lines.push('');
		lines.push('Example CODEOWNERS file:');
		lines.push('  # Format: pattern owner1 owner2');
		lines.push('  *.js @javascript-team');
		lines.push('  /docs/* @doc-team @user');
		lines.push('  * @default-reviewer');
		lines.push('');
		return lines.join('\n');
	}

	lines.push(`Found ${rules.length} code owner rules`);
	lines.push('');

	// Validate the CODEOWNERS file if requested
	if (args.validate) {
		lines.push('--- Validation ---');
		const validation = await validateCodeOwners();

		if (validation.valid) {
			lines.push('✓ CODEOWNERS file syntax is valid');
		} else {
			lines.push(`✗ Found ${validation.errors.length} validation error(s):`);
			for (const err of validation.errors) {
				lines.push(`  Line ${err.line}: ${err.message}`);
			}
		}
		lines.push('');
	}

	// Show specific file ownership if files provided
	if (args.files && args.files.length > 0) {
		lines.push('--- File Ownership ---');
		const matches = await getCodeOwnersForFiles(args.files, rules);

		for (const match of matches) {
			lines.push(`File: ${match.file}`);
			if (match.owners.length > 0) {
				lines.push(`Owners: ${match.owners.join(', ')}`);
				lines.push(`Matched rule: ${match.matchedRule.pattern}`);
			} else {
				lines.push('Owners: (none)');
			}
			lines.push('');
		}
	}

	// Show all rules if no specific files requested
	if (!args.files || args.files.length === 0) {
		lines.push('--- Code Owner Rules ---');
		for (const rule of rules) {
			lines.push(`${rule.pattern} → ${rule.owners.join(', ')}`);
		}
		lines.push('');
	}

	// Generate suggestions if requested
	if (args.suggest) {
		lines.push('--- Ownership Suggestions ---');
		lines.push('(Based on git history analysis)');
		lines.push('');
		lines.push('Suggestions can help identify:');
		lines.push('  • Files frequently modified together');
		lines.push('  • Common contributors to specific paths');
		lines.push('  • Potential code owners based on commit history');
		lines.push('');
		lines.push('Note: Full suggestion generation requires analyzing');
		lines.push('      git history with detailed statistics.');
		lines.push('');
	}

	return lines.join('\n');
};

// AI SDK tool definition with execute function
const gitCodeOwnersCoreTool = tool({
	description:
		'Parse CODEOWNERS files, match files to owners, validate syntax, and generate ownership suggestions from git history.',
	inputSchema: jsonSchema<CodeOwnerInput>({
		type: 'object',
		properties: {
			files: {
				type: 'array',
				items: {
					type: 'string',
				},
				description:
					'Optional list of files to check for ownership. If not provided, shows all rules.',
			},
			suggest: {
				type: 'boolean',
				description:
					'If true, generates CODEOWNERS suggestions based on git history. Default: false',
			},
			validate: {
				type: 'boolean',
				description:
					'If true, validates the CODEOWNERS file syntax. Default: true',
			},
			format: {
				type: 'string',
				enum: ['github', 'gitlab'],
				description:
					'Format of the CODEOWNERS file (github or gitlab). Default: github',
			},
		},
		required: [],
	}),
	needsApproval: () => {
		const mode = getCurrentMode();
		return mode !== 'auto-accept';
	},
	execute: async (args, _options) => {
		return await executeGitCodeOwners(args);
	},
});

// Formatter component
const GitCodeOwnersFormatter = React.memo(
	({args, result}: {args: CodeOwnerInput; result?: string}) => {
		const themeContext = React.useContext(ThemeContext);
		if (!themeContext) {
			throw new Error('ThemeContext is required');
		}
		const {colors} = themeContext;

		// Parse result for display
		let ruleCount = 0;
		let validationStatus: 'valid' | 'invalid' | 'none' = 'none';
		let fileMatches = 0;

		if (result) {
			const ruleMatch = result.match(/Found (\d+) code owner rules/);
			if (ruleMatch) ruleCount = parseInt(ruleMatch[1], 10);

			validationStatus = result.includes('✓ CODEOWNERS file syntax is valid')
				? 'valid'
				: result.includes('✗ Found')
					? 'invalid'
					: 'none';

			const fileMatchesMatch = result.match(/--- File Ownership ---/);
			if (fileMatchesMatch) {
				const fileSections = result.split('--- File Ownership ---')[1];
				if (fileSections) {
					fileMatches = (fileSections.match(/File: /g) || []).length;
				}
			}
		}

		const messageContent = (
			<Box flexDirection="column">
				<Text color={colors.tool}>⚒ git_codeowners</Text>

				<Box>
					<Text color={colors.secondary}>Rules: </Text>
					<Text color={colors.primary}>{ruleCount}</Text>
				</Box>

				{validationStatus !== 'none' && (
					<Box>
						<Text color={colors.secondary}>Validation: </Text>
						<Text color={validationStatus === 'valid' ? colors.success : colors.error}>
							{validationStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
						</Text>
					</Box>
				)}

				{fileMatches > 0 && (
					<Box>
						<Text color={colors.secondary}>Files matched: </Text>
						<Text color={colors.text}>{fileMatches}</Text>
					</Box>
				)}

				{args.validate !== false && validationStatus === 'none' && (
					<Box>
						<Text color={colors.secondary}>Validation: </Text>
						<Text color={colors.text}>No CODEOWNERS file found</Text>
					</Box>
				)}
			</Box>
		);

		return <ToolMessage message={messageContent} hideBox={true} />;
	},
);

const formatter = (
	args: CodeOwnerInput,
	result?: string,
): React.ReactElement => {
	return <GitCodeOwnersFormatter args={args} result={result} />;
};

const validator = async (
	_args: CodeOwnerInput,
): Promise<{valid: true} | {valid: false; error: string}> => {
	// No specific validation needed for this tool
	return {valid: true};
};

// Export the tool using NanocoderToolExport pattern
export const gitCodeOwnersTool: NanocoderToolExport = {
	name: 'git_codeowners' as const,
	tool: gitCodeOwnersCoreTool,
	formatter,
	validator,
};
