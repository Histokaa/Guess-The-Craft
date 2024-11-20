const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { playGame } = require('./../../utility/PlayGameRoom.js'); // Importer la fonction playGame
const { generateCraftingGrid } = require('./../../utility/gameResources.js'); // Importer la fonction generateCraftingGrid
const recipes = require('./../../recipes.json'); // Importer les recettes


module.exports = {
    data: new SlashCommandBuilder()
        .setName('room')
        .setDescription('Créer une salle de crafting pour plusieurs joueurs.')
        .addIntegerOption(option =>
            option.setName('nombrejoueurs')
                .setDescription('Le nombre maximum de joueurs dans la salle.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('nombrerounds')
                .setDescription('Le nombre de rounds à jouer.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const creator = interaction.user;
        const maxPlayers = interaction.options.getInteger('nombrejoueurs');
        const rounds = interaction.options.getInteger('nombrerounds');
        const roomId = `room-${creator.id}`; // Identifiant unique pour la salle
        const players = [creator]; // Le créateur rejoint automatiquement la salle

        // Affichage de l'embed de la salle
        const embed = new EmbedBuilder()
            .setTitle(`Salle de ${creator.username}`)
            .setDescription(`**Rounds :** ${rounds}\n**Joueurs :** ${players.length}/${maxPlayers}\n**Liste des joueurs :** ${players.map(player => `<@${player.id}>`).join(', ')}\n\nEn attente de plus de joueurs pour rejoindre...`)
            .setColor('#00AAFF');

        const joinButton = new ButtonBuilder()
            .setCustomId(`join-${roomId}`)
            .setLabel('Rejoindre')
            .setStyle(ButtonStyle.Primary);

        const leaveButton = new ButtonBuilder()
            .setCustomId(`leave-${roomId}`)
            .setLabel('Quitter')
            .setStyle(ButtonStyle.Danger);

        const startButton = new ButtonBuilder()
            .setCustomId(`start-${roomId}`)
            .setLabel('Commencer')
            .setStyle(ButtonStyle.Success)

        const actionRow = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);

        // Envoyer l'embed de la salle avec les boutons
        const roomMessage = await interaction.reply({
            embeds: [embed],
            components: [actionRow],
            fetchReply: true,
        });

        // Collecteur pour les interactions des boutons
        const filter = i => i.customId.startsWith(`join-${roomId}`) ||
            i.customId.startsWith(`leave-${roomId}`) ||
            i.customId.startsWith(`start-${roomId}`);

        const collector = roomMessage.createMessageComponentCollector({ filter, time: 60*3*1000 }); // 1 minute

        collector.on('collect', async (buttonInteraction) => {
            const user = buttonInteraction.user;

            // Gérer l'action "Rejoindre"
            if (buttonInteraction.customId === `join-${roomId}`) {
                if (players.length >= maxPlayers) {
                    return buttonInteraction.reply({ content: '❌ La salle est pleine !', ephemeral: true });
                }
                if (players.some(player => player.id === user.id)) {
                    return buttonInteraction.reply({ content: '❌ Vous êtes déjà dans la salle !', ephemeral: true });
                }

                players.push(user);
                embed.setDescription(`**Rounds :** ${rounds}\n**Joueurs :** ${players.length}/${maxPlayers}\n**Liste des joueurs :** ${players.map(player => `<@${player.id}>`).join(', ')}\n\nEn attente de plus de joueurs pour rejoindre...`);
                await roomMessage.edit({ embeds: [embed] });

                // Activer le bouton "Commencer" si le créateur est présent et qu'au moins un autre joueur a rejoint
                if (creator.id === user.id && players.length > 1) {
                    startButton.setDisabled(false);
                }
                await buttonInteraction.deferUpdate();
            }

            // Gérer l'action "Quitter"
            if (buttonInteraction.customId === `leave-${roomId}`) {
                const index = players.findIndex(player => player.id === user.id);
                if (index !== -1) {
                    players.splice(index, 1);
                    embed.setDescription(`**Rounds :** ${rounds}\n**Joueurs :** ${players.length}/${maxPlayers}\n**Liste des joueurs :** ${players.map(player => `<@${player.id}>`).join(', ')}\n\nEn attente de plus de joueurs pour rejoindre...`);
                    await roomMessage.edit({ embeds: [embed] });

                    // Si le créateur quitte, supprimer le message
                    if (user.id === creator.id) {
                        // Delete the room message
                        await roomMessage.delete();
                    
                        // Send a notification message to inform that the room was deleted by the creator
                        const channel = interaction.channel; // Get the current channel
                        await channel.send({
                            content: `La salle a été supprimée par <@${creator.id}>.`, // Message in French
                        });
                    }

                    // Désactiver le bouton "Commencer" s'il n'y a pas assez de joueurs
                    if (players.length <= 1) {
                        startButton.setDisabled(true);
                    }
                }
                await buttonInteraction.deferUpdate();
            }

            // Gérer l'action "Commencer" (seul le créateur peut démarrer)
            if (buttonInteraction.customId === `start-${roomId}`) {
                if (user.id !== creator.id) {
                    return buttonInteraction.reply({ content: '❌ Seul le créateur de la salle peut démarrer la partie !', ephemeral: true });
                }

                if (players.length < 2) {
                    return buttonInteraction.reply({ content: '❌ Pas assez de joueurs pour commencer la partie !', ephemeral: true });
                }

                await buttonInteraction.update({
                    content: `🎮 Début de la partie avec ${players.length} joueurs !`,
                    components: [],
                });

                collector.stop(); // Arrêter de collecter les interactions
                await playGame({ players, rounds }, interaction); // Démarrer la partie
            }
        });

        collector.on('end', async () => {
            // Désactiver tous les boutons lorsque la salle expire
            joinButton.setDisabled(true);
            leaveButton.setDisabled(true);
            startButton.setDisabled(true);

            await roomMessage.edit({
                content: '⏰ La salle a été fermée pour cause d\'inactivité.',
                components: [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton)],
            });
            await roomMessage.delete();
        });
    },
};
