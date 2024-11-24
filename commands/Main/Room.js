const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { playGame } = require('./../../utility/PlayGameRoom.js'); // Importer la fonction playGame

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
        const roomId = `room-${creator.id}`;
        const players = [creator];
        let thread;

       
        // Create the embed for the room
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
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);
        await interaction.reply({ content: 'Salle créée !', ephemeral: true }); // Quick acknowledgment

        const channelMessage = await interaction.channel.send({
            embeds: [embed],
            components: [actionRow],
        });


        // Check if the interaction is in a thread
        if (interaction.channel.isThread()) {
            thread = interaction.channel;
        } else {
            // Create a new thread for the game
            thread = await interaction.channel.threads.create({
                name: `Salle de ${creator.username}`,
                autoArchiveDuration: 60,
                reason: 'Salle de jeu pour les joueurs de crafting',
            });
        }


        // Send the embed to the thread
        const threadMessage = await thread.send({
            embeds: [embed],
            components: [actionRow],
        });
        // Store message IDs to track them
        const messages = {
            channelMessageId: channelMessage.id,
            threadMessageId: threadMessage.id,
        };

        // Create a filter for the buttons
        const filter = i => i.customId.startsWith(`join-${roomId}`) ||
            i.customId.startsWith(`leave-${roomId}`) ||
            i.customId.startsWith(`start-${roomId}`);

        // Collect interactions from both the thread and the channel

        const collectorChannel = interaction.channel.createMessageComponentCollector({ filter, time: 60 * 1 * 1000 });
        const collectorThread = thread.createMessageComponentCollector({ filter, time: 60 * 1 * 1000 });
        let gameStarted = false; // Flag to track if the game started
        const handleButtonInteraction = async (buttonInteraction) => {
            const user = buttonInteraction.user;


            if (buttonInteraction.customId === `join-${roomId}`) {
                if (players.length >= maxPlayers) {
                    return await buttonInteraction.reply({ content: '❌ La salle est pleine !', ephemeral: true });
                }
                if (players.some(player => player.id === user.id)) {
                    return await buttonInteraction.reply({ content: '❌ Vous êtes déjà dans la salle !', ephemeral: true });
                }

                players.push(user);
                embed.setDescription(`**Rounds :** ${rounds}\n**Joueurs :** ${players.length}/${maxPlayers}\n**Liste des joueurs :** ${players.map(player => `<@${player.id}>`).join(', ')}\n\nEn attente de plus de joueurs pour rejoindre...`);
                await threadMessage.edit({ embeds: [embed] });
                await channelMessage.edit({ embeds: [embed] });

                if (creator.id === user.id && players.length > 1) {
                    startButton.setDisabled(false);
                }
                await buttonInteraction.deferUpdate();
            }

            if (buttonInteraction.customId === `leave-${roomId}`) {
                const index = players.findIndex(player => player.id === user.id);
                if (index !== -1) {
                    players.splice(index, 1);
                    embed.setDescription(`**Rounds :** ${rounds}\n**Joueurs :** ${players.length}/${maxPlayers}\n**Liste des joueurs :** ${players.map(player => `<@${player.id}>`).join(', ')}\n\nEn attente de plus de joueurs pour rejoindre...`);
                    await threadMessage.edit({ embeds: [embed] });
                    await channelMessage.edit({ embeds: [embed] });

                    if (players.length <= 1) {
                        startButton.setDisabled(true);
                    }
                }
                await buttonInteraction.deferUpdate();
            }

            if (buttonInteraction.customId === `start-${roomId}`) {
                if (players.length < 2) {
                    return await buttonInteraction.reply({ content: '❌ Pas assez de joueurs pour commencer la partie !', ephemeral: true });
                }
        
                gameStarted = true;
                await buttonInteraction.update({
                    content: `🎮 Début de la partie avec ${players.length} joueurs !`,
                    components: [],
                });
        
                collectorChannel.stop(); // Stop the collectors
                collectorThread.stop();
        
                await playGame({ players, rounds, thread, messages }, interaction);
            }
        };

        // Attach the handler for both collectors
        collectorChannel.on('collect', handleButtonInteraction);
        collectorThread.on('collect', handleButtonInteraction);

        collectorChannel.on('end', async () => {
            joinButton.setDisabled(true);
            leaveButton.setDisabled(true);
            startButton.setDisabled(true);
        
            const messageContent = gameStarted
                ? '🎮 La partie a commencé. Bonne chance à tous !'
                : '⏰ La salle a été fermée pour cause d\'inactivité.';
        
            await threadMessage.edit({
                content: messageContent,
                components: [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton)],
            });
        
            await channelMessage.edit({
                content: messageContent,
                components: [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton)],
            });
        });
        
        collectorThread.on('end', async () => {
            joinButton.setDisabled(true);
            leaveButton.setDisabled(true);
            startButton.setDisabled(true);
        
            const messageContent = gameStarted
                ? '🎮 La partie a commencé. Bonne chance à tous !'
                : '⏰ La salle a été fermée pour cause d\'inactivité.';
        
            await threadMessage.edit({
                content: messageContent,
                components: [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton)],
            });


        
            await channelMessage.edit({
                content: messageContent,
                components: [new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton)],
            });

            if(!gameStarted)
            {
                await thread.delete();
                await channelMessage.delete();
            }
                
            

        });
    },
};
