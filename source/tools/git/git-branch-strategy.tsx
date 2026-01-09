/**
 * Git Branch Strategy Tool
 *
 * Manages workflow strategy configuration, generates branch protection rules,
 * validates current branch against strategy, and provides recommendations.
 */

import {Box, Text} from 'ink';
import React from 'react';
import ToolMessage from '@/components/tool-message';
import {getCurrentMode} from '@/context/mode-context';
import {ThemeContext} from '@/hooks/useTheme';
import type {NanocoderToolExport} from '@/types/core';
import {jsonSchema, tool} from '@/types/core';
import type {BranchStrategyInput} from './types';
import {
	execGit,
	getGitWorkflowConfig,
	isGitRepository,
} from './utils';

/**
 * Execute the git_branch_strategy tool
 */
const executeGitBranchStrategy = async (args: BranchStrategyInput): Promise<string> => {
	const lines: string[] = [];

	lines.push('=== Git Branch Strategy Manager ===');
	lines.push('');

	// Get current branch if not provided
	let currentBranch = args.currentBranch;
	if (!currentBranch) {
		try {
			const result = await execGit(['branch', '--show-current']);
			currentBranch = result.trim();
		} catch {
			currentBranch = 'unknown';
		}
	}

	// Handle different actions
	const action = args.action || 'get';

	switch (action) {
		case 'get': {
			const config = await getGitWorkflowConfig();
			lines.push('Current Strategy Configuration:');
			lines.push(`  Workflow Strategy: ${config.workflowStrategy || 'not configured'}`);
			if (config.branchProtection) {
				lines.push(`  Enforce Rules: ${config.branchProtection.enforceRules ?? 'not set'}`);
				lines.push(`  Require Reviews: ${config.branchProtection.requireReviews ?? 'not set'}`);
				lines.push(`  Require Status Checks: ${config.branchProtection.requireStatusChecks ?? 'not set'}`);
				lines.push(`  Required Reviewers: ${config.branchProtection.requiredReviewers ?? 'not set'}`);
				if (config.branchProtection.allowedBranches?.length) {
					lines.push(`  Allowed Branches: ${config.branchProtection.allowedBranches.join(', ')}`);
				}
			}
			lines.push('');
			lines.push(`Current Branch: ${currentBranch}`);
			lines.push('');
			break;
		}

		case 'set': {
			if (!args.strategy || !args.config) {
				return 'Error: "set" action requires both "strategy" and "config" parameters.\n\nTo set branch strategy, update your agents.config.json file:\n\n{\n  "nanocoder": {\n    "git": {\n      "workflowStrategy": "feature-branch",\n      "branchProtection": {\n        "enforceRules": true,\n        "requireReviews": true,\n        "requireStatusChecks": true,\n        "requiredReviewers": 1\n      }\n    }\n  }\n}';
			}
			lines.push('Branch strategy configuration requires updating agents.config.json:');
			lines.push('');
			lines.push('Add to your agents.config.json:');
			lines.push(JSON.stringify(
				{
					nanocoder: {
						git: {
							workflowStrategy: args.strategy,
							branchProtection: args.config,
						},
					},
				},
				null,
				2,
			));
			lines.push('');
			break;
		}

		case 'validate': {
			const config = await getGitWorkflowConfig();
			const strategy = config.workflowStrategy || 'feature-branch';
			lines.push(`Validating branch "${currentBranch}" against strategy: ${strategy}`);
			lines.push('');

			const issues: string[] = [];
			const warnings: string[] = [];

			// Check if branch matches strategy pattern
			switch (strategy) {
				case 'feature-branch': {
					if (currentBranch === 'main' || currentBranch === 'master') {
						warnings.push('Direct commits to main/master are discouraged in feature-branch workflow');
					}
					if (!currentBranch.startsWith('feature/') &&
						!currentBranch.startsWith('bugfix/') &&
						currentBranch !== 'main' &&
						currentBranch !== 'master') {
						warnings.push('Branch name should follow pattern: feature/* or bugfix/*');
					}
					break;
				}

				case 'gitflow': {
					const validPrefixes = ['feature/', 'hotfix/', 'release/', 'develop', 'main', 'master'];
					const isValid = validPrefixes.some(prefix => currentBranch.startsWith(prefix)) ||
						currentBranch === 'main' ||
						currentBranch === 'master' ||
						currentBranch === 'develop';
					if (!isValid) {
						issues.push('Branch name must follow GitFlow pattern: feature/*, hotfix/*, release/*');
					}
					break;
				}

				case 'trunk-based': {
					// Most branches are OK in trunk-based, but very long-lived branches are discouraged
					try {
						const result = await execGit(['log', '--since', '30 days ago', '--pretty=format:%H', currentBranch]);
						const commits = result.trim().split('\n').filter(Boolean).length;
						if (commits > 50) {
							warnings.push(`Branch has ${commits} commits in the last 30 days - consider merging to trunk`);
						}
					} catch {
						// Ignore errors
					}
					break;
				}

				case 'release-flow': {
					const validPrefixes = ['release/', 'main', 'master', 'ci/'];
					const isValid = validPrefixes.some(prefix => currentBranch.startsWith(prefix)) ||
						currentBranch === 'main' ||
						currentBranch === 'master';
					if (!isValid) {
						issues.push('Branch name should follow release-flow pattern: release/* or main/master');
					}
					break;
				}

				default: {
					warnings.push(`Unknown strategy: ${strategy}. Using default feature-branch validation.`);
				}
			}

			// Check allowed branches if configured
			if (config.branchProtection?.allowedBranches?.length && !config.branchProtection.allowedBranches.includes(currentBranch)) {
				issues.push(`Branch "${currentBranch}" is not in the allowed branches list`);
			}

			if (issues.length === 0 && warnings.length === 0) {
				lines.push('✓ Branch validation passed');
			} else {
				if (issues.length > 0) {
					lines.push(`✗ Found ${issues.length} validation error(s):`);
					for (const issue of issues) {
						lines.push(`  ${issue}`);
					}
				}
				if (warnings.length > 0) {
					lines.push(`⚠ Found ${warnings.length} warning(s):`);
					for (const warning of warnings) {
						lines.push(`  ${warning}`);
					}
				}
			}
			lines.push('');
			break;
		}

		case 'recommend': {
			lines.push('Branch Strategy Recommendations:');
			lines.push('');
			lines.push('1. feature-branch:');
			lines.push('   - Best for: Teams with formal PR review process');
			lines.push('   - Long-lived branches: main, develop');
			lines.push('   - Short-lived: feature/*, bugfix/*');
			lines.push('');
			lines.push('2. gitflow:');
			lines.push('   - Best for: Projects with scheduled releases');
			lines.push('   - Long-lived branches: main, develop');
			lines.push('   - Short-lived: feature/*, hotfix/*, release/*');
			lines.push('');
			lines.push('3. trunk-based:');
			lines.push('   - Best for: High-velocity teams with CI/CD');
			lines.push('   - Short-lived feature branches (< 1 day)');
			lines.push('   - Direct commits to trunk encouraged');
			lines.push('');
			lines.push('4. release-flow:');
			lines.push('   - Best for: Continuous delivery with multiple release streams');
			lines.push('   - Long-lived: main, release/*');
			lines.push('   - Short-lived: ci/*');
			lines.push('');
			break;
		}
	}

	return lines.join('\n');
};

