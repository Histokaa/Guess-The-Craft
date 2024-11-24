const { Client } = require('pg');
const { user, host, database, password, port } = require('../config.json');
let client;


// Initialize and ensure the database connection
async function connectToDatabase() {
  if (!client || client._ending) { // Check if the client is not defined or already ended
    client = new Client({
      host,
      user,
      password,
      database,
      port,
    });

    try {
      await client.connect();
      console.log('Connected to PostgreSQL database');
    } catch (err) {
      console.error('Error connecting to PostgreSQL database:', err.stack);
      throw err;
    }
  }
}


async function insertPlayer(playerId, username) {
  const insertPlayerQuery = `
    INSERT INTO players (player_id, discord_username)
    VALUES ($1, $2)
    ON CONFLICT (player_id) DO UPDATE SET discord_username = EXCLUDED.discord_username;
  `;

  await connectToDatabase(); // Ensure the database is connected
  try {
    await client.query(insertPlayerQuery, [playerId, username]);
    console.log(`Player ${username} added successfully.`);
  } catch (err) {
    console.error('Error inserting player:', err);
  }
}
//Add wins and loses and add the streak
async function updatePlayerStats(playerId, discordUsername, stats, gameWinOrLose) {

  const fetchStreakQuery = `
  SELECT 
    current_win_streak, 
    current_loss_streak, 
    longest_win_streak, 
    longest_loss_streak 
  FROM players 
  WHERE player_id = $1;
  `;

  await connectToDatabase();

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  try {
    const streakResult = await client.query(fetchStreakQuery, [playerId]);

    if (streakResult.rows.length > 0) {
      const playerData = streakResult.rows[0];
      currentWinStreak = playerData.current_win_streak || 0;
      currentLossStreak = playerData.current_loss_streak || 0;
      longestWinStreak = playerData.longest_win_streak || 0;
      longestLossStreak = playerData.longest_loss_streak || 0;
    }

    // Update game streaks based on win or loss
    if (gameWinOrLose === "win") {
      currentWinStreak += 1;
      currentLossStreak = 0; // Reset loss streak
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak; // Update longest win streak
      }
    } else if (gameWinOrLose === "lose") {
      currentLossStreak += 1;
      currentWinStreak = 0; // Reset win streak
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak; // Update longest loss streak
      }
    }else
    {
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak; // Update longest loss streak
      }
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak; // Update longest win streak
      }
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }catch (err) {
    console.error('Error updating or creating player stats:', err);
  }

  const insertOrUpdateQuery = `
    INSERT INTO players (
      player_id,
      discord_username,
      total_games_played,
      total_wins,
      total_losses,
      total_draws,
      current_win_streak,
      current_loss_streak,
      longest_win_streak,
      longest_loss_streak,
      total_rounds_played,
      total_losses_rounds,
      total_draws_rounds,
      total_wins_rounds,
      current_win_streak_round,
      current_loss_streak_round,
      longest_win_streak_round,
      longest_loss_streak_round,
      total_guesses,
      total_good_guesses,
      total_bad_guesses
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
    )
    ON CONFLICT (player_id) DO UPDATE
    SET 
      total_games_played = players.total_games_played + $3,
      total_wins = players.total_wins + $4,
      total_losses = players.total_losses + $5,
      total_draws = players.total_draws + $6,
      current_win_streak = $7,
      current_loss_streak = $8,
      longest_win_streak = GREATEST(players.longest_win_streak, $9),
      longest_loss_streak = GREATEST(players.longest_loss_streak, $10),
      total_rounds_played = players.total_rounds_played + $11,
      total_losses_rounds = players.total_losses_rounds + $12,
      total_draws_rounds = players.total_draws_rounds + $13,
      total_wins_rounds = players.total_wins_rounds + $14,
      total_guesses = players.total_guesses + $19,
      total_good_guesses = players.total_good_guesses + $20,
      total_bad_guesses = players.total_bad_guesses + $21;
  `;

  const queryParams = [
    playerId, // $1
    discordUsername, // $2
    stats.totalGamesPlayed || 0, // $3
    stats.totalWins || 0, // $4
    stats.totalLosses || 0, // $5
    stats.totalDraws || 0, // $6
    currentWinStreak || 0, // $7
    currentLossStreak || 0, // $8
    longestWinStreak || 0, // $9
    longestLossStreak || 0, // $10
    stats.totalRoundsPlayed || 0, // $11
    stats.totalLossesRounds || 0, // $12
    stats.totalDrawsRounds || 0, // $13
    stats.totalWinsRounds || 0, // $14
    stats.longestWinStreakRound || 0, // $15
    stats.longestLossStreakRound || 0, // $16
    stats.longestWinStreakRound || 0, // $17
    stats.longestLossStreakRound || 0, // $18
    stats.totalGuesses || 0, // $19
    stats.totalGoodGuesses || 0, // $20
    stats.totalBadGuesses || 0 // $21
  ];


  console.log("total guesses to add to player: " + stats.discordUsername+" : " + stats.totalGuesses);
  console.log("total good guesses to add to player: " + stats.discordUsername+" : " + stats.totalGoodGuesses);
  console.log("total bad guesses to add to player: " + stats.discordUsername+" : " + stats.totalBadGuesses);


  await connectToDatabase();

  try {
    // Insert or update player stats
    await client.query(insertOrUpdateQuery, queryParams);
    console.log(`Updated stats for player with ID: ${playerId}`);

  }catch (err) {
    console.error('Error updating or creating player stats:', err);
  }
}

