const NOOP = (): void => (null);

class Mainloop {
    private simulationTimestep: number = 1000 / 60;
    private frameDelta: number = 0;
    private lastFrameTime: number = 0;
    private fps: number = 60;
    private fpsAlpha: number = 0.9;
    private fpsUpdateInterval: number = 1000;
    private lastFpsUpdate: number = 0;
    private framesSinceLastFpsUpdate: number = 0;
    private numberOfUpdateSteps: number = 0;
    private minFrameDelay: number = 0;
    private running: boolean = false;
    private started: boolean = false;
    private panic: boolean = false;

    private requestAnimationFrame: (callback: (delta?: number) => void) => any;
    private cancelAnimationFrame: (handle: number) => void;
    private requestAnimationFrameId: number;

    private begin: (timestamp: number, delta: number) => void = NOOP;
    private update: (delta: number) => void = NOOP;
    private draw: (interpolation: number) => void = NOOP;
    private end: (fps: number, panic: boolean) => void = NOOP;

    constructor() {
        this.requestAnimationFrame = requestAnimationFrame || this.createRequestAnimationFrameFallback();
        this.cancelAnimationFrame = cancelAnimationFrame || clearTimeout;
    }

    public getSimulationTimestep(): number {
        return this.simulationTimestep;
    }

    public setSimulationTimestep(simulationStep: number): void {
        this.simulationTimestep = simulationStep;
    }

    public getFPS(): number {
        return this.fps;
    }

    public getMaxAllowedFPS(): number {
        return 1000 / this.minFrameDelay;
    }

    public setMaxAllowedFPS(fps: number = Number.POSITIVE_INFINITY): void {
        if (fps === 0) {
            this.stop();
        } else {
            this.minFrameDelay = 1000 / fps;
        }
    }

    public resetFrameDelta(): number {
        const previousFrameDelta = this.frameDelta;

        this.frameDelta = 0;

        return previousFrameDelta;
    }

    public setBegin(callback: () => void): void {
        this.begin = callback;
    }

    public setUpdate(callback: () => void): void {
        this.update = callback;
    }

    public setDraw(callback: () => void): void {
        this.draw = callback;
    }

    public setEnd(callback: () => void): void {
        this.end = callback;
    }

    public start(): void {
        if (!this.started) {
            this.started = true;

            this.requestAnimationFrameId = this.requestAnimationFrame((timestamp: number): void => {
                this.draw(1);

                this.running = true;

                this.lastFrameTime = timestamp;
                this.lastFpsUpdate = timestamp;
                this.framesSinceLastFpsUpdate = 0;

                this.requestAnimationFrameId = this.requestAnimationFrame(this.animate);
            });
        }
    }

    public stop(): void {
        this.running = false;
        this.started = false;
        this.cancelAnimationFrame(this.requestAnimationFrameId);
    }

    public isRunning(): boolean {
        return this.running;
    }

    private animate(timestamp: number): void {
        this.requestAnimationFrameId = this.requestAnimationFrame(this.animate);

        if (timestamp < this.lastFrameTime + this.minFrameDelay) {
            return;
        }

        this.frameDelta += timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.begin(timestamp, this.frameDelta);

        if (timestamp > this.lastFpsUpdate + this.fpsUpdateInterval) {
            this.fps = this.framesSinceLastFpsUpdate * 1000 / (timestamp - this.lastFpsUpdate)
                + (1 - this.fpsAlpha) * this.fps;

            this.lastFpsUpdate = timestamp;
            this.framesSinceLastFpsUpdate = 0;
        }

        this.framesSinceLastFpsUpdate += 1;
        this.numberOfUpdateSteps = 0;

        while (this.frameDelta >= this.simulationTimestep) {
            this.update(this.simulationTimestep);
            this.frameDelta -= this.simulationTimestep;

            this.numberOfUpdateSteps += 1;

            if (this.numberOfUpdateSteps >= 240) {
                this.panic = true;

                break;
            }
        }

        this.draw(this.frameDelta / this.simulationTimestep);

        this.end(this.fps, this.panic);

        this.panic = false;
    }

    private createRequestAnimationFrameFallback(): (callback: (delta?: number) => void) => NodeJS.Timer {
        let lastTimestamp: number = Date.now();
        let now: number = null;
        let timeout: number = null;

        return (callback: (delta?: number) => void): NodeJS.Timer => {
            now = Date.now();

            timeout = Math.max(0, this.simulationTimestep - (now - lastTimestamp));
            lastTimestamp = now + timeout;

            return setTimeout(() => {
                callback(now + timeout);
            }, timeout);
        };
    }
}

export default Mainloop;
