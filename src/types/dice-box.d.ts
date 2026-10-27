// @3d-dice/dice-box ne fournit pas de déclarations TypeScript.
declare module '@3d-dice/dice-box' {
  export default class DiceBox {
    constructor(config: Record<string, any>);
    init(): Promise<void>;
    roll(notation: string, options?: Record<string, any>): any;
    clear(): void;
  }
}
