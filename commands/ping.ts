import { ICommand } from "wokcommands";

export default {
    category: 'Misc',
    description: 'Replies with pong',
    
    callback: ({}) => {
        return 'pong'
    }
} as ICommand