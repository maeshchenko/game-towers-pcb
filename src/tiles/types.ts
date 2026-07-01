export type Port = 'N' | 'E' | 'S' | 'W'
export type TileType = 'straight' | 'corner' | 'fork' | 'bridge' | 'start' | 'finish' | 'empty'
export type Rot = 0 | 90 | 180 | 270
export type ForkRule = 'split5050' | 'byType' | 'timer' | 'membrane'
export interface Tile { type: TileType; rot: Rot; forkRule?: ForkRule }
export interface TileGrid { tileSize: number; tcols: number; trows: number; tiles: Tile[] }
