/**
 * Plan Approval Component for Plan Mode
 *
 * Displays plan summary and allows user to:
 * - Approve and switch to normal/auto-accept mode
 * - Edit plan in external editor
 * - Discard plan
 */

import {Box, Text, useInput} from 'ink';
import {useState} from 'react';
import {useTerminalWidth} from '@/hooks/useTerminalWidth';
import {useTheme} from '@/hooks/useTheme';
import {getPlanManager} from '@/planning/plan-manager';
import type {PlanFile} from '@/planning/types';
import {PLANNING_PHASE_LABELS} from '@/planning/types';

interface PlanApprovalProps {
	planFile: PlanFile;
	onApprove: (mode: 'normal' | 'auto-accept') => void;
	onEdit: () => void;
	onDiscard: () => void;
}

type ApprovalState = 'selecting' | 'confirming-approve' | 'editing';

interface ApprovalOption {
	label: string;
	value: 'approve-normal' | 'approve-auto' | 'edit' | 'discard';
	description: string;
}

export default function PlanApproval({
	planFile,
	onApprove,
	onEdit,
	onDiscard,
}: PlanApprovalProps) {
	const {colors} = useTheme();
	const boxWidth = useTerminalWidth();
	const [state, setState] = useState<ApprovalState>('selecting');
	const [selectedIndex, setSelectedIndex] = useState(0);

	const options: ApprovalOption[] = [
		{
			label: '[A] Approve & Switch to Normal Mode',
			value: 'approve-normal',
			description: 'Approve the plan and continue with tool confirmations',
		},
		{
			label: '[U] Approve & Switch to Auto-Accept Mode',
			value: 'approve-auto',
			description: 'Approve the plan and auto-execute all tools',
		},
		{
			label: '[E] Edit Plan',
			value: 'edit',
			description: 'Open plan in external editor for modifications',
		},
		{
			label: '[D] Discard Plan',
			value: 'discard',
			description: 'Discard this plan and return to normal mode',
		},
	];

	// Handle keyboard input
	useInput((_inputChar, key) => {
		if (state === 'editing') {
			return; // Don't handle input while editor is open
		}

		// Escape to cancel
		if (key.escape) {
			if (state === 'confirming-approve') {
				setState('selecting');
				setSelectedIndex(0);
			} else {
				onDiscard();
			}
			return;
		}

		if (state === 'selecting') {
			// Handle direct key shortcuts
			if (_inputChar === 'a' || _inputChar === 'A') {
				setState('confirming-approve');
				setSelectedIndex(0);
				return;
			}

			if (_inputChar === 'u' || _inputChar === 'U') {
				setState('confirming-approve');
				setSelectedIndex(1);
				return;
			}

			if (_inputChar === 'e' || _inputChar === 'E') {
				handleEdit();
				return;
			}

			if (_inputChar === 'd' || _inputChar === 'D') {
				onDiscard();
				return;
			}

			// Arrow keys for navigation
			if (key.upArrow) {
				setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
			}

			if (key.downArrow) {
				setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
			}

			// Enter to select
			if (key.return) {
				handleSelect(options[selectedIndex].value);
			}
		} else if (state === 'confirming-approve') {
			// Y to confirm, N to go back
			if (_inputChar === 'y' || _inputChar === 'Y') {
				const option = options[selectedIndex];
				if (option.value === 'approve-normal') {
					onApprove('normal');
				} else if (option.value === 'approve-auto') {
					onApprove('auto-accept');
				}
			}

			if (_inputChar === 'n' || _inputChar === 'N' || key.escape) {
				setState('selecting');
				setSelectedIndex(0);
			}
		}
	});

	const handleSelect = (value: ApprovalOption['value']) => {
		if (value === 'approve-normal' || value === 'approve-auto') {
			setState('confirming-approve');
		} else if (value === 'edit') {
			handleEdit();
		} else if (value === 'discard') {
			onDiscard();
		}
	};

	const handleEdit = async () => {
		setState('editing');
		try {
			const planManager = getPlanManager(process.cwd());
			await planManager.openInEditor(planFile.slug);
			onEdit();
		} catch (_error) {
			// If editor fails, still call onEdit to let user handle it
			onEdit();
		}
	};

	// Format plan summary
	const planPhase = PLANNING_PHASE_LABELS[planFile.phase] || planFile.phase;
	const clarificationCount = Object.keys(planFile.clarifications).length;
	const filesCount = planFile.filesToModify.length;
	const verificationCount = planFile.verificationSteps.length;

	return (
		<Box flexDirection="column" width={boxWidth} marginBottom={1}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text color={colors.success} bold>
					✓ Plan Ready for Approval
				</Text>
			</Box>

			{/* Plan summary */}
			<Box flexDirection="column" marginBottom={1}>
				<Box>
					<Text color={colors.secondary}>Phase: </Text>
					<Text color={colors.text}>{planPhase}</Text>
				</Box>

				<Box>
					<Text color={colors.secondary}>Created: </Text>
					<Text color={colors.text}>{planFile.createdAt.toLocaleString()}</Text>
				</Box>

				{clarificationCount > 0 && (
					<Box>
						<Text color={colors.secondary}>Clarifications: </Text>
						<Text color={colors.text}>{clarificationCount}</Text>
					</Box>
				)}

				{filesCount > 0 && (
					<Box>
						<Text color={colors.secondary}>Files to modify: </Text>
						<Text color={colors.text}>{filesCount}</Text>
					</Box>
				)}

				{verificationCount > 0 && (
					<Box>
						<Text color={colors.secondary}>Verification steps: </Text>
						<Text color={colors.text}>{verificationCount}</Text>
					</Box>
				)}
			</Box>

			{/* Options */}
			{state === 'selecting' && (
				<Box flexDirection="column" marginBottom={1}>
					{options.map((option, index) => {
						const isSelected = index === selectedIndex;

						return (
							<Box key={option.value} flexDirection="column" marginBottom={1}>
								<Box>
									<Text color={isSelected ? colors.success : colors.text}>
										{isSelected ? '✓ ' : '  '}
										{option.label}
									</Text>
								</Box>
								{option.description && (
									<Box paddingLeft={4}>
										<Text color={colors.secondary}>{option.description}</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>
			)}

			{/* Confirmation prompt */}
			{state === 'confirming-approve' && (
				<Box flexDirection="column" marginBottom={1}>
					<Box marginBottom={1}>
						<Text color={colors.warning}>
							Are you sure you want to approve this plan?
						</Text>
					</Box>
					<Box>
						<Text color={colors.secondary}>{options[selectedIndex].label}</Text>
					</Box>
				</Box>
			)}

			{/* Help text */}
			<Box flexDirection="column">
				{state === 'selecting' && (
					<>
						<Text color={colors.secondary}>
							Use arrow keys to navigate, Enter to select
						</Text>
						<Text color={colors.secondary}>
							Or press A, U, E, D for quick selection
						</Text>
					</>
				)}

				{state === 'confirming-approve' && (
					<Text color={colors.secondary}>Press Y to confirm, N to go back</Text>
				)}

				<Text color={colors.secondary}>Press Escape to cancel</Text>
			</Box>

			{/* Editor message */}
			{state === 'editing' && (
				<Box marginTop={1}>
					<Text color={colors.info}>Opening external editor...</Text>
				</Box>
			)}
		</Box>
	);
}
