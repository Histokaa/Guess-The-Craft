const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche des informations sur les commandes disponibles.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📜 **Commande Aide**')
            .setDescription('Voici une liste des commandes disponibles avec des descriptions et des exemples d\'utilisation :')
            .setColor('#00AAFF')
            .addFields(
                {
                    name: '🎮 **/guess**',
                    value: 
`**Description :** Cette commande lance un jeu de devinettes où vous devez deviner le craft correct.

**Utilisation :**
- \`/guess\` - Lancez un jeu de devinettes de craft en solo.
  
**Exemple :**
\`\`\`
/guess
\`\`\`
*Devinez le craft basé sur les indices fournis. Bonne chance !*`,
                },
                {
                    name: '⚔️ **/duel**',
                    value: 
`**Description :** Défiez un autre joueur en duel et prouvez qui est le plus fort.

**Utilisation :**
- \`/duel [joueur]\` - Défiez un joueur en duel.

**Exemple :**
\`\`\`
/duel @Joueur
\`\`\`
*Préparez-vous pour le duel, car il ne peut y avoir qu\'un seul gagnant !*`,
                },
                {
                    name: '🏰 **/room**',
                    value: 
`**Description :** Créez une salle où plusieurs joueurs peuvent rejoindre, quitter et démarrer une partie.

**Utilisation :**
- \`/room [nombredeplaces] [nombrerounds]\` - Créez une nouvelle salle pour un jeu de crafting à plusieurs.

**Exemple :**
\`\`\`
/room 4 5
\`\`\`
*Invitez vos amis à rejoindre votre salle, puis lancez la partie lorsque tout le monde est prêt !*`,
                },
                {
                    name: '📊 **/leaderboard**',
                    value: 
`**Description :** Affiche le classement des joueurs selon plusieurs catégories.

**Utilisation :**
- \`/leaderboard\` - Affiche le classement général.

**Navigation :**
- Utilisez les boutons pour changer de page (⬆️, ⬇️) ou de catégorie (⬅️, ➡️).

**Catégories :**
- 🏆 Victoires
- 💔 Défaites
- 🔥 Séries de victoires
- 💀 Séries de défaites

*Consultez votre position et rivalisez pour grimper dans le classement !*`,
                }
            )
            .setFooter({
                text: 'Utilisez ces commandes pour interagir avec le bot et vous amuser !',
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
