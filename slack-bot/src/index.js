/**
 * Interface Slack Bot
 *
 * Main entry point for the Slack bot service using Bolt framework
 */

require('dotenv').config();
const { App } = require('@slack/bolt');

// Import command handlers
const { handleMetricsCommand } = require('./commands/metrics');
const { handleHeadcountCommand } = require('./commands/headcount');
const { handlePlanCommand } = require('./commands/plan');
const { handleHelpCommand } = require('./commands/help');

// Import event handlers
const { handleAppMention } = require('./events/appMention');

// Import modal handlers
const { handlePlanEntrySubmission } = require('./modals/planEntry');

// Import services
const apiClient = require('./services/apiClient');

// Initialize the Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true, // Enable Socket Mode for easier development
});

// ==================== Slash Commands ====================

// /hr command - main entry point
app.command('/hr', async ({ command, ack, respond, client }) => {
  await ack();

  const text = command.text.trim().toLowerCase();
  const args = text.split(' ');
  const subcommand = args[0] || 'help';

  // Log command
  await apiClient.logCommand(command.team_id, command.user_id, command.channel_id, '/hr', text);

  try {
    switch (subcommand) {
      case 'metrics':
        await handleMetricsCommand({ command, respond, client, args: args.slice(1) });
        break;

      case 'headcount':
        await handleHeadcountCommand({ command, respond, client, args: args.slice(1) });
        break;

      case 'plan':
        await handlePlanCommand({ command, respond, client, args: args.slice(1) });
        break;

      case 'ask': {
        // Route to AI Q&A for complex natural language questions
        const question = args.slice(1).join(' ');
        if (!question) {
          await respond({ text: 'Please provide a question. Example: `/hr ask What is the average tenure by department?`', response_type: 'ephemeral' });
          break;
        }
        const aiResult = await apiClient.query(command.team_id, command.user_id, question);
        if (aiResult.blocks) {
          await respond({ blocks: aiResult.blocks, text: aiResult.summary || question, response_type: 'in_channel' });
        } else {
          await respond({ text: aiResult.summary || aiResult.answer || 'No answer found.', response_type: 'in_channel' });
        }
        break;
      }

      case 'help':
      default:
        await handleHelpCommand({ command, respond, client });
        break;
    }
  } catch (error) {
    console.error('Command error:', error);
    await respond({
      text: 'Sorry, something went wrong processing your request. Please try again.',
      response_type: 'ephemeral',
    });
  }
});

// ==================== Events ====================

// App mention - natural language queries
app.event('app_mention', async ({ event, client, say }) => {
  try {
    await handleAppMention({ event, client, say });
  } catch (error) {
    console.error('App mention error:', error);
    await say({
      text: "Sorry, I couldn't process that request. Try `/hr help` to see what I can do.",
      thread_ts: event.ts,
    });
  }
});

// Direct message
app.event('message', async ({ event, client, say }) => {
  // Only handle DMs (no channel)
  if (event.channel_type !== 'im' || event.subtype) return;

  try {
    await handleAppMention({ event, client, say });
  } catch (error) {
    console.error('DM error:', error);
    await say("Sorry, I couldn't understand that. Try asking about headcount, turnover, or open positions.");
  }
});

// ==================== Modal Submissions ====================

app.view('plan_entry_modal', async ({ ack, body, view, client }) => {
  await ack();

  try {
    await handlePlanEntrySubmission({ body, view, client });
  } catch (error) {
    console.error('Modal submission error:', error);
  }
});

// ==================== Shortcuts ====================

app.shortcut('hr_quick_metrics', async ({ shortcut, ack, client }) => {
  await ack();

  try {
    const result = await apiClient.query(shortcut.team.id, shortcut.user.id, 'summary metrics');

    if (result.success) {
      await client.chat.postMessage({
        channel: shortcut.user.id,
        blocks: result.blocks,
        text: result.summary,
      });
    }
  } catch (error) {
    console.error('Shortcut error:', error);
  }
});

// ==================== Error Handling ====================

app.error(async (error) => {
  console.error('Global error:', error);
});

// ==================== Start the App ====================

(async () => {
  const port = process.env.PORT || 3001;
  await app.start(port);
  console.log(`Interface Slack Bot is running on port ${port}`);
})();
