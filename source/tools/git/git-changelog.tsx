/**
 * Git Changelog Tool
 *
 * Generates changelog entries from git commits, supports multiple formats,
 * and can update existing changelog files.
 */

import {Box, Text} from 'ink';
import React from 'react';
import ToolMessage from '@/components/tool-message';
import {getCurrentMode} from '@/context/mode-context';
import {ThemeContext} from '@/hooks/useTheme';
import type {NanocoderToolExport} from '@/types/core';
import {jsonSchema, tool} from '@/types/core';
import type {ChangelogInput} from './types';
import {
	execGit,
	generateChangelogEntry,
} from './utils';

/**
 * Execute the git_changelog tool
 */
const executeGitChangelog = async (args: ChangelogInput): Promise<string> => {
	const lines: string[] = [];

	lines.push('=== Git Changelog Generator ===');
	lines.push('');

	// Determine the version to use
	let version = args.version;
	if (!version) {
		// Try to get the latest version from tags
		try {
			const tagsResult = await execGit(['tag', '--list', 'v*']);
			const tags = tagsResult
				.trim()
				.split('\n')
				.filter(Boolean)
				.sort()
				.reverse();

			if (tags.length > 0) {
				// Extract version number and increment patch
				const latestTag = tags[0];
				const match = latestTag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
				if (match) {
					const major = parseInt(match[1], 10);
					const minor = parseInt(match[2], 10);
					const patch = parseInt(match[3], 10) + 1;
					version = `${major}.${minor}.${patch}`;
				}
			}
		} catch {
			// Fall through to default
		}

		if (!version) {
			version = '1.0.0';
		}
	}

	lines.push(`Version: ${version}`);
	lines.push('');

	// Determine the range
	const since = args.since || 'HEAD~10'; // Default to last 10 commits
	const until = args.until || 'HEAD';

	lines.push(`Range: ${since}..${until}`);
	lines.push(`Format: ${args.format || 'keep-a-changelog'}`);
	lines.push('');

	// Generate changelog entry
	const entry = await generateChangelogEntry({
		version,
		fromTag: since,
		format: args.format || 'keep-a-changelog',
	});

	// Format for display
	const formatArg = args.format || 'keep-a-changelog';
	if (formatArg === 'compact') {
		// For compact format, show a simplified view
		const addedCount = entry.changes.added?.length || 0;
		const changedCount = entry.changes.changed?.length || 0;
		const deprecatedCount = entry.changes.deprecated?.length || 0;
		const removedCount = entry.changes.removed?.length || 0;
		const fixedCount = entry.changes.fixed?.length || 0;
		const securityCount = entry.changes.security?.length || 0;
		const allChanges = addedCount + changedCount + deprecatedCount + removedCount + fixedCount + securityCount;

		lines.push('--- Generated Changelog Entry ---');
		lines.push('');
		lines.push(`## [${entry.version}] - ${entry.date}`);
		lines.push(`Total changes: ${allChanges}`);
		lines.push('');
	} else {
		// Use the utility function for full format
		const {formatChangelogEntry} = await import('./utils');
		lines.push('--- Generated Changelog Entry ---');
		lines.push('');
		lines.push(formatChangelogEntry(entry, formatArg as 'keep-a-changelog' | 'standard'));
		lines.push('');
	}

	// Update changelog file if requested
	if (args.update !== false && args.output !== 'stdout') {
		try {
			const {updateChangelogFile} = await import('./utils');
			const updateFormat = args.format === 'compact' ? 'keep-a-changelog' : (args.format || 'keep-a-changelog');
			await updateChangelogFile(entry, updateFormat as 'keep-a-changelog' | 'standard');
			lines.push('✓ Updated CHANGELOG.md');
			lines.push('');
		} catch (error) {
			lines.push(
				`⚠ Could not update CHANGELOG.md: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			lines.push('');
		}
	}

	return lines.join('\n');
};

// AI SDK tool definition with execute function
const gitChangelogCoreTool = tool({
	description:
		'Generate changelog entries from git commits. Supports Keep a Changelog format and can update existing changelog files.',
	inputSchema: jsonSchema<ChangelogInput>({
		type: 'object',
		properties: {
			version: {
				type: 'string',
				description:
					'Version number for the changelog entry (e.g., "1.2.3"). If not provided, auto-detects from git tags.',
			},
			since: {
				type: 'string',
				description:
					'Starting point for changelog (tag or ref). Default: HEAD~10',
			},
			until: {
				type: 'string',
				description:
					'Ending point for changelog (tag or ref). Default: HEAD',
			},
			format: {
				type: 'string',
				enum: ['keep-a-changelog', 'standard', 'compact'],
				description:
					'Changelog format to use. Default: keep-a-changelog',
			},
			output: {
				type: 'string',
				enum: ['file', 'stdout', 'both'],
				description:
					'Where to output the changelog. Default: both (write to file and show)',
			},
			update: {
				type: 'boolean',
				description:
					'If true, updates the CHANGELOG.md file. Default: true',
			},
		},
		required: [],
	}),
	needsApproval: () => {
		const mode = getCurrentMode();
		return mode !== 'auto-accept';
	},
	execute: async (args, _options) => {
		return await executeGitChangelog(args);
	},
});

// Formatter component
const GitChangelogFormatter = React.memo(
	({args, result}: {args: ChangelogInput; result?: string}) => {
		const themeContext = React.useContext(ThemeContext);
		if (!themeContext) {
			throw new Error('ThemeContext is required');
		}
		const {colors} = themeContext;

		// Parse result for display
		let version = '';
		let format = 'keep-a-changelog';
		let hasChanges = false;

		if (result) {
			const versionMatch = result.match(/Version: ([\d.]+)/);
			if (versionMatch) version = versionMatch[1];

			const formatMatch = result.match(/Format: (\S+)/);
			if (formatMatch) format = formatMatch[1];

			hasChanges = result.includes('### Added') ||
				result.includes('### Changed') ||
				result.includes('### Fixed') ||
				result.includes('Total changes:');
		}

		const messageContent = (
			<Box flexDirection="column">
				<Text color={colors.tool}>⚒ git_changelog</Text>

				<Box>
					<Text color={colors.secondary}>Version: </Text>
					<Text color={colors.primary}>{version || 'Auto-detect'}</Text>
				</Box>

				<Box>
					<Text color={colors.secondary}>Format: </Text>
					<Text color={colors.text}>{format}</Text>
				</Box>

				{args.update !== false && (
					<Box>
						<Text color={colors.secondary}>Output: </Text>
						<Text color={colors.success}>CHANGELOG.md</Text>
					</Box>
				)}

				{result && hasChanges && (
					<Box>
						<Text color={colors.secondary}>Changes: </Text>
						<Text color={colors.success}>Generated</Text>
					</Box>
				)}
			</Box>
		);

		return <ToolMessage message={messageContent} hideBox={true} />;
	},
);

const formatter = (
	args: ChangelogInput,
	result?: string,
): React.ReactElement => {
	return <GitChangelogFormatter args={args} result={result} />;
};

const validator = async (
	_args: ChangelogInput,
): Promise<{valid: true} | {valid: false; error: string}> => {
	// No specific validation needed for this tool
	return {valid: true};
};

// Export the tool using NanocoderToolExport pattern
export const gitChangelogTool: NanocoderToolExport = {
	name: 'git_changelog' as const,
	tool: gitChangelogCoreTool,
	formatter,
	validator,
};
