import { ICommand } from "dkrcommands";
import { toggleTerminalChannel } from "../index"
import { safeReply } from "discord_bots_common";

export default {
    category: 'Administration',
    description: 'Enable terminal mode in this channel',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ interaction, channel }) => {

        const user = interaction!.user;
        const sucessfull = toggleTerminalChannel(channel, user.id);
        
        await safeReply(interaction!, `Turned terminal mode ${sucessfull ? "ON" : "OFF"} for user ${user.username}`);
    }
} as ICommand