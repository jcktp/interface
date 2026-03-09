/**
 * API Client for communicating with the Interface backend
 */

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000';

const client = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Process a natural language query
 */
async function query(teamId, userId, queryText, channelId = null) {
  try {
    const response = await client.post('/api/slack/query', {
      team_id: teamId,
      user_id: userId,
      query: queryText,
      channel_id: channelId,
    });
    return response.data;
  } catch (error) {
    console.error('Query error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to process query',
    };
  }
}

/**
 * Log a slash command usage
 */
async function logCommand(teamId, userId, channelId, command, text = null) {
  try {
    await client.post('/api/slack/log-command', null, {
      params: { team_id: teamId, user_id: userId, channel_id: channelId, command, text },
    });
  } catch (error) {
    console.error('Log command error:', error.message);
  }
}

/**
 * Get workspace info
 */
async function getWorkspace(teamId) {
  try {
    const response = await client.get('/api/slack/workspace', {
      params: { team_id: teamId },
    });
    return response.data;
  } catch (error) {
    console.error('Get workspace error:', error.message);
    return null;
  }
}

/**
 * Update a workforce plan
 */
async function updatePlan(planId, updates, token) {
  try {
    const response = await client.put(`/api/planning/plans/${planId}`, updates, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Update plan error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.detail || 'Failed to update plan' };
  }
}

/**
 * Get planning periods
 */
async function getPlanningPeriods(token) {
  try {
    const response = await client.get('/api/planning/periods', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Get periods error:', error.message);
    return { periods: [] };
  }
}

/**
 * Get workforce plans for a period
 */
async function getWorkforcePlans(periodId, token) {
  try {
    const response = await client.get(`/api/planning/periods/${periodId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Get plans error:', error.message);
    return { plans: [] };
  }
}

module.exports = {
  query,
  logCommand,
  getWorkspace,
  updatePlan,
  getPlanningPeriods,
  getWorkforcePlans,
};
