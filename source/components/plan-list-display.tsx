/**
 * Plan List Display Component - Shows a list of saved plans in a formatted table.
 */

import {Box, Text} from 'ink';
import {useTheme} from '@/hooks/useTheme';
import type {PlanMetadata} from '@/types/plan';

interface PlanListDisplayProps {
	plans: PlanMetadata[];
	title?: string;
}

export function PlanListDisplay({plans, title = 'Saved Plans'}: PlanListDisplayProps) {
	const {colors} = useTheme();

	if (plans.length === 0) {
		return (
			<Box flexDirection="column" marginY={1}>
				<Text color={colors.secondary}>
					No plans found. Use /save-plan to create an implementation plan
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginY={1}>
			<Box
				borderStyle="round"
				borderColor={colors.primary}
				paddingX={2}
				paddingY={1}
			>
				<Box flexDirection="column">
					<Text bold color={colors.primary}>
						{title}
					</Text>
					<Box marginTop={1} flexDirection="column">
						{/* Header */}
						<Box flexDirection="row">
							<Box width={30}>
								<Text bold color={colors.info}>
									ID
								</Text>
							</Box>
							<Box width={25}>
								<Text bold color={colors.info}>
									Title
								</Text>
							</Box>
							<Box width={12}>
								<Text bold color={colors.info}>
									Created
								</Text>
							</Box>
							<Box width={6}>
								<Text bold color={colors.info}>
									Tasks
								</Text>
							</Box>
							<Box width={6}>
								<Text bold color={colors.info}>
									Files
								</Text>
							</Box>
							<Box width={10}>
								<Text bold color={colors.info}>
									Complexity
								</Text>
							</Box>
						</Box>

						{/* Separator */}
						<Box>
							<Text color={colors.secondary}>{'─'.repeat(80)}</Text>
						</Box>

						{/* Rows */}
						{plans.map(plan => (
							<Box key={plan.id} flexDirection="row">
								<Box width={30}>
									<Text color={colors.text}>
										{plan.id.length > 28
											? plan.id.substring(0, 25) + '...'
											: plan.id}
									</Text>
								</Box>
								<Box width={25}>
									<Text color={colors.text}>
										{plan.title.length > 23
											? plan.title.substring(0, 20) + '...'
											: plan.title}
									</Text>
								</Box>
								<Box width={12}>
									<Text color={colors.secondary}>
										{new Date(plan.timestamp).toLocaleDateString()}
									</Text>
								</Box>
								<Box width={6}>
									<Text color={colors.text}>{plan.tasksCount}</Text>
								</Box>
								<Box width={6}>
									<Text color={colors.text}>{plan.filesCount}</Text>
								</Box>
								<Box width={10}>
									<Text
										color={
											plan.complexity === 'high'
												? colors.error
												: plan.complexity === 'medium'
													? colors.warning
													: colors.success
										}
									>
										{plan.complexity || 'medium'}
									</Text>
								</Box>
							</Box>
						))}
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
