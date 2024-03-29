import { ICommand } from "dkrcommands";
import { exec } from "child_process";
import { status_channels } from "..";
import { ApplicationCommandOptionType } from "discord.js";
import { safeReply, sendToChannel, getSimpleEmbed, getDateTime, sleep } from "discord_bots_common/dist/utils/utils";

export default {

    category: "Administartion",
    description: "Shutdown/reboot the server",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "timeout-minutes",
        description: "Number of seconds befor shutdown/reboot",
        type: ApplicationCommandOptionType.Number,
        required: true,
        minValue: 1,
        maxValue: 15
    }, {
        name: "reboot",
        description: "reboot instead of shutdown",
        type: ApplicationCommandOptionType.Boolean,
        required: false
    }],

    callback: async ({ channel, interaction }) => {

        const timeout = interaction!.options.getInteger("timeout-minutes") || 0;
        const reboot = interaction!.options.getBoolean("reboot") || false;

        const msg_channels = status_channels ? status_channels : [channel];

        for (const msg_channel of msg_channels) {
            await safeReply(interaction, "🔌 YES SIR! Shutting down");
            await sendToChannel(msg_channel, msg_channel.guild?.roles.everyone.toString() || "");
            await sendToChannel(msg_channel, getSimpleEmbed(`🟡 Shutting down server in ${timeout} minute(s)`, getDateTime(), "Yellow"));
            await sleep(timeout * 1000 * 60 - 15000);
            await sendToChannel(msg_channel, getSimpleEmbed("🕝 Shutting down in 15 seconds", getDateTime(), "Red"));
            await sleep(15000);
            await sendToChannel(msg_channel, getSimpleEmbed("🔴 Server is offline", getDateTime(), "Red"));
        }

        exec(`${reboot ? "reboot" : "shutdown"} now`);

    }
} as ICommand;