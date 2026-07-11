import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
    director,
    game,
    input,
    Input,
    Node,
    resources,
} from 'cc';
import { TurnManager } from './TurnManager';
const { ccclass, property } = _decorator;

type SoundName = 'bgm' | 'click' | 'item' | 'wave' | 'player_move' | 'win' | 'lose';

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

    private bgmSource: AudioSource = null;
    private sfxSource: AudioSource = null;
    private waveSource: AudioSource = null;
    private readonly clips = new Map<SoundName, AudioClip>();
    private readonly loading = new Map<SoundName, Promise<AudioClip | null>>();
    private waveGeneration = 0;

    @property(AudioClip) bgmClip: AudioClip = null;
    @property(AudioClip) clickClip: AudioClip = null;
    @property(AudioClip) itemClip: AudioClip = null;
    @property(AudioClip) waveClip: AudioClip = null;
    @property(AudioClip) playerMoveClip: AudioClip = null;
    @property(AudioClip) winClip: AudioClip = null;
    @property(AudioClip) loseClip: AudioClip = null;

    static ensure(): GameAudio {
        if (GameAudio.instance?.isValid) return GameAudio.instance;

        const node = new Node('GameAudio');
        director.getScene()?.addChild(node);
        game.addPersistRootNode(node);
        return node.addComponent(GameAudio);
    }

    static playClick() {
        const audio = GameAudio.ensure();
        audio.startBgm();
        audio.play('click');
    }

    onLoad() {
        if (GameAudio.instance && GameAudio.instance !== this) {
            this.node.destroy();
            return;
        }

        GameAudio.instance = this;
        if (this.node.parent === director.getScene()) {
            game.addPersistRootNode(this.node);
        }
        this.cacheInspectorClips();
        this.bgmSource = this.createSource('BGM');
        this.bgmSource.loop = true;
        this.bgmSource.volume = 0.16;
        this.sfxSource = this.createSource('SFX');
        this.sfxSource.loop = false;
        this.sfxSource.volume = 0.85;
        this.waveSource = this.createSource('Wave');
        this.waveSource.loop = false;
        this.waveSource.volume = 0.55;
        TurnManager.eventTarget.on('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.on('food-collected', this.onFoodCollected, this);
        TurnManager.eventTarget.on('game-ended', this.onGameEnded, this);
        input.on(Input.EventType.TOUCH_START, this.onFirstInteraction, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onFirstInteraction, this);

        // Warm up clips so the first gameplay event does not wait on disk IO.
        for (const name of ['bgm', 'click', 'item', 'wave', 'player_move', 'win', 'lose'] as SoundName[]) {
            void this.load(name);
        }
        this.startBgm();
    }

    onDestroy() {
        if (GameAudio.instance !== this) return;
        TurnManager.eventTarget.off('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.off('food-collected', this.onFoodCollected, this);
        TurnManager.eventTarget.off('game-ended', this.onGameEnded, this);
        input.off(Input.EventType.TOUCH_START, this.onFirstInteraction, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onFirstInteraction, this);
        GameAudio.instance = null;
    }

    play(name: SoundName) {
        void this.load(name).then(clip => {
            if (clip && this.sfxSource?.isValid) {
                this.sfxSource.playOneShot(clip, 1);
            }
        });
    }

    /** Browser có thể chặn autoplay; playClick() gọi lại hàm này trong user gesture đầu tiên. */
    private startBgm() {
        void this.load('bgm').then(clip => {
            if (!clip || !this.bgmSource?.isValid || this.bgmSource.playing) return;
            this.bgmSource.clip = clip;
            this.bgmSource.play();
        });
    }

    private onFirstInteraction() {
        // Web chỉ cho phát audio sau user gesture đầu tiên.
        this.startBgm();
        input.off(Input.EventType.TOUCH_START, this.onFirstInteraction, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onFirstInteraction, this);
    }

    private createSource(name: string): AudioSource {
        const sourceNode = new Node(name);
        this.node.addChild(sourceNode);
        return sourceNode.addComponent(AudioSource);
    }

    private cacheInspectorClips() {
        const inspectorClips: Array<[SoundName, AudioClip]> = [
            ['bgm', this.bgmClip],
            ['click', this.clickClip],
            ['item', this.itemClip],
            ['wave', this.waveClip],
            ['player_move', this.playerMoveClip],
            ['win', this.winClip],
            ['lose', this.loseClip],
        ];
        for (const [name, clip] of inspectorClips) {
            if (clip) this.clips.set(name, clip);
        }
    }

    private onTurtleMoved(event: TurtleMovedAudioEvent) {
        this.stopWave();
        if (event.destinationIsFlow) void this.playWavePulse();
        else this.play('player_move');
    }

    private onFoodCollected() {
        this.play('item');
    }

    private onGameEnded(event: GameEndedAudioEvent) {
        this.stopWave();
        this.play(event.isWin ? 'win' : 'lose');
    }

    private async playWavePulse() {
        const generation = ++this.waveGeneration;
        const clip = await this.load('wave');
        if (generation !== this.waveGeneration || !clip || !this.waveSource?.isValid) return;
        this.waveSource.clip = clip;
        this.waveSource.currentTime = 0;
        this.waveSource.play();
        this.unschedule(this.stopWave);
        this.scheduleOnce(this.stopWave, 0.24);
    }

    private readonly stopWave = () => {
        this.waveGeneration++;
        this.unschedule(this.stopWave);
        if (this.waveSource?.isValid) {
            this.waveSource.stop();
            this.waveSource.clip = null;
        }
    };

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
