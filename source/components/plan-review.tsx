/**
 * Plan Review Component - UI for reviewing and approving implementation plans.
 */

import type {ImplementationPlan, PlanTask, PlanComplexity} from '@/types/plan';
import {useTheme} from '@/hooks/useTheme';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Box, Text, useInput} from 'ink';
import React, {useState} from 'react';
import SelectInput from 'ink-select-input';
import {TitledBox} from '@/components/ui/titled-box';
import {getPlanManager} from '@/services/plan-manager';
import {useTerminalWidth} from '@/hooks/useTerminalWidth';

export interface PlanReviewProps {
	plan: ImplementationPlan;
	onApprove: (plan: ImplementationPlan) => void;
	onModify: (plan: ImplementationPlan) => void;
	onCancel: () => void;
}

interface ReviewOption {
	label: string;
	value: 'approve' | 'modify' | 'cancel';
}

interface PlanReviewState {
	stage: 'review' | 'modify' | 'mode-select';
	selectedOption: ReviewOption | null;
	awaitingModeSelection: boolean;
	editorError: string | null;
}

/**
 * Displays an implementation plan for review and approval.
 */
export function PlanReview({plan, onApprove, onModify, onCancel}: PlanReviewProps) {
	const boxWidth = useTerminalWidth();
	const {colors} = useTheme();
	const [state, setState] = useState<PlanReviewState>({
		stage: 'review',
		selectedOption: null,
		awaitingModeSelection: false,
		editorError: null,
	});

	// Handle escape key to cancel
	useInput((_inputChar, key) => {
		if (key.escape && state.stage === 'review') {
			onCancel();
		}
	});

	// Handle mode selection after approval
	useInput((inputChar, key) => {
		if (state.awaitingModeSelection && state.stage === 'mode-select') {
			const char = inputChar.toLowerCase();
			if (char === 'n' || char === '1') {
				// Switch to Normal mode
				onApprove({...plan, approved: true});
			} else if (char === 'a' || char === '2') {
				// Switch to Auto-accept mode
				onApprove({...plan, approved: true});
			} else if (char === 'p' || char === '3') {
				// Stay in Plan mode
				onApprove({...plan, approved: true});
			} else if (key.escape) {
				// Cancel and go back to review
				setState(prev => ({...prev, stage: 'review', awaitingModeSelection: false}));
			}
		}
	});

	const handleSelect = (item: ReviewOption) => {
		setState(prev => ({...prev, selectedOption: item}));

		switch (item.value) {
			case 'approve':
				setState(prev => ({...prev, stage: 'mode-select', awaitingModeSelection: true}));
				break;
			case 'modify':
				openInExternalEditor();
				break;
			case 'cancel':
				onCancel();
				break;
		}
	};

	/**
	 * Opens the plan in an external editor for modification.
	 * Follows the pattern from config-wizard.tsx
	 */
	const openInExternalEditor = async () => {
		try {
			const manager = getPlanManager();
			const planPath = manager.getPlanPath(plan.id);

			// Ensure plan file exists
			const exists = await manager.planExists(plan.id);
			if (!exists) {
				// Save the plan first if it doesn't exist
				await manager.savePlan(plan);
			}

			// Detect editor (respect $EDITOR or $VISUAL environment variables)
			// Fall back to nano on Unix/Mac (much friendlier than vi!)
			// On Windows, use notepad
			const editor =
				process.env.EDITOR ||
				process.env.VISUAL ||
				(process.platform === 'win32' ? 'notepad' : 'nano');

			// Show cursor and restore terminal for editor
			process.stdout.write('\x1B[?25h'); // Show cursor
			if (process.stdin.setRawMode) {
				process.stdin.setRawMode(false); // Disable raw mode
			}

			// Open editor and wait for it to close
			const editorProcess = spawn(editor, [planPath], {
				stdio: 'inherit', // Give editor full control of terminal
			});

			await new Promise<void>((resolve, reject) => {
				editorProcess.on('close', code => {
					// Restore terminal state after editor closes
					if (process.stdin.setRawMode) {
						process.stdin.setRawMode(true); // Re-enable raw mode
					}
					process.stdout.write('\x1B[?25l'); // Hide cursor (Ink will manage it)

					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`Editor exited with code ${code}`));
					}
				});

				editorProcess.on('error', err => {
					// Restore terminal state on error
					if (process.stdin.setRawMode) {
						process.stdin.setRawMode(true);
					}
					process.stdout.write('\x1B[?25l');
					reject(err);
				});
			});

			// Reload the plan after editing
			const modifiedPlan = await manager.loadPlan(plan.id);
			setState(prev => ({...prev, stage: 'review', editorError: null}));
			onModify(modifiedPlan);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to open editor';
			setState(prev => ({...prev, editorError: errorMessage, stage: 'review'}));
		}
	};

	// Mode selection screen after approval
	if (state.awaitingModeSelection && state.stage === 'mode-select') {
		return (
			<TitledBox
				title="Plan Approved - Select Implementation Mode"
				width={boxWidth}
				borderColor={colors.success}
				paddingX={2}
				paddingY={1}
				marginBottom={1}
			>
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color={colors.success}>✓ Plan approved successfully!</Text>
					</Box>

					<Box flexDirection="column" marginBottom={1}>
						<Text color={colors.text}>
							Plan: <Text color={colors.primary}>{plan.title}</Text>
						</Text>
						<Text color={colors.text}>
							Tasks: <Text color={colors.primary}>{plan.tasks.length}</Text>
						</Text>
						<Text color={colors.text}>
							Files: <Text color={colors.primary}>{plan.affectedFiles.length}</Text>
						</Text>
					</Box>

					<Box marginBottom={1}>
						<Text color={colors.text} bold>
							Select implementation mode:
						</Text>
					</Box>

					<Box flexDirection="column" marginBottom={1}>
						<Text color={colors.text}>
							[1] Normal Mode - Confirm each tool execution
						</Text>
						<Text color={colors.text}>
							[2] Auto-accept Mode - Execute without confirmation
						</Text>
						<Text color={colors.text}>
							[3] Stay in Plan Mode - Continue planning
						</Text>
					</Box>

					<Box marginBottom={1}>
						<Text color={colors.secondary}>
							Press 1/N, 2/A, 3/P or Escape to cancel
						</Text>
					</Box>

					<Box>
						<Text color={colors.secondary} dimColor>
							Each tool execution will be confirmed in Normal Mode
						</Text>
					</Box>
				</Box>
			</TitledBox>
		);
	}

	// Error state
	if (state.editorError) {
		return (
			<TitledBox
				title="Editor Error"
				width={boxWidth}
				borderColor={colors.error}
				paddingX={2}
				paddingY={1}
				marginBottom={1}
			>
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color={colors.error}>{state.editorError}</Text>
					</Box>

					<Box marginBottom={1}>
						<Text color={colors.text}>
							Plan: <Text color={colors.primary}>{plan.title}</Text>
						</Text>
					</Box>

					<Box>
						<Text color={colors.secondary}>Press Enter to continue</Text>
					</Box>
				</Box>
			</TitledBox>
		);
	}

	// Main review screen
	const options: ReviewOption[] = [
		{label: '✓ Approve - Proceed to implementation', value: 'approve'},
		{label: '✎ Modify - Edit plan in external editor', value: 'modify'},
		{label: '✗ Cancel - Discard this plan', value: 'cancel'},
	];

	return (
		<TitledBox
			title="Review Implementation Plan"
			width={boxWidth}
			borderColor={colors.primary}
			paddingX={2}
			paddingY={1}
			marginBottom={1}
		>
			<Box flexDirection="column">
				{/* Plan title and description */}
				<Box marginBottom={1}>
					<Text bold color={colors.primary}>
						{plan.title}
					</Text>
				</Box>

				{plan.description && (
					<Box marginBottom={1}>
						<Text color={colors.text}>{plan.description}</Text>
					</Box>
				)}

				{/* Metadata */}
				<Box flexDirection="column" marginBottom={1}>
					<Text color={colors.secondary}>
						Created: {new Date(plan.timestamp).toLocaleString()}
					</Text>
					<Text color={colors.secondary}>
						Complexity: {formatComplexity(plan.estimatedComplexity)}
					</Text>
					<Text color={colors.secondary}>
						Tasks: {plan.tasks.length} | Files: {plan.affectedFiles.length}
					</Text>
				</Box>

				{/* Tasks */}
				<Box marginBottom={1}>
					<Text bold color={colors.text}>
						Tasks ({plan.tasks.length}):
					</Text>
				</Box>

				{plan.tasks.length > 0 ? (
					<Box flexDirection="column" marginBottom={1} marginLeft={2}>
						{plan.tasks.slice(0, 10).map((task, index) => (
							<Box key={task.id}>
								<Text color={colors.text}>
									{index + 1}. {formatTaskStatus(task.status)} {task.description}
								</Text>
							</Box>
						))}
						{plan.tasks.length > 10 && (
							<Text color={colors.secondary} dimColor>
								... and {plan.tasks.length - 10} more tasks
							</Text>
						)}
					</Box>
				) : (
					<Box marginBottom={1} marginLeft={2}>
						<Text color={colors.secondary} dimColor>
							No tasks in this plan
						</Text>
					</Box>
				)}

				{/* Affected files */}
				{plan.affectedFiles.length > 0 && (
					<>
						<Box marginBottom={1}>
							<Text bold color={colors.text}>
								Affected Files ({plan.affectedFiles.length}):
							</Text>
						</Box>
						<Box flexDirection="column" marginBottom={1} marginLeft={2}>
							{plan.affectedFiles.slice(0, 10).map(file => (
								<Box key={file}>
									<Text color={colors.secondary}>• {file}</Text>
								</Box>
							))}
							{plan.affectedFiles.length > 10 && (
								<Text color={colors.secondary} dimColor>
									... and {plan.affectedFiles.length - 10} more files
								</Text>
							)}
						</Box>
					</>
				)}

				{/* Action prompt */}
				<Box marginBottom={1}>
					<Text color={colors.text} bold>
						What would you like to do?
					</Text>
				</Box>

				<SelectInput items={options} onSelect={handleSelect} />

				<Box marginTop={1}>
					<Text color={colors.secondary}>Press Escape to cancel</Text>
				</Box>
			</Box>
		</TitledBox>
	);
}

/**
 * Formats the complexity level for display.
 */
function formatComplexity(complexity?: PlanComplexity): string {
	const colors = {
		low: 'green',
		medium: 'yellow',
		high: 'red',
	};

	const color = complexity ? colors[complexity] : 'white';
	const label = complexity || 'medium';

	// Return the formatted text (in real implementation, would use proper color)
	return label;
}

/**
 * Formats a task status for display.
 */
function formatTaskStatus(status: PlanTask['status']): string {
	switch (status) {
		case 'approved':
			return '✅';
		case 'rejected':
			return '❌';
		case 'pending':
			return '⏳';
		default:
			return '⏳';
	}
}
