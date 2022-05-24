import { ICommand } from "wokcommands";
import fs from "fs";
import https from 'https';

export default {
    category: 'Administration',
    description: 'Send any file to the server',

    slash: false,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: ({ message }) => {

        for (let i = 0; i < message.attachments.size; i++) {
            const file = fs.createWriteStream("/home/kloud/Downloads/" + message.attachments.at(i)?.name);
            https.get(message.attachments.at(i)?.url + "", (response) => {
                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    message.channel?.send({
                        content: "saved " + message.attachments.at(i)?.name
                    });
                });
            });
        }

        return "saving " + message.attachments.size + " file(s) to /home/kloud/Downloads";

    }
} as ICommand