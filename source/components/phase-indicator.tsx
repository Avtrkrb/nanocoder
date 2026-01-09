/**
 * Phase Indicator Component for Plan Mode
 *
 * Displays the current planning phase and progress.
 * Shows all phases with the current one highlighted.
 */

import {Box, Text} from 'ink';
import {useTheme} from '@/hooks/useTheme';
import type {PlanningPhase} from '@/planning/types';
import {PLANNING_PHASE_LABELS, PLANNING_PHASE_ORDER} from '@/planning/types';

interface PhaseIndicatorProps {
	currentPhase: PlanningPhase | null;
	showLabel?: boolean;
}

export default function PhaseIndicator({
	currentPhase,
	showLabel = true,
}: PhaseIndicatorProps) {
	const {colors} = useTheme();

	// If not in plan mode, don't display anything
	if (!currentPhase) {
		return null;
	}

	// Find the index of the current phase
	const currentIndex = PLANNING_PHASE_ORDER.indexOf(currentPhase);

	return (
		<Box flexDirection="column">
			{showLabel && (
				<Box marginBottom={1}>
					<Text color={colors.secondary}>Planning Phase:</Text>
				</Box>
			)}

			<Box flexDirection="row">
				{PLANNING_PHASE_ORDER.map((phase: PlanningPhase, index: number) => {
					const isCurrent = index === currentIndex;
					const isCompleted = index < currentIndex;

					// Determine the icon and color
					let icon = '○';
					let color = colors.secondary;

					if (isCurrent) {
						icon = '●';
						color = colors.success;
					} else if (isCompleted) {
						icon = '✓';
						color = colors.info;
					}

					// Format the phase label
					const phaseLabel = PLANNING_PHASE_LABELS[phase];
					const shortLabel = phaseLabel.split(' ')[0]; // First word only

					return (
						<Box key={phase} marginRight={2}>
							<Text color={color}>
								{icon} {shortLabel}
							</Text>
						</Box>
					);
				})}
			</Box>

			{/* Current phase description */}
			<Box marginTop={1}>
				<Text color={colors.text}>{getPhaseDescription(currentPhase)}</Text>
			</Box>
		</Box>
	);
}

/**
 * Get a description for the current phase
 */
function getPhaseDescription(phase: PlanningPhase): string {
	const descriptions: Record<PlanningPhase, string> = {
		initial_understanding:
			'Exploring codebase to understand requirements and identify files',
		design: 'Creating implementation plan with clarifications',
		review: 'Reviewing collected information and plan details',
		final_plan: 'Finalizing plan document and preparing for approval',
		exit: 'Plan complete - waiting for user approval or modification',
	};

	return descriptions[phase] || '';
}
