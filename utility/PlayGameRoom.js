const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const recipes = require('../recipes.json');

// Path to images and grid template
const IMAGES_FOLDER = '../Images';

const { getItemById, normalizeGrid, generateCraftingGrid, shuffleArray } = require('./gameResources');
const { updatePlayerStats, updateStreak, insertPlayer} = require('./SQLManager');

// Game logic adapted for /room
async function playGame(roomData, interaction) {
    const { players, rounds, thread } = roomData;
    const scores = {};
    let playerStats = {};

    players.forEach(player => {
        insertPlayer(player.id, player.username);
        scores[player.id] = 0;
        playerStats[player.id] = {
            playerId: player.id,
            discordUsername: player.username,
            totalGamesPlayed: 0,
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            currentWinStreak: 0,
            currentLossStreak: 0,
            longestWinStreak: 0,
            longestLossStreak: 0,
            totalRoundsPlayed: 0,
            totalLossesRounds: 0,
            totalDrawsRounds: 0,
            totalWinsRounds: 0,
            currentWinStreakRound: 0,
            currentLossStreakRound: 0,
            longestWinStreakRound: 0,
            longestLossStreakRound: 0,
            totalGuesses: 0,
            totalGoodGuesses: 0,
            totalBadGuesses: 0
        };
    });

    players.forEach(player => {
        playerStats[player.id].totalGamesPlayed++; // Increment total games played for each player
    });
    await new Promise(resolve => setTimeout(resolve, 5000));
    for (let i = 1; i <= rounds; i++) {
        let selectedRecipe;

        // Find a valid recipe
        do {
            const recipeKeys = Object.keys(recipes);
            shuffleArray(recipeKeys); // Shuffle the keys before picking one
            const randomKey = recipeKeys[0]; // Pick the first shuffled key
            selectedRecipe = recipes[randomKey][0];
        } while (!selectedRecipe || !selectedRecipe.inShape);

        const inShapeWithNamesAndImages = normalizeGrid(selectedRecipe.inShape).map((row) =>
            row.map((cell) => {
                if (!cell) return null;
                const item = getItemById(cell);
                return {
                    displayName: item.displayName,
                    frenchDisplayName: item.frenchDisplayName,
                    imagePath: path.join(__dirname, IMAGES_FOLDER, `${item.name}.png`),
                };
            })
        );

        const result = getItemById(selectedRecipe.result.id);

        try {
            const gridImageBuffer = await generateCraftingGrid(inShapeWithNamesAndImages);
            const gridAttachment = new AttachmentBuilder(gridImageBuffer, { name: 'crafting_grid.png' });

            const roundMessage = await thread.send({
                content: `🎮 **Manche ${i}/${rounds}:** Trouvez l’item correspondant à cette recette. Premier à répondre gagne !`,
                files: [gridAttachment],
            });

            const filter = (msg) => players.some(player => player.id === msg.author.id);
            const collector = roundMessage.channel.createMessageCollector({
                filter,
                time: 20000, // 20 seconds
            });

            let winner = null;

            collector.on('collect', (msg) => {
                const guess = msg.content.toLowerCase();
                const englishName = result.displayName.toLowerCase();
                const frenchName = result.frenchDisplayName.toLowerCase();
            
                if (guess === englishName || guess === frenchName) {
                    winner = msg.author;
                    scores[winner.id]++;
                    playerStats[winner.id].totalGoodGuesses++;
                    playerStats[winner.id].totalGuesses++;
                    updateStreak(winner.id, "win", 1);
            
                    players.forEach(player => {
                        if (player.id !== winner.id) {
                            updateStreak(player.id, "lose", 1);
                        }
                    });
            
                    collector.stop();
                } else {
                    playerStats[msg.author.id].totalBadGuesses++;
                    playerStats[msg.author.id].totalGuesses++;
            
                    msg.reply({
                        content: `❌ Mauvais choix ! "${guess}" n’est pas le bon item.`,
                    }).then((reply) => setTimeout(() => reply.delete(), 5000));
                }
            });

            await new Promise((resolve) => {
                collector.on('end', async (_, reason) => {
                    players.forEach(player => {
                        playerStats[player.id].totalRoundsPlayed++;
                    });
                    if (reason === 'time') {
                        players.forEach(player => {
                            updateStreak(player.id, "lose", 1);
                        });
                        await thread.send({
                            content: `⏰ Temps écoulé ! Aucun point marqué. La réponse correcte était **${result.frenchDisplayName}** (${result.displayName}).`,
                        });
                    } else if (winner) {
                        await thread.send({
                            content: `🎉 ${winner} a gagné cette manche ! L'item était **${result.frenchDisplayName}** (${result.displayName}).`,
                        });
                    }
                    resolve();
                });
            });

        } catch (error) {
            console.error('Error generating crafting grid:', error);
            await thread.send({
                content: '❌ Une erreur est survenue lors de la génération de la grille de craft.',
            });
        }
        if (i < rounds) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }


    // Determine final results
    let resultMessage;
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topScore = sortedScores[0][1];
    const topPlayers = sortedScores.filter(([_, score]) => score === topScore);

    // Check if there is a single winner or a tie
    if (topPlayers.length === 1) {
        const winnerId = topPlayers[0][0];

        // Update stats for other players
        players.forEach(player => {
            if (player.id !== winnerId) {
                playerStats[player.id].totalLosses++;
            }
        });

        resultMessage = `🎉 <@${winnerId}> a remporté le jeu avec un score de **${topScore}** points!`;
    } else {
        topPlayers.forEach(([playerId]) => {
            playerStats[playerId].totalDraws++;
        });

        const playerMentions = topPlayers.map(([playerId]) => `<@${playerId}>`).join(' et ');
        resultMessage = `🤝 C'est une égalité entre ${playerMentions} avec un score de **${topScore}** points chacun!`;
    }

    // Send result message to the channel
    await interaction.channel.send({
        content: resultMessage,
    });

    // Update stats for all players based on results
    for (const playerId in playerStats) {
        const playerScore = sortedScores.find(([id, score]) => id === playerId)[1];
        if (playerScore === topScore && topPlayers.length > 1) {
            // It's a draw
            await updatePlayerStats(playerId, playerStats[playerId].discordUsername, playerStats[playerId], 'draw');
        } else if (playerScore === topScore) {
            playerStats[playerId].totalWins++;
            // It's a win
            await updatePlayerStats(playerId, playerStats[playerId].discordUsername, playerStats[playerId], 'win');
        } else {
            // It's a loss
            await updatePlayerStats(playerId, playerStats[playerId].discordUsername, playerStats[playerId], 'lose');
        }
    }


    // Collect results for the game summary with top 3 places
    let results = sortedScores.map(([index, score], i) => {
        let emoji;
        switch (i) {
            case 0:
                emoji = '🥇'; // 1st place
                break;
            case 1:
                emoji = '🥈'; // 2nd place
                break;
            case 2:
                emoji = '🥉'; // 3rd place
                break;
            default:
                emoji = ''; // No emoji for players after the top 3
        }
        return `${emoji} <@${index}>: **${score}** points`;
    }).join('\n');

    // Send game summary message with top 3
    const winnerId = sortedScores[0][0];
    await interaction.channel.send({
        content: `🎉 **Fin du jeu ! Résultats:**\n${results}\n\n🎉 **Gagnant:** <@${winnerId}>`,
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await thread.delete();
}

module.exports = {  playGame };
