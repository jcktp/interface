/**
 * /hr help command handler
 *
 * Shows available commands and usage
 */

async function handleHelpCommand({ respond }) {
  await respond({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Interface Bot Help',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'I can help you access HR metrics and manage workforce plans directly from Slack.',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/hr metrics [department]`\nGet key HR metrics. Optionally filter by department.\n_Example: `/hr metrics engineering`_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/hr headcount [by department|by location]`\nGet headcount information with optional grouping.\n_Example: `/hr headcount by department`_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/hr plan`\nOpen a form to view or update your workforce plan.\n_Opens an interactive modal_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/hr ask <question>`\nAsk any HR question using AI. The AI assistant will query your data and provide an answer.\n_Example: `/hr ask What is the average tenure by department?`_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '`/hr help`\nShow this help message.',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Natural Language Queries:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            'You can also @mention me with questions like:\n' +
            "  What's the headcount in Engineering?\n" +
            '  How many people did we hire last month?\n' +
            "  What's our turnover rate?\n" +
            '  Show me open positions in Sales',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':bulb: *Tip:* Send me a DM for private queries that only you can see.',
          },
        ],
      },
    ],
    response_type: 'ephemeral',
  });
}

module.exports = { handleHelpCommand };
