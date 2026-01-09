/**
 * Git Release Tool
 *
 * Manages semantic versioning, creates git tags, generates release notes,
 * and supports pre-release versions.
 */

import {Box, Text} from 'ink';
import React from 'react';
import ToolMessage from '@/components/tool-message';
import {getCurrentMode} from '@/context/mode-context';
import {ThemeContext} from '@/hooks/useTheme';
import type {NanocoderToolExport} from '@/types/core';
import {jsonSchema, tool} from '@/types/core';
import type {ReleaseInput} from './types';
import {
	createGitTag,
	generateReleaseNotes,
	getSemanticVersion,
} from './utils';

/**
 * Execute the git_release tool
 */
const executeGitRelease = async (args: ReleaseInput): Promise<string> => {
	const lines: string[] = [];

	lines.push('=== Git Release Manager ===');
	lines.push('');

	// Get semantic version analysis
	const versionAnalysis = await getSemanticVersion();
	lines.push(`Current version: ${versionAnalysis.version}`);
	lines.push(`Bump level: ${versionAnalysis.bump}`);
	lines.push(`Rationale: ${versionAnalysis.rationale}`);
	lines.push('');

	// Determine the version to use
	let version = args.version;
	let level = args.level;

	// If level is specified, calculate new version
	if (level && level !== 'auto') {
		const {major, minor, patch, prerelease} = versionAnalysis;
		switch (level) {
			case 'major':
				version = `${major + 1}.0.0`;
				break;
			case 'minor':
				version = `${major}.${minor + 1}.0`;
				break;
			case 'patch':
				version = `${major}.${minor}.${patch + 1}`;
				break;
		}
		if (prerelease) {
			version = `${version}-${prerelease}`;
		}
	} else if (!version) {
		// Use auto-detected version
		switch (versionAnalysis.bump) {
			case 'major':
				version = `${versionAnalysis.major + 1}.0.0`;
				break;
			case 'minor':
				version = `${versionAnalysis.major}.${versionAnalysis.minor + 1}.0`;
				break;
			case 'patch':
				version = `${versionAnalysis.major}.${versionAnalysis.minor}.${versionAnalysis.patch + 1}`;
				break;
			default:
				version = versionAnalysis.version;
		}
		if (args.prerelease) {
			version = `${version}-${args.prerelease}`;
		}
	}

	lines.push(`Release version: ${version}`);
	lines.push('');

	// Generate release notes if requested
	if (args.generateNotes !== false) {
		lines.push('--- Release Notes ---');
		lines.push('');

		const notes = await generateReleaseNotes();
		lines.push(`Version: ${notes.version}`);
		lines.push(`Date: ${new Date().toISOString().split('T')[0]}`);
		lines.push('');
		lines.push(`Summary: ${notes.summary}`);
		lines.push('');

		if (notes.categories.features.length > 0) {
			lines.push('Features:');
			for (const feature of notes.categories.features) {
				lines.push(`  ✓ ${feature}`);
			}
			lines.push('');
		}

		if (notes.categories.fixes.length > 0) {
			lines.push('Bug Fixes:');
			for (const fix of notes.categories.fixes) {
				lines.push(`  • ${fix}`);
			}
			lines.push('');
		}

		if (notes.categories.breaking.length > 0) {
			lines.push('Breaking Changes:');
			for (const breaking of notes.categories.breaking) {
				lines.push(`  ⚠ ${breaking}`);
			}
			lines.push('');
		}
	}

	// Handle dry-run mode
	if (args.dryRun !== false) {
		lines.push('(Dry run - no tag created)');
		lines.push('');
		lines.push('To create this release, run:');
		lines.push(`  git_release with version="${version}" dryRun=false`);
	} else {
		// Create the tag
		if (args.createTag !== false) {
			try {
				const tagMessage = `Release ${version}`;
				await createGitTag(version, tagMessage, {
					annotated: true,
					push: args.pushTag !== false,
				});
				lines.push(`✓ Created tag: ${version}`);
				if (args.pushTag !== false) {
					lines.push('✓ Pushed tag to remote');
				}
			} catch (error) {
				lines.push(
					`✗ Error creating tag: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
		}
		lines.push('');
	}

	return lines.join('\n');
};

// AI SDK tool definition with execute function
const gitReleaseCoreTool = tool({
	description:
		'Manage semantic versioning, create git tags, and generate release notes. Supports automatic version bump detection based on commit history.',
	inputSchema: jsonSchema<ReleaseInput>({
		type: 'object',
		properties: {
			version: {
				type: 'string',
				description:
					'Explicit version to release (e.g., "1.2.3"). If not provided, auto-detects based on commits.',
			},
			level: {
				type: 'string',
				enum: ['major', 'minor', 'patch', 'auto'],
				description:
					'Version bump level. Default: auto (detects from commit types)',
			},
			dryRun: {
				type: 'boolean',
				description:
					'If true, only shows what would be done without creating tags. Default: true',
			},
			createTag: {
				type: 'boolean',
				description:
					'If true, creates a git tag for the release. Default: true',
			},
			pushTag: {
				type: 'boolean',
				description:
					'If true, pushes the tag to the remote repository. Default: true',
			},
			generateNotes: {
				type: 'boolean',
				description:
					'If true, generates release notes from commit history. Default: true',
			},
			updateChangelog: {
				type: 'boolean',
				description:
					'If true, updates the CHANGELOG.md file. Default: false',
			},
			prerelease: {
				type: 'string',
				description:
					'Prerelease identifier (e.g., "alpha", "beta", "rc.1")',
			},
		},
		required: [],
	}),
	needsApproval: (args) => {
		const mode = getCurrentMode();
		// Always need approval when actually creating releases
		return args.dryRun === false ? mode !== 'auto-accept' : true;
	},
	execute: async (args, _options) => {
		return await executeGitRelease(args);
	},
});

// Formatter component
const GitReleaseFormatter = React.memo(
	({args, result}: {args: ReleaseInput; result?: string}) => {
		const themeContext = React.useContext(ThemeContext);
		if (!themeContext) {
			throw new Error('ThemeContext is required');
		}
		const {colors} = themeContext;

		// Parse result for display
		let version = '';
		let bumpLevel = '';
		let isBreaking = false;
		const isDryRun = args.dryRun !== false;

		if (result) {
			const versionMatch = result.match(/Release version: ([\d.\-a-z]+)/i);
			if (versionMatch) version = versionMatch[1];

			const bumpMatch = result.match(/Bump level: (\w+)/);
			if (bumpMatch) bumpLevel = bumpMatch[1];

			isBreaking = result.includes('Breaking Changes:');
		}

		const messageContent = (
			<Box flexDirection="column">
				<Text color={colors.tool}>⚒ git_release</Text>

				<Box>
					<Text color={colors.secondary}>Version: </Text>
					<Text color={colors.primary}>{version || 'Auto-detect'}</Text>
				</Box>

				{bumpLevel && (
					<Box>
						<Text color={colors.secondary}>Bump: </Text>
						<Text color={colors.text}>{bumpLevel}</Text>
					</Box>
				)}

				{isBreaking && (
					<Box>
						<Text color={colors.secondary}>Breaking: </Text>
						<Text color={colors.error}>Yes</Text>
					</Box>
				)}

				<Box>
					<Text color={colors.secondary}>Mode: </Text>
					<Text color={isDryRun ? colors.secondary : colors.success}>
						{isDryRun ? 'dry-run' : 'release'}
					</Text>
				</Box>
			</Box>
		);

		return <ToolMessage message={messageContent} hideBox={true} />;
	},
);

const formatter = (
	args: ReleaseInput,
	result?: string,
): React.ReactElement => {
	return <GitReleaseFormatter args={args} result={result} />;
};

const validator = async (
	_args: ReleaseInput,
): Promise<{valid: true} | {valid: false; error: string}> => {
	// No specific validation needed for this tool
	return {valid: true};
};

// Export the tool using NanocoderToolExport pattern
export const gitReleaseTool: NanocoderToolExport = {
	name: 'git_release' as const,
	tool: gitReleaseCoreTool,
	formatter,
	validator,
};
