import { EmbedFieldData, MessageEmbed } from 'discord.js';
import { ICommand } from "wokcommands";
import { exec } from 'child_process';

function addFields(embed: MessageEmbed, content: string, message: string) {
    content = content.substring(0, 5500);
    const len = content.length;
    let pos = 0;
    let fields: EmbedFieldData | EmbedFieldData[] = [];
    while (pos < len) {
        fields.push({
            name: pos == 0 ? message : '___',
            value: content.slice(pos, pos + 1023)
        });
        pos += 1023;
    }
    embed.addFields(fields);
}

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

        exec(asRoot ? ("timeout 5s " + args[0]) : ("runuser -l kloud -c 'timeout 5s " + args[0] + "'"),
            (error, stdout, stderr) => {

                if (stdout) {
                    embed.setColor('GREEN');
                    addFields(embed, stdout.toString(), 'execution sucessfull');
                }

                if (stderr) {
                    embed.setColor('RED');
                    addFields(embed, stderr.toString(), 'errors while executing');
                } else if (error) {
                    embed.setColor('RED');
                    addFields(embed, error.toString(), 'error while executing');
                }

                if (!stderr && !stdout && !error) {
                    embed.setColor('YELLOW');
                    addFields(embed, 'Command didn\'t return anything', 'check your syntax');
                }

                embed.setDescription("result of executing " + args[0]);

                interaction.editReply({
                    embeds: [embed]
                });

            });
    }
} as ICommand