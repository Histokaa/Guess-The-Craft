const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerStats } = require('./../../utility/SQLManager');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche le profil du joueur.')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Sélectionnez un utilisateur pour afficher son profil.')
        ),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

        try {
            const stats = await getPlayerStats(targetUser.id);
            if (!stats) {
                await interaction.reply(`❌ *Aucun profil trouvé pour* **${targetUser.username}**.`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`📋 Profil de ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`

__**Statistiques générales**__
- **Total de parties jouées** : ${stats.total_games_played || 0}
- 🏆 **Victoires** : ${stats.total_wins || 0}
- ❌ **Défaites** : ${stats.total_losses || 0}
- 🤝 **Matchs nuls** : ${stats.total_draws || 0}

__**Streaks**__
- 🔥 **Série de victoires actuelle** : ${stats.current_win_streak || 0}
- 🧊 **Série de défaites actuelle** : ${stats.current_loss_streak || 0}
- 🌟 **Plus longue série de victoires** : ${stats.longest_win_streak || 0}
- 💔 **Plus longue série de défaites** : ${stats.longest_loss_streak || 0}

__**Statistiques des manches**__
- **Total des manches jouées** : ${stats.total_rounds_played || 0}
- **Victoires des manches** : ${stats.total_wins_rounds || 0}
- **Défaites des manches** : ${stats.total_losses_rounds || 0}
- **Meilleure série de manches gagnées** : ${stats.longest_win_streak_round || 0}
- **Meilleure série de manches perdues** : ${stats.longest_loss_streak_round || 0}

__**Statistiques des devinettes**__
- 🎯 **Total de devinettes** : ${stats.total_guesses || 0}
- ✅ **Bonnes devinettes** : ${stats.total_good_guesses || 0}
- ❌ **Mauvaises devinettes** : ${stats.total_bad_guesses || 0}
`)
                .setFooter({ text: 'Effectué par ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching player stats:', error);
            await interaction.reply('❌ *Une erreur est survenue lors de la récupération des données du profil.*');
        }
    },
};