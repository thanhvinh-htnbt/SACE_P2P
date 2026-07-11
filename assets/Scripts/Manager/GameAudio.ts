import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
    director,
    game,
    Node,
    resources,
} from 'cc';
import { TurnManager } from './TurnManager';
const { ccclass } = _decorator;

type SoundName = 'click' | 'item' | 'wave' | 'player_move' | 'win' | 'lose';

interface TurtleMovedAudioEvent {
    destinationIsFlow?: boolean;
}

interface GameEndedAudioEvent {
    isWin: boolean;
}

/** Sound-effects service shared by gameplay UI and all scenes. */
@ccclass('GameAudio')
export class GameAudio extends Component {
    private static instance: GameAudio = null;

    private source: AudioSource = null;
    private readonly clips = new Map<SoundName, AudioClip>();
    private readonly loading = new Map<SoundName, Promise<AudioClip | null>>();

    static ensure(): GameAudio {
        if (GameAudio.instance?.isValid) return GameAudio.instance;

        const node = new Node('GameAudio');
        director.getScene()?.addChild(node);
        game.addPersistRootNode(node);
        return node.addComponent(GameAudio);
    }

    static playClick() {
        GameAudio.ensure().play('click');
    }

    onLoad() {
        if (GameAudio.instance && GameAudio.instance !== this) {
            this.node.destroy();
            return;
        }

        GameAudio.instance = this;
        this.source = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);
        TurnManager.eventTarget.on('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.on('food-collected', this.onFoodCollected, this);
        TurnManager.eventTarget.on('game-ended', this.onGameEnded, this);

        // Warm up clips so the first gameplay event does not wait on disk IO.
        for (const name of ['click', 'item', 'wave', 'player_move', 'win', 'lose'] as SoundName[]) {
            void this.load(name);
        }
    }

    onDestroy() {
        if (GameAudio.instance !== this) return;
        TurnManager.eventTarget.off('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.off('food-collected', this.onFoodCollected, this);
        TurnManager.eventTarget.off('game-ended', this.onGameEnded, this);
        GameAudio.instance = null;
    }

    play(name: SoundName) {
        void this.load(name).then(clip => {
            if (clip && this.source?.isValid) this.source.playOneShot(clip, 1);
        });
    }

    private onTurtleMoved(event: TurtleMovedAudioEvent) {
        this.play(event.destinationIsFlow ? 'wave' : 'player_move');
    }

    private onFoodCollected() {
        this.play('item');
    }

    private onGameEnded(event: GameEndedAudioEvent) {
        this.play(event.isWin ? 'win' : 'lose');
    }

    private load(name: SoundName): Promise<AudioClip | null> {
        const cached = this.clips.get(name);
        if (cached) return Promise.resolve(cached);

        const pending = this.loading.get(name);
        if (pending) return pending;

        const request = new Promise<AudioClip | null>(resolve => {
            resources.load(`audio/${name}`, AudioClip, (error, clip) => {
                this.loading.delete(name);
                if (error) {
                    console.error(`Cannot load audio/${name}`, error);
                    resolve(null);
                    return;
                }
                this.clips.set(name, clip);
                resolve(clip);
            });
        });
        this.loading.set(name, request);
        return request;
    }
}
