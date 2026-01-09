/**
 * Save Plan Command - Saves the current conversation context as an implementation plan.
 */

import React from 'react';
import {ErrorMessage, SuccessMessage} from '@/components/message-box';
import {extractPlanFromToolCalls, usePlanHandler} from '@/hooks/use-plan-handler';
import type {Command, Message} from '@/types/index';
import {getLogger} from '@/utils/logging';

/**
 * Save Plan command - Captures the current conversation as a plan.
 */
export const savePlanCommand: Command = {
	name: 'save-plan',
	description: 'Save the current conversation context as an implementation plan',
	handler: async (args: string[], messages: Message[]) => {
		const logger = getLogger();

		try {
			// Extract title from arguments or generate from context
			const title = args.join(' ') || undefined;

			// Find the most recent assistant message with tool calls
			const lastAssistantWithTools = [...messages]
				.reverse()
				.find(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0);

			if (!lastAssistantWithTools || !lastAssistantWithTools.tool_calls) {
				return React.createElement(ErrorMessage, {
					key: `plan-error-${Date.now()}`,
					message: `No tool calls found in the conversation to save as a plan.

Please ask the AI to suggest some actions first, then use /save-plan to capture them as a plan.`,
					hideBox: false,
				});
			}

			// Extract tool calls and convert to the format expected by extractPlanFromToolCalls
			const toolCalls = lastAssistantWithTools.tool_calls.map(tc => ({
				name: tc.function.name,
				arguments: tc.function.arguments as Record<string, unknown>,
			}));

			// Build context from recent messages
			const recentMessages = messages.slice(-10); // Last 10 messages for context
			const context = recentMessages
				.map(m => {
					if (m.role === 'user') {
						return `User: ${m.content || ''}`;
					}
					if (m.role === 'assistant') {
						// Clean content from tool calls for better context
						const content = m.content || '';
						return `Assistant: ${content}`;
					}
					return '';
				})
				.filter(Boolean)
				.join('\n\n');

			// Get plan handler and validate directory
			const planHandler = usePlanHandler({logger});
			if (!planHandler.validateDirectory()) {
				return React.createElement(ErrorMessage, {
					key: `plan-error-${Date.now()}`,
					message:
						'Plans can only be created in project directories, not in your home directory.',
					hideBox: true,
				});
			}

			// Extract plan from tool calls
			const plan = extractPlanFromToolCalls(toolCalls, context);

			// Apply custom title if provided
			const options = title ? {title} : undefined;

			// Save the plan
			const planId = await planHandler.savePlan(plan, options);

			return React.createElement(SuccessMessage, {
				key: `plan-saved-${Date.now()}`,
				message: `Plan saved successfully!

ID: ${planId}
Tasks: ${plan.tasks.length}
Files: ${plan.affectedFiles.length}
Complexity: ${plan.estimatedComplexity}

Use /list-plans to see all plans or /load-plan ${planId} to review.`,
				hideBox: true,
			});
		} catch (error) {
			return React.createElement(ErrorMessage, {
				key: `plan-error-${Date.now()}`,
				message: `Failed to save plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
				hideBox: true,
			});
		}
	},
};

/**
 * Internal function to save a plan from tool calls.
 * This will be called by the plan detection logic in conversation-loop.tsx
 */
export async function savePlanFromToolCalls(
	toolCalls: Array<{name: string; arguments: Record<string, unknown>}>,
	context: string,
	title?: string,
): Promise<React.ReactElement> {
	const logger = getLogger();
	const planHandler = usePlanHandler({logger});

	try {
		// Validate directory
		if (!planHandler.validateDirectory()) {
			return React.createElement(ErrorMessage, {
				key: `plan-error-${Date.now()}`,
				message:
					'Plans can only be created in project directories, not in your home directory.',
				hideBox: true,
			});
		}

		// Extract plan from tool calls
		const plan = extractPlanFromToolCalls(toolCalls, context);

		// Apply custom title if provided
		const options = title ? {title} : undefined;

		// Save the plan
		const planId = await planHandler.savePlan(plan, options);

		return React.createElement(SuccessMessage, {
			key: `plan-saved-${Date.now()}`,
			message: `Plan saved successfully!

ID: ${planId}
Tasks: ${plan.tasks.length}
Files: ${plan.affectedFiles.length}
Complexity: ${plan.estimatedComplexity}

Use /list-plans to see all plans or /load-plan ${planId} to review.`,
			hideBox: true,
		});
	} catch (error) {
		return React.createElement(ErrorMessage, {
			key: `plan-error-${Date.now()}`,
			message: `Failed to save plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
			hideBox: true,
		});
	}
}
