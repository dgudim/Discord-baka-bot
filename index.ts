import DiscordJS, { Intents } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const messageReplies = new Map([
    ["ping", "pong"],
    ["pain and suffering", "main and buffering"],
]);

const client = new DiscordJS.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
});

client.on('ready', () => {
    console.log('Bot is up');

    const server = client.guilds.cache.get(process.env.LOCAL_SERV_ID!);
    let commands;

    if (server) {
        commands = server.commands;
    } else {
        commands = client.application?.commands;
    }

    commands?.create({
        name: 'ping',
        description: 'test comand.'
    });

});

client.on('messageCreate', (message) => {
    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        message.reply({
            content: messageReplies.get(msg_content)
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if(!interaction.isCommand()){
        return;
    }

    const {commandName, options} = interaction;

    if (commandName === 'ping') {
        interaction.reply({
            content: 'pong',
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);

