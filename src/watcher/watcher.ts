import * as fs from 'fs';
import * as path from 'path';
import { generateRequiredFiles } from '../init/init';
import * as EventEmitter from 'events';

export interface FileWatcherOptions {
    directory: string,
    files: string[]
}

export enum FileWatcherEvent {
    REBUILD = 'REBUILD'
}

export class FileWatcher {
    private watchEvent: EventEmitter = new EventEmitter();

    constructor(private config: FileWatcherOptions) { }

    start() {
        console.info('Watching for file changes.');

        let debounceTime = 500;
        let watchTimer = null;
        let watcher = fs.watch(path.resolve(this.config.directory), { encoding: 'utf8', recursive: true, persistent: true });

        watcher.addListener('change', (eventName: string, fileName: string) => {
            clearTimeout(watchTimer);

            watchTimer = setTimeout(() => this.eventHandler(fileName), debounceTime);
        });
    }

    addListener(eventType: FileWatcherEvent, callback: () => void) {
        if (eventType) {
            this.watchEvent.addListener(eventType, callback);
        }
    }

    private shouldBeIncluded(fileName: string): boolean {
        fileName = this.escapeSpecialCharacters(fileName);

        let result = this.config.files.find((testFile) => {
            return new RegExp(fileName + '$').test(testFile);
        });

        return result ? true : false;
    }

    private escapeSpecialCharacters(fileName: string): string {
        fileName = fileName.replace(/\\/gi, '\\\\');

        return fileName;
    }

    private eventHandler(fileName: string): void {
        if (this.shouldBeIncluded(fileName)) {
            console.info('File change detected.');
            this.watchEvent.emit(FileWatcherEvent.REBUILD);
            console.info('Watching for file changes.');
        }
    }
}