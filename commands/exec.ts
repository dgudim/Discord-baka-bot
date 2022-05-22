import { MessageEmbed } from 'discord.js';
import DiscordJS from 'discord.js'; // discord api
import util from 'util';
const exec = util.promisify(require('child_process').exec);
import { ICommand } from "wokcommands";

export default {
    category: 'Administration',
    description: 'Execute any command on the server',

    slash: true,
    testOnly: true,

    expectedArgs: '<command> <as root>',
    expectedArgsTypes: ['STRING', 'INTEGER'],
    minArgs: 1,
    maxArgs: 2,

    callback: async ({ interaction, args, member}) => {
        const embed = new MessageEmbed();
        embed.setTitle("exec");
        embed.setDescription("executing " + args[0] + "...");

        await interaction.reply({
            embeds: [embed]
        });

        var asRoot = false;
        const hasAdminRole = member.roles.cache.some(role => role.name.toLowerCase() === 'admin');
        const hasSudoRole = member.roles.cache.some(role => role.name.toLowerCase() === 'sudo');

        if (!hasAdminRole){
            embed.setDescription("can't execute, missing admin role");
            embed.setColor('RED');
            interaction.editReply({
                embeds: [embed]
            });
            return;
        }

        if (parseInt(args[1]) >= 1) {
            if (hasSudoRole) {
                asRoot = true;
            } else {
                embed.setDescription("can't execute as sudo, missing sudo role");
                embed.setColor('RED');
                interaction.editReply({
                    embeds: [embed]
                });
                return;
            }
        }
        

        try {

            const { stdout, stderr } = await exec("runuser -l " + (asRoot ? "root" : "kloud") + " -c 'timeout 5s " + args[0] + "'");
            
            if (stderr) {
                embed.setColor('RED');
                embed.addField(stderr, 'error while executing');
            } else if (stdout) {
                embed.setColor('GREEN');
                embed.addField('execution sucessfull', stdout.toString().slice(0, 1023));
            } else {
                embed.setColor('YELLOW');
                embed.addField('Command didn\'t return anything', 'check your syntax');
            }
        } catch (err) {
            embed.setColor('RED');
            embed.addField(err + "", 'error while executing');
        }

        embed.setDescription("result of executing " + args[0]);

        interaction.editReply({
            embeds: [embed]
        });
    }
} as ICommand