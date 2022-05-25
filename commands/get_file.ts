import { ICommand } from "wokcommands";
import fs from "fs";

export default {
    category: 'Administration',
    description: 'Get any file from the server',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<file path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 1,
    maxArgs: 1,

    callback: ({ interaction, args }) => {

        if (!fs.existsSync(args[0])){
            return "File does not exist"
        }

        if (fs.statSync(args[0]).isDirectory()) {
            return "Can't send directories"
        }

        if (fs.statSync(args[0]).size > 1024 * 1024 * 8){
            return "File too big ( > 8mb)"
        }

        try {
            interaction.channel?.send({
                files: [{
                    attachment: args[0],
                    name: args[0].substring(args[0].lastIndexOf('/') + 1)
                }]
            });
            return "Here is your file"
        } catch (err) {
            return "Unknown error: " + err;
        }

    }
} as ICommand