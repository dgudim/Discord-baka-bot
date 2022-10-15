import { safeReply } from "discord_bots_common/dist/utils/utils";
import { ICommand } from "dkrcommands";
import { toggleTerminalChannel } from "../index";

export default {
    category: "Administration",
    description: "Enable terminal mode in this channel",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ interaction, channel, user }) => {
        const result = toggleTerminalChannel(channel, user.id);
        if (result.error) {
            return safeReply(interaction, `❌ An error occured`);
        }
        await safeReply(interaction, `⚙️ Turned terminal mode ${result.state ? "ON" : "OFF"} for user ${user.username}`);
    }
} as ICommand;