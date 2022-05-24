import { ICommand } from "wokcommands";
import { toggleTerminalChannel } from "../index"

export default {
    category: 'Administration',
    description: 'Enable terminal mode in this channel',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ interaction, message }) => {

        const channel = interaction ? interaction.channel : message.channel;
        const user = interaction ? interaction.user : message.author;

        const sucessfull = toggleTerminalChannel(channel, user.id);
        
        return "Turned terminal mode " + (sucessfull ? "ON" : "OFF") + " for user " + user.username;
    }
} as ICommand