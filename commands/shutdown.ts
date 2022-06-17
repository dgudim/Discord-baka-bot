import { MessageEmbed } from "discord.js";
import { ICommand } from "wokcommands";
import { combinedReply, sendToChannel, sleep } from "../utils";
import { exec } from 'child_process';

export default {

    category: 'Administartion',
    description: 'Shut down the server',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<timeout-minutes>',
    expectedArgsTypes: ['INTEGER'],
    minArgs: 0,
    maxArgs: 1,

    callback: async ({ args, channel, interaction, message }) => {

        const timeout = args[0] ? Math.max(+args[0], 1) : 1;

        const guild = message ? message.guild : interaction.guild;

        await sendToChannel(channel, guild?.roles.everyone.toString() || '');

        const embed = new MessageEmbed();
        embed.setTitle(`🟡 Shutting down server in ${timeout} minute(s)`);
        embed.setDescription('------------------------');
        embed.setColor('YELLOW');

        await combinedReply(interaction, message, embed);

        await sleep(timeout * 1000 * 60 - 15000);

        embed.setTitle('🔴 Shutting down in 15 seconds');
        embed.setColor('RED');

        await sendToChannel(channel, embed);

        try {
            exec('minecraftd stop');
        } catch (err) {
            console.log(err);
        }
        await sleep(15000);
        //exec("shutdown now");

    }
} as ICommand