async function updateStreak(playerId, WinOrLose, number) {
  // Check if the input WinOrLose is valid
  if (WinOrLose !== "win" && WinOrLose !== "lose") {
      console.error("Invalid WinOrLose value. Must be 'win' or 'lose'.");
      return;
  }

  const checkQuery = `
      SELECT 
          longest_win_streak_round, 
          longest_loss_streak_round,
          current_win_streak_round,
          current_loss_streak_round
      FROM players
      WHERE player_id = $1;
  `;
  const result = await client.query(checkQuery, [playerId]);
  const playerData = result.rows[0];

  // Initialize current streaks and longest streaks
  let updatedWinStreakRound = playerData.current_win_streak_round || 0;
  let updatedLossStreakRound = playerData.current_loss_streak_round || 0;

  let longestWinStreakRound = playerData.longest_win_streak_round || 0;
  let longestLossStreakRound = playerData.longest_loss_streak_round || 0;

  let updateQuery;

  if (WinOrLose === "win") {
      // If the player was on a loss streak, reset loss streak to 0
      if (updatedLossStreakRound > 0) {
          updatedLossStreakRound = 0; // Reset the loss streak
      }
      
      updatedWinStreakRound += number; // Add 1 to the win streak

      // Check if current win streak exceeds the longest win streak
      if (updatedWinStreakRound > longestWinStreakRound) {
          // Update the longest win streak if the current streak is greater
          updateQuery = `
              UPDATE players
              SET 
                  longest_win_streak_round = $1,
                  current_win_streak_round = players.current_win_streak_round + 1,
                  current_loss_streak_round = 0,
                  total_wins_rounds = players.total_wins_rounds + 1
              WHERE player_id = $2;
          `;
          console.log(`Updated longest win streak to ${updatedWinStreakRound}`);
      } else {
          // Only update the current win streak, reset the loss streak
          updateQuery = `
              UPDATE players
              SET 
                  current_win_streak_round = $1,
                  current_loss_streak_round = 0,
                  total_wins_rounds = players.total_wins_rounds + 1
              WHERE player_id = $2;
          `;
          console.log(`Updated current win streak to ${updatedWinStreakRound}`);
      }
  } else if (WinOrLose === "lose") {
      // If the player was on a win streak, reset win streak to 0
      if (updatedWinStreakRound > 0) {
          updatedWinStreakRound = 0; // Reset the win streak
      }

      updatedLossStreakRound += number; // Add 1 to the loss streak

      // Check if current loss streak exceeds the longest loss streak
      if (updatedLossStreakRound > longestLossStreakRound) {
          // Update the longest loss streak if the current streak is greater
          updateQuery = `
              UPDATE players
              SET 
                  longest_loss_streak_round = $1,
                  current_loss_streak_round = players.current_loss_streak_round + 1,
                  current_win_streak_round = 0,
                  total_losses_rounds = players.total_losses_rounds + 1
              WHERE player_id = $2;
          `;
          console.log(`Updated longest loss streak to ${updatedLossStreakRound}`);
      } else {
          // Only update the current loss streak, reset the win streak
          updateQuery = `
              UPDATE players
              SET 
                  current_loss_streak_round = $1,
                  current_win_streak_round = 0,
                  total_losses_rounds = players.total_losses_rounds + 1
              WHERE player_id = $2;
          `;
          console.log(`Updated current loss streak to ${updatedLossStreakRound}`);
      }
  }

  try {
      // Execute the update query to update the player's streak
      await client.query(updateQuery, [WinOrLose === "win" ? updatedWinStreakRound : updatedLossStreakRound, playerId]);

      console.log(`Streak update successful for player ${playerId} with result: ${WinOrLose}`);
  } catch (error) {
      console.error("Error updating streak:", error);
  }
}

// Function to get the player's current stats
async function getPlayerStats(playerId) {
  const getPlayerStatsQuery = `
    SELECT * FROM players WHERE player_id = $1;
  `;

  await connectToDatabase();
  try {
    const res = await client.query(getPlayerStatsQuery, [playerId]);
    return res.rows[0]; // Return player stats object
  } catch (err) {
    console.error('Error getting player stats:', err);
    return null;
  }
}

// Clean up the connection on process exit
process.on('exit', () => {
  if (client) {
    client.end().then(() => console.log('Disconnected from PostgreSQL database'));
  }
});

// Export functions
module.exports = {
  insertPlayer,
  getPlayerStats,
  updatePlayerStats,
  updateStreak,
};
