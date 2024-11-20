const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLeaderboard } = require('./../../utility/queries');

const userStates = new Map();

function createNavigationRow(userState, leaderboardLength) {
  const { offset } = userState;

  const isAtTop = offset === 0;
  const isAtBottom = leaderboardLength <= 10;

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
    let title;
    let emoji;
    if (type === 'wins') {
      title = '🏆 Classement des victoires';
      emoji = '🏆';
    } else if (type === 'losses') {
      title = '💔 Classement des défaites';
      emoji = '💔';
    } else if (type === 'win_streak') {
      title = '🔥 Classement des séries de victoires';
      emoji = '🔥';
    } else if (type === 'loss_streak') {
      title = '💀 Classement des séries de défaites';
      emoji = '💀';
    }
  
  
    let text = ''; // Initialize the text string

    leaderboard.forEach((player, index) => {
    const place = index + 1;
    const nickname = player.discord_username;
    const score = type === 'wins' ? player.total_wins + " victoires" : 
                type === 'losses' ? player.total_losses + " défaites" : 
                type === 'win_streak' ? player.longest_win_streak + " victoires d'affilée" : 
                player.longest_loss_streak + " défaites d'affilée";

    const emoji = '•'; // A simple bullet point for each player
    text += `${emoji} **${place}.** ${nickname} - ${score} \n`; // Build the leaderboard line
    });

    // Add a fallback to ensure text is not empty
    if (!text) {
    text = "Aucun joueur n'est actuellement dans le classement.";
    }

    const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(title)
    .setDescription(text) // Use the text variable directly in the embed
    .setFooter({ text: `Page ${Math.floor(offset / 10) + 1}` })
    .setTimestamp();
  
    return embed;
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
    const embed = await createLeaderboardEmbed(userState);
    const row = createNavigationRow(userState, 10); // Supposer un classement complet initialement

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 5 * 60 * 1000, // 5 minutes
    });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.user.id !== userId) {
        return btnInteraction.reply({
          content: 'Ce n\'est pas votre navigation du classement !',
          ephemeral: true,
        });
      }

      const { currentPage, offset } = userState;

      // Gérer les presses des boutons
      if (btnInteraction.customId === 'up') {
        userState.offset = Math.max(0, offset - 10); // Passer à la page précédente (10 joueurs en haut)
      } else if (btnInteraction.customId === 'down') {
        userState.offset += 10; // Passer à la page suivante (10 joueurs en bas)
      } else if (btnInteraction.customId === 'left') {
        // Passer au classement précédent (revenir à 'loss_streak' si déjà en haut)
        userState.currentPage = (currentPage - 1 + 4) % 4;
      } else if (btnInteraction.customId === 'right') {
        // Passer au classement suivant (revenir à 'wins' si déjà en bas)
        userState.currentPage = (currentPage + 1) % 4;
      }

      const updatedEmbed = await createLeaderboardEmbed(userState);
      const updatedRow = createNavigationRow(userState, 10);

      await btnInteraction.update({
        embeds: [updatedEmbed],
        components: [updatedRow],
      });
    });

    collector.on('end', async () => {
      await message.edit({ components: [] }); // Désactiver les boutons après expiration du délai
    });
  }
};
