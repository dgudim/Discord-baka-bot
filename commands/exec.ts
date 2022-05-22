import { MessageEmbed } from 'discord.js';
import util from 'util';
const exec = util.promisify(require('child_process').exec);
import { ICommand } from "wokcommands";

const execIds = [];

export default {
    category: 'Administration',
    description: 'Execute any command on the server',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<command> <as root>',
    expectedArgsTypes: ['STRING', 'INTEGER'],
    minArgs: 1,
    maxArgs: 2,

    callback: async ({ interaction, args }) => {
        const embed = new MessageEmbed();
        embed.setTitle("exec");
        embed.setDescription("executing " + args[0] + "...");

        await interaction.reply({
            embeds: [embed]
        });

        const asRoot = parseInt(args[1]) >= 1;

        try {

            const { stdout, stderr } = await exec(asRoot ? ("timeout 5s " + args[0]) : ("runuser -l kloud -c 'timeout 5s " + args[0] + "'"));
            
            if (stderr) {
                embed.setColor('RED');
                embed.addField(stderr.toString().slice(0, 255), 'error while executing');
            } else if (stdout) {
                embed.setColor('GREEN');
                embed.addField('execution sucessfull', stdout.toString().slice(0, 1023));
            } else {
                embed.setColor('YELLOW');
                embed.addField('Command didn\'t return anything', 'check your syntax');
            }
        } catch (err) {
            embed.setColor('RED');
            embed.addField((err + "").slice(0, 255), 'error while executing');
        }

        embed.setDescription("result of executing " + args[0]);

        interaction.editReply({
            embeds: [embed]
        });
    }
} as ICommand