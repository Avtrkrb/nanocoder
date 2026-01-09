/**
 * List Plans Command - Lists all saved implementation plans.
 */

import React from 'react';
import {ErrorMessage} from '@/components/message-box';
import {PlanListDisplay} from '@/components/plan-list-display';
import {getPlanManager} from '@/services/plan-manager';
import type {Command} from '@/types/index';
import {Box, Text} from 'ink';

/**
 * List Plans command - Shows all saved implementation plans.
 */
export const listPlansCommand: Command = {
	name: 'list-plans',
	description: 'List all saved implementation plans',
	handler: async () => {
		try {
			const manager = getPlanManager();

			// Validate directory
			if (!manager.validateProjectDirectory()) {
				return React.createElement(ErrorMessage, {
					key: `plan-error-${Date.now()}`,
					message:
						'Plans can only be listed in project directories, not in your home directory.',
					hideBox: true,
				});
			}

			const plans = await manager.listPlans();

			return React.createElement(
				Box,
				{key: `plans-container-${Date.now()}`, flexDirection: 'column'},
				React.createElement(PlanListDisplay, {
					plans,
					title: `Saved Plans (${plans.length})`,
				}),
				React.createElement(
					Box,
					{marginTop: 1},
					React.createElement(Text, {dimColor: true}, '  Use /load-plan <id> to review a plan'),
				),
			);
		} catch (error) {
			return React.createElement(ErrorMessage, {
				key: `plan-error-${Date.now()}`,
				message: `Failed to list plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
				hideBox: true,
			});
		}
	},
};
