import DiscordJS, { Intents } from 'discord.js'; // discord api
import WOKCommands from 'wokcommands';
import path from 'path';
import dotenv from 'dotenv'; // evironment vars
dotenv.config();

const client = new DiscordJS.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ]
});

client.on('ready', () => {
    new WOKCommands(client, {
        commandDir: path.join(__dirname, 'commands'),
        typeScript: true,
        testServers: [process.env.LOCAL_SERV_ID || '', process.env.FILEBIN_SERV_ID || '']
    }).setDefaultPrefix('').setColor(0x005555);
});

client.login(process.env.TOKEN);

