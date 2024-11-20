const { user, host, database, password, port } = require('../config.json');
const { Pool } = require('pg');

const pool = new Pool({
  host,
  user,
  password,
  database,
  port,
});



// Fetch leaderboard data with pagination
async function getLeaderboard(offset = 0, type = 'wins') {
    const client = await pool.connect();
    try {
      let query;
      if (type === 'wins') {
        query = 'SELECT discord_username, total_wins FROM players ORDER BY total_wins DESC LIMIT 10 OFFSET $1';
      } else if (type === 'losses') {
        query = 'SELECT discord_username, total_losses FROM players ORDER BY total_losses DESC LIMIT 10 OFFSET $1';
      } else if (type === 'win_streak') {
        query = 'SELECT discord_username, longest_win_streak FROM players ORDER BY longest_win_streak DESC LIMIT 10 OFFSET $1';
      } else if (type === 'loss_streak') {
        query = 'SELECT discord_username, longest_loss_streak FROM players ORDER BY longest_loss_streak DESC LIMIT 10 OFFSET $1';
      }
  
      const res = await client.query(query, [offset]);
      return res.rows;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      client.release();
    }
  }
  
  module.exports = {
    getLeaderboard,
  };