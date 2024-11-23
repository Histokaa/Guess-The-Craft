const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLeaderboard } = require('./../../utility/queries');

const userStates = new Map();

function createNavigationRow(userState, leaderboardLength) {
  const { offset } = userState;

  const isAtTop = offset === 0;
  const isAtBottom = offset + 10 >= leaderboardLength;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('left')
      .setLabel('← Précédent')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('up')
      .setLabel('↑ Page précédente')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isAtTop),
    new ButtonBuilder()
      .setCustomId('down')
      .setLabel('↓ Page Suivante')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isAtBottom),
    new ButtonBuilder()
      .setCustomId('right')
      .setLabel('→ Suivant')
      .setStyle(ButtonStyle.Primary)
  );
}

async function createLeaderboardEmbed(userState) {
  const { offset, currentPage } = userState;
  const types = ['wins', 'losses', 'win_streak', 'loss_streak'];
  const type = types[currentPage];

  const leaderboard = await getLeaderboard(offset, type);
  let title, emoji;

  if (type === 'wins') {
    title = '🏆 Classement des victoires';
  } else if (type === 'losses') {
    title = '💔 Classement des défaites';
  } else if (type === 'win_streak') {
    title = '🔥 Classement des séries de victoires';
  } else if (type === 'loss_streak') {
    title = '💀 Classement des séries de défaites';
  }

  let text = '';
  leaderboard.forEach((player, index) => {
    const place = index + 1 + offset;
    const nickname = player.discord_username;
    const score = type === 'wins'
      ? `${player.total_wins} victoires`
      : type === 'losses'
      ? `${player.total_losses} défaites`
      : type === 'win_streak'
      ? `${player.longest_win_streak} victoires d'affilée`
      : `${player.longest_loss_streak} défaites d'affilée`;

    text += `• **${place}.** ${nickname} - ${score}\n`;
  });

  if (!text) {
    text = "Aucun joueur n'est actuellement dans le classement.";
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(title)
    .setDescription(text)
    .setFooter({ text: `Page ${Math.floor(offset / 10) + 1}` })
    .setTimestamp();

  return { embed, leaderboardLength: leaderboard.length };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement de GuessTheCraft.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Initialiser l'état de l'utilisateur s'il n'est pas déjà défini
    if (!userStates.has(userId)) {
      userStates.set(userId, {
        currentPage: 0, // 0 = Victoires, 1 = Défaites, 2 = Série de victoires, 3 = Série de défaites
        offset: 0, // Décalage pour la pagination
      });
    }

    const userState = userStates.get(userId);

    // Réponse différée pour éviter l'expiration de l'interaction
    await interaction.deferReply();

    const { embed, leaderboardLength } = await createLeaderboardEmbed(userState);
    const row = createNavigationRow(userState, leaderboardLength);

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.user.id !== userId) {
        return btnInteraction.reply({
          content: 'Ce n\'est pas votre navigation du classement !',
          ephemeral: true,
        });
      }
    
      const { currentPage, offset } = userState;
    
      try {
        // Mettre à jour l'état en fonction des boutons cliqués
        if (btnInteraction.customId === 'up') {
          userState.offset = Math.max(0, offset - 10);
        } else if (btnInteraction.customId === 'down') {
          userState.offset += 10;
        } else if (btnInteraction.customId === 'left') {
          userState.currentPage = (currentPage - 1 + 4) % 4;
        } else if (btnInteraction.customId === 'right') {
          userState.currentPage = (currentPage + 1) % 4;
        }
    
        const { embed: updatedEmbed, leaderboardLength: updatedLength } = await createLeaderboardEmbed(userState);
        const updatedRow = createNavigationRow(userState, updatedLength);
    
        // Vérifier et différer si nécessaire
        if (!btnInteraction.deferred && !btnInteraction.replied) {
          await btnInteraction.deferUpdate();
        }
    
        await btnInteraction.editReply({
          embeds: [updatedEmbed],
          components: [updatedRow],
        });
      } catch (error) {
        console.error('Erreur dans le collecteur:', error.message, error);
      }
    });
    
    collector.on('end', async () => {
      try {
        await message.edit({
          components: [], // Désactiver les boutons
        });
      } catch (error) {
        console.error('Erreur lors de la désactivation des boutons après expiration:', error.message, error);
      }
    });
    

    collector.on('end', async () => {
      await message.edit({ components: [] }); // Désactiver les boutons après expiration du délai
    });
  },
};
