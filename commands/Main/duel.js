const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const recipes = require('./../../recipes.json');
const { updatePlayerStats, updateStreak, insertPlayer} = require('./../../utility/SQLManager');

const { getItemById, normalizeGrid, generateCraftingGrid, shuffleArray } = require('./../../utility/gameResources');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Start a crafting guessing duel!')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Choisir un joueur à defier.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('rounds')
                .setDescription('Le nombre de round à jouer (défaut is 5).')
                .setMinValue(1)
        ),
    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;
        const totalRounds = interaction.options.getInteger('rounds') || 5;

        insertPlayer(challenger.id, challenger.username);
        insertPlayer(opponent.id, opponent.username);

        const playerStats = {
            [challenger.id]: {
                playerId: challenger.id,
                discordUsername: challenger.username,
                totalGamesPlayed: 0,
                totalWins : 0, // $4
                totalLosses : 0, // $5
                totalDraws : 0, // $6
                currentWinStreak : 0, // $7
                currentLossStreak : 0, // $8
                longestWinStreak : 0, // $9
                longestLossStreak : 0, // $10
                totalRoundsPlayed : 0, // $11
                totalLossesRounds : 0, // $12
                totalDrawsRounds : 0, // $13
                totalWinsRounds : 0, // $14
                currentWinStreakRound : 0, // $15
                currentLossStreakRound : 0, // $16
                longestWinStreakRound : 0, // $17
                longestLossStreakRound : 0, // $18
                totalGuesses : 0, // $19
                totalGoodGuesses : 0, // $20
                totalBadGuesses : 0 // $21
            },
            [opponent.id]: {
                playerId: opponent.id,
                discordUsername: opponent.username,
                totalGamesPlayed: 0,
                totalWins : 0, // $4
                totalLosses : 0, // $5
                totalDraws : 0, // $6
                currentWinStreak : 0, // $7
                currentLossStreak : 0, // $8
                longestWinStreak : 0, // $9
                longestLossStreak : 0, // $10
                totalRoundsPlayed : 0, // $11
                totalLossesRounds : 0, // $12
                totalDrawsRounds : 0, // $13
                totalWinsRounds : 0, // $14
                currentWinStreakRound : 0, // $15
                currentLossStreakRound : 0, // $16
                longestWinStreakRound : 0, // $17
                longestLossStreakRound : 0, // $18
                totalGuesses : 0, // $19
                totalGoodGuesses : 0, // $20
                totalBadGuesses : 0 // $21
            },
        };


        // Validate the opponent
        if (opponent.bot) {
            return interaction.reply({
                content: "❌ Vous ne pouvez pas défier un bot.",
                ephemeral: true,
            });
        }

        if (opponent.id === challenger.id) {
            return interaction.reply({
                content: "❌ Vous ne pouvez pas vous défier vous-même.",
                ephemeral: true,
            });
        }

        // Request duel acceptance
        const acceptButton = new ButtonBuilder()
            .setCustomId('accept_duel')
            .setLabel('Accepter')
            .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
            .setCustomId('decline_duel')
            .setLabel('Refuser')
            .setStyle(ButtonStyle.Danger);


        const actionRow = new ActionRowBuilder().addComponents(acceptButton, declineButton);

        const requestMessage = await interaction.reply({
            content: `${opponent}, ${challenger} vous a défié à un duel de crafting en ${totalRounds} manches ! Acceptez-vous ?`,
            components: [actionRow],
        });

        const filter = (btnInteraction) =>
            btnInteraction.user.id === opponent.id; // Only allow the opponent to interact

        const collector = requestMessage.createMessageComponentCollector({
            filter,
            time: 30000, // 30 seconds to respond
        });

        let accepted = false;

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId === 'accept_duel') {
                accepted = true;
                collector.stop();
                await btnInteraction.update({
                    content: `${opponent} a accepté le duel ! 🎮 Préparez-vous !`,
                    components: [],
                });
            } else if (btnInteraction.customId === 'decline_duel') {
                collector.stop();
                await btnInteraction.update({
                    content: `${opponent} a refusé le duel. 😔`,
                    components: [],
                });
            }
        });

        collector.on('end', async (_, reason) => {
            if (!accepted && reason === 'time') {
                await interaction.editReply({
                    content: `${opponent} n'a pas répondu à temps. Duel annulé.`,
                    components: [],
                });
                return; // Stop execution
            }

            if (!accepted) {
                return; // Stop execution if declined
            }

            // Continue with the duel logic if accepted
            let scores = {
                [challenger.id]: 0,
                [opponent.id]: 0,
            };
            playerStats[challenger.id].totalGamesPlayed++;
            playerStats[opponent.id].totalGamesPlayed++;
            async function playRound(roundNumber) {
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
                            imagePath: path.join(__dirname, './../../Images', `${item.name}.png`),
                        };
                    })
                );

                const result = getItemById(selectedRecipe.result.id);

                try {
                    const gridImageBuffer = await generateCraftingGrid(inShapeWithNamesAndImages);
                    const gridAttachment = new AttachmentBuilder(gridImageBuffer, { name: 'crafting_grid.png' });

                    const message = await interaction.channel.send({
                        content: `🎮 **Manche ${roundNumber}/${totalRounds}:** Trouvez l’item correspondant à cette recette. Premier à répondre gagne !`,
                        files: [gridAttachment],
                    });

                    const filter = (msg) =>
                        msg.author.id === challenger.id || msg.author.id === opponent.id;
                    const collector = message.channel.createMessageCollector({
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

                            playerStats[winner.id].totalWinsRounds++;
                            playerStats[winner.id].currentWinStreakRound++;
                            playerStats[winner.id].currentLossStreakRound = 0;
 
                          
                            const loserId = winner.id === challenger.id ? opponent.id : challenger.id;

                            updateStreak(loserId, "lose", 1);
                            playerStats[loserId].totalLossesRounds++;
                            playerStats[loserId].currentLossStreakRound++;
                            playerStats[loserId].currentWinStreakRound = 0;
 

                            collector.stop();
                        } else {

                            playerStats[msg.author.id].totalBadGuesses++;
                            playerStats[msg.author.id].totalGuesses++;


                            msg.reply({
                                content: `❌ Mauvais choix ! "${guess}" n’est pas le bon item.`,
                            }).then((reply) => setTimeout(() => reply.delete(), 5000));
                        
                        }
                    });

                    return new Promise((resolve) => {
                        collector.on('end', async (_, reason) => {

                            playerStats[challenger.id].totalRoundsPlayed++;
                            playerStats[opponent.id].totalRoundsPlayed++;

                            if (reason === 'time') {
         
                            
                                updateStreak(challenger.id, "lose", 1);
                                updateStreak(opponent.id, "lose", 1);
                                
                                playerStats[challenger.id].currentWinStreakRound = 0;
                                playerStats[opponent.id].currentWinStreakRound = 0;
                                playerStats[challenger.id].currentLossStreakRound += 1;
                                playerStats[opponent.id].currentLossStreakRound += 1;

                                await interaction.channel.send({
                                    content: `⏰ Temps écoulé ! Aucun point marqué. La réponse correcte était **${result.frenchDisplayName}** (${result.displayName}).`,
                                });
                            } else if (winner) {

                                await interaction.channel.send({
                                    content: `🎉 ${winner} a gagné cette manche ! L'item était **${result.frenchDisplayName}** (${result.displayName}).`,
                                });
                            }
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error('Error generating crafting grid:', error);
                    await interaction.channel.send({
                        content: '❌ Une erreur est survenue lors de la génération de la grille de craft.',
                    });
                }
            }

            for (let i = 1; i <= totalRounds; i++) {
                await playRound(i);
            }

            const challengerScore = scores[challenger.id];
            const opponentScore = scores[opponent.id];

            


            let resultMessage;
            if (challengerScore > opponentScore) {
                playerStats[challenger.id].totalWins++;
                playerStats[challenger.id].currentWinStreak++;
                playerStats[challenger.id].currentLossStreak = 0;

                playerStats[opponent.id].totalLosses++;
                playerStats[opponent.id].currentLossStreak++;
                playerStats[opponent.id].currentWinStreak = 0;
                resultMessage = `🎉 ${challenger} a remporté le duel avec un score de **${challengerScore}** contre **${opponentScore}** !`;
            } else if (opponentScore > challengerScore) {
                playerStats[opponent.id].totalWins++;
                playerStats[opponent.id].currentWinStreak++;
                playerStats[opponent.id].currentLossStreak = 0;

                playerStats[challenger.id].totalLosses++;
                playerStats[challenger.id].currentLossStreak++;
                playerStats[challenger.id].currentWinStreak = 0;

                resultMessage = `🎉 ${opponent} a remporté le duel avec un score de **${opponentScore}** contre **${challengerScore}** !`;
            } else {
                playerStats[challenger.id].totalDraws++;
                playerStats[opponent.id].totalDraws++;

                resultMessage = `🤝 C'est une égalité ! Les deux joueurs ont marqué **${challengerScore}** points.`;
            }

            await interaction.channel.send({
                content: resultMessage,
            });

           // Determine the result for the challenger and opponent
            const challengerResult = challengerScore > opponentScore ? 'win' : challengerScore < opponentScore ? 'lose' : 'draw';
            const opponentResult = opponentScore > challengerScore ? 'win' : opponentScore < challengerScore ? 'lose' : 'draw';

            
            // Update stats for both players
            await updatePlayerStats(challenger.id, playerStats[challenger.id].discordUsername, playerStats[challenger.id], challengerResult);
            await updatePlayerStats(opponent.id, playerStats[opponent.id].discordUsername, playerStats[opponent.id], opponentResult);
        });
    },
};