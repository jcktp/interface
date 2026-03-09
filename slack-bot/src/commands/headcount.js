/**
 * /hr headcount command handler
 *
 * Usage: /hr headcount [by department|by location]
 */

const apiClient = require('../services/apiClient');

async function handleHeadcountCommand({ command, respond, args }) {
  let query = 'headcount';

  if (args.includes('by')) {
    const byIndex = args.indexOf('by');
    const groupBy = args[byIndex + 1] || 'department';
    query = `headcount by ${groupBy}`;
  } else if (args.length > 0) {
    query = `headcount ${args.join(' ')}`;
  }

  const result = await apiClient.query(command.team_id, command.user_id, query, command.channel_id);

  if (!result.success) {
    await respond({
      text: `Error: ${result.error}`,
      response_type: 'ephemeral',
    });
    return;
  }

  // Format response blocks
  const blocks = result.blocks || formatHeadcountBlocks(result);

  await respond({
    blocks,
    response_type: 'in_channel',
  });
}

function formatHeadcountBlocks(result) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Headcount Report',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:busts_in_silhouette: *Total Headcount:* ${result.total || 0}`,
      },
    },
  ];

  if (result.breakdown && result.breakdown.length > 0) {
    const breakdownText = result.breakdown
      .map((item) => `  ${item.department}: *${item.count}*`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*By Department:*\n${breakdownText}`,
      },
    });
  }

  return blocks;
}

module.exports = { handleHeadcountCommand };
