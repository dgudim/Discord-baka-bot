import { RestOrArray, APIEmbedField, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import { ICommand } from "dkrcommands";
import { exec } from 'child_process';
import { safeReply } from 'discord_bots_common';

function addFields(embed: EmbedBuilder, content: string, message: string) {
    content = content.substring(0, 5500);
    const len = content.length;
    let pos = 0;
    let fields: RestOrArray<APIEmbedField> = [];
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

    options: [{
        name: "command",
        description: "Command to execute",
        type: ApplicationCommandOptionType.String,
        required: true
    }, {
        name: "as-root",
        description: "Whether to execute as root",
        type: ApplicationCommandOptionType.Boolean,
        required: false
    }],

    callback: async ({ interaction }) => {

        let interaction_nn = interaction!;
        const command = interaction_nn.options.getString("command");
        const as_root = interaction_nn.options.getBoolean("as_root");

        const embed = new EmbedBuilder();
        embed.setTitle("exec");
        embed.setDescription(`executing ${command}...`);

        safeReply(interaction_nn, embed);

        exec(as_root ? ("timeout 5s " + command) : (`runuser -l kloud -c 'timeout 5s ${command}'`),
            (error, stdout, stderr) => {

                if (stdout) {
                    embed.setColor('Green');
                    addFields(embed, stdout.toString(), 'execution sucessfull');
                }

                const err = error + "\n" + stderr;

                if (stderr || error) {
                    embed.setColor('Red');
                    addFields(embed, err.toString(), 'errors while executing');
                }

                if (!stderr && !stdout && !error) {
                    embed.setColor('Yellow');
                    addFields(embed, 'Command didn\'t return anything', 'check your syntax');
                }

                embed.setDescription(`result of executing ${command}`);

                interaction_nn.editReply({
                    embeds: [embed]
                });

            });
    }
} as ICommand