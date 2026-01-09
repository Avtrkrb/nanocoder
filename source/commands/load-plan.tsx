/**
 * Load Plan Command - Loads and displays a saved implementation plan.
 */

import React from 'react';
import {ErrorMessage, InfoMessage, SuccessMessage, WarningMessage} from '@/components/message-box';
import {getPlanManager} from '@/services/plan-manager';
import type {Command} from '@/types/index';
import {Box, Text} from 'ink';

/**
 * Load Plan command - Loads a saved plan for review.
 */
export const loadPlanCommand: Command = {
	name: 'load-plan',
	description: 'Load and review a saved implementation plan',
	handler: async (args: string[]) => {
		if (args.length === 0) {
			return React.createElement(InfoMessage, {
				key: `load-plan-help-${Date.now()}`,
				message: `Load Plan - Review a saved implementation plan

Usage: /load-plan <plan-id>

Load a plan to review its tasks and approve it for implementation.
Use /list-plans to see available plans.

Example: /load-plan plan-2025-01-02-15-30-45`,
				hideBox: false,
			});
		}

		const planId = args[0];

		try {
			const manager = getPlanManager();

			// Validate directory
			if (!manager.validateProjectDirectory()) {
				return React.createElement(ErrorMessage, {
					key: `plan-error-${Date.now()}`,
					message:
						'Plans can only be loaded in project directories, not in your home directory.',
					hideBox: true,
				});
			}

			// Check if plan exists
			const exists = await manager.planExists(planId);
			if (!exists) {
				return React.createElement(ErrorMessage, {
					key: `plan-error-${Date.now()}`,
					message: `Plan '${planId}' does not exist. Use /list-plans to see available plans.`,
					hideBox: true,
				});
			}

			// Load the plan
			const plan = await manager.loadPlan(planId);

			// Build children array
			const boxChildren: React.ReactElement[] = [];

			// Description
			boxChildren.push(
				React.createElement(Text, {bold: true, key: 'desc-label'}, `Description:`),
			);
			boxChildren.push(
				React.createElement(Text, {color: 'white', key: 'desc-value'}, plan.description || 'No description'),
			);

			// Metadata
			boxChildren.push(React.createElement(Box, {marginTop: 1, key: 'meta-spacer-1'}));
			boxChildren.push(
				React.createElement(
					Text,
					{dimColor: true, key: 'created'},
					`Created: ${new Date(plan.timestamp).toLocaleString()}`,
				),
			);
			boxChildren.push(
				React.createElement(
					Text,
					{dimColor: true, key: 'complexity'},
					`Complexity: ${plan.estimatedComplexity || 'medium'}`,
				),
			);
			boxChildren.push(
				React.createElement(
					Text,
					{dimColor: true, key: 'status'},
					`Status: ${plan.approved ? '✅ Approved' : '⏳ Pending approval'}`,
				),
			);

			// Tasks
			boxChildren.push(React.createElement(Box, {marginTop: 1, key: 'tasks-spacer'}));
			boxChildren.push(
				React.createElement(Text, {bold: true, key: 'tasks-label'}, `Tasks: ${plan.tasks.length}`),
			);

			if (plan.tasks.length > 0) {
				for (const [index, task] of plan.tasks.entries()) {
					const taskChildren: React.ReactNode[] = [
						React.createElement(Text, {key: 'text'}, `${index + 1}. ${task.description}`),
					];
					if (task.file) {
						taskChildren.push(
							React.createElement(Text, {dimColor: true, key: 'file'}, ` → ${task.file}`),
						);
					}
					boxChildren.push(
						React.createElement(Box, {key: task.id, marginLeft: 2}, ...taskChildren),
					);
				}
			} else {
				boxChildren.push(
					React.createElement(Text, {dimColor: true, key: 'no-tasks'}, '  No tasks in this plan'),
				);
			}

			// Affected files
			if (plan.affectedFiles.length > 0) {
				boxChildren.push(React.createElement(Box, {marginTop: 1, key: 'files-spacer'}));
				boxChildren.push(
					React.createElement(Text, {bold: true, key: 'files-label'}, `Affected Files: ${plan.affectedFiles.length}`),
				);
				for (const file of plan.affectedFiles) {
					boxChildren.push(
						React.createElement(
							Box,
							{key: file, marginLeft: 2},
							React.createElement(Text, {dimColor: true}, `  • ${file}`),
						),
					);
				}
			}

			// Display plan details
			return React.createElement(
				Box,
				{key: `plan-display-${Date.now()}`, flexDirection: 'column'},
				React.createElement(SuccessMessage, {
					message: `Plan loaded: ${plan.title}`,
					hideBox: true,
				}),
				React.createElement(Box, {flexDirection: 'column', marginTop: 1, paddingX: 2}, ...boxChildren),
				React.createElement(WarningMessage, {
					key: 'approval-warning',
					message:
						'Plan loading is for review only. Use /save-plan to create new plans from current conversation.',
					hideBox: true,
				}),
			);
		} catch (error) {
			return React.createElement(ErrorMessage, {
				key: `plan-error-${Date.now()}`,
				message: `Failed to load plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
				hideBox: true,
			});
		}
	},
};
