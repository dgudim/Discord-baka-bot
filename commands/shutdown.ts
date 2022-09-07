import { ICommand } from "dkrcommands";
import { combinedReply, getDateTime, getSimpleEmbed, sendToChannel, sleep } from "@discord_bots_common/utils";
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

        const guild = message?.guild || interaction?.guild;
        const msg_channel = status_channel ? status_channel : channel;

        await combinedReply(interaction, message, 'YES SIR! Shutting down');
        await sendToChannel(msg_channel, guild?.roles.everyone.toString() || '');
        await sendToChannel(msg_channel, getSimpleEmbed(`🟡 Shutting down server in ${timeout} minute(s)`, getDateTime(), 'Yellow'));
        await sleep(timeout * 1000 * 60 - 15000);
        await sendToChannel(msg_channel, getSimpleEmbed('🔴 Shutting down in 15 seconds', getDateTime(), 'Red'));
        await sleep(15000);
        await sendToChannel(msg_channel, getSimpleEmbed("🔴 Server is offline", getDateTime(), 'Red'));

        exec(`${args[1] ? 'reboot' : 'shutdown'} now`);

    }
} as ICommand