// AI SDK tool definition with execute function
const gitBranchStrategyCoreTool = tool({
	description:
		'Manage workflow strategy configuration, generate branch protection rules, validate current branch against strategy, and provide recommendations.',
	inputSchema: jsonSchema<BranchStrategyInput>({
		type: 'object',
		properties: {
			action: {
				type: 'string',
				enum: ['get', 'set', 'validate', 'recommend'],
				description:
					'Action to perform. Default: get',
			},
			strategy: {
				type: 'string',
				enum: ['feature-branch', 'gitflow', 'trunk-based', 'release-flow'],
				description:
					'Workflow strategy to set (required for "set" action).',
			},
			config: {
				type: 'object',
				description:
					'Configuration object (required for "set" action).',
			},
			currentBranch: {
				type: 'string',
				description:
					'The current branch name. If not provided, auto-detected from git.',
			},
		},
		required: [],
	}),
	needsApproval: () => {
		const mode = getCurrentMode();
		return mode !== 'auto-accept';
	},
	execute: async (args, _options) => {
		return await executeGitBranchStrategy(args);
	},
});

// Formatter component
const GitBranchStrategyFormatter = React.memo(
	({args, result}: {args: BranchStrategyInput; result?: string}) => {
		const themeContext = React.useContext(ThemeContext);
		if (!themeContext) {
			throw new Error('ThemeContext is required');
		}
		const {colors} = themeContext;

		// Parse result for display
		let action = args.action || 'get';
		let strategy = '';
		let hasIssues = false;
		let branch = '';

		if (result) {
			const strategyMatch = result.match(/Workflow Strategy: (\S+)/);
			if (strategyMatch) strategy = strategyMatch[1];
			else {
				const strategyMatch2 = result.match(/strategy: (\S+)/);
				if (strategyMatch2) strategy = strategyMatch2[1];
			}

			hasIssues = result.includes('✗ Found') || result.includes('validation error');

			const branchMatch = result.match(/Current Branch: (\S+)/);
			if (branchMatch) branch = branchMatch[1];
		}

		const messageContent = (
			<Box flexDirection="column">
				<Text color={colors.tool}>⚒ git_branch_strategy</Text>

				<Box>
					<Text color={colors.secondary}>Action: </Text>
					<Text color={colors.primary}>{action}</Text>
				</Box>

				{strategy && (
					<Box>
						<Text color={colors.secondary}>Strategy: </Text>
						<Text color={colors.text}>{strategy}</Text>
					</Box>
				)}

				{branch && (
					<Box>
						<Text color={colors.secondary}>Branch: </Text>
						<Text color={colors.text}>{branch}</Text>
					</Box>
				)}

				{hasIssues && (
					<Box>
						<Text color={colors.secondary}>Status: </Text>
						<Text color={colors.error}>Issues found</Text>
					</Box>
				)}
			</Box>
		);

		return <ToolMessage message={messageContent} hideBox={true} />;
	},
);

const formatter = (
	args: BranchStrategyInput,
	result?: string,
): React.ReactElement => {
	return <GitBranchStrategyFormatter args={args} result={result} />;
};

const validator = async (
	_args: BranchStrategyInput,
): Promise<{valid: true} | {valid: false; error: string}> => {
	// Check if in git repository
	if (!(await isGitRepository())) {
		return {
			valid: false,
			error: 'git Not in a git repository',
		};
	}

	return {valid: true};
};

// Export the tool using NanocoderToolExport pattern
export const gitBranchStrategyTool: NanocoderToolExport = {
	name: 'git_branch_strategy' as const,
	tool: gitBranchStrategyCoreTool,
	formatter,
	validator,
};
