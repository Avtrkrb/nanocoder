/**
 * Git Workflow Utilities
 *
 * Shared utilities for git operations including command execution,
 * diff parsing, and analysis functions.
 */

import {spawn} from 'node:child_process';
import type {
	CommitType,
	DiffAnalysis,
	EnhancedStatus,
	FileChange,
	FileChangeStatus,
} from './types';

/**
 * Execute a git command and return the output
 */
export async function execGit(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('git', args);
		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on('close', (code: number | null) => {
			if (code === 0) {
				// Use trimEnd() instead of trim() to preserve leading whitespace
				// which is significant in porcelain output (e.g., " M" vs "M ")
				resolve(stdout.trimEnd());
			} else {
				// Non-zero exit code indicates an error
				// Include stderr in error message for context
				const errorMessage =
					stderr.trim() || `Git command failed with exit code ${code}`;
				reject(new Error(errorMessage));
			}
		});

		proc.on('error', error => {
			reject(new Error(`Failed to execute git: ${error.message}`));
		});
	});
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepository(): Promise<boolean> {
	try {
		await execGit(['rev-parse', '--is-inside-work-tree']);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(): Promise<string> {
	return execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

/**
 * Get the default branch (main or master)
 */
export async function getDefaultBranch(): Promise<string> {
	try {
		// Try to get from remote origin
		const remoteBranch = await execGit([
			'symbolic-ref',
			'refs/remotes/origin/HEAD',
			'--short',
		]);
		return remoteBranch.replace('origin/', '');
	} catch {
		// Fall back to checking if main or master exists
		try {
			await execGit(['rev-parse', '--verify', 'main']);
			return 'main';
		} catch {
			try {
				await execGit(['rev-parse', '--verify', 'master']);
				return 'master';
			} catch {
				return 'main'; // Default to main
			}
		}
	}
}

/**
 * Parse git diff --stat output to extract file changes
 */
export function parseDiffStat(diffStat: string): FileChange[] {
	const files: FileChange[] = [];
	const lines = diffStat.split('\n').filter(line => line.trim());

	for (const line of lines) {
		// Skip summary line (e.g., "3 files changed, 10 insertions(+), 5 deletions(-)")
		if (line.includes('files changed') || line.includes('file changed')) {
			continue;
		}

		// Parse line format: " path/to/file.ts | 10 ++++---"
		const match = line.match(/^\s*(.+?)\s+\|\s+(\d+|Bin)/);
		if (match) {
			const path = match[1].trim();
			const isBinary = match[2] === 'Bin';

			// Count + and - signs for additions/deletions
			const changesMatch = line.match(/\|.*?(\d+)?\s*([+-]+)?/);
			let additions = 0;
			let deletions = 0;

			if (changesMatch && changesMatch[2]) {
				additions = (changesMatch[2].match(/\+/g) || []).length;
				deletions = (changesMatch[2].match(/-/g) || []).length;
			}

			// Detect renames (format: old => new)
			const renameMatch = path.match(/(.+)\s*=>\s*(.+)/);
			let finalPath = path;
			let oldPath: string | undefined;
			let status: FileChangeStatus = 'modified';

			if (renameMatch) {
				// Handle various rename formats
				oldPath = renameMatch[1].trim();
				finalPath = renameMatch[2].trim();
				status = 'renamed';
			}

			files.push({
				path: finalPath,
				status,
				oldPath,
				additions,
				deletions,
				isBinary,
			});
		}
	}

	return files;
}

/**
 * Parse git status --porcelain output
 */
export function parseGitStatus(statusOutput: string): {
	staged: FileChange[];
	unstaged: FileChange[];
	untracked: string[];
	conflicts: string[];
} {
	const staged: FileChange[] = [];
	const unstaged: FileChange[] = [];
	const untracked: string[] = [];
	const conflicts: string[] = [];

	const lines = statusOutput.split('\n').filter(line => line.trim());

	for (const line of lines) {
		if (line.length < 3) continue;

		const indexStatus = line[0];
		const workTreeStatus = line[1];
		const path = line.slice(3).trim();

		// Detect conflicts (both modified)
		if (indexStatus === 'U' || workTreeStatus === 'U') {
			conflicts.push(path);
			continue;
		}

		// Untracked files
		if (indexStatus === '?' && workTreeStatus === '?') {
			untracked.push(path);
			continue;
		}

		// Staged changes (index status)
		if (indexStatus !== ' ' && indexStatus !== '?') {
			staged.push({
				path,
				status: mapStatusChar(indexStatus),
				additions: 0,
				deletions: 0,
				isBinary: false,
			});
		}

		// Unstaged changes (work tree status)
		if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
			unstaged.push({
				path,
				status: mapStatusChar(workTreeStatus),
				additions: 0,
				deletions: 0,
				isBinary: false,
			});
		}
	}

	return {staged, unstaged, untracked, conflicts};
}

/**
 * Map git status character to FileChangeStatus
 */
function mapStatusChar(char: string): FileChangeStatus {
	switch (char) {
		case 'A':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		case 'C':
			return 'copied';
		case 'M':
		default:
			return 'modified';
	}
}

/**
 * Analyze staged changes to suggest commit type
 */
export function analyzeChangesForCommitType(files: FileChange[]): CommitType {
	// Check file patterns to determine commit type
	const paths = files.map(f => f.path.toLowerCase());

	// Test files
	if (
		paths.every(
			p =>
				p.includes('test') ||
				p.includes('spec') ||
				p.includes('__tests__') ||
				p.endsWith('.test.ts') ||
				p.endsWith('.test.tsx') ||
				p.endsWith('.spec.ts') ||
				p.endsWith('.spec.tsx'),
		)
	) {
		return 'test';
	}

	// Documentation
	if (
		paths.every(
			p =>
				p.endsWith('.md') ||
				p.includes('readme') ||
				p.includes('docs/') ||
				p.includes('documentation'),
		)
	) {
		return 'docs';
	}

	// CI/CD
	if (
		paths.every(
			p =>
				p.includes('.github/') ||
				p.includes('.gitlab-ci') ||
				p.includes('jenkinsfile') ||
				p.includes('.circleci') ||
				p.includes('.travis'),
		)
	) {
		return 'ci';
	}

	// Build configuration
	if (
		paths.every(
			p =>
				p.includes('package.json') ||
				p.includes('webpack') ||
				p.includes('vite') ||
				p.includes('rollup') ||
				p.includes('tsconfig') ||
				p.includes('babel') ||
				p.includes('eslint') ||
				p.includes('prettier'),
		)
	) {
		return 'build';
	}

	// Style changes (CSS, formatting)
	if (
		paths.every(
			p =>
				p.endsWith('.css') ||
				p.endsWith('.scss') ||
				p.endsWith('.less') ||
				p.endsWith('.styled.ts') ||
				p.endsWith('.styled.tsx'),
		)
	) {
		return 'style';
	}

	// All new files = likely a feature
	if (files.every(f => f.status === 'added')) {
		return 'feat';
	}

	// All deletions = likely chore/cleanup
	if (files.every(f => f.status === 'deleted')) {
		return 'chore';
	}

	// If files contain "fix" in path or small changes in specific files
	if (
		paths.some(p => p.includes('fix')) ||
		(files.length <= 3 && files.every(f => f.additions + f.deletions < 20))
	) {
		return 'fix';
	}

	// Default to feat for larger changes
	return 'feat';
}

/**
 * Suggest a scope based on file paths
 */
export function suggestScope(files: FileChange[]): string | undefined {
	if (files.length === 0) return undefined;

	const paths = files.map(f => f.path);

	// Extract common directory patterns
	const directories = paths.map(p => {
		const parts = p.split('/');
		// Return second level for src/components/Button.tsx -> components
		if (parts[0] === 'source' || parts[0] === 'src') {
			return parts[1];
		}
		return parts[0];
	});

	// Find most common directory
	const counts = new Map<string, number>();
	for (const dir of directories) {
		if (dir) {
			counts.set(dir, (counts.get(dir) || 0) + 1);
		}
	}

	// If all files are in same directory, use it as scope
	if (counts.size === 1) {
		const scope = directories[0];
		// Don't use generic names as scope
		if (scope && !['lib', 'utils', 'helpers', 'common'].includes(scope)) {
			return scope;
		}
	}

	return undefined;
}

/**
 * Detect potential breaking changes in the diff
 */
async function detectBreakingChanges(
	files: FileChange[],
): Promise<{isBreaking: boolean; reason?: string}> {
	// For now, we'll check file patterns that commonly indicate breaking changes
	const riskyPaths = files.filter(
		f =>
			f.path.includes('types') ||
			f.path.includes('interfaces') ||
			f.path.includes('api') ||
			f.path.includes('schema') ||
			f.path.includes('public'),
	);

	// If modifying public API files with deletions
	if (riskyPaths.length > 0 && riskyPaths.some(f => f.deletions > 0)) {
		return {
			isBreaking: true,
			reason: `Modifying public API files: ${riskyPaths.map(f => f.path).join(', ')}`,
		};
	}

	return {isBreaking: false};
}

/**
 * Analyze staged changes comprehensively
 */
export async function analyzeStagedChanges(): Promise<DiffAnalysis> {
	// Get diff stat
	const diffStat = await execGit(['diff', '--staged', '--stat']);
	const files = parseDiffStat(diffStat);

	// Get name-status for accurate file status (A=added, M=modified, D=deleted, R=renamed)
	const nameStatus = await execGit(['diff', '--staged', '--name-status']);
	const statusLines = nameStatus.split('\n').filter(line => line.trim());

	for (const line of statusLines) {
		const parts = line.split('\t');
		if (parts.length >= 2) {
			const statusCode = parts[0][0]; // First char is status (A, M, D, R, C)
			const path = parts.length === 3 ? parts[2] : parts[1]; // For renames, new path is third

			const file = files.find(f => f.path === path);
			if (file) {
				switch (statusCode) {
					case 'A':
						file.status = 'added';
						break;
					case 'D':
						file.status = 'deleted';
						break;
					case 'R':
						file.status = 'renamed';
						break;
					case 'C':
						file.status = 'copied';
						break;
					// M stays as 'modified' (default)
				}
			}
		}
	}

	// Get numstat for accurate counts
	const numstat = await execGit(['diff', '--staged', '--numstat']);
	const numstatLines = numstat.split('\n').filter(line => line.trim());

	for (const line of numstatLines) {
		const parts = line.split('\t');
		if (parts.length >= 3) {
			// Parse with NaN guard - default to 0 if parsing fails
			const additionsRaw = parseInt(parts[0], 10);
			const deletionsRaw = parseInt(parts[1], 10);
			const additions =
				parts[0] === '-' || Number.isNaN(additionsRaw) ? 0 : additionsRaw;
			const deletions =
				parts[1] === '-' || Number.isNaN(deletionsRaw) ? 0 : deletionsRaw;
			const path = parts[2];

			// Use exact path matching to avoid substring false positives
			const file = files.find(f => f.path === path);
			if (file) {
				file.additions = additions;
				file.deletions = deletions;
			}
		}
	}

	const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
	const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

	const suggestedType = analyzeChangesForCommitType(files);
	const suggestedScope = suggestScope(files);
	const {isBreaking, reason} = await detectBreakingChanges(files);

	return {
		files,
		totalAdditions,
		totalDeletions,
		totalFiles: files.length,
		suggestedType,
		suggestedScope,
		isBreakingChange: isBreaking,
		breakingChangeReason: reason,
	};
}

/**
 * Get enhanced git status
 */
export async function getEnhancedStatus(): Promise<EnhancedStatus> {
	// Get porcelain status
	const statusOutput = await execGit(['status', '--porcelain']);
	const {staged, unstaged, untracked, conflicts} = parseGitStatus(statusOutput);

	// Get branch info
	const branch = await getCurrentBranch();

	// Get upstream info
	let upstream: string | undefined;
	let ahead = 0;
	let behind = 0;

	try {
		upstream = await execGit(['rev-parse', '--abbrev-ref', '@{upstream}']);
		const aheadBehind = await execGit([
			'rev-list',
			'--left-right',
			'--count',
			`${upstream}...HEAD`,
		]);
		const [behindCount, aheadCount] = aheadBehind
			.split('\t')
			.map(n => parseInt(n, 10));
		ahead = aheadCount || 0;
		behind = behindCount || 0;
	} catch {
		// No upstream configured
	}

	// Build summary
	const summaryParts: string[] = [];
	if (staged.length > 0) summaryParts.push(`${staged.length} staged`);
	if (unstaged.length > 0) summaryParts.push(`${unstaged.length} modified`);
	if (untracked.length > 0) summaryParts.push(`${untracked.length} untracked`);
	if (conflicts.length > 0) summaryParts.push(`${conflicts.length} conflicts`);
	if (ahead > 0) summaryParts.push(`${ahead} ahead`);
	if (behind > 0) summaryParts.push(`${behind} behind`);

	const summary =
		summaryParts.length > 0 ? summaryParts.join(', ') : 'Working tree clean';

	return {
		branch,
		upstream,
		ahead,
		behind,
		staged,
		unstaged,
		untracked,
		hasConflicts: conflicts.length > 0,
		conflicts,
		summary,
	};
}

/**
 * Get commits between current branch and target
 */
export async function getCommitsBetween(
	targetBranch: string,
): Promise<Array<{hash: string; subject: string; body: string}>> {
	try {
		const log = await execGit([
			'log',
			`${targetBranch}..HEAD`,
			'--format=%H%n%s%n%b%n---COMMIT_SEPARATOR---',
		]);

		if (!log.trim()) {
			return [];
		}

		const commitBlocks = log
			.split('---COMMIT_SEPARATOR---')
			.filter(b => b.trim());

		return commitBlocks.map(block => {
			const lines = block.trim().split('\n');
			return {
				hash: lines[0] || '',
				subject: lines[1] || '',
				body: lines.slice(2).join('\n').trim(),
			};
		});
	} catch {
		return [];
	}
}

/**
 * Get list of contributors who have modified the changed files
 */
export async function getSuggestedReviewers(
	files: FileChange[],
): Promise<string[]> {
	const reviewers = new Set<string>();

	for (const file of files.slice(0, 5)) {
		// Limit to avoid too many git commands
		try {
			const log = await execGit([
				'log',
				'--format=%ae',
				'-n',
				'5',
				'--',
				file.path,
			]);
			for (const email of log.split('\n').filter(e => e.trim())) {
				reviewers.add(email.trim());
			}
		} catch {
			// File might be new
		}
	}

	// Remove current user
	try {
		const currentUser = await execGit(['config', 'user.email']);
		reviewers.delete(currentUser.trim());
	} catch {
		// Config might not be set
	}

	return Array.from(reviewers).slice(0, 5);
}

// ============================================================================
// PHASE 2: Advanced Git Workflow - Utility Functions
// ============================================================================

import {existsSync, readFileSync, promises as fs} from 'node:fs';
import {resolve} from 'node:path';
import type {
	BranchStrategyConfig,
	ChangelogEntry,
	ChangelogOptions,
	CodeOwnerMatch,
	CodeOwnerRule,
	ReleaseConfig,
	ReleaseNotes,
	SemanticVersion,
} from './types';

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Get git workflow configuration from agents.config.json
 */
export async function getGitWorkflowConfig(): Promise<{
	workflowStrategy?: string;
	branchProtection?: BranchStrategyConfig;
	release?: ReleaseConfig;
	codeowners?: {enabled: boolean; filePath?: string};
}> {
	const configPaths = [
		resolve('agents.config.json'),
		resolve('.agents.config.json'),
	];

	for (const configPath of configPaths) {
		if (existsSync(configPath)) {
			try {
				const content = readFileSync(configPath, 'utf-8');
				const config = JSON.parse(content);
				return config.nanocoder?.git || {};
			} catch {
				// Invalid JSON, continue to next path
			}
		}
	}

	return {};
}

/**
 * Parse semantic version from version string
 */
export function parseSemanticVersion(version: string): SemanticVersion | null {
	// Remove 'v' prefix if present
	const cleanVersion = version.replace(/^v/, '');

	// Match semver pattern: major.minor.patch[-prerelease][+build]
	const match = cleanVersion.match(
		/^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/,
	);

	if (!match) {
		return null;
	}

	return {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10),
		patch: parseInt(match[3], 10),
		prerelease: match[4],
		build: match[5],
		version: cleanVersion,
	};
}

/**
 * Get the latest version tag
 */
export async function getLatestVersion(
	prefix = 'v',
): Promise<SemanticVersion | null> {
	try {
		// Get all tags that start with the prefix
		const tagsOutput = await execGit(['tag', '-l', `${prefix}*`]);

		if (!tagsOutput.trim()) {
			return null;
		}

		const tags = tagsOutput
			.split('\n')
			.filter(t => t.trim())
			.map(parseSemanticVersion)
			.filter((v): v is SemanticVersion => v !== null);

		if (tags.length === 0) {
			return null;
		}

		// Sort by version (descending)
		tags.sort((a, b) => {
			if (a.major !== b.major) return b.major - a.major;
			if (a.minor !== b.minor) return b.minor - a.minor;
			return b.patch - a.patch;
		});

		return tags[0];
	} catch {
		return null;
	}
}

/**
 * Compare two version strings
 * Returns: 1 if v1 > v2, 0 if v1 == v2, -1 if v1 < v2
 */
export function compareVersions(v1: string, v2: string): 1 | 0 | -1 {
	const sv1 = parseSemanticVersion(v1);
	const sv2 = parseSemanticVersion(v2);

	if (!sv1 || !sv2) {
		return 0;
	}

	if (sv1.major !== sv2.major) return sv1.major > sv2.major ? 1 : -1;
	if (sv1.minor !== sv2.minor) return sv1.minor > sv2.minor ? 1 : -1;
	if (sv1.patch !== sv2.patch) return sv1.patch > sv2.patch ? 1 : -1;

	return 0;
}

/**
 * Analyze commits since last tag to determine semantic version bump
 */
export async function getSemanticVersion(
	fromTag?: string,
): Promise<SemanticVersion & {
	bump: 'major' | 'minor' | 'patch' | 'none';
	rationale: string;
}> {
	// Get current version
	const currentVersion = (fromTag
		? parseSemanticVersion(fromTag)
		: await getLatestVersion()) || {
		major: 0,
		minor: 0,
		patch: 0,
		version: '0.0.0',
	};

	// Get commits since the tag
	const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
	const log = await execGit([
		'log',
		range,
		'--format=%s%n%b%n---COMMIT_SEPARATOR---',
	]);

	const commits = log
		.split('---COMMIT_SEPARATOR---')
		.filter(c => c.trim())
		.map(c => c.trim());

	let bump: 'major' | 'minor' | 'patch' | 'none' = 'none';
	const breakingChanges: string[] = [];
	const features: string[] = [];
	const fixes: string[] = [];

	for (const commit of commits) {
		const lines = commit.split('\n');
		const subject = lines[0] || '';
		const body = lines.slice(1).join('\n');

		// Check for breaking changes
		if (
			subject.includes('!') ||
			body.includes('BREAKING CHANGE:') ||
			body.includes('BREAKING-CHANGE:')
		) {
			const match = body.match(/BREAKING CHANGE:\s*(.+)/);
			breakingChanges.push(match ? match[1] : subject);
		}

		// Categorize commits
		if (subject.match(/^(feat|feature):/)) {
			features.push(subject);
		} else if (subject.match(/^fix:/)) {
			fixes.push(subject);
		}
	}

	// Determine bump level based on conventional commits
	if (breakingChanges.length > 0) {
		bump = 'major';
	} else if (features.length > 0) {
		bump = 'minor';
	} else if (fixes.length > 0) {
		bump = 'patch';
	}

	// Calculate new version
	let newMajor = currentVersion.major;
	let newMinor = currentVersion.minor;
	let newPatch = currentVersion.patch;

	switch (bump) {
		case 'major':
			newMajor++;
			newMinor = 0;
			newPatch = 0;
			break;
		case 'minor':
			newMinor++;
			newPatch = 0;
			break;
		case 'patch':
			newPatch++;
			break;
	}

	const newVersion: string = `${newMajor}.${newMinor}.${newPatch}`;
	const rationale =
		bump === 'major'
			? `Breaking changes detected: ${breakingChanges.slice(0, 3).join(', ')}`
			: bump === 'minor'
				? `${features.length} new features added`
				: bump === 'patch'
					? `${fixes.length} fixes applied`
					: 'No significant changes';

	return {
		major: newMajor,
		minor: newMinor,
		patch: newPatch,
		prerelease: currentVersion.prerelease,
		build: currentVersion.build,
		version: newVersion,
		bump,
		rationale,
	};
}

/**
 * Create and optionally push a git tag
 */
export async function createGitTag(
	tag: string,
	message: string,
	options?: {
		annotated?: boolean;
		signed?: boolean;
		push?: boolean;
	},
): Promise<void> {
	const args = ['tag'];

	if (options?.signed) {
		args.push('-s');
	} else if (options?.annotated !== false) {
		args.push('-a');
	}

	args.push(tag, '-m', message);

	await execGit(args);

	if (options?.push) {
		await execGit(['push', 'origin', tag]);
	}
}

/**
 * Generate release notes from commits
 */
export async function generateReleaseNotes(
	fromTag?: string,
	toRef = 'HEAD',
): Promise<ReleaseNotes> {
	// Get version info
	const versionInfo = await getSemanticVersion(fromTag);
	const commitsLog = await execGit([
		'log',
		`${fromTag || ''}..${toRef}`,
		'--format=%s%n%b%n---COMMIT_SEPARATOR---',
	]);

	const commits = commitsLog
		.split('---COMMIT_SEPARATOR---')
		.filter(c => c.trim())
		.map(c => {
			const lines = c.trim().split('\n');
			const subject = lines[0] || '';
			const body = lines.slice(1).join('\n');

			// Parse conventional commit
			const match = subject.match(
				/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
			);

			if (match) {
				return {
					type: (match[1] || 'chore') as CommitType,
					scope: match[2],
					subject: match[4],
					breaking: match[3] === '!' || body.includes('BREAKING CHANGE:'),
				};
			}

			return {
				type: 'chore' as CommitType,
				subject,
				breaking: false,
			};
		});

	// Categorize commits
	const categories = {
		features: commits
			.filter(c => c.type === 'feat')
			.map(c => ` - ${c.subject}`),
		fixes: commits
			.filter(c => c.type === 'fix')
			.map(c => ` - ${c.subject}`),
		breaking: commits
			.filter(c => c.breaking)
			.map(c => ` - ${c.subject}`),
		other: commits
			.filter(c => !['feat', 'fix'].includes(c.type))
			.map(c => ` - ${c.subject}`),
	};

	const summaryParts: string[] = [];
	if (categories.features.length > 0) {
		summaryParts.push(`${categories.features.length} new features`);
	}
	if (categories.fixes.length > 0) {
		summaryParts.push(`${categories.fixes.length} fixes`);
	}
	if (categories.breaking.length > 0) {
		summaryParts.push(`${categories.breaking.length} breaking changes`);
	}

	return {
		version: versionInfo.version,
		date: new Date().toISOString().split('T')[0],
		commits,
		categories,
		summary: summaryParts.join(', ') || 'No changes',
	};
}

// ============================================================================
// Changelog Management
// ============================================================================

/**
 * Parse existing CHANGELOG.md file
 */
export async function parseChangelog(
	format: 'keep-a-changelog' | 'standard' = 'keep-a-changelog',
): Promise<ChangelogEntry[]> {
	const changelogPath = resolve('CHANGELOG.md');

	if (!existsSync(changelogPath)) {
		return [];
	}

	try {
		const content = await fs.readFile(changelogPath, 'utf-8');
		const entries: ChangelogEntry[] = [];

		// Parse Keep a Changelog format
		if (format === 'keep-a-changelog') {
			// Match sections like ## [1.2.3] - 2024-01-01
			const sectionRegex =
				/##\s+\[([^\]]+)\]\s+-\s+(\d{4}-\d{2}-\d{2})\s+([\s\S]*?)(?=\n##\s+\[|$)/g;

			let match: RegExpExecArray | null;
			while ((match = sectionRegex.exec(content)) !== null) {
				const version = match[1];
				const date = match[2];
				const sectionContent = match[3];

				// Parse subsections
				const changes: ChangelogEntry['changes'] = {};

				const subsectionRegex = /###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)\s+([\s\S]*?)(?=\n###\s|$)/g;
				let subMatch: RegExpExecArray | null;

				while ((subMatch = subsectionRegex.exec(sectionContent)) !== null) {
					const type = subMatch[1].toLowerCase();
					const items = subMatch[2]
						.split('\n')
						.map(line => line.replace(/^-\s*/, '').trim())
						.filter(line => line);

					if (type === 'added') changes.added = items;
					else if (type === 'changed') changes.changed = items;
					else if (type === 'deprecated') changes.deprecated = items;
					else if (type === 'removed') changes.removed = items;
					else if (type === 'fixed') changes.fixed = items;
					else if (type === 'security') changes.security = items;
				}

				entries.push({
					version,
					date,
					released: true,
					changes,
				});
			}
		}

		return entries;
	} catch {
		return [];
	}
}

/**
 * Format changelog entry as markdown
 */
export function formatChangelogEntry(
	entry: ChangelogEntry,
	format: 'keep-a-changelog' | 'standard' = 'keep-a-changelog',
): string {
	if (format === 'keep-a-changelog') {
		const lines: string[] = [];
		lines.push(`## [${entry.version}] - ${entry.date}`);
		lines.push('');

		const typeMap: Array<keyof ChangelogEntry['changes'] & string> = [
			'added',
			'changed',
			'deprecated',
			'removed',
			'fixed',
			'security',
		];

		const titleMap: Record<string, string> = {
			added: 'Added',
			changed: 'Changed',
			deprecated: 'Deprecated',
			removed: 'Removed',
			fixed: 'Fixed',
			security: 'Security',
		};

		for (const type of typeMap) {
			const items = entry.changes[type];
			if (items && items.length > 0) {
				lines.push(`### ${titleMap[type]}`);
				for (const item of items) {
					lines.push(`- ${item}`);
				}
				lines.push('');
			}
		}
		lines.push('');

		return lines.join('\n');
	}

	// Standard format
	return `## ${entry.version} (${entry.date})\n\n`;
}

/**
 * Update CHANGELOG.md with new entry
 */
export async function updateChangelogFile(
	entry: ChangelogEntry,
	format: 'keep-a-changelog' | 'standard' = 'keep-a-changelog',
): Promise<void> {
	const changelogPath = resolve('CHANGELOG.md');

	let content = '';
	if (existsSync(changelogPath)) {
		content = await fs.readFile(changelogPath, 'utf-8');
	}

	const newEntry = formatChangelogEntry(entry, format);

	// Insert new entry after header
	const headerRegex = /^(#[^\n]*\n\n)/;
	const newContent = headerRegex.test(content)
		? content.replace(headerRegex, `$1${newEntry}`)
		: `# Changelog\n\n${newEntry}${content}`;

	await fs.writeFile(changelogPath, newContent, 'utf-8');
}

/**
 * Generate changelog entry from commits
 */
export async function generateChangelogEntry(
	options: ChangelogOptions & {
		version: string;
		fromTag?: string;
	},
): Promise<ChangelogEntry> {
	const releaseNotes = await generateReleaseNotes(options.fromTag);
	const date = new Date().toISOString().split('T')[0];

	const changes: ChangelogEntry['changes'] = {};

	// Map commits to changelog categories
	for (const commit of releaseNotes.commits) {
		switch (commit.type) {
			case 'feat':
				if (!changes.added) changes.added = [];
				changes.added.push(commit.subject);
				break;
			case 'fix':
				if (!changes.fixed) changes.fixed = [];
				changes.fixed.push(commit.subject);
				break;
			case 'refactor':
				if (!changes.changed) changes.changed = [];
				changes.changed.push(commit.subject);
				break;
			case 'perf':
				if (!changes.changed) changes.changed = [];
				changes.changed.push(commit.subject);
				break;
		}
	}

	return {
		version: options.version,
		date,
		released: true,
		changes,
	};
}

// ============================================================================
// Code Owners
// ============================================================================

/**
 * Parse CODEOWNERS file (supports GitHub and GitLab formats)
 */
export async function parseCodeOwnersFile(
	filePath = '.github/CODEOWNERS',
): Promise<CodeOwnerRule[]> {
	const resolvedPath = resolve(filePath);

	if (!existsSync(resolvedPath)) {
		return [];
	}

	try {
		const content = await fs.readFile(resolvedPath, 'utf-8');
		const rules: CodeOwnerRule[] = [];
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Skip comments and empty lines
			if (!line || line.startsWith('#')) {
				continue;
			}

			// Parse: pattern owner1 owner2 ...
			const parts = line.split(/\s+/);
			if (parts.length >= 2) {
				const pattern = parts[0];
				const owners = parts.slice(1);

				rules.push({
					pattern,
					owners,
					line: i + 1,
				});
			}
		}

		return rules;
	} catch {
		return [];
	}
}

/**
 * Check if a file path matches a CODEOWNERS pattern
 */
function matchesPattern(file: string, pattern: string): boolean {
	// Convert gitignore-style pattern to regex
	// This is a simplified implementation

	// Handle directory patterns ending with /
	if (pattern.endsWith('/')) {
		pattern = pattern.slice(0, -1);
	}

	// Handle ** wildcard
	pattern = pattern.replace(/\*\*/g, '.*');

	// Handle * wildcard
	pattern = pattern.replace(/(?<!\.)\*/g, '[^/]*');

	// Escape other special regex characters except * and **
	const regexPattern = `^${pattern
		.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
		.replace(/\\\*/g, '[^/]*')
		.replace(/\\\.\*/g, '.*')}$`;

	return new RegExp(regexPattern).test(file);
}

/**
 * Match files to code owners
 */
export async function getCodeOwnersForFiles(
	files: string[],
	rules?: CodeOwnerRule[],
): Promise<CodeOwnerMatch[]> {
	const codeOwnersRules = rules || (await parseCodeOwnersFile());

	if (codeOwnersRules.length === 0) {
		return [];
	}

	const matches: CodeOwnerMatch[] = [];

	for (const file of files) {
		// Find matching rules (last match wins in CODEOWNERS)
		let matchedRule: CodeOwnerRule | undefined;

		for (const rule of codeOwnersRules) {
			if (matchesPattern(file, rule.pattern)) {
				matchedRule = rule;
			}
		}

		if (matchedRule) {
			matches.push({
				file,
				owners: matchedRule.owners,
				matchedRule,
			});
		}
	}

	return matches;
}

/**
 * Validate CODEOWNERS file syntax
 */
export async function validateCodeOwners(
	filePath = '.github/CODEOWNERS',
): Promise<{
	valid: boolean;
	errors: Array<{line: number; message: string}>;
}> {
	const rules = await parseCodeOwnersFile(filePath);
	const errors: Array<{line: number; message: string}> = [];

	// Check for duplicate patterns
	const patternCounts = new Map<string, number>();
	for (const rule of rules) {
		patternCounts.set(rule.pattern, (patternCounts.get(rule.pattern) || 0) + 1);
	}

	for (const [pattern, count] of patternCounts.entries()) {
		if (count > 1) {
			errors.push({
				line: 0,
				message: `Duplicate pattern: ${pattern}`,
			});
		}
	}

	// Validate owner format (@username or email)
	for (const rule of rules) {
		for (const owner of rule.owners) {
			// Skip valid usernames and emails
			if (
				!owner.startsWith('@') &&
				!/^[^@]+@[^@]+\.[^@]+$/.test(owner)
			) {
				errors.push({
					line: rule.line,
					message: `Invalid owner format: ${owner}`,
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Generate CODEOWNERS file suggestions based on git history
 */
export async function generateCodeOwnersSuggestions(): Promise<
	Array<{pattern: string; suggestedOwners: string[]; confidence: number}>
> {
	const suggestions: Array<{
		pattern: string;
		suggestedOwners: string[];
		confidence: number;
	}> = [];

	try {
		// Get all tracked files
		const filesOutput = await execGit(['ls-files']);
		const files = filesOutput.split('\n').filter(f => f.trim());

		// Group files by directory
		const dirMap = new Map<string, string[]>();
		for (const file of files) {
			const dir = file.split('/')[0] || '.';
			if (!dirMap.has(dir)) {
				dirMap.set(dir, []);
			}
			dirMap.get(dir)!.push(file);
		}

		// For each directory, find top contributors
		for (const [dir, dirFiles] of dirMap.entries()) {
			const contributorCounts = new Map<string, number>();

			for (const file of dirFiles.slice(0, 10)) {
				// Limit files to avoid too many git commands
				try {
					const log = await execGit([
						'log',
						'--format=%ae',
						'-n',
						'10',
						'--',
						file,
					]);

					for (const email of log.split('\n').filter(e => e.trim())) {
						contributorCounts.set(
							email.trim(),
							(contributorCounts.get(email.trim()) || 0) + 1,
						);
					}
				} catch {
					// New file, skip
				}
			}

			// Get top contributors
			const sortedContributors = Array.from(
				contributorCounts.entries(),
			).sort((a, b) => b[1] - a[1]);

			if (sortedContributors.length > 0) {
				suggestions.push({
					pattern: `${dir}/**/*`,
					suggestedOwners: sortedContributors
						.slice(0, 3)
						.map(([email]) => email),
					confidence: Math.min(1, sortedContributors[0][1] / 10),
				});
			}
		}
	} catch {
		// Ignore errors
	}

	return suggestions;
}

// ============================================================================
// Team Collaboration
// ============================================================================

/**
 * Get repository URL from git remote
 */
export async function getRepositoryUrl(): Promise<string | null> {
	try {
		const origin = await execGit(['config', 'remote.origin.url']);

		// Convert SSH to HTTPS format
		if (origin.startsWith('git@')) {
			const match = origin.match(/git@([^:]+):(.+)\.git/);
			if (match) {
				return `https://${match[1]}/${match[2]}`;
			}
		}

		// Remove .git suffix if present
		return origin.replace(/\.git$/, '');
	} catch {
		return null;
	}
}

/**
 * Detect co-authors from recent commits
 */
export async function detectCoAuthors(
	files?: string[],
	limit = 5,
): Promise<Array<{name: string; email: string; commits: number}>> {
	const coAuthors = new Map<string, {name: string; email: string; commits: number}>();

	try {
		// Get recent commits
		let range = 'HEAD';
		if (files && files.length > 0) {
			range = `HEAD -- ${files.join(' ')}`;
		}

		const log = await execGit([
			'log',
			'-n',
			'100',
			'--format=%an%x00%ae',
			range,
		]);

		const entries = log.split('\n').filter(e => e.trim());

		for (const entry of entries) {
			const [name, email] = entry.split('\x00');
			const key = email;

			if (!coAuthors.has(key)) {
				coAuthors.set(key, {name, email, commits: 0});
			}
			coAuthors.get(key)!.commits++;
		}

		// Get current user
		try {
			const currentUserEmail = await execGit(['config', 'user.email']);
			const currentUserName = await execGit(['config', 'user.name']);
			const currentKey = currentUserEmail.trim();
			coAuthors.delete(currentKey);

			// Also try to match by name
			for (const [key, value] of coAuthors.entries()) {
				if (value.name === currentUserName.trim()) {
					coAuthors.delete(key);
				}
			}
		} catch {
			// Config not set, skip filtering
		}

		// Sort by commit count and return top contributors
		return Array.from(coAuthors.values())
			.sort((a, b) => b.commits - a.commits)
			.slice(0, limit);
	} catch {
		return [];
	}
}

/**
 * Extract issue/PR references from commit messages
 */
export function extractIssueReferences(
	commits: Array<{subject: string; body: string}>,
): Array<{type: 'issue' | 'pr'; number: string; url?: string}> {
	const references: Array<{type: 'issue' | 'pr'; number: string; url?: string}> =
		[];

	// Common patterns: #123, closes #123, fixes #123, resolves #123
	const patterns = [
		/(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi,
		/#(\d+)/g,
	];

	for (const commit of commits) {
		const text = `${commit.subject} ${commit.body}`;

		for (const pattern of patterns) {
			const match = pattern.exec(text);
			if (match) {
				references.push({
					type: 'issue',
					number: match[1],
				});
			}
		}
	}

	return references;
}
