const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas'); // Import canvas library
const recipes = require('./../../recipes.json');
const items = require('./../../items.json');
const translations = require('./../../fr.json');


// Path to images and grid template
const IMAGES_FOLDER = path.join(__dirname, './../../Images');
const GRID_TEMPLATE_PATH = path.join(__dirname, './../../Images/crafting_table_template.png'); 

// Retrieve an item by its ID
function getItemById(id) {
    const item = items.find(item => item.id === id);
    if (!item) {
        return { displayName: 'item inconnu', name: 'unknown' }; // Default values for unknown items
    }
    const frenchName = translations[item.name] || item.displayName;
    return {
        ...item,
        frenchDisplayName: frenchName,
    };
}

// Normalize the grid to 3x3 format
function normalizeGrid(inShape) {
    const gridSize = 3;
    const normalizedGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    for (let row = 0; row < inShape.length; row++) {
        for (let col = 0; col < inShape[row].length; col++) {
            normalizedGrid[row][col] = inShape[row][col] === undefined ? null : inShape[row][col];
        }
    }

    return normalizedGrid;
}

// Generate the crafting grid image
async function generateCraftingGrid(grid) {
    const canvas = createCanvas(694, 694); // Canvas size matches crafting table
    const ctx = canvas.getContext('2d');

    // Load the crafting table template
    const template = await loadImage(GRID_TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    // Constants for positioning items within the grid
    const cellSize = 200; 
    const borderSize = 25; 
    const edgeOffsetX = 25; 
    const edgeOffsetY = 25; 
    const scaleFactor = 0.9; 
    const scaledSize = cellSize * scaleFactor; 
    const offset = (cellSize - scaledSize) / 2; 

    // Draw each item's image on its corresponding grid position
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const cell = grid[row][col];
            if (cell && cell.imagePath) {
                const img = await loadImage(cell.imagePath);
                const x = edgeOffsetX + col * (cellSize + borderSize) + offset; 
                const y = edgeOffsetY + row * (cellSize + borderSize) + offset; 
                ctx.drawImage(img, x, y, scaledSize, scaledSize); 
            }
        }
    }

    return canvas.toBuffer(); // Return the generated image as a buffer
}
// Reuse existing functions: getItemById, normalizeGrid, and generateCraftingGrid


module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Start a crafting guessing duel!')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Select a user to duel against.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('rounds')
                .setDescription('The number of rounds for the duel (default is 5).')
                .setMinValue(1)
        ),
    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;
        const totalRounds = interaction.options.getInteger('rounds') || 5;

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

            async function playRound(roundNumber) {
                let selectedRecipe;

                // Find a valid recipe
                do {
                    const recipeKeys = Object.keys(recipes);
                    const randomKey = recipeKeys[Math.floor(Math.random() * recipeKeys.length)];
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
                            collector.stop();
                        } else {
                            msg.reply({
                                content: `❌ Mauvais choix ! "${guess}" n’est pas le bon item.`,
                            }).then((reply) => setTimeout(() => reply.delete(), 5000));
                        }
                    });

                    return new Promise((resolve) => {
                        collector.on('end', async (_, reason) => {
                            if (reason === 'time') {
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
                resultMessage = `🎉 ${challenger} a remporté le duel avec un score de **${challengerScore}** contre **${opponentScore}** !`;
            } else if (opponentScore > challengerScore) {
                resultMessage = `🎉 ${opponent} a remporté le duel avec un score de **${opponentScore}** contre **${challengerScore}** !`;
            } else {
                resultMessage = `🤝 C'est une égalité ! Les deux joueurs ont marqué **${challengerScore}** points.`;
            }

            await interaction.channel.send({
                content: resultMessage,
            });
        });
    },
};