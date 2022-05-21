import DiscordJS, { Intents } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

class CommandReply {

    description: string;
    callback_func: Function;

    constructor(description: string, callback_func: Function) {
        this.description = description;
        this.callback_func = callback_func;
    }

}

const messageReplies = new Map([
    ["ping",
        (message: DiscordJS.Message) => {
            message.reply({
                content: 'pong'
            });
        }],
    ["pain and suffering",
        (message: DiscordJS.Message) => {
            message.reply({
                content: 'main() and buffering'
            });
        }],
]);

const commandReplies = new Map([
    ['server_status', new CommandReply(
        'get current minecraft server status',
        (interaction: DiscordJS.BaseCommandInteraction) => {
            interaction.reply({
                content: 'not implemented',
                ephemeral: false
            });
        })]]);

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

    for (const [name, command] of commandReplies) {
        commands?.create({
            name: name,
            description: command.description
        });
    }

});

client.on('messageCreate', (message) => {
    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        messageReplies.get(msg_content)!(message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }

    const { commandName, options } = interaction;

    if (commandReplies.has(commandName)) {
        commandReplies.get(commandName)?.callback_func(interaction);
    }
});

client.login(process.env.TOKEN);

