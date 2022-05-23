import { ICommand } from "wokcommands";
import { toggleTerminalChannel } from "../index"

export default {
    category: 'Administration',
    description: 'Enable terminal mode in this channel',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ interaction }) => {

        const sucessfull = toggleTerminalChannel(interaction.channel, interaction.user.id);
        
        return "Turned terminal mode " + (sucessfull ? "ON" : "OFF") + " for user " + interaction.user.username;
    }
} as ICommand