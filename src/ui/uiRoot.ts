// Single mount point for all DOM UI. Everything the game creates must live inside
// #game-container (it is the element rotated 90° in mobile portrait mode), but hijacking
// document.body.appendChild globally broke third-party scripts and hid real geometry —
// so UI modules call mountUi()/unmountUi() explicitly instead.

export function uiRoot(): HTMLElement {
  return document.getElementById('game-container') ?? document.body
}

export function mountUi<T extends Node>(node: T): T {
  return uiRoot().appendChild(node)
}

export function unmountUi(node: Node): void {
  node.parentNode?.removeChild(node)
}
