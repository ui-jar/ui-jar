import * as fs from 'fs';
import * as path from 'path';

export class FileSearch {
    constructor(private includes = [], private excludes = []) { }

    getFiles(directory: string) {
        let results = [];

        let files = fs.readdirSync(directory);

        files.forEach((file) => {
            const filePath = directory + '/' + file;

            let shouldBeExcluded = this.excludes.find((excludeItem) => {
                return new RegExp(excludeItem).test(file);
            });

            if (shouldBeExcluded) {
                return;
            }

            if (fs.statSync(filePath).isDirectory()) {
                results = results.concat(this.getFiles(filePath));
            } else if (fs.statSync(filePath).isFile()) {
                let shouldBeIncluded = this.includes.find((includeItem) => {
                    return new RegExp(includeItem).test(file);
                });

                if (shouldBeIncluded) {
                    results.push(path.resolve(filePath));
                }
            }
        });

        return results;
    }
}