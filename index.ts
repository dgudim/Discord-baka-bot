import DiscordJS, { Intents } from 'discord.js'; // discord api
import WOKCommands from 'wokcommands';
import path from 'path';
import dotenv from 'dotenv'; // evironment vars
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
dotenv.config();

const terminalShellsByChannel = new Map<string, ChildProcessWithoutNullStreams>();
const channelTerminalShellUsers = new Map<string, Array<string>>();

function sendToChannel(channel: DiscordJS.TextBasedChannel | null, content: string) {
    if (channel) {
        const len = content.length;
        let pos = 0;
        while (pos < len) {
            channel.send({
                content: content.slice(pos, pos + 1999)
            });
            pos += 1999;
        }
    }
}

export function toggleTerminalChannel(channel: DiscordJS.TextBasedChannel | null, client_id: string) {
    let added = false;
    const channel_id = channel?.id || '';
    if (!terminalShellsByChannel.has(channel_id)) {
        const shell_session = spawn('/bin/sh');

        shell_session.on('error', (err) => {
            sendToChannel(channel, 'Failed to start screen session: ' + err);
        });

        shell_session.stdout.on('data', (data) => {
            sendToChannel(channel, (data + '').trim());
        });

        shell_session.stderr.on('data', (data) => {
            sendToChannel(channel, (data + '').trim());
        });

        shell_session.on('close', (code) => {
            if (code !== 0) {
                sendToChannel(channel, 'shell session exited with code ' + code);
                terminalShellsByChannel.delete(channel_id);
                channelTerminalShellUsers.set(channel_id, []);
            }
        });

        terminalShellsByChannel.set(channel_id, shell_session);
        channelTerminalShellUsers.set(channel_id, []);
    }

    let client_index = channelTerminalShellUsers.get(channel_id)!.indexOf(client_id);
    
    if (client_index == -1) {
        channelTerminalShellUsers.get(channel_id)?.push(client_id);
        added = true;
    } else {
        channelTerminalShellUsers.get(channel_id)?.splice(client_index, 1);
    }

    return added;
};

const client = new DiscordJS.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ]
});

const messageReplies = new Map([ // put your message replies here
    ["ping",
        (message: DiscordJS.Message) => {
            message.reply({
                content: 'pong'
            });
        }],
    ["windows",
        (message: DiscordJS.Message) => {
            message.reply({
                content: '🐧 Linux 🐧'
            });
        }],
    ["pain and suffering",
        (message: DiscordJS.Message) => {
            message.reply({
                content: 'main() and buffering'
            });
        }],
]);

client.on('ready', () => {

    client.user?.setPresence({
        status: 'online',
        activities: [{
            name: 'prefix is >'
        }]
    });

    new WOKCommands(client, {
        commandDir: path.join(__dirname, 'commands'),
        typeScript: true,
        botOwners: ['410761741484687371', '470215458889662474'],
        testServers: [process.env.LOCAL_SERV_ID || '', process.env.FILEBIN_SERV_ID || '']
    }).setDefaultPrefix('>').setColor(0x005555);
});

client.on('messageCreate', (message) => {

    if (terminalShellsByChannel.has(message.channelId) && channelTerminalShellUsers.get(message.channelId)?.indexOf(message.author.id) != -1) {
        terminalShellsByChannel.get(message.channelId)?.stdin.write("timeout 5s " + message.content + "\n");
        return;
    }

    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        messageReplies.get(msg_content)!(message);
    }
});


client.login(process.env.TOKEN);

