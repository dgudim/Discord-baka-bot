import { MessageEmbed } from "discord.js";
import { ICommand } from "wokcommands";
import { combinedReply, getDateTime, getSimpleEmbed, sendToChannel, sleep } from "../utils";
import { exec } from 'child_process';
import { status_channel } from "..";

export default {

    category: 'Administartion',
    description: 'Shut down the server',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<timeout-minutes> <reboot>',
    expectedArgsTypes: ['INTEGER', 'INTEGER'],
    minArgs: 1,
    maxArgs: 2,

    callback: async ({ args, channel, interaction, message }) => {

        const timeout = Math.max(+args[0], 1);

        const guild = message ? message.guild : interaction.guild;
        const msg_channel = status_channel ? status_channel : channel;

        await combinedReply(interaction, message, 'YES SIR! Shutting down');

        await sendToChannel(msg_channel, guild?.roles.everyone.toString() || '');

        await sendToChannel(msg_channel, getSimpleEmbed(`🟡 Shutting down server in ${timeout} minute(s)`, getDateTime(), 'YELLOW'));

        await sleep(timeout * 1000 * 60 - 15000);

        await sendToChannel(msg_channel, getSimpleEmbed('🔴 Shutting down in 15 seconds', getDateTime(), 'RED'));

        try {
            exec('minecraftd stop');
        } catch (err) {
            console.log(err);
        }
        await sleep(15000);

        await sendToChannel(msg_channel, getSimpleEmbed("🔴 Server is offline", getDateTime(), 'RED'));

        exec(`${args[1] ? 'reboot' : 'shutdown'} now`);

    }
} as ICommand