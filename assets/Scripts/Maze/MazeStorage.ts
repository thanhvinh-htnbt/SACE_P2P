import { sys, JsonAsset, resources, native } from 'cc';
import { MazeLevelData } from './MazeData';

export class MazeStorage {
    static saveLevel(data: MazeLevelData) {
        const key = `maze_level_${data.levelId}`;
        const json = JSON.stringify(data);

        if (sys.isNative && native.fileUtils) {
            const path = `${native.fileUtils.getWritablePath()}${key}.json`;
            native.fileUtils.writeStringToFile(json, path);
        } else {
            sys.localStorage.setItem(key, json);
        }
    }

    static loadLevelFromResources(levelId: string): Promise<MazeLevelData> {
        return new Promise((resolve, reject) => {
            resources.load(`levels/${levelId}`, JsonAsset, (err, asset) => {
                if (err) { reject(err); return; }
                resolve(asset.json as MazeLevelData);
            });
        });
    }

    static loadLevelFromStorage(levelId: string): MazeLevelData | null {
        const key = `maze_level_${levelId}`;
        const json = sys.localStorage.getItem(key);
        return json ? JSON.parse(json) : null;
    }
}