import { ICommand } from "wokcommands";

export default {
    category: 'Misc',
    description: 'Use linux',
    
    callback: ({ }) => {
        return '🐧 Linux 🐧'
    }
} as ICommand