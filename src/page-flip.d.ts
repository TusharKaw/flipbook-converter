// page-flip 2.x ships TypeScript sources but no distributable declarations.
// Keep the public API used by this reader typed without compiling vendor sources.
declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, string | number | boolean>);
    on(event: string, callback: (event: { data: string | number }) => void): void;
    loadFromHTML(pages: NodeListOf<HTMLElement>): void;
    getCurrentPageIndex(): number;
    getOrientation(): 'portrait' | 'landscape';
    getSettings(): { width: number; height: number };
    turnToPage(index: number): void;
    flipNext(): void;
    flipPrev(): void;
    update(): void;
    getState(): string;
    startUserTouch(point: { x: number; y: number }): void;
    userMove(point: { x: number; y: number }, isTouch: boolean): void;
    userStop(point: { x: number; y: number }, isSwipe?: boolean): void;
  }
}
