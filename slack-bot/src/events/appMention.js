/**
 * App mention event handler
 *
 * Handles natural language queries when the bot is @mentioned
 */

const apiClient = require('../services/apiClient');

async function handleAppMention({ event, client, say }) {
  // Extract the query text (remove the bot mention)
  const text = event.text.replace(/<@[A-Z0-9]+>/gi, '').trim();

  if (!text) {
    await say({
      text: "Hi there! Ask me about headcount, turnover, hiring, or open positions. Type `/hr help` to see all commands.",
      thread_ts: event.ts,
    });
    return;
  }

  // Get the team ID from the event
  const teamId = event.team || event.user_team;

  // Process the query
  const result = await apiClient.query(teamId, event.user, text, event.channel);

  if (!result.success) {
    await say({
      text: `Sorry, I couldn't process that request: ${result.error}`,
      thread_ts: event.ts,
    });
    return;
  }

  // Send the response
  if (result.blocks) {
    await say({
      blocks: result.blocks,
      text: result.summary,
      thread_ts: event.ts,
    });
  } else {
    await say({
      text: result.summary || "I processed your request but don't have a response to show.",
      thread_ts: event.ts,
    });
  }
}

module.exports = { handleAppMention };
