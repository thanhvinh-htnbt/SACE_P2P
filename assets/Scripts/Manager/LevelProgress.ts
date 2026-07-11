import { sys } from 'cc';

/** Trạng thái chọn màn và mở khóa, dùng chung giữa Lobby và gameplay. */
export class LevelProgress {
    private static readonly UNLOCKED_LEVELS_KEY = 'unlocked_maze_levels';
    private static readonly DEFAULT_LEVEL = 'level_01';
    private static levelOrder: string[] = [];
    private static selectedLevel = LevelProgress.DEFAULT_LEVEL;

    static setAvailableLevels(levelNames: string[]): void {
        this.levelOrder = [...new Set(levelNames)]
            .filter(name => /^level_\d+$/i.test(name))
            .sort((a, b) => this.getLevelNumber(a) - this.getLevelNumber(b));

        const firstLevel = this.levelOrder[0] ?? this.DEFAULT_LEVEL;
        if (!this.isUnlocked(firstLevel)) this.unlockLevel(firstLevel);
    }

    static getAvailableLevels(): readonly string[] {
        return this.levelOrder;
    }

    static getSelectedLevel(): string {
        if (this.isAvailable(this.selectedLevel) && this.isUnlocked(this.selectedLevel)) {
            return this.selectedLevel;
        }
        return this.levelOrder[0] ?? this.DEFAULT_LEVEL;
    }

    static selectLevel(levelName: string): boolean {
        if (!this.isAvailable(levelName) || !this.isUnlocked(levelName)) return false;
        this.selectedLevel = levelName;
        return true;
    }

    static isUnlocked(levelName: string): boolean {
        return this.getUnlockedLevels().indexOf(levelName) >= 0;
    }

    static unlockLevel(levelName: string): void {
        const unlocked = this.getUnlockedLevels();
        if (unlocked.indexOf(levelName) >= 0) return;

        unlocked.push(levelName);
        sys.localStorage.setItem(this.UNLOCKED_LEVELS_KEY, JSON.stringify(unlocked));
    }

    /** Mở khóa màn kế tiếp sau khi thắng và trả về tên màn đó. */
    static completeLevel(levelName: string): string | null {
        const nextLevel = this.getNextLevel(levelName);
        if (nextLevel) this.unlockLevel(nextLevel);
        return nextLevel;
    }

    /** Chọn màn kế tiếp đã mở khóa. Trả về null nếu đây là màn cuối. */
    static selectNextLevel(): string | null {
        const nextLevel = this.getNextLevel(this.getSelectedLevel());
        if (!nextLevel || !this.selectLevel(nextLevel)) return null;
        return nextLevel;
    }

    private static getNextLevel(levelName: string): string | null {
        const index = this.levelOrder.indexOf(levelName);
        return index >= 0 && index < this.levelOrder.length - 1
            ? this.levelOrder[index + 1]
            : null;
    }

    private static getUnlockedLevels(): string[] {
        const saved = sys.localStorage.getItem(this.UNLOCKED_LEVELS_KEY);
        if (!saved) return [this.levelOrder[0] ?? this.DEFAULT_LEVEL];

        try {
            const levels: unknown = JSON.parse(saved);
            return Array.isArray(levels)
                ? levels.filter((value): value is string => typeof value === 'string')
                : [];
        } catch {
            return [this.levelOrder[0] ?? this.DEFAULT_LEVEL];
        }
    }

    private static isAvailable(levelName: string): boolean {
        return this.levelOrder.length === 0 || this.levelOrder.indexOf(levelName) >= 0;
    }

    private static getLevelNumber(levelName: string): number {
        const match = levelName.match(/(\d+)$/);
        return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    }
}
