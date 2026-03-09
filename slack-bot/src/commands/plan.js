/**
 * /hr plan command handler
 *
 * Opens a modal for viewing/updating workforce plans
 */

const apiClient = require('../services/apiClient');

async function handlePlanCommand({ command, respond, client }) {
  try {
    // Open the plan entry modal
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'plan_entry_modal',
        title: {
          type: 'plain_text',
          text: 'Workforce Plan',
        },
        submit: {
          type: 'plain_text',
          text: 'Submit Update',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: JSON.stringify({
          channel_id: command.channel_id,
          user_id: command.user_id,
          team_id: command.team_id,
        }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Update your department workforce plan for the current planning period.',
            },
          },
          {
            type: 'input',
            block_id: 'department_block',
            element: {
              type: 'static_select',
              action_id: 'department_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select department',
              },
              options: getDepartmentOptions(),
            },
            label: {
              type: 'plain_text',
              text: 'Department',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Plan Updates*',
            },
          },
          {
            type: 'input',
            block_id: 'planned_hires_block',
            element: {
              type: 'number_input',
              action_id: 'planned_hires_input',
              is_decimal_allowed: false,
              min_value: '0',
              placeholder: {
                type: 'plain_text',
                text: 'Number of planned hires',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Planned Hires',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'planned_attrition_block',
            element: {
              type: 'number_input',
              action_id: 'planned_attrition_input',
              is_decimal_allowed: false,
              min_value: '0',
              placeholder: {
                type: 'plain_text',
                text: 'Expected attrition',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Expected Attrition',
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'reason_block',
            element: {
              type: 'plain_text_input',
              action_id: 'reason_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Reason for the update...',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Reason / Notes',
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error opening modal:', error);
    await respond({
      text: 'Sorry, there was an error opening the plan form. Please try again.',
      response_type: 'ephemeral',
    });
  }
}

function getDepartmentOptions() {
  const departments = [
    'Engineering',
    'Product',
    'Sales',
    'Marketing',
    'HR',
    'Finance',
    'Operations',
    'Customer Support',
    'Design',
    'Legal',
  ];

  return departments.map((dept) => ({
    text: {
      type: 'plain_text',
      text: dept,
    },
    value: dept.toLowerCase(),
  }));
}

module.exports = { handlePlanCommand };
