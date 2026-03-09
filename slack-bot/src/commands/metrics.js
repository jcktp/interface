/**
 * /hr metrics command handler
 *
 * Usage: /hr metrics [department]
 */

const apiClient = require('../services/apiClient');

async function handleMetricsCommand({ command, respond, args }) {
  const department = args.join(' ') || null;
  const query = department ? `metrics for ${department}` : 'summary metrics';

  const result = await apiClient.query(command.team_id, command.user_id, query, command.channel_id);

  if (!result.success) {
    await respond({
      text: `Error: ${result.error}`,
      response_type: 'ephemeral',
    });
    return;
  }

  await respond({
    blocks: result.blocks || [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: result.summary || 'No metrics available',
        },
      },
    ],
    response_type: 'in_channel',
  });
}

module.exports = { handleMetricsCommand };
