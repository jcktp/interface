/**
 * Plan entry modal submission handler
 */

const apiClient = require('../services/apiClient');

async function handlePlanEntrySubmission({ body, view, client }) {
  const metadata = JSON.parse(view.private_metadata || '{}');
  const values = view.state.values;

  // Extract form values
  const department = values.department_block?.department_select?.selected_option?.value;
  const plannedHires = values.planned_hires_block?.planned_hires_input?.value;
  const plannedAttrition = values.planned_attrition_block?.planned_attrition_input?.value;
  const reason = values.reason_block?.reason_input?.value;

  if (!department) {
    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: 'Please select a department to update the plan.',
    });
    return;
  }

  // Build update object
  const updates = {};
  if (plannedHires !== undefined && plannedHires !== '') {
    updates.planned_hires = parseInt(plannedHires, 10);
  }
  if (plannedAttrition !== undefined && plannedAttrition !== '') {
    updates.planned_attrition = parseInt(plannedAttrition, 10);
  }
  if (reason) {
    updates.notes = reason;
  }

  // For now, we'll just acknowledge the submission
  // In a full implementation, this would call the API to update the plan
  const message =
    Object.keys(updates).length > 0
      ? `Plan update submitted for *${department}*:\n` +
        (updates.planned_hires !== undefined ? `  Planned Hires: ${updates.planned_hires}\n` : '') +
        (updates.planned_attrition !== undefined
          ? `  Expected Attrition: ${updates.planned_attrition}\n`
          : '') +
        (updates.notes ? `  Notes: ${updates.notes}` : '')
      : 'No changes were submitted.';

  // Send confirmation to user
  await client.chat.postMessage({
    channel: body.user.id,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: ' + message,
        },
      },
    ],
    text: message,
  });

  // If a channel was specified, also post there
  if (metadata.channel_id && Object.keys(updates).length > 0) {
    await client.chat.postMessage({
      channel: metadata.channel_id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:chart_with_upwards_trend: <@${body.user.id}> updated the workforce plan for *${department}*`,
          },
        },
      ],
      text: `Plan updated for ${department}`,
    });
  }
}

module.exports = { handlePlanEntrySubmission };
