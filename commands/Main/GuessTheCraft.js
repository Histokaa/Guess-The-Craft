const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const recipes = require('./../../recipes.json');

// Path to images and grid template
const IMAGES_FOLDER = path.join(__dirname, './../../Images');
const { getItemById, normalizeGrid, generateCraftingGrid, shuffleArray } = require('./../../utility/gameResources');

const { insertPlayer} = require('./../../utility/SQLManager');




module.exports = {
    data: new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Deviner des crafts d\'item'),
    async execute(interaction) {
        // Function to start or reload the game
        async function startGame() {
            // Only defer if not already deferred/replied
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: true }); // Reply ephemeral so only the user sees it
            }

            let selectedRecipe;

            // Find a valid recipe
            do {
                const recipeKeys = Object.keys(recipes);
                shuffleArray(recipeKeys); // Shuffle the keys before picking one
                const randomKey = recipeKeys[0]; // Pick the first shuffled key
                selectedRecipe = recipes[randomKey][0];
            } while (!selectedRecipe || !selectedRecipe.inShape);

            // Prepare grid data with item details
            const inShapeWithNamesAndImages = normalizeGrid(selectedRecipe.inShape).map(row =>
                row.map(cell => {
                    if (!cell) return null; // Empty cells
                    const item = getItemById(cell);
                    return {
                        displayName: item.displayName,
                        frenchDisplayName: item.frenchDisplayName,
                        imagePath: path.join(IMAGES_FOLDER, `${item.name}.png`),
                    };
                })
            );

            const result = getItemById(selectedRecipe.result.id);

            try {
                // Generate the crafting grid image
                const gridImageBuffer = await generateCraftingGrid(inShapeWithNamesAndImages);
                const gridAttachment = new AttachmentBuilder(gridImageBuffer, { name: 'crafting_grid.png' });

                // Button to reload the game
                const reloadButton = new ButtonBuilder()
                    .setCustomId('rerun')
                    .setLabel('Relancer un guess')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔁');

                // Send the crafting grid and button (ephemeral)
                await interaction.editReply({
                    content: 'Trouve l’item correspondant à cette recette en 20 secondes',
                    files: [gridAttachment],
                    components: [new ActionRowBuilder().addComponents(reloadButton)],
                    ephemeral: true, // Ensure this message is ephemeral
                });
                

                // Listen for button interactions
                const buttonFilter = (btnInteraction) =>
                    btnInteraction.customId === 'rerun' && btnInteraction.user.id === interaction.user.id;

                const buttonCollector = interaction.channel.createMessageComponentCollector({
                    filter: buttonFilter,
                    time: 60000, // 30 seconds for button interaction
                });

                buttonCollector.on('collect', async (btnInteraction) => {
                    // Make sure the interaction is still valid
                    if (!btnInteraction.isButton()) return;
                
                    // Immediately acknowledge the interaction to prevent the "unknown interaction" error
                    await btnInteraction.deferUpdate(); 
                
                    // Stop any active collectors and reset the state
                    messageCollector.stop(); // Stop the message collector for guesses
                    buttonCollector.stop(); // Stop the button collector

                    // Restart the game
                    await startGame(); // Restart the game
                });

                buttonCollector.on('end', async (_, reason) => {
                    // Handle timeout and make the response ephemeral
                    if (reason === 'time') {
                        await interaction.editReply({
                            content: 'Le temps est écoulé! Essayez à nouveau.',
                            files: [gridAttachment],
                            components: [], // Remove button components
                            ephemeral: true, // Ensure this message is ephemeral
                        });
                    }
                });

                // Collect user guesses
                const messageFilter = (msg) => msg.author.id === interaction.user.id;
                const messageCollector = interaction.channel.createMessageCollector({
                    filter: messageFilter,
                    time: 20000,
                });

                messageCollector.on('collect', async (message) => {
                    const guess = message.content.toLowerCase();
                    const englishName = result.displayName.toLowerCase();
                    const frenchName = result.frenchDisplayName.toLowerCase();
                
                    if (guess === englishName || guess === frenchName) {
                        
                        // Send a non-ephemeral message pinging the player
                        await message.channel.send({
                            content: `🎉 Félicitations ${message.author}, tu as trouvé la bonne réponse ! L'item était **${result.frenchDisplayName}** (${result.displayName}).`
                        });
                
                        message.delete();  // Delete the user's guess message
                        messageCollector.stop();  // Stop the message collector
                    } else {
                        await interaction.followUp({
                            content: `❌ Mauvais choix ! "${guess}" n’est pas le bon item. Essaie encore !`,
                            ephemeral: true, // Make this reply ephemeral
                        });
                        message.delete();  // Delete the user's guess message
                    }
                });
                messageCollector.on('end', async (collected, reason) => {
                    if (reason === 'time') {
                
                        // Optionally, you can add another message that is not ephemeral if you'd like to notify the channel
                        await interaction.channel.send({
                            content: `⏰ ${interaction.user}, Le temps est écoulé ! La réponse correcte était **${result.frenchDisplayName}** (${result.displayName}).`
                        });
                    }
                });
            } catch (error) {
                console.error('Error generating crafting grid:', error);
                await interaction.followUp({
                    content: '❌ Une erreur est survenue lors de la génération de la grille de craft.',
                    ephemeral: true, // Make the reply ephemeral
                });
            }
        }

        // Start the game initially
        await startGame();
    },
};