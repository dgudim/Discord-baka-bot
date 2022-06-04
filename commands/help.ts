import { MessageEmbed } from "discord.js";
import { ICommand } from "wokcommands";
import { prefix } from "..";

export default {

    category: 'Help',
    description: 'Display help',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    callback: async ({ interaction, message }) => {

        const embed = new MessageEmbed();
        embed.setTitle("Sussy Baka's help page");
        embed.setDescription('----------------------');
        embed.setColor('AQUA');
        embed.addFields([
            {
                name: "Current prefix is",
                value: prefix
            },
            {
                name: "⚙️ User commands",
                value:
                    `\`/random_img   \` > Displays a random image from specified directory. (can be executed with prefix)
                     \`/search_img   \` > Searches images by a search query.
                     \`/send_file    \` > Send file to a specified directory on the server. (use with prefix)
                     \`/set_tags     \` > Sets tags for the last image displayed by _img commands.
                     \`/get_sauce    \` > Get sauce of an image.
                     \`/server_status\` > Display minecraft server status. (can be executed with prefix)`
            },
            {
                name: "⚡️ Admin commands",
                value:
                    `\`/exec    \` > Execute any command on the server.
                     \`/get_file\` > Get any file from the server < 8Mb.
                     \`/terminal\` > Toggle terminal mode in this channel (message = command). (can be executed with prefix)`
            }]);

        if (interaction) {
            interaction.reply({
                embeds: [embed]
            });
        } else {
            message.reply({
                embeds: [embed]
            });
        }

    }
} as ICommand