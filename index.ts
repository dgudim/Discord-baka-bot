import { Intents, TextBasedChannel, Message, Client } from 'discord.js'; // discord api
import WOKCommands from 'wokcommands';
import path from 'path';
import dotenv from 'dotenv'; // evironment vars
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import ConfigTS from "configstore-ts";

export interface IConfig {
    send_file_dir: string;
    img_dir: string;
}

export const config = new ConfigTS<IConfig>(path.join(__dirname, "./local.json"), { 
    send_file_dir: '/home/kloud/Downloads/',
    img_dir: '/home/public_files'
 });

dotenv.config();

const terminalShellsByChannel = new Map<string, ChildProcessWithoutNullStreams>();
const channelTerminalShellUsers = new Map<string, Array<string>>();

const bultInCommands = ['alias', 'bg', 'bind', 'builtin',
    'cd', 'command', 'compgen', 'complete', 'declare', 'dirs', 'disown', 'echo', 'enable', 'eval',
    'exec', 'exit', 'export', 'fc', 'fg', 'getopts', 'hash', 'help', 'history', 'jobs', 'kill', 'let', 'local',
    'logout', 'popd', 'printf', 'pushd', 'pwd', 'read', 'readonly', 'set', 'shift', 'shopt', 'source',
    'suspend', 'test', 'times', 'trap', 'type', 'typeset', 'ulimit', 'umask', 'unalias', 'unset', 'until', 'wait'];

const prefix = '>';

function isButin(str: string) {
    return bultInCommands.some(bultInCommands => str.startsWith(bultInCommands));
}

function sendToChannel(channel: TextBasedChannel | null, content: string) {
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

export function toggleTerminalChannel(channel: TextBasedChannel | null, client_id: string) {
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
            sendToChannel(channel, 'shell session exited with code ' + code);
            sendToChannel(channel, 'turned OFF terminal mode for all users in this channel');
            terminalShellsByChannel.delete(channel_id);
            channelTerminalShellUsers.set(channel_id, []);
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

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ]
});

const messageReplies = new Map([ // put your message replies here
    ["ping",
        (message: Message) => {
            message.reply({
                content: 'pong'
            });
        }],
    ["windows",
        (message: Message) => {
            message.reply({
                content: '🐧 Linux 🐧'
            });
        }],
    ["pain and suffering",
        (message: Message) => {
            message.reply({
                content: 'main() and buffering'
            });
        }],
    ["понял",
        (message: Message) => {
            message.reply({
                content: 'не поняла'
            });
        }],
    ["amogus",
        (message: Message) => {
            message.reply({
                content: 'sus'
            });
        }]
]);

client.on('ready', () => {

    client.user?.setPresence({
        status: 'online',
        activities: [{
            name: 'prefix is ' + prefix
        }]
    });

    new WOKCommands(client, {
        commandDir: path.join(__dirname, 'commands'),
        typeScript: true,
        botOwners: ['410761741484687371', '470215458889662474'],
        testServers: [process.env.LOCAL_SERV_ID || '', process.env.FILEBIN_SERV_ID || '']
    }).setDefaultPrefix(prefix).setColor(0x005555);
});

client.on('messageCreate', (message) => {

    if (!message.content.startsWith(prefix) &&
        terminalShellsByChannel.has(message.channelId) &&
        channelTerminalShellUsers.get(message.channelId)?.indexOf(message.author.id) != -1) {
        terminalShellsByChannel.get(message.channelId)?.stdin.write(
            isButin(message.content.trim()) ? message.content.trim() + "\n" :
                "timeout 5s " + message.content.trim() + " | sed -e 's/\x1b\[[0-9;]*[a-zA-Z]//g' \n");
        return;
    }

    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        messageReplies.get(msg_content)!(message);
    }
});


client.login(process.env.TOKEN);
